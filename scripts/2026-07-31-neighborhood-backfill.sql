-- ============================================================================
-- ⚠️ SUPERSEDED 2026-08-05 — DO NOT RUN. Never executed.
-- Replaced by scripts/2026-08-05-neighborhood-rule.sql, which uses the agreed
-- street-only vocabulary (this file still writes 'Avenue B / Alphabet City')
-- and resolves all 7 venues left undecided below. Kept for provenance only.
-- ============================================================================
--
-- 2026-07-31 — neighborhood backfill (20 venues)
--
-- GAP-ONLY. Every statement is guarded `where neighborhood is null`, so this
-- cannot overwrite a value you already set. Same pattern as the 2026-07-26
-- parity backfill.
--
-- Source: the verified Google addresses already in src/data/places/places.json.
-- Nothing here is inferred or invented — each venue is literally ON the street
-- it is being labelled with, using the neighborhood vocabulary already in the
-- table. The 7 venues whose address is a CROSS STREET (or on Loisaida Ave) are
-- deliberately NOT in this file; they need a rule decision first. See the notes
-- at the bottom.
-- ============================================================================

update venues set neighborhood = 'Avenue A'
 where name = 'Berlin' and neighborhood is null;  -- 25 Avenue A
update venues set neighborhood = 'St. Marks Place'
 where name = 'Bua' and neighborhood is null;  -- 122 St Marks Pl
update venues set neighborhood = '1st Avenue'
 where name = 'Goodnight Sonny' and neighborhood is null;  -- 134 1st Ave
update venues set neighborhood = 'St. Marks Place'
 where name = 'Holiday Cocktail Lounge' and neighborhood is null;  -- 75 St Marks Pl
update venues set neighborhood = '2nd Avenue'
 where name = 'Juke Bar' and neighborhood is null;  -- 196 2nd Ave
update venues set neighborhood = '2nd Avenue'
 where name = 'Little Rebel' and neighborhood is null;  -- 219 2nd Ave
update venues set neighborhood = 'Avenue B / Alphabet City'
 where name = 'Lucky' and neighborhood is null;  -- 168 Avenue B
update venues set neighborhood = 'Avenue B / Alphabet City'
 where name = 'Mona''s' and neighborhood is null;  -- 224 Avenue B Unit 14
update venues set neighborhood = 'Avenue A'
 where name = 'Motel No Tell' and neighborhood is null;  -- 210 Avenue A
update venues set neighborhood = '2nd Avenue'
 where name = 'Paradise Lost' and neighborhood is null;  -- 100 2nd Ave
update venues set neighborhood = 'St. Marks Place'
 where name = 'Please Don''t Tell' and neighborhood is null;  -- 113 St Marks Pl
update venues set neighborhood = 'St. Marks Place'
 where name = 'Romeos' and neighborhood is null;  -- 118 St Marks Pl
update venues set neighborhood = '1st Avenue'
 where name = 'Superbueno' and neighborhood is null;  -- 13 1st Ave
update venues set neighborhood = '2nd Avenue'
 where name = 'Sweet Linda' and neighborhood is null;  -- 29 2nd Ave
update venues set neighborhood = 'St. Marks Place'
 where name = 'Ten Degrees' and neighborhood is null;  -- 121 St Marks Pl
update venues set neighborhood = '1st Avenue'
 where name = 'The Headless Widow' and neighborhood is null;  -- 99 1st Ave
update venues set neighborhood = 'Avenue A'
 where name = 'The Spotted Owl Tavern' and neighborhood is null;  -- 211 Avenue A
update venues set neighborhood = 'Avenue B / Alphabet City'
 where name = 'The York' and neighborhood is null;  -- 186 Avenue B
update venues set neighborhood = '2nd Avenue'
 where name = 'Wonderland Bar' and neighborhood is null;  -- 96 2nd Ave
update venues set neighborhood = '1st Avenue'
 where name = 'd.b.a.' and neighborhood is null;  -- 41 1st Ave

-- ---------- verification ----------
-- Expect 50 filled / 7 null (the 7 pending a rule decision).
select
  count(*) filter (where neighborhood is not null) as filled,
  count(*) filter (where neighborhood is null)     as still_null
from venues;

select name, neighborhood from venues where neighborhood is null order by name;


-- ============================================================================
-- NOT INCLUDED — 7 venues needing a rule decision (Colton)
-- ============================================================================
-- These have verified addresses but no unambiguous street label:
--
--   Accidental Bar    98 Loisaida Ave     <- Loisaida Ave IS Avenue C
--   Two Perrys        127 Loisaida Ave    <- same
--   Big Bar           75 E 7th St         <- cross street
--   Club Cumming      505 E 6th St        <- cross street
--   Deluxx Fluxx      125 E 11th St       <- cross street
--   Solas             232 E 9th St        <- cross street
--   The Wayland       700 E 9th St        <- cross street
--
-- ---------- three contradictions already in the live data ----------
-- Found while deriving the rule. NOT touched by this file — fixing them means
-- overwriting values you set, which is your call, not a gap-fill.
--
-- 1. Loisaida Ave is split across two labels, and one of them is factually
--    wrong. Loisaida Avenue IS Avenue C:
--       Joyface (104) + Nublu 151 (151)          -> 'Avenue C / Alphabet City'  (correct)
--       Alphabet City Beer Co (96) + Summit (133) -> 'Avenue B / Alphabet City'  (wrong street)
--
-- 2. E 14th St carries two labels for adjacent addresses:
--       Beauty Bar (231 E 14th)        -> 'E 14th Street'
--       Coyote Ugly Saloon (233 E 14th) -> '1st Avenue'
--    Next door to each other, different neighborhoods.
--
-- 3. E 7th St carries three labels:
--       Standings (43)         -> '1st Avenue'
--       McSorley's (15)        -> 'St. Marks Place'
--       Blue & Gold (79)       -> 'St. Marks Place'
--       Lovers of Today (132½) -> 'Avenue A'
--
-- The underlying question is what `neighborhood` MEANS: the street the venue
-- sits on, or the corridor a local would say it belongs to. The existing 30
-- rows are corridor-ish but inconsistent. Pick one and the 7 above resolve
-- themselves:
--
--   (a) Street-literal  — cross-street venues get 'E 7th Street' etc. Honest
--                         and mechanical, but adds ~5 near-empty labels.
--   (b) Nearest avenue  — Big Bar (75 E 7th) -> '1st Avenue', Club Cumming
--                         (505 E 6th) -> 'Avenue B / Alphabet City', etc.
--                         Matches how people actually give directions here.
--                         RECOMMENDED — it is what most of the existing 30
--                         already do, just applied consistently.
-- ============================================================================
