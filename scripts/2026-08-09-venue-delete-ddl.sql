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
--     night_comments/night_post_likes/night_post_tags reference night_posts,
--     not venues directly, so they cascade transitively through night_posts
--     and need no entry of their own here.
-- ============================================================================


-- ---------- 1. admins may delete venues ----------
drop policy if exists "admins delete venues" on venues;
create policy "admins delete venues"
  on venues for delete
  to authenticated
  using (public.is_admin());


-- ---------- 2. venue_delete_impact() ----------
-- One column per table that references venues, named for the table, so the
-- admin sees the full blast radius before confirming. Same SECURITY DEFINER +
-- pinned search_path + self-checked is_admin() pattern as admin_overview() in
-- scripts/2026-07-28-admin-ddl.sql.
-- Every source table is aliased (c, vr, np, ...) even though most of the
-- queries don't strictly need it, because the OUT parameters implied by
-- `returns table` are named identically to several of these tables
-- (check_ins, venue_ratings, ...) and become PL/pgSQL variables in scope for
-- the rest of the function body. Aliasing sidesteps that name collision
-- entirely instead of relying on qualified-reference resolution rules.
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
set search_path = public
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
-- select * from public.venue_delete_impact(
--   (select id from venues order by created_at limit 1)
-- );
--   -- expect: 8 zero-or-positive counts for a real venue id, or
--   -- "not authorized" if this is pasted here rather than called from the app.
-- ============================================================================
