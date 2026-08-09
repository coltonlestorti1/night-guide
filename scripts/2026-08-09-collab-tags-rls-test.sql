-- ============================================================================
-- RLS PROOF — collab tags (night_post_tags) + the collab OR-branch grafted
-- onto night_posts' SELECT policy.
--
-- SAFE: everything runs inside ONE transaction that ROLLS BACK. The fixture
-- posts, fixture tags, the fixture friendship edges and every role
-- impersonation are never committed. Nothing persists, and the script can be
-- re-run any number of times.
--
-- Structure copied deliberately from
-- scripts/2026-08-07-night-comments-rls-test.sql, the proven pattern in this
-- repo. Same harness rules, same reasons:
--
--   * EVERY SCENARIO RE-ESTABLISHES ITS OWN ROLE, immediately before its own
--     operation, via set_config('role', 'authenticated', true) +
--     set_config('request.jwt.claims', ...). Restoring admin to write a
--     result row silently ends impersonation; the next scenario that assumed
--     it was still someone else would run as admin and bypass RLS, producing
--     a false PASS. Also true for admin FIXTURE MUTATIONS between scenarios
--     (e.g. flipping a tag's state) — admin is restored before those too.
--   * role_at_op captures current_setting('role') AT the impersonated
--     operation, not at the _res write, and a role that was anything other
--     than 'authenticated' at that moment is surfaced as
--     'BAD HARNESS: ran as <role>' rather than PASS/FAIL — so a harness
--     mistake can never again be misread as a policy result.
--   * Admin is restored before every _res write, including inside every
--     exception handler.
--   * `grant insert, select on _res to authenticated;` is a fallback belt.
--   * The results query is LAST, immediately before `rollback`, and nothing
--     follows the rollback — the Supabase SQL editor only shows the final
--     result set.
--   * `raise notice` is not visible in the editor; every check surfaces as a
--     row in the final result set.
--   * night_date = date '2000-01-01' (far past) so fixture posts can never
--     collide with night_posts' unique (user_id, venue_id, night_date).
--
-- ---------------------------------------------------------------------------
-- Real-account discovery, and why friendship EDGES can be fabricated even
-- though profiles CANNOT.
--
-- profiles.id references auth.users, so no profile can be invented — every
-- actor below is a real row discovered by query. But the SPECIFIC graph this
-- feature needs (a friend of the collaborator who is a total stranger to the
-- author; someone who has blocked the author but is friends with the
-- collaborator; a plain friend of the author) is unlikely to already exist by
-- coincidence among a handful of real accounts. This script follows the same
-- move scripts/2026-08-07-night-comments-rls-test.sql made for its scenario 7
-- block edge: pick CLEAN real profiles (no pre-existing friendship row, in
-- either direction, against the people they need a specific relationship
-- with), then INSERT the exact friendship edges the graph needs AS ADMIN,
-- deliberately bypassing friendships' own RLS. This script proves
-- night_post_tags' and night_posts' policies, not friendships' INSERT policy,
-- exactly the same boundary the comments script drew.
--
-- "Clean" (no pre-existing row, either direction) is required, not optional:
-- a stray real 'blocked' row would falsely suppress a PASS, and a stray real
-- 'accepted' row would let a scenario pass for the wrong reason (the ordinary
-- friends/school branch) instead of the collab branch actually being proved.
--
-- Setup is staged so a missing piece SKIPS only the scenarios that need it,
-- not the whole file:
--   Gate 1 (core)      -> v_author, v_collaborator, v_friend_of_collab, 2
--                         venues. Needed by nearly everything (#1,2,3,6,7,8,
--                         9,10). If this fails, nothing below can run.
--   Gate 2 (blocker)   -> v_blocker. Needed only by #4.
--   Gate 3 (3rd party) -> v_third_party. Needed only by #5.
-- ============================================================================

begin;

create temp table _res(
  id         serial,
  n          int,    -- scenario number from the spec table, for final ordering
  scenario   text,
  expected   text,
  actual     text,
  role_at_op text,   -- current_setting('role') captured AT the impersonated
                      -- operation. NULL for SETUP FAILED/SKIP rows (which
                      -- never impersonate anyone) and for the one deliberate
                      -- ADMIN ground-truth check in #10 (verifying the post
                      -- row still physically exists is not itself an
                      -- RLS-gated assertion, so it is never impersonated).
  verdict    text
) on commit drop;

grant insert, select on _res to authenticated;

do $$
declare
  v_author            uuid;
  v_collaborator       uuid;  -- tagged on the main fixture post
  v_friend_of_collab   uuid;  -- accepted friend of v_collaborator ONLY —
                               -- clean (no pre-existing row, either
                               -- direction) against v_author
  v_blocker            uuid;  -- blocked v_author, accepted-friends with
                               -- v_collaborator
  v_third_party        uuid;  -- accepted friend of v_author, sees the post
                               -- via the ordinary friends branch
  v_venues             uuid[];
  v_post_friends       uuid;  -- visibility='friends', main fixture for #1-8,10
  v_post_nobody        uuid;  -- visibility='nobody', fixture for #9
  v_cnt                int;
  v_state              tag_state;
  v_role_at_op         text;
  v_admin              text := current_user;
  v_have_core          boolean := false;
  v_have_blocker       boolean := false;
  v_have_third_party   boolean := false;
begin
  -- ===========================================================================
  -- GATE 1 (core): v_author, v_collaborator, v_friend_of_collab, 2 venues.
  -- ===========================================================================
  select id into v_author from profiles order by id limit 1;

  if v_author is null then
    insert into _res (n, scenario, expected, actual, verdict)
    values (0, 'SETUP FAILED: no profiles exist at all', '-', '-', 'SKIP');
  else
    -- v_collaborator: distinct from author, clean against author (no
    -- pre-existing friendship row in either direction) — we will tag this
    -- person and never want a stray real block/accept edge to skew results.
    select p.id into v_collaborator
      from profiles p
     where p.id <> v_author
       and not exists (
         select 1 from friendships f
         where (f.user_id = v_author and f.friend_id = p.id)
            or (f.friend_id = v_author and f.user_id = p.id)
       )
     order by p.id limit 1;

    -- v_friend_of_collab: distinct from both, clean against v_author AND
    -- clean against v_collaborator (we are about to insert a real accepted
    -- edge to the latter and cannot risk a conflicting pre-existing row in
    -- either direction landing a stray 'blocked' status on the same pair).
    if v_collaborator is not null then
      select p.id into v_friend_of_collab
        from profiles p
       where p.id <> v_author and p.id <> v_collaborator
         and not exists (
           select 1 from friendships f
           where (f.user_id = v_author and f.friend_id = p.id)
              or (f.friend_id = v_author and f.user_id = p.id)
         )
         and not exists (
           select 1 from friendships f
           where (f.user_id = v_collaborator and f.friend_id = p.id)
              or (f.friend_id = v_collaborator and f.user_id = p.id)
         )
       order by p.id limit 1;
    end if;

    select array_agg(id) into v_venues from (select id from venues order by id limit 2) v;

    if v_collaborator is null then
      insert into _res (n, scenario, expected, actual, verdict)
      values (0, 'SETUP FAILED: no clean profile found for v_collaborator', '-', '-', 'SKIP');
    elsif v_friend_of_collab is null then
      insert into _res (n, scenario, expected, actual, verdict)
      values (0, 'SETUP FAILED: no clean profile found for v_friend_of_collab', '-', '-', 'SKIP');
    elsif v_venues is null or array_length(v_venues, 1) < 2 then
      insert into _res (n, scenario, expected, actual, verdict)
      values (0, 'SETUP FAILED: fewer than 2 venues exist', '-', '-', 'SKIP');
    else
      v_have_core := true;
    end if;
  end if;

  if v_have_core then
    -- Real accepted edge, v_friend_of_collab <-> v_collaborator. Inserted as
    -- admin, deliberately bypassing friendships' own INSERT policy — this
    -- script proves night_post_tags'/night_posts' policies, not friendships'.
    insert into friendships (user_id, friend_id, status)
    values (v_friend_of_collab, v_collaborator, 'accepted');

    -- Fixture posts, both authored by v_author. Inserted as admin, bypassing
    -- night_posts' own INSERT policy — this script tests SELECT/tag policies,
    -- not that one (it already has its own proof in
    -- scripts/2026-08-07-night-posts-rls-test.sql).
    insert into night_posts (user_id, venue_id, night_date, visibility)
    values (v_author, v_venues[1], date '2000-01-01', 'friends')
    returning id into v_post_friends;

    insert into night_posts (user_id, venue_id, night_date, visibility)
    values (v_author, v_venues[2], date '2000-01-01', 'nobody')
    returning id into v_post_nobody;

    -- The main fixture tag: v_collaborator tagged on the 'friends' post,
    -- starting 'collab'. Inserted as admin, bypassing night_post_tags' own
    -- INSERT policy (proved separately by scenario #8 below).
    insert into night_post_tags (post_id, tagged_user_id, state)
    values (v_post_friends, v_collaborator, 'collab');

    -- ---- #1: a friend of the COLLABORATOR (not of the author) reads a
    -- 'friends' post whose tag on that collaborator is state='collab'.
    -- Expect 1 row. This is the whole feature: night_posts' SELECT policy's
    -- new collab OR-branch joins night_post_tags to friendships on
    -- state='collab' AND an accepted friendship between viewer and
    -- tagged_user_id — v_friend_of_collab qualifies via that branch alone
    -- (they are NOT a friend of v_author, so the ordinary 'friends' branch is
    -- false; visibility='friends' so 'everyone'/'school' are also false).
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_friend_of_collab, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    select count(*) into v_cnt from night_posts where id = v_post_friends;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (1, 'friend of collaborator reads a friends post tagged collab', '1', v_cnt::text,
      v_role_at_op, case when v_cnt = 1 then 'PASS' else 'FAIL' end);

    -- ---- #4 (THE MOST IMPORTANT SCENARIO): a viewer who BLOCKED THE POST'S
    -- AUTHOR, but IS friends with the collaborator, reads the same 'collab'
    -- post. Expect 0 rows — collab must not be a way around a block.
    -- v_blocker's edges are set up here (part of Gate 2) so we can prove this
    -- while the tag is still 'collab', before later scenarios flip its state.
    select p.id into v_blocker
      from profiles p
     where p.id <> v_author and p.id <> v_collaborator and p.id <> v_friend_of_collab
       and not exists (
         select 1 from friendships f
         where (f.user_id = v_author and f.friend_id = p.id)
            or (f.friend_id = v_author and f.user_id = p.id)
       )
       and not exists (
         select 1 from friendships f
         where (f.user_id = v_collaborator and f.friend_id = p.id)
            or (f.friend_id = v_collaborator and f.user_id = p.id)
       )
     order by p.id limit 1;

    if v_blocker is null then
      insert into _res (n, scenario, expected, actual, verdict)
      values (4, 'SETUP FAILED: no clean profile found for v_blocker', '-', '-', 'SKIP');
    else
      v_have_blocker := true;

      -- v_blocker blocked v_author.
      insert into friendships (user_id, friend_id, status)
      values (v_blocker, v_author, 'blocked');
      -- v_blocker is accepted-friends with v_collaborator — WOULD qualify via
      -- the collab branch if the block gate did not apply first.
      insert into friendships (user_id, friend_id, status)
      values (v_blocker, v_collaborator, 'accepted');

      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_blocker, 'role', 'authenticated')::text, true);
      select current_setting('role', true) into v_role_at_op;
      select count(*) into v_cnt from night_posts where id = v_post_friends;
      perform set_config('role', v_admin, true);
      insert into _res (n, scenario, expected, actual, role_at_op, verdict)
      values (4, 'blocked-the-author viewer, friends with collaborator, reads collab post',
        '0', v_cnt::text, v_role_at_op, case when v_cnt = 0 then 'PASS' else 'FAIL' end);
    end if;

    -- ---- #2: same reader (v_friend_of_collab), tag flipped to state='tag'.
    -- Expect 0 rows — accepting a tag ('tag') must NOT widen the audience;
    -- only 'collab' does. The collab OR-branch's join explicitly requires
    -- state = 'collab', so 'tag' never matches it, and none of the other
    -- branches apply either (still not a friend of the author).
    perform set_config('role', v_admin, true);
    update night_post_tags set state = 'tag'
     where post_id = v_post_friends and tagged_user_id = v_collaborator;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_friend_of_collab, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    select count(*) into v_cnt from night_posts where id = v_post_friends;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (2, 'friend of collaborator reads a friends post tagged (state=tag, not collab)',
      '0', v_cnt::text, v_role_at_op, case when v_cnt = 0 then 'PASS' else 'FAIL' end);

    -- ---- #3: same reader, tag flipped to state='pending'. Expect 0 rows —
    -- same reasoning as #2, and this state is also left in place for #5.
    perform set_config('role', v_admin, true);
    update night_post_tags set state = 'pending'
     where post_id = v_post_friends and tagged_user_id = v_collaborator;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_friend_of_collab, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    select count(*) into v_cnt from night_posts where id = v_post_friends;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (3, 'friend of collaborator reads a friends post tagged pending',
      '0', v_cnt::text, v_role_at_op, case when v_cnt = 0 then 'PASS' else 'FAIL' end);

    -- ===========================================================================
    -- GATE 3 (3rd party): needed only by #5.
    -- ===========================================================================
    select p.id into v_third_party
      from profiles p
     where p.id <> v_author and p.id <> v_collaborator and p.id <> v_friend_of_collab
       and (not v_have_blocker or p.id <> v_blocker)
       and not exists (
         select 1 from friendships f
         where (f.user_id = v_author and f.friend_id = p.id)
            or (f.friend_id = v_author and f.user_id = p.id)
       )
     order by p.id limit 1;

    if v_third_party is null then
      insert into _res (n, scenario, expected, actual, verdict)
      values (5, 'SETUP FAILED: no clean profile found for v_third_party', '-', '-', 'SKIP');
    else
      v_have_third_party := true;

      -- Real accepted edge so v_third_party can see v_post_friends via the
      -- ordinary friends branch — the point of #5 is that a visible POST does
      -- not make a pending TAG ROW visible, so the reader must genuinely be
      -- able to see the post for the proof to mean anything.
      insert into friendships (user_id, friend_id, status)
      values (v_third_party, v_author, 'accepted');

      -- ---- #5: a third party reads the TAG ROW (not the post) of a
      -- 'pending' tag on a post they CAN see. Expect 0 rows — a pending tag
      -- must not name someone who has not agreed. night_post_tags' SELECT
      -- policy's third-party branch requires state in ('tag','collab');
      -- 'pending' never satisfies it, regardless of whether the post itself
      -- is visible.
      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_third_party, 'role', 'authenticated')::text, true);
      select current_setting('role', true) into v_role_at_op;
      select count(*) into v_cnt
        from night_post_tags
       where post_id = v_post_friends and tagged_user_id = v_collaborator;
      perform set_config('role', v_admin, true);
      insert into _res (n, scenario, expected, actual, role_at_op, verdict)
      values (5, 'third party reads the pending tag row on a post they can see',
        '0', v_cnt::text, v_role_at_op, case when v_cnt = 0 then 'PASS' else 'FAIL' end);
    end if;

    -- ---- #6: the POST'S AUTHOR tries to UPDATE the (currently 'pending')
    -- tag to 'collab'. Expect 0 rows — only the tagged person may; this is
    -- the entire consent mechanism. The UPDATE policy's USING clause is
    -- auth.uid() = tagged_user_id, which v_author fails (v_author <>
    -- v_collaborator), so RLS filters the target row out before WITH CHECK
    -- is ever evaluated — 0 rows updated, no error.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_author, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    update night_post_tags set state = 'collab'
     where post_id = v_post_friends and tagged_user_id = v_collaborator;
    get diagnostics v_cnt = row_count;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (6, 'post author tries to UPDATE a tag to collab', '0', v_cnt::text,
      v_role_at_op, case when v_cnt = 0 then 'PASS' else 'FAIL' end);

    -- ---- #7: the TAGGED person updates their own tag pending -> collab.
    -- Expect 1 row. USING clause (auth.uid() = tagged_user_id) is true for
    -- v_collaborator, and WITH CHECK (state in ('tag','collab')) accepts
    -- 'collab'. Leaves the tag in state='collab' for #10 below.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_collaborator, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    update night_post_tags set state = 'collab'
     where post_id = v_post_friends and tagged_user_id = v_collaborator;
    get diagnostics v_cnt = row_count;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (7, 'tagged person updates own tag pending -> collab', '1', v_cnt::text,
      v_role_at_op, case when v_cnt = 1 then 'PASS' else 'FAIL' end);

    -- ---- #8: the author inserts a tag with state='collab' DIRECTLY on a
    -- non-private (visibility='friends') post, targeting a fresh person
    -- (v_friend_of_collab is not yet tagged on v_post_friends — v_collaborator
    -- is the only existing tag row there). Expect 42501 — the INSERT policy's
    -- WITH CHECK requires (visibility <> 'nobody' and state = 'pending');
    -- visibility <> 'nobody' holds but state = 'collab' fails that
    -- conjunction, so the whole WITH CHECK fails: inserts must start pending.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_author, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;

    begin
      insert into night_post_tags (post_id, tagged_user_id, state)
      values (v_post_friends, v_friend_of_collab, 'collab');
      -- unexpectedly succeeded
      perform set_config('role', v_admin, true);
      insert into _res (n, scenario, expected, actual, role_at_op, verdict)
      values (8, 'author inserts a tag as collab directly on a non-private post',
        '42501', '0', v_role_at_op, 'FAIL');
    exception when insufficient_privilege then
      perform set_config('role', v_admin, true);
      insert into _res (n, scenario, expected, actual, role_at_op, verdict)
      values (8, 'author inserts a tag as collab directly on a non-private post',
        '42501', '42501', v_role_at_op, 'PASS');
    end;

    -- ---- #9: author widens a 'nobody' post to 'friends'; its 'private' tag
    -- becomes 'pending' (the reset_tags_on_widen trigger). Fixture tag
    -- inserted as admin (bypassing night_post_tags' own INSERT policy, which
    -- is proved separately above/elsewhere) on v_post_nobody, naming
    -- v_friend_of_collab, state='private' — the only state the INSERT policy
    -- allows on a 'nobody' post.
    insert into night_post_tags (post_id, tagged_user_id, state)
    values (v_post_nobody, v_friend_of_collab, 'private');

    -- The widen itself is impersonated as v_author (real RLS): night_posts'
    -- "users update own posts" policy (auth.uid() = user_id, both USING and
    -- WITH CHECK) is what actually allows this write. role_at_op below
    -- reflects THIS operation, the one the scenario is fundamentally about.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_author, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    update night_posts set visibility = 'friends' where id = v_post_nobody;

    -- Ground-truth read of the trigger's effect, as admin — this is a fact
    -- about the row, not itself an RLS-gated assertion (the trigger function
    -- is security definer and runs regardless of who fired the UPDATE), so it
    -- is deliberately not impersonated.
    perform set_config('role', v_admin, true);
    select state into v_state
      from night_post_tags where post_id = v_post_nobody and tagged_user_id = v_friend_of_collab;
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (9, 'author widens nobody->friends: private tag becomes pending (trigger)',
      'pending', coalesce(v_state::text, 'null'), v_role_at_op,
      case when v_state = 'pending' then 'PASS' else 'FAIL' end);

    -- ---- #10: either party deletes the tag; the POST still exists
    -- afterward. Deleting as v_collaborator (the tagged person) — DELETE
    -- policy's first clause (auth.uid() = tagged_user_id) applies. Expect 1
    -- row deleted, and — the actual point of the scenario — the post row
    -- must still physically exist afterward (post count 1), proving removing
    -- a tag never removes the post (no ON DELETE CASCADE runs the other way;
    -- night_post_tags.post_id references night_posts, not vice versa).
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_collaborator, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    delete from night_post_tags where post_id = v_post_friends and tagged_user_id = v_collaborator;
    get diagnostics v_cnt = row_count;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (10, 'either party deletes a tag (precondition: delete itself succeeds)',
      '1', v_cnt::text, v_role_at_op, case when v_cnt = 1 then 'PASS' else 'FAIL' end);

    -- Ground truth, as admin, deliberately not impersonated — see #9's note
    -- above for why. role_at_op NULL, same convention as SETUP FAILED/SKIP.
    select count(*) into v_cnt from night_posts where id = v_post_friends;
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (10, 'post still exists after its tag is deleted', '1', v_cnt::text, null,
      case when v_cnt = 1 then 'PASS' else 'FAIL' end);
  end if;
end $$;

-- Single result set, deliberately: the Supabase SQL editor only shows the
-- LAST result set. Self-check first, exactly as in
-- scripts/2026-08-07-night-comments-rls-test.sql: any scenario row
-- (role_at_op is not null, i.e. not a SETUP FAILED/SKIP/ground-truth row)
-- whose role_at_op was not 'authenticated' at the moment of its operation
-- gets its verdict OVERRIDDEN to a distinct 'BAD HARNESS: ran as <role>'
-- string — never PASS, never FAIL — so a role mistake in this script can
-- never again be misread as a policy result in either direction.
with checked as (
  select id, n, scenario, expected, actual, role_at_op,
         case
           when role_at_op is not null and role_at_op <> 'authenticated'
             then 'BAD HARNESS: ran as ' || role_at_op
           else verdict
         end as verdict
    from _res
)
select n, scenario, expected, actual, role_at_op, verdict,
       case when count(*) filter (where verdict not in ('PASS')) over () = 0
            then 'ALL PASS (or SKIP — check rows above)'
            else count(*) filter (where verdict <> 'PASS') over () || ' NOT PASS'
       end as overall
  from checked
 order by n, id;

rollback;
