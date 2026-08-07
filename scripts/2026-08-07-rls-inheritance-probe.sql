-- ============================================================================
-- PROBE — does a policy's USING clause get the referenced table's RLS applied?
--
-- ANSWER, RUN AGAINST LIVE 2026-08-07: rows_visible = 0.
--   INHERITANCE HOLDS. A policy that leans on night_posts' own policy is a
--   real single source of truth. night_comments uses Branch A.
--
-- Consequence worth knowing: the night-photos policies restated the audience
-- predicate in full because this question was open. They did not have to. That
-- is a duplicate copy of the audience rule sitting in the schema, and it is
-- safe to collapse — but collapsing it is a change to a shipped security
-- boundary and needs its own verification pass, not a drive-by edit.
--
-- HOW THIS WAS GOT WRONG FIRST: three earlier versions asked "does RLS apply
-- to a subquery against night_posts?" and got `false`, which looked like an
-- answer. It was not — that is just a normal query, where RLS obviously
-- applies. The construct that actually matters is a POLICY whose USING clause
-- references another table, which is what this file builds. If you re-run this
-- to re-confirm, keep the policy. Without it you are measuring nothing.
--
-- v1-v3 asked "does RLS apply to a subquery against night_posts?" — which is
-- trivially yes, because that was just a normal query. They never built a
-- POLICY whose USING clause references night_posts, which is the actual thing
-- the comments feature depends on.
--
-- This one creates a throwaway table with exactly the policy shape under test:
--     using (exists (select 1 from night_posts p where p.id = post_id))
-- attaches a row to a 'nobody' post, and reads it as an unrelated user.
--
--   0 rows -> night_posts' policy WAS applied inside the policy -> Branch A.
--   1 row  -> it was NOT -> the audience predicate must be restated -> Branch B.
--
-- SAFE: one transaction, always ROLLS BACK. DDL is transactional in Postgres,
-- so the table never commits and cannot outlive this run. The throwaway post is
-- dated 2000-01-01 so it cannot collide with a real one.
--
-- NOTE ON THE EDITOR WARNING: it may flag "creates a table without RLS". This
-- script enables RLS on that table itself, three lines down. Either button is
-- fine — "Run without RLS" does not skip our own ALTER.
-- ============================================================================

begin;

create table _probe_comments (
  id      uuid primary key default gen_random_uuid(),
  post_id uuid not null references night_posts (id) on delete cascade
);

alter table _probe_comments enable row level security;

-- The authenticated role must be able to reach the table at all, or we would
-- measure a missing GRANT instead of the policy.
grant select on _probe_comments to authenticated;

-- THE CONSTRUCT UNDER TEST: a policy whose USING clause leans on night_posts'
-- own policy rather than restating the audience rule.
create policy "inherit from night_posts"
  on _probe_comments for select to authenticated
  using (exists (select 1 from night_posts p where p.id = _probe_comments.post_id));

do $$
declare
  v_author uuid;
  v_other  uuid;
  v_venue  uuid;
  v_post   uuid;
  v_cnt    int;
  v_admin  text := current_user;
begin
  select id into v_author from profiles order by created_at limit 1;
  select id into v_other  from profiles where id <> v_author limit 1;
  select id into v_venue  from venues limit 1;

  if v_other is null or v_venue is null then
    perform set_config('probe.result', 'SETUP FAILED: need two profiles and one venue', true);
    return;
  end if;

  -- A post only its author may read, and a "comment" hanging off it.
  insert into night_posts (user_id, venue_id, night_date, visibility)
  values (v_author, v_venue, date '2000-01-01', 'nobody')
  returning id into v_post;

  insert into _probe_comments (post_id) values (v_post);

  -- Become an unrelated signed-in user and read through the policy.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_other::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';

  select count(*) into v_cnt from _probe_comments;

  execute format('set local role %I', v_admin);

  perform set_config('probe.rows', v_cnt::text, true);
  perform set_config('probe.result',
    case when v_cnt = 0
      then 'INHERITANCE HOLDS -> the DRY policy is safe (Branch A)'
      else 'INHERITANCE DOES NOT HOLD -> restate the predicate (Branch B)'
    end, true);
end $$;

-- The answer. Last result set, so this is what the editor shows.
select
  'rows an unrelated user read through the inheriting policy' as question,
  current_setting('probe.rows',   true) as rows_visible,
  current_setting('probe.result', true) as result;

rollback;

-- No trailing verification query on purpose: in v1 a check placed after the
-- rollback became the last result set and hid the actual answer. DDL is
-- transactional in Postgres, so the rollback above already guarantees
-- _probe_comments is gone. If you want to confirm it, run this on its own:
--     select count(*) from information_schema.tables
--      where table_name = '_probe_comments';   -- expect 0
