-- ============================================================================
-- 2026-08-05 — onboarding taste capture
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-05-onboarding-taste-capture-design.md
-- ============================================================================

-- ---------- 1. private profile fields ----------
-- NOT in `profiles`: that table's SELECT policy makes every column readable by
-- any signed-in user, and RLS is row-level so two columns cannot be exempted.
-- A sibling table with its own policy is the standard shape.
create table if not exists profile_private (
  id       uuid primary key references profiles (id) on delete cascade,
  birthday date not null,
  gender   text check (gender in ('woman','man','nonbinary','prefer_not_to_say'))
);

alter table profile_private enable row level security;

drop policy if exists "own private profile readable" on profile_private;
create policy "own private profile readable"
  on profile_private for select to authenticated using (auth.uid() = id);

drop policy if exists "own private profile insert" on profile_private;
create policy "own private profile insert"
  on profile_private for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own private profile update" on profile_private;
create policy "own private profile update"
  on profile_private for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- 2. exact match key for venues ----------
-- Makes a future "we added your bar" an exact join instead of fuzzy strings.
alter table venues add column if not exists google_place_id text;
create unique index if not exists venues_google_place_id_idx
  on venues (google_place_id) where google_place_id is not null;

-- ---------- 3. requested venues ----------
create table if not exists venue_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  google_place_id    text not null,
  name               text not null,
  address            text,
  created_at         timestamptz not null default now(),
  fulfilled_venue_id uuid references venues (id),
  unique (user_id, google_place_id)
);

create index if not exists venue_requests_place_idx on venue_requests (google_place_id);

alter table venue_requests enable row level security;

drop policy if exists "users read own requests" on venue_requests;
create policy "users read own requests"
  on venue_requests for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "users create own requests" on venue_requests;
create policy "users create own requests"
  on venue_requests for insert to authenticated
  with check (auth.uid() = user_id);

-- No client UPDATE or DELETE. fulfilled_venue_id is set by an operator.

-- ---------- verification ----------
select tablename, policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public' and tablename in ('profile_private','venue_requests')
 order by tablename, cmd;

-- Expect true, true.
select
  (select count(*) from information_schema.columns
    where table_name = 'venues' and column_name = 'google_place_id') = 1 as has_place_id,
  (select relrowsecurity from pg_class where relname = 'profile_private') as pp_rls;
