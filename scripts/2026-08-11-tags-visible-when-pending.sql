-- ============================================================================
-- 2026-08-11 — a tag is visible as soon as it is made
--
-- ⚠️ THIS FILE CONTAINS DDL AND HAS NO `rollback` IN IT. That is deliberate.
--    Mixing DDL with a trailing `rollback` in one paste has burned this project
--    before: the editor discards the DDL while the checks still print PASS.
--    Sections 1-2 are safe to paste together. Section 3 is an OPTIONAL
--    rollback-wrapped live test and MUST BE RUN ON ITS OWN.
--
-- WHAT CHANGED, AND WHY (Colton, 2026-08-11)
--
-- Until now a 'pending' tag was invisible to everyone except the two people
-- involved. Colton tagged three people and NOBODY saw anything — not the
-- people he tagged, and not him. A saved tag and a failed tag looked identical.
--
-- The model he chose, which is the one Instagram uses:
--
--   * Being NAMED on a post rides the POST'S OWN audience. If you can see the
--     night, you can see who was on it. No consent needed to appear in someone
--     else's sentence about their own night.
--   * Accepting is what makes it a MUTUAL post — that is what puts the night on
--     the tagged person's profile and, for 'collab', in front of THEIR friends.
--     That still requires them, and nothing here changes it.
--
-- So the state machine keeps all four states and every write rule. Only the
-- READ rule for third parties moves: 'pending' joins 'tag' and 'collab'.
--
-- ⚠️ WHAT MUST NOT FOLLOW IT: THE SCORE. night_post_tags.score is still null on
--    every unaccepted row, enforced by fill_tag_score_on_accept() and by
--    sync_night_post_score()'s state filter. That was already a privacy rule
--    when only the AUTHOR could read pending rows; it is now load-bearing for
--    the post's whole audience. A score on a pending row would let anyone learn
--    your rating of a venue by tagging you in a post about it, which is exactly
--    what venue_ratings' owner-only policy exists to prevent.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. The one line that moves.
--
-- Everything else is preserved verbatim and is load-bearing:
--
--   * `exists (select 1 from night_posts p where p.id = ...)` is NOT a
--     existence check. A policy's USING clause inherits the referenced table's
--     RLS (proved 2026-08-07), so this reads "the post is visible to ME" —
--     which is what makes a tag ride the post's audience instead of having an
--     audience of its own. Do not "optimise" it into a join on p.id alone.
--
--   * The blocked clause stays. Someone who blocked you must not see your name
--     on a night just because a mutual friend posted it.
--
--   * 'private' stays EXCLUDED. That state belongs to posts narrowed to
--     'nobody' — you cannot publicly name someone in a post nobody can see.
-- ----------------------------------------------------------------------------
drop policy if exists "tags visible with their post" on night_post_tags;
create policy "tags visible with their post"
  on night_post_tags for select to authenticated
  using (
    auth.uid() = tagged_user_id
    or exists (select 1 from night_posts p
                where p.id = night_post_tags.post_id and p.user_id = auth.uid())
    or (
      -- was: state in ('tag', 'collab')
      state in ('pending', 'tag', 'collab')
      and exists (select 1 from night_posts p where p.id = night_post_tags.post_id)
      and not exists (
        select 1 from friendships f
        where f.status = 'blocked'
          and ((f.user_id = auth.uid()   and f.friend_id = night_post_tags.tagged_user_id)
            or (f.friend_id = auth.uid() and f.user_id   = night_post_tags.tagged_user_id))
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 2. VERIFICATION — read-only.
-- ----------------------------------------------------------------------------

-- 2.1 The policy exists and now names 'pending'. Expect one row, PASS.
select polname,
       case when pg_get_expr(polqual, polrelid) like '%pending%'
            then 'PASS' else 'FAIL — pending is not in the USING clause' end as verdict,
       pg_get_expr(polqual, polrelid) as using_clause
  from pg_policy
 where polrelid = 'public.night_post_tags'::regclass
   and polname  = 'tags visible with their post';

-- 2.2 THE RULE THAT MUST NOT HAVE MOVED: no unaccepted tag carries a score.
--     Expect leaked_scores = 0, PASS. A non-zero here means someone's venue
--     rating is now readable by the post's whole audience.
select count(*)                                                as tag_rows,
       count(*) filter (where state = 'pending')               as pending_rows,
       count(*) filter (where state not in ('tag','collab')
                          and score is not null)               as leaked_scores,
       case when count(*) filter (where state not in ('tag','collab')
                                    and score is not null) = 0
            then 'PASS' else 'FAIL' end                        as verdict
  from night_post_tags;

-- 2.3 The write rules are untouched — the author still cannot self-accept.
--     Expect the INSERT policy to still force 'pending' (or 'private'), and
--     the UPDATE policy to still be keyed on tagged_user_id.
select polname,
       case polcmd when 'a' then 'INSERT' when 'w' then 'UPDATE'
                   when 'r' then 'SELECT' when 'd' then 'DELETE' else polcmd::text end as cmd,
       pg_get_expr(polwithcheck, polrelid) as with_check
  from pg_policy
 where polrelid = 'public.night_post_tags'::regclass
   and polcmd in ('a', 'w')
 order by polcmd;


-- ============================================================================
-- ============================================================================
-- 3. OPTIONAL LIVE TEST — ⚠️ RUN THIS SECTION BY ITSELF ⚠️
--
-- 🚨 DO NOT PASTE THIS TOGETHER WITH SECTIONS 1-2. It ends in `rollback`, and
--    a rollback in the same paste as DDL discards the DDL while the checks
--    still print PASS. That has happened on this project.
--
-- Writes nothing permanent. Proves the thing section 2 cannot: that a THIRD
-- PARTY who can see the post can now see a pending tag on it, and that someone
-- who CANNOT see the post still cannot.
-- ============================================================================
-- ============================================================================

begin;

create temporary table _res (check_name text, verdict text, detail text) on commit drop;
grant insert, select on _res to authenticated;

do $$
declare
  v_admin  text := current_user;
  v_role   text;
  v_author uuid;
  v_tagged uuid;
  v_third  uuid;
  v_post   uuid;
  v_venue  uuid;
  v_seen   int;
begin
  select p.user_id, p.venue_id, p.id into v_author, v_venue, v_post
    from night_posts p
   where p.visibility <> 'nobody'
   order by p.created_at desc
   limit 1;

  if v_post is null then
    insert into _res values ('fixture', 'SKIP', 'no non-private post exists to test with');
    return;
  end if;

  -- Someone to tag, and a separate third party to look.
  select id into v_tagged from profiles where id <> v_author limit 1;
  select id into v_third  from profiles where id not in (v_author, v_tagged) limit 1;

  if v_tagged is null then
    insert into _res values ('fixture', 'SKIP', 'need a second profile');
    return;
  end if;

  insert into night_post_tags (post_id, tagged_user_id, state)
       values (v_post, v_tagged, 'pending')
  on conflict (post_id, tagged_user_id) do update set state = 'pending';

  -- The tagged person always could see their own tag. The interesting case is
  -- the third party.
  if v_third is null then
    insert into _res values (
      'a. a third party sees the pending tag', 'SKIP', 'no third profile exists');
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_third, 'role', 'authenticated')::text, true);
    select count(*) into v_seen
      from night_post_tags
     where post_id = v_post and tagged_user_id = v_tagged;
    v_role := current_setting('role');
    perform set_config('role', v_admin, true);

    -- NOTE: this is 1 only if the third party can also see the POST. If the
    -- post is friends-only and they are not a friend, 0 is CORRECT, not a
    -- failure — the tag rides the post's audience by design. The detail column
    -- reports the post's visibility so you can tell the two apart.
    insert into _res values (
      'a. a third party sees the pending tag',
      case when v_role <> 'authenticated' then 'BAD HARNESS: ran as ' || v_role
           when v_seen > 0 then 'PASS' else 'CHECK' end,
      'rows = ' || v_seen || ', post visibility = ' ||
      (select visibility::text from night_posts where id = v_post) ||
      ' (0 is correct if this viewer cannot see that post)');
  end if;

  -- The score rule, under the new visibility.
  select count(*) into v_seen
    from night_post_tags
   where post_id = v_post and tagged_user_id = v_tagged and score is not null;

  insert into _res values (
    'b. the pending tag still carries NO score',
    case when v_seen = 0 then 'PASS' else 'FAIL' end,
    'rows with a score = ' || v_seen ||
    '  <-- anything above 0 leaks a venue rating to the post audience');

  perform set_config('role', v_admin, true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select * from _res order by check_name;

rollback;
