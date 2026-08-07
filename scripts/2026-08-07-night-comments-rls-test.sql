-- ============================================================================
-- RLS PROOF — night_comments read / write / delete rules.
--
-- SAFE: everything runs inside ONE transaction that ROLLS BACK. The fixture
-- posts, fixture comments and the role impersonation are never committed.
-- Nothing persists, and the script can be re-run any number of times.
--
-- Profiles cannot be fabricated (profiles.id references auth.users), so this
-- discovers real accounts by query: one accepted-friendship pair (author +
-- friend) and one profile with no friendship row at all against the author
-- (a true stranger) — then role-impersonates each of them with
-- set_config('request.jwt.claims', ...) + set_config('role', 'authenticated',
-- ...), the same technique proven in scripts/2026-08-07-night-posts-rls-test.sql.
--
-- Fixture posts and comments are inserted as the admin role, deliberately
-- bypassing RLS — this script tests the night_comments policies, not the
-- night_posts INSERT policy. night_date is far in the past (2000-01-01) so the
-- (user_id, venue_id, night_date) unique constraint on night_posts can never
-- collide with a real row.
--
-- EVERY SCENARIO SETS ITS OWN ROLE. Never assume impersonation carries over
-- from the previous scenario, even when the actor is unchanged — a prior
-- scenario's admin-restore (or its exception handler's admin-restore) is the
-- last role change in effect otherwise, and the next scenario would silently
-- run as admin, which bypasses RLS. That exact mistake produced a false FAIL
-- on scenario 3 in an earlier run of this file. role_at_op below exists so
-- that mistake can never again be misread as a policy result.
--
-- The eight scenarios (see scripts/2026-08-07-night-comments-ddl.sql for the
-- policies being proved):
--   1. Stranger reads comments on a 'nobody' post          -> 0 rows
--   2. Non-friend inserts a comment on a 'friends' post    -> 42501
--   3. Non-friend inserts a comment on an 'everyone' post  -> 42501
--   4. Unrelated user deletes someone else's comment       -> 0 rows
--   5. Post author deletes a friend's comment on their own post -> 1 row
--   6. A FRIEND of the author inserts a comment on a 'nobody' post -> 42501
--   7. A user who BLOCKED the commenter reads a mutual friend's post thread
--      -> the blocked person's comment is invisible (0 rows for that comment)
--   8. UPDATE against night_comments by the comment's own author -> 0 rows
--
-- Scenario 3 is about the WRITE policy's friendship clause: the insert's
-- exists() subquery requires an accepted friendship with the post author (or
-- being the author). An 'everyone' post is fully readable by a stranger, but
-- that does not make the stranger a friend, so the insert must still be
-- refused. An audience-only policy would wrongly allow this.
--
-- Scenario 3 does NOT, however, prove that the write path is independent of
-- visibility — it only proves the friendship clause bites on its own. The
-- WITH CHECK's exists() subquery reads night_posts, and that read is itself
-- subject to night_posts' RLS, exactly the way the SELECT policy's gate 1 is.
-- So the write path transitively INHERITS post visibility in addition to
-- requiring friendship — it is not friendship-only. Scenario 3's stranger
-- fails the friendship clause regardless of visibility, so scenarios 1-5 all
-- pass whether or not that inheritance holds; none of them distinguishes the
-- two. Scenario 6 below is the one that actually exercises it: a FRIEND, who
-- passes the friendship clause on its own, targeting a 'nobody' post — a
-- visibility tier that hides the post from everyone but its author, friends
-- included.
-- ============================================================================

begin;

create temp table _res(
  id         serial,
  scenario   text,
  expected   int,
  actual     int,
  role_at_op text,   -- current_setting('role') captured AT the impersonated
                      -- operation, not at the _res write. NULL for SETUP
                      -- FAILED / SKIP rows, which never impersonate anyone.
  verdict    text
) on commit drop;

-- Belt and braces. _res is owned by the admin role that runs this script, so
-- an impersonated 'authenticated' role has no privilege on it by default. The
-- role is always restored to admin before every write below, but this grant
-- means a single missed restore degrades into a correct result instead of an
-- aborted script. Free: this is a temp table inside a transaction that always
-- rolls back.
grant insert, select on _res to authenticated;

do $$
declare
  v_author         uuid;
  v_friend         uuid;  -- accepted friend of v_author
  v_stranger       uuid;  -- no friendship row of any kind against v_author
  v_venues         uuid[];
  v_post_nobody    uuid;
  v_post_friends   uuid;
  v_post_everyone  uuid;
  v_comment_friend uuid;
  v_blocker        uuid;  -- for scenario 7: no friendship row of any kind
                           -- against v_friend, so blocking it is unambiguous
  v_comment_new    uuid;  -- fresh comment for scenarios 7-8 — scenario 5 above
                           -- really does delete v_comment_friend (that's the
                           -- one DELETE scenario expected to succeed), so it
                           -- can't be reused past that point
  v_cnt            int;
  v_role_at_op     text;  -- captured fresh for every scenario, right after
                           -- that scenario's own set_config calls, before the
                           -- risky operation runs.
  v_admin          text := current_user;
begin
  -- An accepted friendship pair. Direction doesn't matter — both policies
  -- check (user_id, friend_id) in either order.
  select f.user_id, f.friend_id
    into v_author, v_friend
    from friendships f
   where f.status = 'accepted'
   limit 1;

  if v_author is null then
    insert into _res (scenario, expected, actual, verdict)
    values ('SETUP FAILED: no accepted friendship exists', 0, 0, 'SKIP');
    return;
  end if;

  -- A real profile with NO friendship row at all against v_author — a clean
  -- stranger, not pending and not blocked.
  select p.id into v_stranger
    from profiles p
   where p.id <> v_author and p.id <> v_friend
     and not exists (
       select 1 from friendships f
       where (f.user_id = v_author and f.friend_id = p.id)
          or (f.friend_id = v_author and f.user_id = p.id)
     )
   limit 1;

  if v_stranger is null then
    insert into _res (scenario, expected, actual, verdict)
    values ('SETUP FAILED: no non-friend profile found for the author', 0, 0, 'SKIP');
    return;
  end if;

  select array_agg(id) into v_venues from (select id from venues limit 3) v;
  if v_venues is null or array_length(v_venues, 1) < 3 then
    insert into _res (scenario, expected, actual, verdict)
    values ('SETUP FAILED: fewer than 3 venues exist', 0, 0, 'SKIP');
    return;
  end if;

  -- Fixture posts, all authored by v_author, one per audience needed below.
  -- Inserted as the admin role — RLS is bypassed here deliberately, the same
  -- as the night_posts proof: we are testing night_comments policies, not
  -- night_posts' own INSERT policy.
  insert into night_posts (user_id, venue_id, night_date, visibility)
  values (v_author, v_venues[1], date '2000-01-01', 'nobody')
  returning id into v_post_nobody;

  insert into night_posts (user_id, venue_id, night_date, visibility)
  values (v_author, v_venues[2], date '2000-01-01', 'friends')
  returning id into v_post_friends;

  insert into night_posts (user_id, venue_id, night_date, visibility)
  values (v_author, v_venues[3], date '2000-01-01', 'everyone')
  returning id into v_post_everyone;

  -- Fixture comments, also inserted as admin.
  insert into night_comments (post_id, user_id, body)
  values (v_post_nobody, v_friend, 'a comment only the author should ever see');

  insert into night_comments (post_id, user_id, body)
  values (v_post_everyone, v_friend, 'a friend''s comment on the author''s everyone post')
  returning id into v_comment_friend;

  -- ---- scenario 1: stranger reads comments on a 'nobody' post.
  -- Expect 0 — gate 1 of the READ policy (post visibility, inherited from
  -- night_posts) hides the post entirely from v_stranger, so
  -- exists(select 1 from night_posts p where p.id = ...) is false before gate
  -- 2 (the block check) is even reached.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;
  select count(*) into v_cnt from night_comments where post_id = v_post_nobody;
  perform set_config('role', v_admin, true);
  insert into _res (scenario, expected, actual, role_at_op, verdict)
  values ('stranger reads comments on a nobody post', 0, v_cnt, v_role_at_op,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- ---- scenario 2: non-friend inserts a comment on a 'friends' post.
  -- Expect 42501 — the WRITE policy's exists() clause requires an accepted
  -- friendship with the post AUTHOR (or being the author); v_stranger has
  -- neither, so the WITH CHECK fails and Postgres raises insufficient_privilege.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;

  -- The role restore in each branch below is NOT optional. The subtransaction
  -- rollback that PL/pgSQL performs when an exception is caught undoes table
  -- writes made inside the begin/exception block, but it does NOT undo a role
  -- change made in the ENCLOSING block — and set_config('role', ...) above was
  -- called outside this begin/exception, in the enclosing scope. So the
  -- moment the exception handler runs, role is still 'authenticated', and
  -- writing to _res while wearing it is exactly the bug that failed the first
  -- run. Restore admin as the FIRST statement of every branch, before any
  -- write to _res. v_role_at_op was already captured above, before any of
  -- this restoring happens, so it reflects the role that was actually active
  -- for the insert attempt, not the role active when we record the result.
  begin
    insert into night_comments (post_id, user_id, body)
    values (v_post_friends, v_stranger, 'should be refused - friends post');
    -- unexpectedly succeeded
    perform set_config('role', v_admin, true);
    insert into _res (scenario, expected, actual, role_at_op, verdict)
    values ('non-friend inserts on a friends post', 42501, 0, v_role_at_op, 'FAIL');
  exception when insufficient_privilege then
    perform set_config('role', v_admin, true);
    insert into _res (scenario, expected, actual, role_at_op, verdict)
    values ('non-friend inserts on a friends post', 42501, 42501, v_role_at_op, 'PASS');
  end;

  -- ---- scenario 3: non-friend inserts a comment on an 'everyone' post.
  -- Expect 42501 — the post is fully READABLE by v_stranger (visibility =
  -- 'everyone'), but v_stranger still has no accepted friendship with the
  -- author, so the WRITE policy's friendship clause refuses the insert. A
  -- policy that gated writes on audience alone, with no friendship
  -- requirement, would wrongly allow this; this is the case that proves it
  -- doesn't. (This scenario does NOT prove the write path ignores visibility
  -- — it can't, since v_stranger fails the friendship clause regardless of
  -- what visibility does. Scenario 6 below is the one that isolates that.)
  --
  -- v_stranger is the same actor as scenario 2, but role is NOT assumed to
  -- carry over — scenario 2's exception handler (or its success branch) just
  -- restored admin above, so without re-impersonating here this scenario
  -- would silently run as admin, which bypasses RLS and would make the
  -- insert wrongly succeed. That is exactly the false FAIL a previous run of
  -- this file produced. Every scenario re-establishes its own role.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;

  begin
    insert into night_comments (post_id, user_id, body)
    values (v_post_everyone, v_stranger, 'should be refused - everyone post');
    -- unexpectedly succeeded
    perform set_config('role', v_admin, true);
    insert into _res (scenario, expected, actual, role_at_op, verdict)
    values ('non-friend inserts on an everyone post', 42501, 0, v_role_at_op, 'FAIL');
  exception when insufficient_privilege then
    perform set_config('role', v_admin, true);
    insert into _res (scenario, expected, actual, role_at_op, verdict)
    values ('non-friend inserts on an everyone post', 42501, 42501, v_role_at_op, 'PASS');
  end;

  -- ---- scenario 4: an unrelated user deletes someone else's comment on
  -- someone else's post. Expect 0 rows — neither DELETE clause matches for
  -- v_stranger: they are not the comment's author (v_friend is,
  -- auth.uid() = user_id fails) and they are not the post's author (v_author
  -- is, the exists() against night_posts fails too). RLS filters the target
  -- row out rather than raising an error, so this deletes 0 rows silently.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;
  delete from night_comments where id = v_comment_friend;
  get diagnostics v_cnt = row_count;
  perform set_config('role', v_admin, true);
  insert into _res (scenario, expected, actual, role_at_op, verdict)
  values ('unrelated user deletes someone else''s comment', 0, v_cnt, v_role_at_op,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- ---- scenario 5: the post author deletes a friend's comment on their own
  -- post. Expect 1 row — the DELETE policy's second clause matches: the
  -- comment's post (v_post_everyone) belongs to auth.uid() = v_author, so the
  -- author may remove any comment on their own thread regardless of who wrote
  -- it. This is the same comment scenario 4 just failed to touch.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_author, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;
  delete from night_comments where id = v_comment_friend;
  get diagnostics v_cnt = row_count;
  perform set_config('role', v_admin, true);
  insert into _res (scenario, expected, actual, role_at_op, verdict)
  values ('post author deletes a friend''s comment', 1, v_cnt, v_role_at_op,
    case when v_cnt = 1 then 'PASS' else 'FAIL' end);

  -- ------------------------------------------------------------------------
  -- Setup for scenarios 6-8. Runs as admin (still restored from scenario 5).
  --
  -- v_blocker: a real profile with NO friendship row at all against v_friend
  -- (either direction, any status) — same "clean" pattern used to find
  -- v_stranger against v_author above, so scenario 7's block edge is the
  -- only relationship in play between them.
  select p.id into v_blocker
    from profiles p
   where p.id <> v_author and p.id <> v_friend and p.id <> v_stranger
     and not exists (
       select 1 from friendships f
       where (f.user_id = v_friend and f.friend_id = p.id)
          or (f.friend_id = v_friend and f.user_id = p.id)
     )
   limit 1;

  if v_blocker is null then
    insert into _res (scenario, expected, actual, verdict)
    values ('SETUP FAILED: no profile found to block v_friend for scenario 7', 0, 0, 'SKIP');
    return;
  end if;

  -- A fresh comment — v_comment_friend above no longer exists, scenario 5
  -- really deleted it. Inserted as admin, same fixture pattern as the rest.
  insert into night_comments (post_id, user_id, body)
  values (v_post_everyone, v_friend, 'a second friend comment, for scenarios 7 and 8')
  returning id into v_comment_new;

  -- The block edge scenario 7 needs. Inserted as admin, deliberately
  -- bypassing friendships' own INSERT policy — this script proves
  -- night_comments' policies, not friendships'.
  insert into friendships (user_id, friend_id, status)
  values (v_blocker, v_friend, 'blocked');

  -- ---- scenario 6: a FRIEND of the author inserts a comment on a 'nobody'
  -- post. Expect 42501.
  --
  -- This is the scenario that actually isolates WITH CHECK's inheritance of
  -- post visibility (see the file header). v_friend passes the WRITE
  -- policy's friendship clause on its own — an accepted friendship with
  -- v_author — so if friendship were the only gate, this insert would
  -- wrongly succeed. It must not: the policy's exists(select 1 from
  -- night_posts p where p.id = night_comments.post_id and (...)) subquery
  -- reads night_posts under night_posts' OWN RLS, the same as the SELECT
  -- policy's gate 1 does, and a 'nobody' post is invisible to everyone but
  -- its author. So the subquery finds no row at all for v_friend, the whole
  -- exists() is false, and the WITH CHECK fails regardless of friendship.
  --
  -- The real path that reaches this: publishPost() upserts, so an author can
  -- re-publish an existing post at a narrower visibility — reachable from
  -- the recap card — turning a post a friend already saw (and may already
  -- have tried to comment on) into 'nobody'. This scenario proves narrowing
  -- actually closes the WRITE path too, not just the read path.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_friend, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;

  begin
    insert into night_comments (post_id, user_id, body)
    values (v_post_nobody, v_friend, 'should be refused - nobody post, even for a friend');
    -- unexpectedly succeeded
    perform set_config('role', v_admin, true);
    insert into _res (scenario, expected, actual, role_at_op, verdict)
    values ('friend inserts on a nobody post', 42501, 0, v_role_at_op, 'FAIL');
  exception when insufficient_privilege then
    perform set_config('role', v_admin, true);
    insert into _res (scenario, expected, actual, role_at_op, verdict)
    values ('friend inserts on a nobody post', 42501, 42501, v_role_at_op, 'PASS');
  end;

  -- ---- scenario 7: a user who has BLOCKED the commenter reads a mutual
  -- friend's post thread. Expect 0 rows for that comment.
  --
  -- Gate 2 of the READ policy (the block check) is otherwise entirely
  -- unexercised by this script — scenario 1 is the only other READ scenario,
  -- and it turns on gate 1 (post visibility) alone: v_stranger never even
  -- reaches gate 2 there, because gate 1 already hides the whole post.
  -- v_blocker can see v_post_everyone fine (visibility = 'everyone' is open
  -- to any authenticated viewer), but v_blocker has blocked v_friend, so
  -- v_comment_new — which v_friend posted on that same post — must not
  -- appear in v_blocker's read, even though the thread itself is visible.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_blocker, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;
  select count(*) into v_cnt from night_comments where id = v_comment_new;
  perform set_config('role', v_admin, true);
  insert into _res (scenario, expected, actual, role_at_op, verdict)
  values ('blocker cannot read the blocked commenter''s comment', 0, v_cnt, v_role_at_op,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- ---- scenario 8: UPDATE against night_comments by the comment's own
  -- author. Expect 0 rows.
  --
  -- There is no UPDATE policy on night_comments, deliberately (see the DDL's
  -- "NO UPDATE POLICY" section — "no editing" is a database rule, not a UI
  -- promise). An absent policy means the command matches zero rows, the same
  -- as DELETE with no matching policy clause (scenario 4) — it does not
  -- raise an error. v_friend owns v_comment_new outright (scenario 7 only
  -- read it, never wrote to it), which isolates "no UPDATE policy exists at
  -- all" from "you don't own this row."
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_friend, 'role', 'authenticated')::text, true);
  select current_setting('role', true) into v_role_at_op;
  update night_comments set body = 'edited' where id = v_comment_new;
  get diagnostics v_cnt = row_count;
  perform set_config('role', v_admin, true);
  insert into _res (scenario, expected, actual, role_at_op, verdict)
  values ('comment author cannot UPDATE (no UPDATE policy exists)', 0, v_cnt, v_role_at_op,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);
end $$;

-- Single result set, deliberately: the Supabase SQL editor only shows the
-- LAST result set, so the per-scenario breakdown and the overall verdict are
-- combined into one query here rather than two separate selects.
--
-- Self-check first: any scenario row (role_at_op is not null, i.e. it's not a
-- SETUP FAILED/SKIP row) whose role_at_op was not 'authenticated' at the
-- moment of its operation gets its verdict OVERRIDDEN to a distinct
-- 'BAD HARNESS: ran as <role>' string — never PASS, never FAIL — so a role
-- mistake in this script can never again be misread as a policy result in
-- either direction.
with checked as (
  select id, scenario, expected, actual, role_at_op,
         case
           when role_at_op is not null and role_at_op <> 'authenticated'
             then 'BAD HARNESS: ran as ' || role_at_op
           else verdict
         end as verdict
    from _res
)
select scenario, expected, actual, role_at_op, verdict,
       case when count(*) filter (where verdict <> 'PASS') over () = 0
            then 'ALL PASS'
            else count(*) filter (where verdict <> 'PASS') over () || ' FAILED'
       end as overall
  from checked
 order by id;

rollback;
