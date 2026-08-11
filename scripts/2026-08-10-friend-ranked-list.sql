-- Friend-visible ranked lists. Paste in the SQL editor.
--
-- WHY A FUNCTION AND NOT A POLICY
-- venue_ratings is owner-only and stays that way. Widening its SELECT policy to
-- "owner or accepted friend" would put a friendships subquery inside the policy
-- of a table that other policies already read — the exact shape that took the
-- night feed down on 2026-08-09 with 42P17 infinite recursion. A SECURITY
-- DEFINER function keeps the table's policy trivially owner-only and puts the
-- friendship check somewhere it can be read, tested, and revoked in one place.
--
-- WHAT IS SHARED
-- The ranked list only: venue, bucket, rank position, score. Not rated_at —
-- when someone rated a place is a timestamp trail we have no reason to hand
-- over, and this project has already shipped one retention finding.
--
-- Saves are NOT shared here. venue_saves has its own per-user visibility
-- setting (profiles.save_visibility) and folding it into a friends-only
-- function would silently overrule a user who set their saves to nobody.

-- ----------------------------------------------------------------------------
-- Are these two people accepted friends? Extracted because both functions below
-- need it and the same predicate is already inlined in half a dozen policies.
-- ----------------------------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from friendships f
     where f.status = 'accepted'
       and ((f.user_id = a and f.friend_id = b)
         or (f.user_id = b and f.friend_id = a))
  );
$$;

-- ----------------------------------------------------------------------------
-- Another user's ranked list, if you are allowed to see it.
--
-- Returns ZERO ROWS rather than raising when you are not a friend. A raise
-- would leak the difference between "not your friend" and "has no ratings",
-- and the caller has to handle the empty case anyway.
--
-- A blocked relationship has status 'blocked', never 'accepted', so blocking
-- removes access with no extra clause.
-- ----------------------------------------------------------------------------
create or replace function public.friend_ranked_list(p_user uuid)
returns table (venue_id uuid, bucket text, rank_position int, score numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.venue_id, r.bucket, r.rank_position, r.score
    from venue_ratings r
   where r.user_id = p_user
     and (p_user = auth.uid() or public.are_friends(auth.uid(), p_user))
   order by r.score desc, r.rank_position asc;
$$;

-- ----------------------------------------------------------------------------
-- Counts for another user's profile header. Same gate as the list itself: if
-- you cannot see the list, you do not get its size either.
-- ----------------------------------------------------------------------------
create or replace function public.friend_profile_stats(p_user uuid)
returns table (been_count int, friend_count int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::int from venue_ratings r where r.user_id = p_user),
    (select count(*)::int from friendships f
      where f.status = 'accepted'
        and (f.user_id = p_user or f.friend_id = p_user))
  where p_user = auth.uid() or public.are_friends(auth.uid(), p_user);
$$;

-- ----------------------------------------------------------------------------
-- Grants.
--
-- `from public` is NOT enough. Supabase grants EXECUTE to anon explicitly, so a
-- revoke aimed at PUBLIC leaves anon holding its own direct grant — proved on
-- this project 2026-08-09. Name anon.
--
-- auth.uid() is null for anon, so every one of these already returns nothing
-- for a signed-out caller. Revoking anyway means that safety does not depend on
-- reading the function body correctly.
-- ----------------------------------------------------------------------------
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.friend_ranked_list(uuid) from public, anon;
revoke execute on function public.friend_profile_stats(uuid) from public, anon;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.friend_ranked_list(uuid) to authenticated;
grant execute on function public.friend_profile_stats(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- PROOF. Run these as a signed-in user in the SQL editor's "run as" if
-- available; otherwise they document what must hold and the app-level probe in
-- the summary covers it.
--
-- 1. anon must not be able to execute any of the three.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('are_friends', 'friend_ranked_list', 'friend_profile_stats');
-- Expect: anon_can_execute = false on all three rows.

-- 2. Every one of them must pin search_path, including pg_temp. A SECURITY
--    DEFINER function without pg_temp can be hijacked via a temp-schema object.
select p.proname, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('are_friends', 'friend_ranked_list', 'friend_profile_stats');
-- Expect: proconfig contains search_path=public, pg_temp on all three.

-- 3. venue_ratings' own policies must be UNCHANGED — still owner-only.
select policyname, cmd, qual
  from pg_policies
 where tablename = 'venue_ratings';
-- Expect: four policies, every one of them auth.uid() = user_id.
