-- ENDZ — 2026-08-05
-- Part 1: venue_saves (server-backed saves; powers the friend facepile on cards)
-- Part 2: check-in history (stop deleting rows) + the RLS fix that MUST ship with it
--
-- Paste this whole file into the Supabase SQL editor in one go. Part 2's policy
-- replacement is not optional — see the warning above it.

begin;

-- ============================================================
-- PART 1 — venue_saves
-- ============================================================
-- Saves used to live in localStorage (src/store/saved.ts), so they were
-- per-device and invisible to everyone including their own owner on a second
-- phone. Moving them server-side is what makes "3 friends saved this" possible.
--
-- Reuses checkin_visibility so a save follows the same everyone/friends/nobody
-- vocabulary the user already learned from check-ins. Default 'friends' matches
-- the check-in default — a save is a taste disclosure, not a public post.

create table if not exists venue_saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  venue_id    uuid not null references venues (id) on delete cascade,
  visibility  checkin_visibility not null default 'friends',
  created_at  timestamptz not null default now(),
  unique (user_id, venue_id)   -- one save per person per venue; toggle = delete
);

create index if not exists venue_saves_venue_idx on venue_saves (venue_id);
create index if not exists venue_saves_user_idx  on venue_saves (user_id);

alter table venue_saves enable row level security;

create policy "users create own saves"
  on venue_saves for insert
  with check (auth.uid() = user_id);

create policy "users delete own saves"
  on venue_saves for delete
  using (auth.uid() = user_id);

-- Only the visibility of your own save may change. user_id / venue_id are held
-- immutable by the pre-update snapshot, the same pattern check_ins uses (RLS
-- has no OLD reference, so the snapshot is how you pin a column).
create policy "users update own saves"
  on venue_saves for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from venue_saves prev
      where prev.id = venue_saves.id
        and prev.user_id  = venue_saves.user_id
        and prev.venue_id = venue_saves.venue_id
    )
  );

-- Read rules mirror check_ins exactly: yours, or 'everyone', or 'friends' and
-- we're accepted friends — and never anyone in ghost mode.
create policy "saves visible per rules"
  on venue_saves for select
  using (
    auth.uid() = user_id
    or (
      not exists (
        select 1 from profiles p
        where p.id = venue_saves.user_id and p.ghost_mode = true
      )
      and (
        visibility = 'everyone'
        or (
          visibility = 'friends'
          and exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and (
                (f.user_id = auth.uid()   and f.friend_id = venue_saves.user_id) or
                (f.friend_id = auth.uid() and f.user_id   = venue_saves.user_id)
              )
          )
        )
      )
    )
  );

-- Default visibility for NEW saves, remembered per user (the Profile toggle).
alter table profiles
  add column if not exists save_visibility checkin_visibility not null default 'friends';


-- ============================================================
-- PART 2 — check-in history
-- ============================================================
-- Until now a check-in ENDED by being deleted: checkOut() and the
-- "one place at a time" rule in checkIn() both ran DELETE. That means ENDZ has
-- no memory of where anyone has been, so "their weekend regular" cannot be
-- computed and venue_hour_stats is the only history that exists.
--
-- New rule: ending a check-in sets expires_at = now(). Nothing is deleted.
-- active_check_ins (expires_at > now()) is unchanged, so the live map, pin
-- counts and venue_activity() all behave exactly as before.

-- ended_at records an explicit "I left" and distinguishes it from the 3-hour
-- auto-expiry. Both are ended check-ins; only one is a deliberate signal, and
-- the difference matters when history is used to infer a regular haunt.
alter table check_ins
  add column if not exists ended_at timestamptz;

-- History is queried by "this user, most recent first" — the existing
-- check_ins_user_idx alone degrades once rows accumulate instead of vanishing.
create index if not exists check_ins_user_history_idx
  on check_ins (user_id, created_at desc);

-- ------------------------------------------------------------
-- !! THE PART THAT IS NOT OPTIONAL !!
-- ------------------------------------------------------------
-- "checkins visible per rules" has NO time bound. That was harmless only
-- because ended rows were deleted a moment later. The instant this table
-- retains history, that same policy lets any accepted friend read your ENTIRE
-- location history straight off the base table via PostgREST — not just where
-- you are now. The app would never show it; the API would hand it over.
--
-- Retaining history and leaving this policy alone converts a live-presence
-- feature into a permanent location log readable by every friend. So the time
-- bound ships in the same transaction as the retention.
--
-- After this: you see all of your own rows. Everyone else sees only rows that
-- are still active — exactly what they could see before.

drop policy if exists "checkins visible per rules" on check_ins;

create policy "checkins visible per rules"
  on check_ins for select
  using (
    auth.uid() = user_id
    or (
      expires_at > now()                       -- <-- the fix: live rows only
      and not exists (
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

-- The UPDATE policy already permits expires_at to move earlier and nothing
-- else, which is precisely "end my check-in". No change needed — ending a
-- check-in was already an allowed update, it just wasn't how the client did it.

-- Let a user erase their own history. DELETE stays owner-only (unchanged), so
-- this needs no new policy — it's here as the documented escape hatch:
--   delete from check_ins where user_id = auth.uid() and expires_at <= now();

commit;

-- ------------------------------------------------------------
-- AFTER PASTING — do NOT enable the purge job in endz-schema.sql.
-- The commented-out pg_cron 'purge-expired-checkins' schedule deletes
-- expired rows an hour after they end. That job is now the exact opposite
-- of what we want; if it ever gets switched on it silently eats the history.
-- A retention window (if we choose one) replaces it, e.g. 12 months:
--   $$ delete from check_ins where expires_at < now() - interval '12 months' $$
-- ------------------------------------------------------------
