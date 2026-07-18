-- ============================================================
-- ENDZ — Supabase schema (MVP)
-- Run this in the Supabase SQL editor (SQL > New query > Run).
-- Four core tables: profiles, venues, check_ins, friendships.
-- ============================================================

-- ---------- Enums ----------

create type venue_type as enum ('bar', 'club', 'lounge', 'college_spot', 'upscale', 'other');
create type price_tier as enum ('$', '$$', '$$$', '$$$$');
create type vibe_level as enum ('chill', 'building', 'packed');
create type checkin_visibility as enum ('everyone', 'friends', 'nobody');
create type friend_status as enum ('pending', 'accepted', 'blocked');


-- ---------- profiles ----------
-- One row per user. Links to Supabase auth.users.
-- ghost_mode = global "don't broadcast me" switch.

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  ghost_mode    boolean not null default false,
  created_at    timestamptz not null default now()
);


-- ---------- venues ----------
-- Bars/clubs/lounges. Seed this with real venues for your beachhead.
-- lat/lng drive the map pins.

create table venues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         venue_type not null default 'bar',
  price        price_tier,
  description  text,                    -- short "vibe" blurb
  music        text,                    -- e.g. 'hip-hop', 'house', 'mixed'
  age_range    text,                    -- e.g. '21-25'
  lat          double precision not null,
  lng          double precision not null,
  created_at   timestamptz not null default now()
);

create index venues_geo_idx on venues (lat, lng);


-- ---------- check_ins ----------
-- The live layer. Each check-in auto-expires so the map never shows stale data.
-- expires_at defaults to 3 hours out — tune as you learn.

create table check_ins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  venue_id    uuid not null references venues (id) on delete cascade,
  vibe        vibe_level,
  visibility  checkin_visibility not null default 'friends',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '3 hours')
);

create index check_ins_venue_idx   on check_ins (venue_id);
create index check_ins_user_idx    on check_ins (user_id);
create index check_ins_expires_idx on check_ins (expires_at);


-- ---------- friendships ----------
-- Social graph. Mutual (no one-way follows on the location layer).
-- Store one row per relationship; resolve direction in queries.
-- Friends-of-friends = a 2-hop query over accepted rows.

create table friendships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  friend_id   uuid not null references profiles (id) on delete cascade,
  status      friend_status not null default 'pending',
  created_at  timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friendships_user_idx   on friendships (user_id);
create index friendships_friend_idx on friendships (friend_id);


-- ============================================================
-- Active check-ins view
-- Use this everywhere instead of querying check_ins directly,
-- so expired rows never show up on the map.
-- ============================================================

create view active_check_ins as
  select *
  from check_ins
  where expires_at > now();


-- ============================================================
-- Cleanup (optional but recommended)
-- The view already hides expired rows. This just keeps the table small.
-- Requires the pg_cron extension (enable under Database > Extensions).
-- ============================================================

-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'purge-expired-checkins',
--   '*/15 * * * *',                       -- every 15 minutes
--   $$ delete from check_ins where expires_at < now() - interval '1 hour' $$
-- );


-- ============================================================
-- LIVE DB OBJECTS created outside this file — verified in the
-- 2026-07-14 security audit. Documented here so they're version-
-- controlled. (Capture the exact venue_activity body to this file
-- when convenient — SQL editor cell truncates it in the UI.)
-- ============================================================

-- venue_activity() — anonymous per-venue counts for map pins.
--   SECURITY DEFINER (verified): bypasses check_ins RLS so signed-out /
--   non-friend callers still get a count, WITHOUT exposing the rows.
--   RETURNS TABLE(venue_id uuid, active_count bigint, latest_vibe vibe_level)
--   — aggregates only, NO user_id / identity columns. search_path is pinned
--   (proconfig set). Called via supabase.rpc('venue_activity') in
--   src/hooks/useCheckIns.ts. AUDIT: safe — no identity leak.

-- waitlist — early-access signup capture (name, email, phone, source).
--   RLS ENABLED (verified relrowsecurity = true). Exactly ONE policy:
--   "anyone can join waitlist" — INSERT for {anon, authenticated},
--   with_check true, NO using-expr. There is deliberately NO SELECT
--   policy, so the client can insert but can never read the list back.
--   Written by src/lib/waitlist.ts. AUDIT: safe — list stays private.


-- ============================================================
-- Row-Level Security (RLS)
-- Turn it on for every table. Below are sane MVP starter policies —
-- tighten as the friends-of-friends rules firm up.
-- ============================================================

alter table profiles    enable row level security;
alter table venues      enable row level security;
alter table check_ins   enable row level security;
alter table friendships enable row level security;

-- profiles: anyone signed in can read basic profiles; you can only edit your own.
create policy "profiles readable by authenticated"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "users insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- venues: readable by anyone signed in. Writes locked down (seed via service role/admin).
create policy "venues readable by authenticated"
  on venues for select
  using (auth.role() = 'authenticated');

-- check_ins: a user can create/delete their own.
create policy "users create own checkins"
  on check_ins for insert
  with check (auth.uid() = user_id);

create policy "users delete own checkins"
  on check_ins for delete
  using (auth.uid() = user_id);

-- (Patch 2026-07-14) UPDATE policy — RLS was enabled with no UPDATE policy,
-- so setVibe()'s update silently matched 0 rows and vibes never saved.
-- Owner may change vibe and end a check-in early (expires_at may only move
-- earlier — also what the future delete→expire history change needs).
-- id / user_id / venue_id / created_at / visibility are immutable via the
-- pre-update snapshot exists() (RLS has no OLD reference). If a
-- "change visibility mid-check-in" feature lands later, relax the
-- visibility line here.
create policy "users update own checkins"
  on check_ins for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from check_ins prev
      where prev.id = check_ins.id
        and prev.user_id = check_ins.user_id
        and prev.venue_id = check_ins.venue_id
        and prev.created_at = check_ins.created_at
        and prev.visibility = check_ins.visibility
        and check_ins.expires_at <= prev.expires_at
    )
  );

-- check_ins read policy (MVP):
-- you can see a check-in if it's yours, OR it's visible to 'everyone',
-- OR it's 'friends' and you're an accepted friend of that user,
-- AND the user isn't in ghost mode.
create policy "checkins visible per rules"
  on check_ins for select
  using (
    auth.uid() = user_id
    or (
      not exists (
        select 1 from profiles p
        where p.id = check_ins.user_id and p.ghost_mode = true
      )
      and (
        visibility = 'everyone'
        or (
          visibility = 'friends'
          and exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and (
                (f.user_id = auth.uid()   and f.friend_id = check_ins.user_id) or
                (f.friend_id = auth.uid() and f.user_id   = check_ins.user_id)
              )
          )
        )
      )
    )
  );

-- friendships: you can see rows you're part of; writes are tightly scoped.
-- (RLS patch 2026-07-14, per the friends-core spec "Hard prerequisite before
-- merge": DELETE policy with blocked-side exception, recipient-only accept
-- with immutable row identities, INSERT hardening against reverse block-rows.
-- Block semantics: blocking = delete any pair row, then insert
-- (blocker, blocked, 'blocked') — so user_id is always the blocker.)
create policy "users see own friendships"
  on friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Insert your own requests — denied if the target has blocked you
-- (reverse blocked row is visible to you: you're its friend_id).
create policy "users create own friend requests"
  on friendships for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from friendships rev
      where rev.user_id = friendships.friend_id
        and rev.friend_id = friendships.user_id
        and rev.status = 'blocked'
    )
  );

-- Only the recipient may accept, and only pending → accepted.
-- The exists() compares the new row against the pre-update snapshot,
-- making id / user_id / friend_id immutable (RLS has no OLD reference).
create policy "recipient accepts pending request"
  on friendships for update
  using (auth.uid() = friend_id and status = 'pending')
  with check (
    auth.uid() = friend_id
    and status = 'accepted'
    and exists (
      select 1 from friendships prev
      where prev.id = friendships.id
        and prev.user_id = friendships.user_id
        and prev.friend_id = friendships.friend_id
    )
  );

-- Decline/cancel/remove are deletes by either party; unblock is a delete by
-- the blocker (user_id). The blocked side can never delete the block row.
create policy "users delete own friendships"
  on friendships for delete
  using (
    auth.uid() = user_id
    or (auth.uid() = friend_id and status <> 'blocked')
  );


-- ---------- events ----------
-- Append-only product analytics (check-ins, opens, directions, etc.).
-- One row per user action. user_id is null for signed-out visitors;
-- anonymous_id (a device-scoped uuid from localStorage) always present.
-- Written by src/lib/analytics.ts (logEvent). Read only server-side /
-- dashboards via the service role — never from the client.
-- Applied 2026-07-15; verified live (venue_open/check_in/vibe_set rows landed).

create table events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  anonymous_id  text not null,
  event_name    text not null,
  venue_id      uuid references venues (id) on delete set null,
  props         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index events_created_idx on events (created_at);
create index events_name_idx    on events (event_name);
create index events_venue_idx    on events (venue_id);
create index events_user_idx     on events (user_id);

alter table events enable row level security;

-- INSERT only. with_check pins user_id to the caller so a client can't
-- attribute events to someone else (anon → auth.uid() is null → user_id
-- must be null; authenticated → user_id null or their own uid).
create policy "anyone can log events"
  on events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Deliberately NO select / update / delete policy: the list stays private
-- and immutable from the client, exactly like waitlist.

-- Belt-and-suspenders; may be redundant if Supabase default privileges
-- already grant insert to these roles (they do for the waitlist table).
grant insert on events to anon, authenticated;


-- ============================================================
-- Notes
-- ============================================================
-- 1. Friends-of-friends (Phase: nice-to-have) is a 2-hop query, not a column.
--    Get your accepted friends, then their accepted friends, exclude yourself
--    and people already your direct friends. Add an FoF visibility tier later
--    if you want check-ins to show one hop out.
-- 2. Venue "activity level" for pins = count of rows in active_check_ins for
--    that venue. No extra column needed; derive it live.
-- 3. Adjust the 3-hour expiry once you see real session lengths.
-- ---------- venues.is_active (curated starter set) ----------
-- Soft-hide flag: only is_active = true venues surface in the app
-- (SupabaseDataSource.getVenues filters on it). Dormant venues stay in
-- the table so they can be flipped back on without re-seeding.
-- Applied 2026-07-15: 28 active, 24 dormant.

alter table venues add column if not exists is_active boolean not null default true;

update venues set is_active = false where name in (
  'International Bar',
  'KGB Bar',
  'Juke Bar',
  'Ten Degrees',
  'The Headless Widow',
  'Wonderland Bar',
  'Bua',
  'Superbueno',
  'Sweet Linda',
  'Motel No Tell',
  'Solas',
  'Paradise Lost',
  'Goodnight Sonny',
  'Lucky',
  'Mona''s',
  'The York',
  'The Spotted Owl Tavern',
  'Accidental Bar',
  'Berlin',
  'Little Rebel',
  'Big Bar',
  'Two Perrys',
  'Wiggle Room',
  'Banshee'
);

-- sanity: should return 28 active / 24 inactive
select is_active, count(*) from venues group by is_active order by is_active;
