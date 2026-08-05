-- ============================================================================
-- 2026-08-05 — neighborhood rule: street-only labels
--
-- Supersedes scripts/2026-07-31-neighborhood-backfill.sql (which used the old
-- 'Avenue B / Alphabet City' vocabulary and left 7 venues undecided). Do not
-- run that file; run this one instead.
--
-- Decisions taken by Colton 2026-08-05:
--   * street-only labels; area names move to search, off the card
--   * '3rd Avenue' added to the vocabulary
--   * Coyote Ugly's address 233 E 14th St is CORRECT -> its stored coordinates
--     were wrong and are fixed here (section 4)
--   * Club Cumming's is_active = false is deliberate; left alone
--
-- Final vocabulary (8):
--   Avenue A · Avenue B · Avenue C · 1st Avenue · 2nd Avenue · 3rd Avenue ·
--   Bowery · St. Marks Place
--
-- Cross-street venues are assigned by NEAREST AVENUE, computed as perpendicular
-- distance to each avenue's line (fitted from the venues verifiably on it), not
-- estimated by eye. Margins are in the comments.
--
-- Sections 1-2 are gap-only (`where neighborhood is null`) and cannot overwrite.
-- Section 3 DOES overwrite values you set. Section 4 fixes bad coordinates.
-- Run the whole file top to bottom.
-- ============================================================================


-- ---------- 1. gap-fills: venues literally on the street ----------
-- 20 venues, verified Google addresses from src/data/places/places.json.

update venues set neighborhood = 'Avenue A'
 where name = 'Berlin' and neighborhood is null;                     -- 25 Avenue A
update venues set neighborhood = 'Avenue A'
 where name = 'Motel No Tell' and neighborhood is null;              -- 210 Avenue A
update venues set neighborhood = 'Avenue A'
 where name = 'The Spotted Owl Tavern' and neighborhood is null;     -- 211 Avenue A

update venues set neighborhood = '1st Avenue'
 where name = 'Goodnight Sonny' and neighborhood is null;            -- 134 1st Ave
update venues set neighborhood = '1st Avenue'
 where name = 'Superbueno' and neighborhood is null;                 -- 13 1st Ave
update venues set neighborhood = '1st Avenue'
 where name = 'The Headless Widow' and neighborhood is null;         -- 99 1st Ave
update venues set neighborhood = '1st Avenue'
 where name = 'd.b.a.' and neighborhood is null;                     -- 41 1st Ave

update venues set neighborhood = '2nd Avenue'
 where name = 'Juke Bar' and neighborhood is null;                   -- 196 2nd Ave
update venues set neighborhood = '2nd Avenue'
 where name = 'Little Rebel' and neighborhood is null;               -- 219 2nd Ave
update venues set neighborhood = '2nd Avenue'
 where name = 'Paradise Lost' and neighborhood is null;              -- 100 2nd Ave
update venues set neighborhood = '2nd Avenue'
 where name = 'Sweet Linda' and neighborhood is null;                -- 29 2nd Ave
update venues set neighborhood = '2nd Avenue'
 where name = 'Wonderland Bar' and neighborhood is null;             -- 96 2nd Ave

update venues set neighborhood = 'Avenue B'
 where name = 'Lucky' and neighborhood is null;                      -- 168 Avenue B
update venues set neighborhood = 'Avenue B'
 where name = 'Mona''s' and neighborhood is null;                    -- 224 Avenue B
update venues set neighborhood = 'Avenue B'
 where name = 'The York' and neighborhood is null;                   -- 186 Avenue B

-- Loisaida Avenue IS Avenue C, so these two are on-street, not cross-street.
update venues set neighborhood = 'Avenue C'
 where name = 'Accidental Bar' and neighborhood is null;             -- 98 Loisaida Ave
update venues set neighborhood = 'Avenue C'
 where name = 'Two Perrys' and neighborhood is null;                 -- 127 Loisaida Ave

update venues set neighborhood = 'St. Marks Place'
 where name = 'Bua' and neighborhood is null;                        -- 122 St Marks Pl
update venues set neighborhood = 'St. Marks Place'
 where name = 'Holiday Cocktail Lounge' and neighborhood is null;    -- 75 St Marks Pl
update venues set neighborhood = 'St. Marks Place'
 where name = 'Please Don''t Tell' and neighborhood is null;         -- 113 St Marks Pl
update venues set neighborhood = 'St. Marks Place'
 where name = 'Romeos' and neighborhood is null;                     -- 118 St Marks Pl
update venues set neighborhood = 'St. Marks Place'
 where name = 'Ten Degrees' and neighborhood is null;                -- 121 St Marks Pl


-- ---------- 2. gap-fills: cross-street venues, nearest avenue ----------
-- 5 venues. Margin = distance to nearest avenue vs runner-up.

update venues set neighborhood = '1st Avenue'
 where name = 'Big Bar' and neighborhood is null;        -- 75 E 7th St    60m vs 154m
update venues set neighborhood = 'Avenue A'
 where name = 'Club Cumming' and neighborhood is null;   -- 505 E 6th St   10m vs 153m
update venues set neighborhood = '2nd Avenue'
 where name = 'Solas' and neighborhood is null;          -- 232 E 9th St   71m vs 287m
update venues set neighborhood = 'Avenue C'
 where name = 'The Wayland' and neighborhood is null;    -- 700 E 9th St   15m vs 265m
update venues set neighborhood = '3rd Avenue'
 where name = 'Deluxx Fluxx' and neighborhood is null;   -- 125 E 11th St  west of 2nd Ave


-- ---------- 3. relabels — THESE OVERWRITE EXISTING VALUES ----------

-- 3a. Loisaida Avenue IS Avenue C. Two venues were on the wrong avenue.
update venues set neighborhood = 'Avenue C'
 where name = 'Alphabet City Beer Co';   -- 96 Loisaida Ave   was 'Avenue B / Alphabet City'
update venues set neighborhood = 'Avenue C'
 where name = 'The Summit Bar';          -- 133 Loisaida Ave  was 'Avenue B / Alphabet City'

-- 3b. Suffix drop — same street, area name moves to search.
update venues set neighborhood = 'Avenue C'
 where name = 'Joyface';                 -- 104 Loisaida Ave
update venues set neighborhood = 'Avenue C'
 where name = 'Nublu 151';               -- 151 Loisaida Ave
update venues set neighborhood = 'Avenue B'
 where name = 'Death & Co';              -- 433 E 6th St      57m vs 206m

-- 3c. 'St. Marks Place' was being used as a corridor for venues not on it.
--     Only Barcade (6 St Marks Pl) is genuinely on St. Marks and keeps it.
update venues set neighborhood = '2nd Avenue'
 where name = 'McSorley''s Old Ale House';  -- 15 E 7th St    18m vs 229m
update venues set neighborhood = '1st Avenue'
 where name = 'Blue & Gold Tavern';         -- 79 E 7th St    42m vs 172m
update venues set neighborhood = '1st Avenue'
 where name = 'KGB Bar';                    -- 85 E 4th St    81m vs 128m  <- THIN margin
-- ^ KGB Bar is the one genuinely uncertain call in this file. 85 E 4th sits
--   mid-block; the two avenues are within 47m of each other in the fit, which
--   is inside the coordinate noise. Flip it to '2nd Avenue' if you disagree.

-- 3d. 'Upper East Village' retired.
update venues set neighborhood = '2nd Avenue'
 where name = 'Sake Bar Decibel';        -- 240 E 9th St     42m vs 258m
update venues set neighborhood = '3rd Avenue'
 where name = 'The Ready Rooftop';       -- 112 E 11th St    west of 2nd Ave

-- 3e. 'E 14th Street' retired. Both recomputed from CORRECTED coordinates
--     (section 4) — they are next-door neighbours and now agree.
update venues set neighborhood = '2nd Avenue'
 where name = 'Beauty Bar';              -- 231 E 14th St    88m vs 312m
update venues set neighborhood = '2nd Avenue'
 where name = 'Coyote Ugly Saloon';      -- 233 E 14th St    79m vs 303m
update venues set neighborhood = 'Avenue B'
 where name = 'Otto''s Shrunken Head';   -- 538 E 14th St    39m vs 144m
-- ^ 538 E 14th is far east, past Avenue A — the third 'E 14th Street' venue.


-- ---------- 4. COORDINATE FIX (map-pin bug) ----------
-- Both venues' stored coordinates were wrong. Coyote Ugly's pin was 514 m from
-- the actual bar; Beauty Bar's was ~229 m off. Values below are from the Google
-- Places API, keyed on the googlePlaceId already in places.json, fetched
-- 2026-08-05. Verified: the two corrected points are ~10 m apart, which is what
-- adjacent street numbers should be.

update venues set lat = 40.73291,   lng = -73.9856429 where name = 'Coyote Ugly Saloon';
update venues set lat = 40.7329854, lng = -73.985709  where name = 'Beauty Bar';


-- ---------- verification ----------
-- Expect: 57 filled, 0 null.
select
  count(*) filter (where neighborhood is not null) as filled,
  count(*) filter (where neighborhood is null)     as still_null
from venues;

-- Expect exactly the 8-value vocabulary, nothing with a '/' in it.
select neighborhood, count(*)
  from venues
 group by neighborhood
 order by neighborhood;

-- Expect the two corrected rows, ~10 m apart.
select name, lat, lng from venues
 where name in ('Beauty Bar','Coyote Ugly Saloon');
