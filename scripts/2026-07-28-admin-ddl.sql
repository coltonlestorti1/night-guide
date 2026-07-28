-- ============================================================================
-- 2026-07-28 — admin dashboard v1
--
-- Additive and idempotent. Safe to run more than once. Nothing existing
-- changes behavior for non-admin users: every new policy is additive, and
-- `role` defaults to 'user' for all 56 existing rows.
--
-- Run this WHOLE file in the Supabase SQL editor in one go, top to bottom.
-- Section 1 must commit before section 3 uses the enum, which is why the
-- enum creation is wrapped in its own DO block rather than an ALTER TYPE.
--
-- ⚠️ SECURITY FIX INCLUDED (section 4). The existing "users update own
-- profile" policy has no WITH CHECK on individual columns, so once `role`
-- exists ANY signed-in user could run
--     update profiles set role = 'super_admin' where id = auth.uid();
-- and promote themselves. Section 4's trigger closes that. Do not skip it,
-- and do not add the column without it.
-- ============================================================================


-- ---------- 1. role enum ----------
do $$ begin
  create type admin_role as enum ('user', 'admin', 'super_admin');
exception when duplicate_object then null;
end $$;


-- ---------- 2. profiles.role ----------
-- Readable by any authenticated user (inherits the existing profiles SELECT
-- policy). That is deliberate and harmless: knowing who an admin is grants
-- nothing, and hiding it would mean splitting the profiles read path.
alter table profiles add column if not exists role admin_role not null default 'user';


-- ---------- 3. is_admin() ----------
-- SECURITY DEFINER so it can read profiles.role from inside a policy without
-- being subject to that same policy (no recursion). search_path is pinned,
-- same as venue_activity().
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- ---------- 4. privilege-escalation guard (REQUIRED) ----------
-- RLS cannot reference OLD, so the column-level rule lives in a trigger.
-- auth.uid() is null for the service role and for the SQL editor, which is
-- how Colton's paste below is allowed through; every real user session has a
-- non-null uid and is rejected.
create or replace function public.guard_profile_role() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'role is not self-assignable';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
  before update on profiles
  for each row execute function public.guard_profile_role();


-- ---------- 5. admins may edit venues ----------
-- venues has always been SELECT-only for authenticated users; every write so
-- far went through the service role or this SQL editor. This is what makes
-- the dashboard's venue editor work.
drop policy if exists "admins update venues" on venues;
create policy "admins update venues"
  on venues for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Insert/delete are deliberately NOT granted. Adding or removing a venue is
-- a seed-file operation with research behind it, not a dashboard button.


-- ---------- 6. admins may read events ----------
-- events was created INSERT-only on purpose (same shape as waitlist), so
-- nothing could read it outside the Supabase console. This opens reads to
-- admins only; update/delete stay closed so the log remains immutable.
drop policy if exists "admins read events" on events;
create policy "admins read events"
  on events for select
  to authenticated
  using (public.is_admin());


-- ---------- 7. aggregate RPCs ----------
-- The dashboard needs counts, not rows. Pulling every event row to the client
-- just to length() it would get slow and leak more than it needs to. Each RPC
-- re-checks is_admin() itself because SECURITY DEFINER bypasses RLS.

-- Event volume by name since a cutoff.
create or replace function public.admin_event_counts(p_since timestamptz)
returns table (event_name text, total bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select e.event_name, count(*)::bigint
    from events e
    where e.created_at >= p_since
    group by e.event_name
    order by count(*) desc;
end $$;

-- Event volume per day, for the one chart that has real data behind it.
create or replace function public.admin_events_daily(p_since timestamptz)
returns table (day date, total bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select e.created_at::date as day, count(*)::bigint
    from events e
    where e.created_at >= p_since
    group by e.created_at::date
    order by 1;
end $$;

-- Single-row totals for the overview cards.
create or replace function public.admin_overview()
returns table (
  venues_total       bigint,
  venues_active      bigint,
  profiles_total     bigint,
  check_ins_total    bigint,
  check_ins_active   bigint,
  plans_total        bigint,
  waitlist_total     bigint,
  events_total       bigint,
  events_last_7d     bigint,
  first_event_at     timestamptz,
  last_event_at      timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      (select count(*) from venues)::bigint,
      (select count(*) from venues where is_active)::bigint,
      (select count(*) from profiles)::bigint,
      (select count(*) from check_ins)::bigint,
      (select count(*) from check_ins where expires_at > now())::bigint,
      (select count(*) from plans)::bigint,
      (select count(*) from waitlist)::bigint,
      (select count(*) from events)::bigint,
      (select count(*) from events where created_at > now() - interval '7 days')::bigint,
      (select min(created_at) from events),
      (select max(created_at) from events);
end $$;

grant execute on function public.admin_event_counts(timestamptz) to authenticated;
grant execute on function public.admin_events_daily(timestamptz)  to authenticated;
grant execute on function public.admin_overview()                 to authenticated;


-- ---------- 8. seed the one admin ----------
-- Colton only. Adding anyone later is this same one-liner with a different
-- email — it does not need a code change.
update profiles p
   set role = 'super_admin'
  from auth.users u
 where u.id = p.id
   and lower(u.email) = 'colton.lestorti@gmail.com';


-- ---------- verification ----------
-- Expect: one super_admin row, and 56 venues untouched at role-default 'user'.
select u.email, p.username, p.role
  from profiles p join auth.users u on u.id = p.id
 where p.role <> 'user';

select role, count(*) from profiles group by role;

-- Expect true when run as Colton in the app; in the SQL editor auth.uid() is
-- null so this correctly returns false. Verify it from the app, not here.
select public.is_admin() as is_admin_in_sql_editor_expect_false;
