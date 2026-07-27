-- ============================================================================
-- 2026-07-27 — push the 9 missing descriptions live.
--
-- These venues came in via scripts/expansion-seed.sql, which inserted name,
-- type, price and coordinates but no description. They have read correctly in
-- the demo dataset and blank in production ever since.
--
-- Colton's own copy, straight from src/data/venues.ts. Gap-only: guarded by
-- "description is null", so it cannot overwrite anything.
-- ============================================================================

update venues v set description = d.description
from (values
  ('96 Tears', 'Small, buzzy wine-and-cocktail spot with cool-kid energy.'),
  ('Double Down Saloon', 'Legendary punk dive. Cheap, loud, no apologies.'),
  ('Lovers of Today', 'Hidden basement cocktail den — date-night energy.'),
  ('Banshee', 'Friendly Irish pub on 1st. Good pints, easy hang.'),
  ('Sake Bar Decibel', 'Underground sake bar — graffiti walls, deep sake list.'),
  ('Barcade', 'Craft beer plus a wall of vintage arcade games.'),
  ('Blue & Gold Tavern', 'Old-school dive, cheap pours, been there forever.'),
  ('Downtown Social', 'Big multi-room bar — darts, games, easy for groups.'),
  ('Otto''s Shrunken Head', 'Tiki dive with punk bands in the back room.')
) as d(name, description)
where v.name = d.name and v.description is null;

-- Expect with_description = 44 of 55.
select
  count(*) filter (where description is not null) as with_description,
  count(*) filter (where music is not null)       as with_music,
  count(*) filter (where age_range is not null)   as with_age,
  count(*)                                        as total
from venues where is_active;
