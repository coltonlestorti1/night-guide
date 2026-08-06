-- ============================================================================
-- 2026-08-06 — SECURITY: active_check_ins bypasses RLS on check_ins
-- RUN THIS BEFORE ANYTHING ELSE TODAY.
--
-- WHAT IS WRONG
-- A Postgres view executes with the privileges of its OWNER, not its caller,
-- unless it is explicitly marked `security_invoker = true`. `active_check_ins`
-- was never marked, so every read through it bypasses the RLS on `check_ins`
-- completely.
--
-- PROVEN LIVE 2026-08-06, with nothing but the publishable key that ships in
-- the production bundle to every visitor:
--   GET /rest/v1/check_ins?select=user_id,venue_id          -> []          (RLS works)
--   GET /rest/v1/active_check_ins?select=user_id,venue_id,vibe,visibility
--     -> [{"user_id":"8f60dae4-…","venue_id":"f164e187-…",
--          "vibe":"chill","visibility":"friends"}]           (RLS bypassed)
--
-- That row's own visibility setting is 'friends'. An anonymous caller read it.
--
-- IMPACT
-- Anyone can enumerate who is at which bar right now — user id, venue id, vibe,
-- created_at, expires_at — regardless of the per-check-in visibility setting.
-- It is not limited to anonymous callers: because RLS is bypassed rather than
-- widened, ANY signed-in user can read EVERY active check-in, including rows
-- set to friends-only or nobody. Sign-ups are open, so that is reachable today.
-- This contradicts the privacy principles in ~/Documents/endz/CLAUDE.md
-- ("default to friends-only visibility", "no covert tracking").
--
-- WHY THE 2026-08-05 PRE-LAUNCH AUDIT MISSED IT
-- That audit probed base TABLES — check_ins returned 0 rows to anon and passed.
-- It never probed the VIEW. This is almost certainly not a new regression: a
-- `create or replace view` does not add security_invoker, so the bypass has
-- likely existed for as long as the view has.
--
-- WHY THE FIX IS SAFE — nothing legitimately needs the bypass
-- Verified by reading the code and calling the API:
--   * the anonymous map gets crowd counts from the `venue_activity` RPC, which
--     returns aggregates only (verified: zero `user_id` in its output)
--   * useMyCheckIn() filters .eq("user_id", userId) — an authenticated, own-row
--     read, which RLS already permits
--   * friends.ts reads friends' check-ins as an authenticated user, which the
--     "checkins visible per rules" policy already permits
-- So the signed-out map keeps working and friends keep seeing each other.
-- ============================================================================

-- ---------- 1. make the view respect the caller's RLS (Postgres 15+) ----------
alter view active_check_ins set (security_invoker = true);

-- ---------- 2. belt and braces ----------
-- Even with security_invoker on, anon has no business reading this view: every
-- legitimate consumer is authenticated. If step 1 errors because the project is
-- on Postgres 14 or older, this statement alone still closes the anonymous half
-- of the leak — but the signed-in half would remain, so say so rather than
-- assuming it is fixed.
revoke all on active_check_ins from anon;

-- ---------- verification ----------
-- Expect security_invoker to appear in reloptions.
select relname, reloptions
  from pg_class
 where relname = 'active_check_ins';

-- Expect anon to be absent from the grantees for this view.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_name = 'active_check_ins'
 order by grantee, privilege_type;

-- ⚠️ AFTER RUNNING, the client-side probe is the real test — re-run it from the
-- repo root and expect [] instead of a row:
--   U=$(grep -m1 VITE_SUPABASE_URL .env.local | cut -d= -f2-)
--   K=$(grep -m1 VITE_SUPABASE_PUBLISHABLE_KEY .env.local | cut -d= -f2-)
--   curl -s "$U/rest/v1/active_check_ins?select=user_id,venue_id" \
--     -H "apikey: $K" -H "Authorization: Bearer $K"
--
-- ⚠️ ALSO: any future `alter table check_ins add column` still requires
-- re-running scripts/2026-08-06-fix-active-check-ins-view.sql, and a
-- `create or replace view` DROPS these settings — re-apply this file after it.
