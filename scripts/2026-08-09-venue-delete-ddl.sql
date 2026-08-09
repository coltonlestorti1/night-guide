-- ============================================================================
-- 2026-08-09 — admin venue delete
-- Additive and idempotent. Safe to run more than once.
--
-- WHY A NEW DELETE POLICY IS REQUIRED
-- scripts/2026-07-28-admin-ddl.sql granted admins UPDATE on venues and said
-- "Insert/delete are deliberately NOT granted. Adding or removing a venue is a
-- seed-file operation with research behind it, not a dashboard button." That
-- call is being reversed for delete only: the admin dashboard is getting a
-- destructive delete action, so without this policy `delete from venues ...`
-- from the app matches zero rows and silently no-ops — same failure shape as
-- the pre-admin-ddl venue editor.
--
-- WHY venue_delete_impact() EXISTS AT ALL
-- check_ins, venue_ratings and night_posts are RLS-protected so a browser
-- client only ever sees its own rows plus whatever is currently public. If the
-- admin UI counted "rows attached to this venue" with a plain client-side
-- select, a venue with 14 *other people's* check-ins would report 0 attached
-- records, and a confirmation guard built on that count would wave the delete
-- through. Counting has to happen inside the database, past RLS, which is
-- exactly what SECURITY DEFINER is for — and exactly why it re-checks
-- is_admin() itself rather than trusting the caller. A SECURITY DEFINER
-- function that skips its own authorization check is a privilege-escalation
-- hole, and this one can count other users' private rows (their check-ins,
-- their ratings) for a venue the caller may not even be allowed to see.
--
-- CASCADE MAP (verified against endz-schema.sql and scripts/*.sql —
-- endz-schema.sql itself is missing the `create table` statements for
-- venue_hour_stats, venue_saves and night_posts; those three were confirmed
-- from the scripts that created them instead):
--   check_ins.venue_id            on delete cascade  -> row destroyed
--   venue_ratings.venue_id        on delete cascade  -> row destroyed
--   night_posts.venue_id          on delete cascade  -> row destroyed
--   plans.venue_id                on delete cascade  -> row destroyed
--   venue_saves.venue_id          on delete cascade  -> row destroyed
--   venue_hour_stats.venue_id     on delete cascade  -> row destroyed
--   events.venue_id               on delete set null -> row survives, venue_id -> null
--   venue_requests.fulfilled_venue_id   (no action)   -> BLOCKS the delete with
--     a foreign-key violation until that request is reassigned or cleared.
--
-- TRANSITIVE CASCADE — night_posts.venue_id going away drags MORE than the
-- venue_delete_impact() "night_posts" count reveals. night_comments,
-- night_post_likes, night_post_tags and night_post_photos all reference
-- night_posts (not venues directly), each ON DELETE CASCADE, so deleting a
-- venue with 2 night posts can destroy dozens of rows once every comment,
-- like, tag and photo on those 2 posts is counted. venue_delete_impact()
-- deliberately does NOT add sub-counts for these — that would mean either a
-- much heavier function or a second RPC just for depth-2 counts, for numbers
-- an admin cannot act on individually anyway (you either delete the venue and
-- everything under it, or you don't). The honest fix is at the UI layer: the
-- confirmation copy must say plainly that deleting a night post also deletes
-- its comments, likes, tags and photos, not just report a "night_posts"
-- number that undersells what actually dies.
-- ============================================================================


-- ---------- 1. admins may delete venues ----------
drop policy if exists "admins delete venues" on venues;
create policy "admins delete venues"
  on venues for delete
  to authenticated
  using (public.is_admin());


-- ---------- 2. is_admin() — RESTATED, search_path fix ----------
-- The original definition in scripts/2026-07-28-admin-ddl.sql pins
-- `set search_path = public` but NOT pg_temp. When pg_temp is not listed
-- explicitly, Postgres searches it FIRST for unqualified relation names.
-- Any authenticated user can run `create temp table profiles(id uuid, role
-- text)` in their own session and insert a row making themselves look like an
-- admin; is_admin()'s `select ... from profiles` would then resolve to that
-- session-local temp table instead of public.profiles and return true. That
-- function already gates venue UPDATE and the whole admin dashboard, and this
-- script adds venue DELETE behind the same gate — the fix belongs here, in
-- the script that is actually about to be pasted, not as a silent edit to the
-- 2026-07-28 file (which stays as the historical record of what shipped
-- then). `create or replace` is safe: same signature, same behavior, just a
-- closed search_path.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

grant execute on function public.is_admin() to authenticated;


-- ---------- 3. venue_delete_impact() ----------
-- One column per table that references venues, named for the table, so the
-- admin sees the full blast radius before confirming. Same SECURITY DEFINER +
-- pinned search_path + self-checked is_admin() pattern as admin_overview() in
-- scripts/2026-07-28-admin-ddl.sql — with search_path additionally pinning
-- pg_temp for the same reason as is_admin() above; this function also reads
-- straight from base tables under SECURITY DEFINER and is just as reachable
-- by a `create temp table check_ins(...)` shadowing trick otherwise.
-- Every source table is aliased (c, vr, np, ...) even though most of the
-- queries don't strictly need it, because the OUT parameters implied by
-- `returns table` are named identically to several of these tables
-- (check_ins, venue_ratings, ...) and become PL/pgSQL variables in scope for
-- the rest of the function body. Aliasing sidesteps that name collision
-- entirely instead of relying on qualified-reference resolution rules.
drop function if exists public.venue_delete_impact(uuid);
create or replace function public.venue_delete_impact(p_venue_id uuid)
returns table (
  check_ins        bigint,
  venue_ratings    bigint,
  night_posts      bigint,
  plans            bigint,
  venue_saves      bigint,
  venue_hour_stats bigint,
  events           bigint,
  venue_requests   bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      (select count(*) from check_ins c        where c.venue_id = p_venue_id)::bigint,
      (select count(*) from venue_ratings vr    where vr.venue_id = p_venue_id)::bigint,
      (select count(*) from night_posts np      where np.venue_id = p_venue_id)::bigint,
      (select count(*) from plans pl            where pl.venue_id = p_venue_id)::bigint,
      (select count(*) from venue_saves vs      where vs.venue_id = p_venue_id)::bigint,
      (select count(*) from venue_hour_stats vh where vh.venue_id = p_venue_id)::bigint,
      (select count(*) from events ev           where ev.venue_id = p_venue_id)::bigint,
      (select count(*) from venue_requests vreq where vreq.fulfilled_venue_id = p_venue_id)::bigint;
end $$;

-- Default PUBLIC grant on new functions would otherwise leave `anon` able to
-- call this — harmlessly, since is_admin() rejects it with "not authorized",
-- but the grant should say what it means rather than rely on that rejection
-- being the only thing standing between anon and a call attempt.
revoke execute on function public.venue_delete_impact(uuid) from public;
grant execute on function public.venue_delete_impact(uuid) to authenticated;


-- ---------- verification ----------
-- Run after pasting, signed in as Colton in the app (auth.uid() is null in
-- the SQL editor, so is_admin() correctly returns false there and the RPC
-- below will raise "not authorized" if run from this editor instead).
--
-- select policyname from pg_policies
--   where tablename = 'venues' and policyname = 'admins delete venues';
--   -- expect: one row
--
-- select proname, proconfig from pg_proc
--   where proname in ('is_admin', 'venue_delete_impact') and pronamespace = 'public'::regnamespace;
--   -- expect proconfig to include search_path=public, pg_temp for both rows
--
-- select * from public.venue_delete_impact(
--   (select id from venues order by created_at limit 1)
-- );
--   -- expect: 8 zero-or-positive counts for a real venue id, or
--   -- "not authorized" if this is pasted here rather than called from the app.
-- ============================================================================
