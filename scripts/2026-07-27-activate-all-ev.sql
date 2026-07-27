-- ============================================================================
-- 2026-07-27 — activate all East Village venues
--
-- Inverts the 2026-07-15 "curated starter set" (endz-schema.sql:331). That
-- curation made sense when a venue with no check-ins rendered as a dead grey
-- dot, so extra venues were dead weight on the map. The heat engine removes
-- that cost: every venue now carries a researched or archetype baseline, so a
-- newly activated venue is immediately alive and correctly ranked.
--
-- New default: live unless explicitly hidden.
--
-- All 21 previously dormant venues were re-verified against Google Places on
-- 2026-07-27 — every one returned businessStatus = OPERATIONAL.
--
-- Cienfuegos stays hidden: Google reports CLOSED_PERMANENTLY (see the
-- 2026-07-26 soft-hide, commit f9b1a59).
--
-- Idempotent and additive. Safe to re-run.
-- ============================================================================

update venues
set is_active = true
where name <> 'Cienfuegos'
  and is_active = false;

-- Belt and braces: Cienfuegos must stay hidden.
update venues set is_active = false where name = 'Cienfuegos';

-- ---------------------------------------------------------------------------
-- Verification — run these after the updates above.
-- ---------------------------------------------------------------------------

-- Expect: false = 1, true = 56
select is_active, count(*) from venues group by is_active order by is_active;

-- Expect exactly one row: Cienfuegos
select name from venues where not is_active order by name;
