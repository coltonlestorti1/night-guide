-- ============================================================================
-- RLS PROOF — night_posts audience rules.
--
-- SAFE: everything runs inside ONE transaction that ROLLS BACK. The fixture
-- posts and the temporary block are never committed. Nothing persists.
--
-- Profiles cannot be fabricated (profiles.id references auth.users), so this
-- discovers two real accounts that share a college and one at a different
-- college, publishes one post per audience as the first, then reads as each
-- other account with `set_config('request.jwt.claims', ...)` — the same
-- role-impersonation technique that closed slice 1.
-- ============================================================================

begin;

create temp table _res(
  scenario text,
  expected int,
  actual   int,
  verdict  text
) on commit drop;

do $$
declare
  v_author  uuid;
  v_same    uuid;
  v_other   uuid;
  v_college text;
  v_venues  uuid[];
  v_cnt     int;
  v_admin   text := current_user;
begin
  -- Two real accounts at the same college.
  select p1.id, p2.id, p1.college_slug
    into v_author, v_same, v_college
    from profiles p1
    join profiles p2
      on p2.college_slug = p1.college_slug and p2.id <> p1.id
   where p1.college_slug is not null
   limit 1;

  if v_author is null then
    insert into _res values ('SETUP FAILED: no two profiles share a college', 0, 0, 'SKIP');
    return;
  end if;

  -- Someone at a different college.
  select id into v_other
    from profiles
   where college_slug is not null and college_slug is distinct from v_college
   limit 1;

  select array_agg(id) into v_venues from (select id from venues limit 4) v;

  -- Fixtures: one post per audience, different venues (unique constraint is
  -- per user+venue+night). Inserted as the admin role, so RLS is bypassed here
  -- deliberately — we are testing READS, not writes.
  insert into night_posts (user_id, venue_id, night_date, visibility) values
    (v_author, v_venues[1], current_date, 'everyone'),
    (v_author, v_venues[2], current_date, 'school'),
    (v_author, v_venues[3], current_date, 'friends'),
    (v_author, v_venues[4], current_date, 'nobody');

  -- ---- reader 1: same college, NOT a friend. Expect everyone + school = 2.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_same, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from night_posts where user_id = v_author;
  perform set_config('role', v_admin, true);
  insert into _res values ('same college, not friend -> everyone + school', 2, v_cnt,
    case when v_cnt = 2 then 'PASS' else 'FAIL' end);

  -- ---- reader 2: different college, not a friend. Expect everyone only = 1.
  if v_other is not null then
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    select count(*) into v_cnt from night_posts where user_id = v_author;
    perform set_config('role', v_admin, true);
    insert into _res values ('different college, not friend -> everyone only', 1, v_cnt,
      case when v_cnt = 1 then 'PASS' else 'FAIL' end);
  else
    insert into _res values ('different college: no such profile to test with', 1, -1, 'SKIP');
  end if;

  -- ---- reader 3: same college, but BLOCKED. Expect 0 — blocking must cut
  -- across every tier, including 'everyone'.
  insert into friendships (user_id, friend_id, status)
  values (v_author, v_same, 'blocked')
  on conflict (user_id, friend_id) do update set status = 'blocked';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_same, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from night_posts where user_id = v_author;
  perform set_config('role', v_admin, true);
  insert into _res values ('same college but BLOCKED -> nothing at any tier', 0, v_cnt,
    case when v_cnt = 0 then 'PASS' else 'FAIL' end);

  -- ---- reader 4: the author. Expect all four, including 'nobody'.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_author, 'role', 'authenticated')::text, true);
  select count(*) into v_cnt from night_posts where user_id = v_author;
  perform set_config('role', v_admin, true);
  insert into _res values ('author sees own posts incl. nobody', 4, v_cnt,
    case when v_cnt = 4 then 'PASS' else 'FAIL' end);
end $$;

select * from _res;

rollback;
