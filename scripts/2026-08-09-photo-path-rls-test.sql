-- ============================================================================
-- RLS PROOF — night_post_photos INSERT must own the storage path.
--
-- SAFE: everything runs inside ONE transaction that ROLLS BACK. Fixture posts,
-- fixture photo rows and every role impersonation are never committed. Nothing
-- persists, and the script can be re-run any number of times. It creates NO
-- storage objects — only table rows, which is where the policy lives.
--
-- Harness rules copied from scripts/2026-08-09-collab-tags-rls-test.sql, the
-- proven pattern in this repo:
--   * EVERY SCENARIO RE-ESTABLISHES ITS OWN ROLE immediately before its own
--     operation. Restoring admin to write a result row ends impersonation, so
--     a later scenario that assumed otherwise would run as admin, bypass RLS
--     and produce a false PASS.
--   * role_at_op is captured AT the impersonated operation. Anything other
--     than 'authenticated' surfaces as 'BAD HARNESS: ran as <role>' rather
--     than PASS/FAIL, so a harness mistake can never be misread as a result.
--   * Admin is restored before every _res write, including inside every
--     exception handler.
--   * The results query is LAST, immediately before `rollback` — the Supabase
--     editor only shows the final result set.
--   * night_date = date '2000-01-01' so fixture posts cannot collide with
--     night_posts' unique (user_id, venue_id, night_date).
--
-- ---------------------------------------------------------------------------
-- WHAT IS BEING PROVED
--
-- The old INSERT policy checked only that the POST was yours. It never checked
-- that storage_path was yours. The unique index on storage_path looks like it
-- prevents re-using another user's path — but DELETING A POST FREES THAT INDEX
-- ENTRY, and until 2026-08-09 nothing deleted the file. So:
--
--   1. Alice posts a friends-only photo. Bob (a friend) reads storage_path
--      straight out of the feed payload.
--   2. Alice deletes the post. Row gone, file retained, path unclaimed.
--   3. Bob attaches Alice's path to his own 'everyone' post. The storage read
--      policy joins through BOB's post, so Alice's deleted private photo is
--      signable by every user on ENDZ.
--
-- Scenario 2 below is that exact sequence. It is the one that mattered:
-- BEFORE the fix it SUCCEEDS.
--
-- Scenario 1 is deliberately NOT the headline. With Alice's row still present
-- the unique index would also reject the insert, so a PASS there could be the
-- index rather than the policy — it is recorded for completeness and its
-- SQLSTATE is reported so the two causes stay distinguishable.
-- ============================================================================

begin;

create temp table _res(
  id         serial,
  n          int,
  scenario   text,
  expected   text,
  actual     text,
  role_at_op text,
  verdict    text
) on commit drop;

grant insert, select on _res to authenticated;

do $$
declare
  v_alice        uuid;
  v_bob          uuid;
  v_venues       uuid[];
  v_post_alice   uuid;
  v_post_bob     uuid;
  v_alice_path   text;
  v_bob_path     text;
  v_role_at_op   text;
  v_admin        text := current_user;
  v_state        text;
  v_cnt          int;
  v_have_core    boolean := false;
begin
  -- ==========================================================================
  -- SETUP. profiles.id references auth.users, so no actor can be invented —
  -- both are real rows discovered by query. Unlike the collab script this
  -- needs NO friendship graph: the policy under test looks only at post
  -- ownership and the path prefix, so any two distinct profiles will do.
  -- ==========================================================================
  select id into v_alice from profiles order by id limit 1;
  select id into v_bob   from profiles where id <> v_alice order by id limit 1;
  select array_agg(id) into v_venues from (select id from venues order by id limit 2) v;

  if v_alice is null or v_bob is null then
    insert into _res (n, scenario, expected, actual, verdict)
    values (0, 'SETUP FAILED: need 2 distinct profiles', '-', '-', 'SKIP');
  elsif v_venues is null or array_length(v_venues, 1) < 2 then
    insert into _res (n, scenario, expected, actual, verdict)
    values (0, 'SETUP FAILED: fewer than 2 venues exist', '-', '-', 'SKIP');
  else
    v_have_core := true;
  end if;

  if v_have_core then
    v_alice_path := v_alice::text || '/probe-' || gen_random_uuid()::text || '.jpg';
    v_bob_path   := v_bob::text   || '/probe-' || gen_random_uuid()::text || '.jpg';

    -- Fixtures inserted AS ADMIN, deliberately bypassing night_posts' own
    -- policies. This script proves night_post_photos' INSERT policy, not
    -- night_posts'.
    insert into night_posts (user_id, venue_id, night_date, visibility)
    values (v_alice, v_venues[1], date '2000-01-01', 'friends')
    returning id into v_post_alice;

    insert into night_posts (user_id, venue_id, night_date, visibility)
    values (v_bob, v_venues[2], date '2000-01-01', 'everyone')
    returning id into v_post_bob;

    insert into night_post_photos (post_id, storage_path)
    values (v_post_alice, v_alice_path);

    -- ---- #1 Bob claims Alice's path while her row still exists.
    -- Expect rejection. Reported with its SQLSTATE because 23505 (unique
    -- index) and 42501 (policy) are both possible here and mean different
    -- things — only 42501 is evidence about the policy.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_bob, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    begin
      insert into night_post_photos (post_id, storage_path)
      values (v_post_bob, v_alice_path);
      v_state := 'NO ERROR — INSERT SUCCEEDED';
    exception when others then
      v_state := SQLSTATE;
    end;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (1, 'Bob claims Alice''s path while her photo row still exists',
      'rejected (42501 policy, or 23505 index)', v_state, v_role_at_op,
      case when v_role_at_op is distinct from 'authenticated'
             then 'BAD HARNESS: ran as ' || coalesce(v_role_at_op, 'null')
           when v_state in ('42501', '23505') then 'PASS'
           else 'FAIL' end);

    -- ---- #2 THE ATTACK. Alice deletes her post, which cascades the photo row
    -- and FREES THE UNIQUE INDEX ENTRY. Bob then claims the now-unreferenced
    -- path for his own 'everyone' post. Expect 42501 specifically: with the
    -- index no longer holding the path, the policy is the only thing left
    -- standing between Bob and Alice's deleted private photo.
    --
    -- BEFORE THE FIX THIS INSERT SUCCEEDS.
    delete from night_posts where id = v_post_alice;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_bob, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    begin
      insert into night_post_photos (post_id, storage_path)
      values (v_post_bob, v_alice_path);
      v_state := 'NO ERROR — ATTACK SUCCEEDED';
    exception when others then
      v_state := SQLSTATE;
    end;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (2, 'ATTACK: Bob claims Alice''s freed path after she deleted the post',
      '42501', v_state, v_role_at_op,
      case when v_role_at_op is distinct from 'authenticated'
             then 'BAD HARNESS: ran as ' || coalesce(v_role_at_op, 'null')
           when v_state = '42501' then 'PASS'
           else 'FAIL' end);

    -- ---- #3 REGRESSION GUARD. Bob attaches his OWN path to his OWN post.
    -- Expect success. A policy that blocks the attack by blocking everything
    -- is not a fix — this is what proves ordinary posting still works.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_bob, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    begin
      insert into night_post_photos (post_id, storage_path)
      values (v_post_bob, v_bob_path);
      v_state := 'inserted';
    exception when others then
      v_state := SQLSTATE;
    end;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (3, 'REGRESSION: Bob attaches his own path to his own post',
      'inserted', v_state, v_role_at_op,
      case when v_role_at_op is distinct from 'authenticated'
             then 'BAD HARNESS: ran as ' || coalesce(v_role_at_op, 'null')
           when v_state = 'inserted' then 'PASS'
           else 'FAIL' end);

    -- ---- #4 The ORIGINAL check must still hold: owning the path does not let
    -- you attach it to somebody else's post. Alice's post is gone, so Bob
    -- needs a fresh one belonging to her.
    insert into night_posts (user_id, venue_id, night_date, visibility)
    values (v_alice, v_venues[2], date '2000-01-01', 'friends')
    returning id into v_post_alice;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_bob, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    begin
      insert into night_post_photos (post_id, storage_path)
      values (v_post_alice, v_bob::text || '/probe-other-post.jpg');
      v_state := 'NO ERROR — INSERT SUCCEEDED';
    exception when others then
      v_state := SQLSTATE;
    end;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (4, 'Bob attaches his own path to ALICE''s post',
      '42501', v_state, v_role_at_op,
      case when v_role_at_op is distinct from 'authenticated'
             then 'BAD HARNESS: ran as ' || coalesce(v_role_at_op, 'null')
           when v_state = '42501' then 'PASS'
           else 'FAIL' end);

    -- ---- #5 A path with no folder at all. split_part returns the whole
    -- string when there is no delimiter, so 'naked.jpg' must not match any
    -- uid. Guards the same edge the client test covers.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_bob, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role_at_op;
    begin
      insert into night_post_photos (post_id, storage_path)
      values (v_post_bob, 'naked-' || gen_random_uuid()::text || '.jpg');
      v_state := 'NO ERROR — INSERT SUCCEEDED';
    exception when others then
      v_state := SQLSTATE;
    end;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (5, 'Bob attaches a path with no folder prefix to his own post',
      '42501', v_state, v_role_at_op,
      case when v_role_at_op is distinct from 'authenticated'
             then 'BAD HARNESS: ran as ' || coalesce(v_role_at_op, 'null')
           when v_state = '42501' then 'PASS'
           else 'FAIL' end);

    -- ---- #6 GROUND TRUTH, admin, never impersonated. Exactly one photo row
    -- should exist for Bob's post: the legitimate one from #3. If any rejected
    -- insert had actually landed, this would be higher — which is what stops
    -- an exception being raised for some unrelated reason from reading as a
    -- policy PASS.
    select count(*) into v_cnt from night_post_photos where post_id = v_post_bob;
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (6, 'GROUND TRUTH: photo rows on Bob''s post (only #3 should have landed)',
      '1', v_cnt::text, null,
      case when v_cnt = 1 then 'PASS' else 'FAIL' end);
  end if;
end $$;

-- LAST statement before rollback — the editor shows only this.
--
-- Verdict FIRST. The scenario text is long enough to push later columns off
-- the right edge of the Supabase results grid, and a result you have to
-- scroll sideways to read is a result that gets skimmed.
select n, verdict, actual, expected, role_at_op, scenario
  from _res order by n, id;

rollback;
