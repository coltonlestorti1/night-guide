-- ENDZ — 2026-08-05
-- App Store compliance: the two hard blockers that don't depend on Apple.
--
--   Part 1: delete_own_account()  — Guideline 5.1.1(v), in-app account deletion
--   Part 2: reports              — Guideline 1.2, reporting user content
--
-- Paste the whole file into the Supabase SQL editor in one go.

begin;

-- ============================================================
-- PART 1 — in-app account deletion (Guideline 5.1.1(v))
-- ============================================================
-- Apple requires deletion to be INITIATED IN THE APP. Profile.tsx currently
-- opens a mailto: to support, which Apple explicitly names as insufficient.
--
-- Deleting an auth user cannot be done with the anon key, and this project has
-- no Edge Function deploy path (only the anon key exists locally — see
-- night-guide/CLAUDE.md). A SECURITY DEFINER function owned by postgres does
-- the same job as a service-role Edge Function with none of the deploy
-- machinery, and it stays in the clipboard→SQL-editor workflow everything else
-- here already uses.
--
-- The cascade does the actual work. auth.users → profiles is ON DELETE CASCADE,
-- and profiles is the parent of check_ins, friendships, venue_saves, plans and
-- plan_rsvps (all ON DELETE CASCADE). events.user_id is ON DELETE SET NULL, so
-- an event outlives its creator with no attribution. Verified against
-- endz-schema.sql, 2026-08-05.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
-- auth is on the path because the function deletes from auth.users; pinning it
-- is what stops a search_path attack against a SECURITY DEFINER function.
set search_path = public, auth
as $$
begin
  -- No parameter, and the id comes from the JWT — there is deliberately no way
  -- to express "delete somebody else's account" through this function.
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on a new function, which would
-- leave this callable with just the anon key. That exact mistake was found and
-- fixed on record_venue_hour_samples() (see endz-schema.sql) — do not repeat it.
revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant  execute on function public.delete_own_account() to authenticated;


-- ============================================================
-- PART 2 — reports (Guideline 1.2)
-- ============================================================
-- ENDZ carries user-generated content: usernames, display names, bios,
-- avatars, plan titles and notes. Apple requires a way to REPORT objectionable
-- content and BLOCK the user who posted it, plus acting on reports within 24h.
-- Blocking already exists (useBlockUser); reporting did not exist at all.

do $$ begin
  create type report_reason as enum (
    'harassment', 'spam', 'impersonation', 'inappropriate', 'safety', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
exception when duplicate_object then null;
end $$;

create table if not exists reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references profiles (id) on delete cascade,
  reported_user_id  uuid not null references profiles (id) on delete cascade,
  -- What was being looked at when the report was filed ('profile' | 'plan').
  -- Kept as free text plus a loose id: reports must survive the thing they
  -- point at being deleted, so this is deliberately NOT a foreign key.
  context           text not null default 'profile',
  context_id        uuid,
  reason            report_reason not null,
  details           text,
  status            report_status not null default 'open',
  created_at        timestamptz not null default now()
);

-- One report per person per target per surface: a user who taps report twice
-- has not found two problems, and dedupe makes the button idempotent instead
-- of a way to flood the table.
--
-- This is deliberately TWO partial indexes rather than one table-level UNIQUE.
-- Postgres treats NULLs as distinct in a unique constraint, so
-- `unique (reporter_id, reported_user_id, context, context_id)` would allow
-- unlimited duplicates for profile reports — where context_id is ALWAYS null,
-- i.e. the common case. The constraint would have looked correct and enforced
-- nothing. (`nulls not distinct` would also work but needs PG15+; partial
-- indexes work everywhere.)
create unique index if not exists reports_dedupe_ctx
  on reports (reporter_id, reported_user_id, context, context_id)
  where context_id is not null;

create unique index if not exists reports_dedupe_no_ctx
  on reports (reporter_id, reported_user_id, context)
  where context_id is null;

create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_reported_idx on reports (reported_user_id);

alter table reports enable row level security;

-- File a report about someone else. Self-reports are rejected at the policy
-- level rather than in the client, so the rule holds no matter what calls it.
create policy "users file own reports"
  on reports for insert
  with check (
    auth.uid() = reporter_id
    and reported_user_id <> auth.uid()
  );

-- A reporter may see what they filed — that is what lets the UI say "already
-- reported" instead of failing on the unique constraint. Nobody can read a
-- report filed against them: that would turn reporting into a way to start a
-- fight, which is the opposite of the point.
create policy "reporters see own reports"
  on reports for select
  using (auth.uid() = reporter_id);

-- No UPDATE or DELETE policy on purpose. A filed report is immutable from the
-- client; triage happens through the Supabase dashboard on the service role,
-- which bypasses RLS. When the admin dashboard grows a moderation screen it
-- gets its own role-gated policy — deliberately not granted here.

commit;

-- ------------------------------------------------------------
-- AFTER PASTING — verify both, and expect the first to fail:
--
--   1. As anon (the app's key), delete_own_account() must be DENIED:
--      curl -s -X POST "$URL/rest/v1/rpc/delete_own_account" -H "apikey: $ANON"
--      → expects a permission-denied error, NOT a success.
--
--   2. As anon, reports must return [] (RLS on, no rows visible), and an
--      insert must be rejected.
-- ------------------------------------------------------------
