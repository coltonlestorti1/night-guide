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
-- The five required scenarios (see scripts/2026-08-07-night-comments-ddl.sql
-- for the policies being proved):
--   1. Stranger reads comments on a 'nobody' post          -> 0 rows
--   2. Non-friend inserts a comment on a 'friends' post    -> 42501
--   3. Non-friend inserts a comment on an 'everyone' post  -> 42501
--   4. Unrelated user deletes someone else's comment       -> 0 rows
--   5. Post author deletes a friend's comment on their own post -> 1 row
--
-- Scenario 3 is the one that matters most: the WRITE policy gates on
-- friendship with the post author, not on audience. An 'everyone' post is
-- fully readable by a stranger, but that does not make the stranger a friend,
-- so the insert must still be refused. An audience-only policy would wrongly
-- allow this.
-- ============================================================================

begin;

create temp table _res(
  id       serial,
  scenario text,
  expected int,
  actual   int,
  verdict  text
) on commit drop;

do $$
declare
  v_author        uuid;
  v_friend        uuid;  -- accepted friend of v_author
  v_stranger      uuid;  -- no friendship row of any kind against v_author
  v_venues        uuid[];
  v_post_nobody   uuid;
  v_post_friends  uuid;
  v_post_everyone uuid;
  v_comment_friend uuid;
  v_cnt           int;
  v_admin         text := current_user;
begin
  -- An accepted friendship pair. Direction doesn't matter — both policies
  -- check (user_id, friend_id) in either order.
  select f.user_id, f.friend_id
    into v_author, v_friend
    from friendships f
   where f.status = 'accepted'
   limit 1;

  if v_author is null then
    insert into _res values (default, 'SETUP FAILED: no accepted friendship exists', 0, 0, 'SKIP');
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
    insert into _res values (default, 'SETUP FAILED: no non-friend profile found for the author', 0, 0, 'SKIP');
    return;
  end if;

  select array_agg(id) into v_venues from (select id from venues limit 3) v;
  if v_venues is null or array_length(v_venues, 1) < 3 then
    insert into _res values (default, 'SETUP FAILED: fewer than 3 venues exist', 0, 0, 'SKIP');
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
  select count(*) into v_cnt from night_comments where post_id = v_post_nobody;
  perform set_config('role', v_admin, true);
  insert into _res values (default, 'stranger reads comments on a nobody post', 0, v_cnt,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- ---- scenario 2: non-friend inserts a comment on a 'friends' post.
  -- Expect 42501 — the WRITE policy's exists() clause requires an accepted
  -- friendship with the post AUTHOR (or being the author); v_stranger has
  -- neither, so the WITH CHECK fails and Postgres raises insufficient_privilege.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);

  begin
    insert into night_comments (post_id, user_id, body)
    values (v_post_friends, v_stranger, 'should be refused - friends post');
    insert into _res values (default, 'non-friend inserts on a friends post', 42501, 0, 'FAIL');
  exception when insufficient_privilege then
    insert into _res values (default, 'non-friend inserts on a friends post', 42501, 42501, 'PASS');
  end;

  -- ---- scenario 3: non-friend inserts a comment on an 'everyone' post.
  -- Expect 42501 — the post is fully READABLE by v_stranger (visibility =
  -- 'everyone'), but the WRITE policy never consults visibility at all, only
  -- friendship with the author. A policy that gated writes on audience instead
  -- of friendship would wrongly allow this; this is the case that proves it
  -- doesn't.
  begin
    insert into night_comments (post_id, user_id, body)
    values (v_post_everyone, v_stranger, 'should be refused - everyone post');
    insert into _res values (default, 'non-friend inserts on an everyone post', 42501, 0, 'FAIL');
  exception when insufficient_privilege then
    insert into _res values (default, 'non-friend inserts on an everyone post', 42501, 42501, 'PASS');
  end;

  perform set_config('role', v_admin, true);

  -- ---- scenario 4: an unrelated user deletes someone else's comment on
  -- someone else's post. Expect 0 rows — neither DELETE clause matches for
  -- v_stranger: they are not the comment's author (v_friend is,
  -- auth.uid() = user_id fails) and they are not the post's author (v_author
  -- is, the exists() against night_posts fails too). RLS filters the target
  -- row out rather than raising an error, so this deletes 0 rows silently.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  delete from night_comments where id = v_comment_friend;
  get diagnostics v_cnt = row_count;
  perform set_config('role', v_admin, true);
  insert into _res values (default, 'unrelated user deletes someone else''s comment', 0, v_cnt,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- ---- scenario 5: the post author deletes a friend's comment on their own
  -- post. Expect 1 row — the DELETE policy's second clause matches: the
  -- comment's post (v_post_everyone) belongs to auth.uid() = v_author, so the
  -- author may remove any comment on their own thread regardless of who wrote
  -- it. This is the same comment scenario 4 just failed to touch.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_author, 'role', 'authenticated')::text, true);
  delete from night_comments where id = v_comment_friend;
  get diagnostics v_cnt = row_count;
  perform set_config('role', v_admin, true);
  insert into _res values (default, 'post author deletes a friend''s comment', 1, v_cnt,
    case when v_cnt = 1 then 'PASS' else 'FAIL' end);
end $$;

-- Single result set, deliberately: the Supabase SQL editor only shows the
-- LAST result set, so the per-scenario breakdown and the overall verdict are
-- combined into one query here rather than two separate selects. "overall" is
-- repeated on every row so it is visible at a glance without scrolling.
select scenario, expected, actual, verdict,
       case when count(*) filter (where verdict <> 'PASS') over () = 0
            then 'ALL PASS'
            else count(*) filter (where verdict <> 'PASS') over () || ' FAILED'
       end as overall
  from _res
 order by id;

rollback;
