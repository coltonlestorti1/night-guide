-- ============================================================================
-- 2026-08-10 — night_post_tags.score: YOUR score on a card you were tagged in
--
-- Additive and idempotent. Safe to run more than once.
--
-- ⚠️ THIS FILE CONTAINS DDL AND HAS NO `rollback` IN IT. That is deliberate.
--    Mixing DDL with a trailing `rollback` in one paste has burned this project
--    before: the Supabase SQL editor discarded the DDL while the verification
--    output still printed PASS, so the change looked applied and was not.
--    Sections 1-4 below are the real change plus read-only checks — paste them
--    together. Section 5 is an OPTIONAL rollback-wrapped live test and MUST BE
--    PASTED AND RUN ON ITS OWN, never appended to sections 1-4.
--
-- WHY A COLUMN AND NOT A JOIN
-- Same reason night_posts.score exists (see "night_posts.score ↔ venue_ratings
-- sync" in endz-schema.sql): venue_ratings is owner-only at the RLS level and
-- stays that way. A friend looking at a post cannot read anyone's ratings. So
-- for a TAGGED person's score to render to anybody but themselves, it has to
-- live on a row the viewer can already read — and that row is the tag.
--
-- No new RLS policy is needed or wanted. The column rides night_post_tags'
-- existing policies, so it is readable by exactly whoever can already read the
-- tag — which is the same audience that decides whether the post is visible at
-- all.
--
-- WHY IT MUST BE TRIGGER-MAINTAINED
-- A score is a RENDERING of a moving ranking, not a fact: ranking.ts spreads a
-- bucket's band across its members, so every score in a bucket moves whenever
-- the bucket grows or shrinks. A copy written once at tag time would freeze
-- exactly the way night_posts.score froze before 2026-08-10 (The Grafton read
-- 9.2 in /lists and 8.4 on its own post). The sync therefore lives in the
-- database, in the trigger that already does this job for night_posts, so no
-- future write path can forget it.
--
-- CLIENT CACHE IS NOT OPTIONAL. A DB trigger is invisible to react-query. The
-- new query keys (authored-posts, tagged-posts) must join POST_SCORE_KEYS in
-- src/hooks/useMyRatings.ts, or a tagged card keeps its old ring until reload.
-- That is application work and is NOT part of this script.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The column.
--
-- NULLABLE ON PURPOSE. "tagged but never rated" is a legitimate, expected and
-- permanent state — being out with someone is not an obligation to rank the
-- place. A null here renders as no circle, the same as an unrated post.
--
-- Left as bare `numeric` (the shape the design specifies) rather than
-- night_posts.score's numeric(3,1) + 0..10 check. Every value that can reach
-- this column is copied from venue_ratings.score, which is already
-- numeric(3,1) check (score >= 0 and score <= 10), so the range is enforced at
-- the source. Noted rather than silently "improved": if you would rather this
-- column restate the constraint, that is a separate, deliberate decision.
-- ---------------------------------------------------------------------------
alter table public.night_post_tags add column if not exists score numeric;


-- ---------------------------------------------------------------------------
-- 2. The sync trigger, extended.
--
-- The night_posts half of this function is UNCHANGED — same statements, same
-- delete-sets-null branch, same WHERE keys. Only two things are new: the
-- night_post_tags updates, and the security clause explained below.
--
-- night_post_tags has no venue_id of its own (its PK is (post_id,
-- tagged_user_id)), so the venue comes from the post: update every tag row
-- naming this user whose post is for this venue.
--
-- 🚨 WHY THE TAG UPDATE IS RESTRICTED TO ACCEPTED STATES — DO NOT WIDEN IT.
-- Two separate reasons, and the second is a privacy boundary.
--
-- 1. It would RAISE. night_post_tags' UPDATE policy is:
--
--        create policy "tagged person decides"
--          on night_post_tags for update to authenticated
--          using (auth.uid() = tagged_user_id)
--          with check (auth.uid() = tagged_user_id and state in ('tag','collab'));
--
--    A row failing USING is silently skipped, but a row that passes USING and
--    fails WITH CHECK RAISES. A user holding a 'pending' or 'private' tag on a
--    post for a venue they then rate passes USING (they are tagged_user_id)
--    and fails WITH CHECK — and that error aborts their venue_ratings write.
--    Rating a spot would fail outright, for the ordinary case of a tag you
--    have not answered yet.
--
-- 2. It would LEAK THE RATING. This is the reason that matters. The SELECT
--    policy "tags visible with their post" lets the POST'S AUTHOR read every
--    tag row on their own post in ANY state, including 'pending':
--
--        or exists (select 1 from night_posts p
--                    where p.id = night_post_tags.post_id and p.user_id = auth.uid())
--
--    So a score written onto a pending row is readable by whoever tagged you —
--    before you accept, and still there if you decline. venue_ratings is
--    owner-only precisely so that no one can read what you thought of a place.
--    Anyone could then learn your rating of any venue simply by tagging you in
--    a post about it.
--
-- Restricting to state in ('tag','collab') answers both at once, and it needs
-- NO privilege elevation: those rows pass WITH CHECK, so the function stays
-- `security invoker` exactly as it shipped. An earlier draft of this script
-- reached for `security definer` to silence reason 1 and would have opened
-- reason 2.
--
-- The consequence to keep in mind: accepting a tag for a venue you had ALREADY
-- rated leaves score null, because no venue_ratings row changes at accept
-- time. Section 2b fills it at the moment of acceptance.
--
-- search_path: the previous definition pinned NOTHING. Now pinned to
-- `public, pg_temp` per the 2026-08-09 hardening rule — pg_temp is searched
-- FIRST when unlisted, so an unpinned body can have public.<table> shadowed by
-- a caller's temp table. Harmless here today, but it costs nothing and this is
-- the one place the function is being rewritten.
-- ---------------------------------------------------------------------------
create or replace function public.sync_night_post_score()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (tg_op = 'DELETE') then
    -- The rating is gone: both snapshots go back to null, and PostCard's verb
    -- falls back from "ranked" to "went to" — the rendering an unrated post
    -- already gets.
    update night_posts set score = null
     where user_id = old.user_id and venue_id = old.venue_id;

    update night_post_tags t set score = null
      from night_posts p
     where p.id = t.post_id
       and t.tagged_user_id = old.user_id
       and p.venue_id = old.venue_id
       and t.state in ('tag', 'collab')
       and t.score is not null;

    return old;
  end if;

  update night_posts set score = new.score
   where user_id = new.user_id and venue_id = new.venue_id;

  -- `is distinct from` on the tag branch only: a bucket rewrite fires this
  -- trigger once per member, and most of those members' scores did not
  -- actually change. Skipping the no-op write keeps a re-rank from churning
  -- unrelated tag rows. The night_posts statement above is left byte-identical
  -- to the shipped version on purpose — this script is not the place to
  -- retune it.
  update night_post_tags t set score = new.score
    from night_posts p
   where p.id = t.post_id
     and t.tagged_user_id = new.user_id
     and p.venue_id = new.venue_id
     and t.state in ('tag', 'collab')
     and t.score is distinct from new.score;

  return new;
end; $$;

-- The trigger binds by name, so replacing the function above is enough on a
-- live database. Restated anyway so this file stands alone.
drop trigger if exists trg_sync_night_post_score on venue_ratings;
create trigger trg_sync_night_post_score
after insert or update or delete on venue_ratings
for each row execute function public.sync_night_post_score();


-- ---------------------------------------------------------------------------
-- 2b. Fill the score at the moment of acceptance.
--
-- The trigger above only ever fires when a venue_ratings row CHANGES. Accepting
-- a tag for a venue you rated last month changes no rating, so without this the
-- card would sit there scoreless until you happened to re-rate the place.
--
-- BEFORE, so it assigns new.score directly rather than issuing a second UPDATE
-- against the row currently being updated. WITH CHECK is evaluated after BEFORE
-- triggers run and constrains only tagged_user_id and state, so setting score
-- here cannot trip it.
--
-- security INVOKER on purpose: it reads venue_ratings as the tagged person, and
-- reading your OWN rating is exactly what the owner-only policy permits. A
-- definer here would let it read anyone's.
-- ---------------------------------------------------------------------------
create or replace function public.fill_tag_score_on_accept()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Only on the way INTO an accepted state, and only when the row does not
  -- already carry a score — re-running must not clobber a value the sync
  -- trigger has since moved.
  if new.state in ('tag', 'collab') and new.score is null then
    select r.score into new.score
      from venue_ratings r
      join night_posts p on p.id = new.post_id
     where r.user_id = new.tagged_user_id
       and r.venue_id = p.venue_id;
  end if;

  -- Leaving an accepted state drops the score with it, so a tag reverted to
  -- 'pending' or 'private' stops carrying the rating it must not expose.
  if new.state not in ('tag', 'collab') then
    new.score := null;
  end if;

  return new;
end; $$;

drop trigger if exists trg_fill_tag_score_on_accept on night_post_tags;
create trigger trg_fill_tag_score_on_accept
before insert or update on night_post_tags
for each row execute function public.fill_tag_score_on_accept();


-- ---------------------------------------------------------------------------
-- 3. One-time backfill.
--
-- Mirrors the two night_posts backfills in endz-schema.sql: one statement for
-- "this person has a rating, copy it", one for "this person has no rating,
-- clear a stale value". Both are safe to re-run — they are no-ops once true.
-- ---------------------------------------------------------------------------

-- 3a. ACCEPTED tag rows whose person has rated the post's venue.
--
--     The state filter is the same privacy boundary as section 2, and it
--     matters more here: this statement runs as the schema owner, so RLS will
--     not stop it writing a score onto a pending row that the post's author
--     can then read. Do not drop it.
update night_post_tags t set score = r.score
  from night_posts p
  join venue_ratings r on r.venue_id = p.venue_id
 where p.id = t.post_id
   and r.user_id = t.tagged_user_id
   and t.state in ('tag', 'collab')
   and t.score is distinct from r.score;

-- 3b. Everything that must NOT be carrying a score: rows whose person has no
--     rating for that venue, and rows that are not in an accepted state.
update night_post_tags t set score = null
 where t.score is not null
   and (
     t.state not in ('tag', 'collab')
     or not exists (
       select 1
         from night_posts p
         join venue_ratings r
           on r.venue_id = p.venue_id and r.user_id = t.tagged_user_id
        where p.id = t.post_id)
   );


-- ---------------------------------------------------------------------------
-- 4. VERIFICATION — read-only. Paste with sections 1-3; nothing here writes.
--
-- The Supabase SQL editor shows only the LAST result set, so run 4.1-4.5 one
-- at a time (or read them from the multi-result view if your client shows all).
-- ---------------------------------------------------------------------------

-- 4.1 The column exists and is nullable.
--     Expect exactly one row: score | numeric | YES.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'night_post_tags'
   and column_name  = 'score';

-- 4.2 Both functions are INVOKER-rights and pin pg_temp.
--     Expect two rows, both security_definer = false, both PASS.
--
--     security_definer = true here is a FAILURE, not an upgrade: see the
--     banner in section 2. A definer sync would write scores onto pending tag
--     rows, which the post's author is allowed to read.
select p.proname,
       p.prosecdef as security_definer,
       p.proconfig,
       case when not p.prosecdef
             and p.proconfig::text like '%pg_temp%' then 'PASS' else 'FAIL' end as verdict
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('sync_night_post_score', 'fill_tag_score_on_accept')
 order by p.proname;

-- 4.3 The trigger is still bound to venue_ratings for all three events.
--     Expect trg_sync_night_post_score, enabled 'O', INSERT OR DELETE OR UPDATE.
select t.tgname,
       t.tgenabled,
       pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
 where t.tgrelid = 'public.venue_ratings'::regclass
   and not t.tgisinternal
 order by t.tgname;

-- 4.3b The accept-time trigger is bound to night_post_tags, BEFORE insert or
--      update. AFTER would be useless — it assigns new.score.
select t.tgname,
       t.tgenabled,
       pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
 where t.tgrelid = 'public.night_post_tags'::regclass
   and not t.tgisinternal
 order by t.tgname;

-- 4.4 THE PROOF, as counts. Every tag row is joined to its post's venue and to
--     that tagged person's rating of that venue (left join — most people have
--     not rated most venues).
--
--     accepted_wrong  : ACCEPTED row, person HAS a rating, tag score does not
--                       match it
--     accepted_stale  : ACCEPTED row, person has NO rating, tag score not null
--     unaccepted_leak : row is pending/private and carries a score at all.
--                       This is the privacy check — see the banner in section
--                       2. It must be 0, and a non-zero here means someone's
--                       rating is readable by whoever tagged them.
--
--     All three must be 0. accepted_with_a_rating / accepted_without_a_rating
--     tell you whether the live data actually contains both cases — if either
--     is 0, this query cannot demonstrate that case and you want section 5.
select
  count(*)                                                                  as tag_rows,
  count(*) filter (where t.state in ('tag','collab'))                       as accepted_rows,
  count(*) filter (where t.state in ('tag','collab')
                     and r.score is not null)                               as accepted_with_a_rating,
  count(*) filter (where t.state in ('tag','collab')
                     and r.score is null)                                   as accepted_without_a_rating,
  count(*) filter (where t.state in ('tag','collab')
                     and r.score is not null
                     and t.score is distinct from r.score)                  as accepted_wrong,
  count(*) filter (where t.state in ('tag','collab')
                     and r.score is null and t.score is not null)           as accepted_stale,
  count(*) filter (where t.state not in ('tag','collab')
                     and t.score is not null)                               as unaccepted_leak,
  case when count(*) filter (where t.state in ('tag','collab')
                               and r.score is not null
                               and t.score is distinct from r.score) = 0
        and count(*) filter (where t.state in ('tag','collab')
                               and r.score is null
                               and t.score is not null) = 0
        and count(*) filter (where t.state not in ('tag','collab')
                               and t.score is not null) = 0
       then 'PASS' else 'FAIL' end                                          as verdict
  from night_post_tags t
  join night_posts p    on p.id = t.post_id
  left join venue_ratings r on r.user_id = t.tagged_user_id
                           and r.venue_id = p.venue_id;

-- 4.5 THE PROOF, to eyeball. Rated tags first, unrated after, so both required
--     cases are visible in one screen:
--       * a tag row whose person HAS rated the venue carries that exact score
--       * a tag row whose person has NOT rated it carries null
--     Every verdict should read 'ok — ...'. Any 'MISMATCH' is a real failure.
select v.name                as venue,
       pr.username           as tagged_person,
       t.state,
       t.score               as tag_score,
       r.score               as their_actual_rating,
       case
         when r.score is null and t.score is null then 'ok — not rated, null'
         when r.score is null and t.score is not null then 'MISMATCH — stale score, no rating'
         when t.score = r.score then 'ok — matches rating'
         else 'MISMATCH — score drifted from rating'
       end                   as verdict
  from night_post_tags t
  join night_posts p  on p.id  = t.post_id
  join venues v       on v.id  = p.venue_id
  join profiles pr    on pr.id = t.tagged_user_id
  left join venue_ratings r on r.user_id = t.tagged_user_id
                           and r.venue_id = p.venue_id
 order by (r.score is null), v.name, pr.username
 limit 40;


-- ============================================================================
-- ============================================================================
-- 5. OPTIONAL LIVE TRIGGER TEST — ⚠️ RUN THIS SECTION BY ITSELF ⚠️
--
-- 🚨 DO NOT PASTE THIS TOGETHER WITH SECTIONS 1-3. It ends in `rollback`, and
--    a rollback in the same paste as DDL discards the DDL while the checks
--    below still print PASS. That exact failure has happened on this project.
--    Sequence: paste 1-4, confirm 4.2/4.4 read PASS, THEN paste 5 on its own.
--
-- Everything in section 5 runs inside one transaction that rolls back. The
-- fixture post, the fixture tag and the rating edits never persist.
--
-- It DOES temporarily edit and then delete one REAL venue_ratings row (the most
-- recently rated one) — that is the only way to fire a trigger on real data.
-- The rollback undoes it, along with the night_posts.score change that same
-- trigger makes. Do not run section 5 outside a transaction, and do not
-- "helpfully" change the trailing `rollback` to `commit`.
--
-- Section 4 proves the STATE is consistent. Section 5 proves the TRIGGERS are
-- what keep it that way: that a pending tag never carries a score, that
-- accepting fills one, and that a rating change and a rating delete both
-- follow through.
-- ============================================================================
-- ============================================================================

begin;

create temporary table _res (check_name text, verdict text, detail text) on commit drop;
grant insert, select on _res to authenticated;

do $$
declare
  v_admin  text := current_user;   -- restored before every _res write
  v_role   text;                   -- role captured AT the impersonated op
  v_rater  uuid;
  v_venue  uuid;
  v_author uuid;
  v_post   uuid;
  v_before numeric;
  v_after  numeric;
  v_tag    numeric;
begin
  -- Fixture: a real person who really has a rating. Nothing is invented —
  -- profiles.id references auth.users, so actors must be discovered.
  select user_id, venue_id, score into v_rater, v_venue, v_before
    from venue_ratings
   order by rated_at desc
   limit 1;

  if v_rater is null then
    insert into _res values ('fixture', 'SKIP', 'no venue_ratings rows exist to test with');
    return;
  end if;

  select id into v_author from profiles where id <> v_rater limit 1;
  if v_author is null then
    insert into _res values ('fixture', 'SKIP', 'need a second profile to author the post');
    return;
  end if;

  -- night_date 2000-01-01 so the fixture can never collide with the real
  -- unique (user_id, venue_id, night_date) on night_posts.
  insert into night_posts (user_id, venue_id, night_date, visibility)
       values (v_author, v_venue, date '2000-01-01', 'friends')
    returning id into v_post;

  -- 'pending' ON PURPOSE, and it stays that way for the first three checks.
  -- Pending is the state RLS WITH CHECK rejects on update, so it is the state
  -- that would break rating writes if the sync ever stopped filtering on
  -- state — and it is the state that must never carry a score.
  insert into night_post_tags (post_id, tagged_user_id, state)
       values (v_post, v_rater, 'pending');

  select score into v_tag
    from night_post_tags
   where post_id = v_post and tagged_user_id = v_rater;

  insert into _res values (
    'a. PENDING tag carries no score on insert',
    case when v_tag is null then 'PASS' else 'FAIL' end,
    'tag score = ' || coalesce(v_tag::text, 'null') ||
    '  <-- non-null leaks the rating to whoever tagged them');

  v_after := case when v_before = 1.1 then 2.2 else 1.1 end;

  -- Become the rater and move their rating exactly as the app does.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_rater, 'role', 'authenticated')::text,
                     true);
  begin
    update venue_ratings set score = v_after
     where user_id = v_rater and venue_id = v_venue;
    v_role := current_setting('role');   -- captured AT the op, not after
    perform set_config('role', v_admin, true);
    insert into _res values (
      'b. rating write survives a PENDING tag on the same venue',
      case when v_role = 'authenticated' then 'PASS'
           else 'BAD HARNESS: ran as ' || v_role end,
      'no RLS error raised; role at op was ' || v_role);
  exception when others then
    v_role := current_setting('role');
    perform set_config('role', v_admin, true);
    insert into _res values (
      'b. rating write survives a PENDING tag on the same venue',
      case when v_role = 'authenticated' then 'FAIL'
           else 'BAD HARNESS: ran as ' || v_role end,
      sqlstate || ' ' || sqlerrm ||
      '  <-- 42501 here means the sync stopped filtering on state');
  end;
  perform set_config('role', v_admin, true);
  perform set_config('request.jwt.claims', '', true);

  select score into v_tag
    from night_post_tags
   where post_id = v_post and tagged_user_id = v_rater;

  insert into _res values (
    'c. PENDING tag still has no score after the rating moved',
    case when v_tag is null then 'PASS' else 'FAIL' end,
    'tag score = ' || coalesce(v_tag::text, 'null') ||
    ', rating is now ' || v_after::text);

  -- Accept it, as the tagged person, exactly as the app does. The BEFORE
  -- trigger has to fill the score here: no venue_ratings row changes at accept
  -- time, so the sync trigger cannot possibly fire.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_rater, 'role', 'authenticated')::text,
                     true);
  begin
    update night_post_tags set state = 'collab'
     where post_id = v_post and tagged_user_id = v_rater;
    v_role := current_setting('role');
    perform set_config('role', v_admin, true);
    insert into _res values (
      'd. accepting is permitted for the tagged person',
      case when v_role = 'authenticated' then 'PASS'
           else 'BAD HARNESS: ran as ' || v_role end,
      'role at op was ' || v_role);
  exception when others then
    v_role := current_setting('role');
    perform set_config('role', v_admin, true);
    insert into _res values (
      'd. accepting is permitted for the tagged person',
      case when v_role = 'authenticated' then 'FAIL'
           else 'BAD HARNESS: ran as ' || v_role end,
      sqlstate || ' ' || sqlerrm);
  end;
  perform set_config('role', v_admin, true);
  perform set_config('request.jwt.claims', '', true);

  select score into v_tag
    from night_post_tags
   where post_id = v_post and tagged_user_id = v_rater;

  insert into _res values (
    'e. ACCEPTING fills the score from the existing rating',
    case when v_tag = v_after then 'PASS' else 'FAIL' end,
    'tag score = ' || coalesce(v_tag::text, 'null') ||
    ', expected ' || v_after::text ||
    '  <-- null here means fill_tag_score_on_accept did not fire');

  -- Now that it is accepted, the sync trigger owns it.
  v_after := case when v_after = 1.1 then 3.3 else 1.1 end;
  update venue_ratings set score = v_after
   where user_id = v_rater and venue_id = v_venue;

  select score into v_tag
    from night_post_tags
   where post_id = v_post and tagged_user_id = v_rater;

  insert into _res values (
    'f. UPDATE propagates to an ACCEPTED tag',
    case when v_tag = v_after then 'PASS' else 'FAIL' end,
    'tag score = ' || coalesce(v_tag::text, 'null') ||
    ', rating now = ' || v_after::text ||
    ' (was ' || coalesce(v_before::text, 'null') || ')');

  -- Delete branch: the score must go back to null, not linger.
  delete from venue_ratings where user_id = v_rater and venue_id = v_venue;

  select score into v_tag
    from night_post_tags
   where post_id = v_post and tagged_user_id = v_rater;

  insert into _res values (
    'g. DELETE nulls an ACCEPTED tag score',
    case when v_tag is null then 'PASS' else 'FAIL' end,
    'tag score after rating delete = ' || coalesce(v_tag::text, 'null'));

  -- And the untagged-person case, on the same fixture post: an ACCEPTED tag
  -- for someone with no rating for this venue must carry null.
  select id into v_author
    from profiles
   where id <> v_rater
     and not exists (select 1 from venue_ratings r
                      where r.user_id = profiles.id and r.venue_id = v_venue)
   limit 1;

  if v_author is null then
    insert into _res values (
      'h. accepted tag for a person with no rating carries null', 'SKIP',
      'every profile has rated this venue — no candidate');
  else
    insert into night_post_tags (post_id, tagged_user_id, state)
         values (v_post, v_author, 'collab');
    select score into v_tag
      from night_post_tags
     where post_id = v_post and tagged_user_id = v_author;
    insert into _res values (
      'h. accepted tag for a person with no rating carries null',
      case when v_tag is null then 'PASS' else 'FAIL' end,
      'tag score = ' || coalesce(v_tag::text, 'null'));
  end if;
end $$;

-- Results LAST, immediately before the rollback — the editor shows only the
-- final result set, and nothing may follow the rollback.
select * from _res order by check_name;

rollback;
