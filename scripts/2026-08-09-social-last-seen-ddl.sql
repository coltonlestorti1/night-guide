-- ============================================================================
-- 2026-08-09 — unread badge on the Social tab.
-- Additive and idempotent. Safe to run more than once.
--
-- ONE column, not a reads table. The badge only ever needs a NUMBER, and
-- "seen" was defined (Colton, 2026-08-09) as "you opened Social" — so a single
-- watermark per user answers it. A row-per-item reads table would buy per-post
-- precision that is never displayed, and would be written on every feed view,
-- making it the most-written table in the app for no visible benefit.
--
-- Cost: at most ONE update per visit to Social.
--
-- No new policy needed. profiles already carries "users update own profile"
-- (using auth.uid() = id), which is exactly the permission required, and this
-- column is not sensitive: it says when you last looked at your own feed.
-- ============================================================================

alter table profiles
  add column if not exists social_last_seen_at timestamptz;

comment on column profiles.social_last_seen_at is
  'When this user last opened the Social tab. Drives the unread badge: anything
   created after this is "new". Null means never opened — treated as "no badge"
   rather than "everything is new", so a new signup is not greeted by a count
   of every post that has ever existed.';

-- ---------- verification ----------
-- Expect one row: social_last_seen_at | timestamp with time zone | YES
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'profiles'
   and column_name = 'social_last_seen_at';
