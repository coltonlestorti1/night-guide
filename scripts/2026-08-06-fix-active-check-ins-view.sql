-- ============================================================================
-- 2026-08-06 — FIX: active_check_ins is missing columns added after it
--
-- ROOT CAUSE
-- The view was created as `select * from check_ins`. Postgres expands that
-- `*` ONCE, at creation, and freezes the column list. Every ALTER TABLE
-- check_ins ADD COLUMN since has been invisible to the view:
--     vibe_at, would_recommend   (2026-07-27 feedback DDL)
--     ended_at                   (2026-08-05 saves-and-history DDL)
--
-- SYMPTOM
-- useMyCheckIn() selects would_recommend from this view, so the request 400s
-- with "column active_check_ins.would_recommend does not exist". The query
-- never resolves, `mine` stays undefined, and CheckInCard's
-- `disabled={!mine || ...}` leaves every vibe button dead. Venue sheets also
-- show "Check in" while the user is already checked in somewhere.
--
-- Verified live 2026-08-06: view has id, user_id, venue_id, created_at,
-- expires_at, visibility, vibe — and is missing the three above.
--
-- ⚠️ ANY future `alter table check_ins add column` MUST be followed by
-- re-running this statement, or the view silently goes stale again. A
-- `select *` view does not track its table.
-- ============================================================================

create or replace view active_check_ins as
  select * from check_ins where expires_at > now();

-- ---------- verification ----------
-- Expect all three to be true.
select
  (select count(*) from information_schema.columns
    where table_name = 'active_check_ins' and column_name = 'would_recommend') = 1 as has_would_recommend,
  (select count(*) from information_schema.columns
    where table_name = 'active_check_ins' and column_name = 'vibe_at') = 1 as has_vibe_at,
  (select count(*) from information_schema.columns
    where table_name = 'active_check_ins' and column_name = 'ended_at') = 1 as has_ended_at;
