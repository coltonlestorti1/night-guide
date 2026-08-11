-- ============================================================================
-- 2026-08-11 — a friend's friends list
--
-- The Friends stat on /u/:username has been a number with nothing behind it:
-- friend_profile_stats() returns the count, but no function returns the people.
-- This adds that function and makes the count match it.
--
-- ⚠️ THIS FILE CONTAINS DDL AND HAS NO `rollback` IN IT. That is deliberate.
--    Mixing DDL with a trailing `rollback` in one paste has burned this project
--    before: the editor discards the DDL while the checks still print PASS.
--    Sections 1-3 are safe to paste together. Section 4 is an OPTIONAL
--    rollback-wrapped live test and MUST BE RUN ON ITS OWN.
--
-- ⚠️ THE ORACLE THIS MUST NOT REOPEN. On 2026-08-10 a security review found
--    are_friends(a, b) granted to authenticated: SECURITY DEFINER, bypassing
--    friendships RLS, taking two arbitrary ids without anchoring either to the
--    caller. Every signed-in user can read every profile id, so it was a
--    pairwise oracle — iterate the profile list, reconstruct the entire app's
--    friendship graph. The function below deliberately answers only about a
--    person the caller is ALREADY friends with, and it is the reason this is
--    one gated function rather than a readable table.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. The list.
--
-- Returns ZERO ROWS rather than raising when you are not a friend — the same
-- choice friend_ranked_list makes, for the same reason: a raise would leak the
-- difference between "not your friend" and "has no friends", and the caller
-- has to handle the empty case anyway.
--
-- `distinct` is load-bearing. friendships is unique on (user_id, friend_id),
-- so a pair CAN hold two accepted rows in opposite directions — the same trap
-- that made friend_count double-count a person before it was fixed. Without
-- distinct that person appears twice, which is also a React key collision.
--
-- The blocked clause is about the VIEWER, not the profile owner. Someone you
-- blocked must not reappear just because you both know the same person. A
-- blocked relationship has status 'blocked' and never 'accepted', so blocking
-- the profile OWNER already removes access with no extra clause — this covers
-- the third party instead.
-- ----------------------------------------------------------------------------
create or replace function public.friend_friend_list(p_user uuid)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.username, s.display_name, s.avatar_url
    from (
      select distinct pr.id, pr.username, pr.display_name, pr.avatar_url
        from friendships f
        join profiles pr
          on pr.id = case when f.user_id = p_user then f.friend_id else f.user_id end
       where f.status = 'accepted'
         and (f.user_id = p_user or f.friend_id = p_user)
         and (p_user = auth.uid() or public.are_friends(auth.uid(), p_user))
         and not exists (
           select 1
             from friendships b
            where b.status = 'blocked'
              and ((b.user_id = auth.uid() and b.friend_id = pr.id)
                or (b.user_id = pr.id      and b.friend_id = auth.uid()))
         )
    ) s
   order by lower(coalesce(s.display_name, s.username));
$$;


-- ----------------------------------------------------------------------------
-- 2. The count has to match the list it links to.
--
-- friend_profile_stats.friend_count did not filter blocked third parties,
-- because until now nothing rendered the list and the discrepancy was
-- invisible. A header reading "8 Friends" above seven rows is the exact bug
-- class already fixed once on this feature (been_count, which was not joined
-- to venues on is_active).
--
-- been_count below is UNCHANGED — copied verbatim so this replacement cannot
-- quietly regress it.
-- ----------------------------------------------------------------------------
create or replace function public.friend_profile_stats(p_user uuid)
returns table (been_count int, friend_count int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    -- Joined to venues on is_active so this matches the list it links to. The
    -- client drops ratings whose venue was deactivated, and a header reading
    -- "12 Been" above eleven rows reads as a bug.
    (select count(*)::int
       from venue_ratings r
       join venues v on v.id = r.venue_id and v.is_active
      where r.user_id = p_user),
    -- count(distinct other party): friendships is unique on (user_id,
    -- friend_id), so a pair CAN hold two accepted rows in opposite directions
    -- and a plain count(*) would show that person twice.
    --
    -- The `not exists` mirrors friend_friend_list's blocked clause EXACTLY. If
    -- you change one, change the other — they are the count and the list of
    -- the same set.
    (select count(distinct case when f.user_id = p_user then f.friend_id else f.user_id end)::int
       from friendships f
      where f.status = 'accepted'
        and (f.user_id = p_user or f.friend_id = p_user)
        and not exists (
          select 1
            from friendships b
           where b.status = 'blocked'
             and ((b.user_id = auth.uid()
                   and b.friend_id = case when f.user_id = p_user then f.friend_id else f.user_id end)
               or (b.user_id = case when f.user_id = p_user then f.friend_id else f.user_id end
                   and b.friend_id = auth.uid()))
        ))
  where p_user = auth.uid() or public.are_friends(auth.uid(), p_user);
$$;


-- ----------------------------------------------------------------------------
-- 3. Grants.
--
-- `from public` is NOT enough. Supabase grants EXECUTE to anon explicitly, so a
-- revoke aimed at PUBLIC leaves anon holding its own direct grant — proved on
-- this project 2026-08-09. Name anon.
--
-- auth.uid() is null for anon, so this already returns nothing for a signed-out
-- caller. Revoking anyway means that safety does not depend on reading the
-- function body correctly.
--
-- are_friends is NOT re-granted here. It stays internal-only.
-- ----------------------------------------------------------------------------
revoke execute on function public.friend_friend_list(uuid) from public, anon;
grant  execute on function public.friend_friend_list(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3b. VERIFICATION — read-only.
-- ----------------------------------------------------------------------------

-- 3b.1 Both functions are SECURITY DEFINER and pin pg_temp.
--      Expect two rows, both PASS.
select p.proname,
       p.prosecdef as security_definer,
       p.proconfig,
       case when p.prosecdef
             and p.proconfig::text like '%pg_temp%' then 'PASS' else 'FAIL' end as verdict
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('friend_friend_list', 'friend_profile_stats')
 order by p.proname;

-- 3b.2 anon holds NO execute on any of the three. Expect zero rows.
--      A row here means the oracle is reachable signed-out.
select r.routine_name, g.grantee, g.privilege_type
  from information_schema.routine_privileges g
  join information_schema.routines r
    on r.specific_name = g.specific_name
 where r.routine_schema = 'public'
   and r.routine_name in ('friend_friend_list', 'friend_profile_stats', 'are_friends')
   and g.grantee in ('anon', 'PUBLIC');

-- 3b.3 are_friends is STILL revoked from authenticated. Expect zero rows.
--      This is the 2026-08-10 oracle fix. If a row appears, it regressed.
select r.routine_name, g.grantee, g.privilege_type
  from information_schema.routine_privileges g
  join information_schema.routines r
    on r.specific_name = g.specific_name
 where r.routine_schema = 'public'
   and r.routine_name = 'are_friends'
   and g.grantee = 'authenticated';

-- (A count-vs-list check is deliberately NOT here. Both bodies depend on
--  auth.uid() for the blocked clause, so outside a session they collapse to the
--  same expression and any such query passes tautologically — the same empty-set
--  PASS that made the tagged-score check meaningless on 2026-08-10. The real
--  comparison needs a session, so it lives in section 4.)


-- ============================================================================
-- ============================================================================
-- 4. OPTIONAL LIVE TEST — ⚠️ RUN THIS SECTION BY ITSELF ⚠️
--
-- 🚨 DO NOT PASTE THIS TOGETHER WITH SECTIONS 1-3. It ends in `rollback`, and
--    a rollback in the same paste as DDL discards the DDL while the checks
--    still print PASS. That has happened on this project.
--
-- This writes NOTHING permanent: it only reads, under an impersonated session,
-- inside a transaction that is rolled back. It proves the three things section
-- 3b cannot: that a friend sees the list, that a STRANGER sees nothing, and
-- that the count matches the list for a real viewer.
-- ============================================================================
-- ============================================================================

begin;

create temporary table _res (check_name text, verdict text, detail text) on commit drop;
grant insert, select on _res to authenticated;

do $$
declare
  v_admin     text := current_user;   -- restored before every _res write
  v_role      text;
  v_viewer    uuid;
  v_target    uuid;
  v_stranger  uuid;
  v_list      int;
  v_count     int;
begin
  -- Fixture: a real accepted friendship. Nothing is invented.
  select f.user_id, f.friend_id into v_viewer, v_target
    from friendships f
   where f.status = 'accepted'
   limit 1;

  if v_viewer is null then
    insert into _res values ('fixture', 'SKIP', 'no accepted friendships exist to test with');
    return;
  end if;

  -- Become the viewer.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_viewer, 'role', 'authenticated')::text,
                     true);

  select count(*) into v_list   from public.friend_friend_list(v_target);
  select friend_count into v_count from public.friend_profile_stats(v_target);
  v_role := current_setting('role');
  perform set_config('role', v_admin, true);

  insert into _res values (
    'a. a friend can see the list',
    case when v_role <> 'authenticated' then 'BAD HARNESS: ran as ' || v_role
         when v_list > 0 then 'PASS' else 'FAIL' end,
    'rows = ' || v_list || '; the target has at least the viewer as a friend, so 0 is wrong');

  insert into _res values (
    'b. the count matches the list',
    case when v_role <> 'authenticated' then 'BAD HARNESS: ran as ' || v_role
         when v_list = v_count then 'PASS' else 'FAIL' end,
    'list = ' || v_list || ', friend_count = ' || coalesce(v_count::text, 'null') ||
    '  <-- a header above a shorter list is the bug already fixed once here');

  -- A stranger: someone with NO accepted friendship to the target.
  select p.id into v_stranger
    from profiles p
   where p.id <> v_target
     and not exists (
       select 1 from friendships f
        where f.status = 'accepted'
          and ((f.user_id = p.id and f.friend_id = v_target)
            or (f.user_id = v_target and f.friend_id = p.id)))
   limit 1;

  if v_stranger is null then
    insert into _res values (
      'c. a stranger sees nothing', 'SKIP', 'everyone is friends with the target');
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_stranger, 'role', 'authenticated')::text,
                       true);
    select count(*) into v_list from public.friend_friend_list(v_target);
    v_role := current_setting('role');
    perform set_config('role', v_admin, true);

    insert into _res values (
      'c. a stranger sees nothing',
      case when v_role <> 'authenticated' then 'BAD HARNESS: ran as ' || v_role
           when v_list = 0 then 'PASS' else 'FAIL' end,
      'rows = ' || v_list || '  <-- anything above 0 is the social-graph leak');
  end if;

  perform set_config('role', v_admin, true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Results LAST, immediately before the rollback — the editor shows only the
-- final result set, and nothing may follow the rollback.
select * from _res order by check_name;

rollback;
