-- ============================================================================
-- 2026-07-27 — round-1 trait ingest (descriptions, music, ages, college scene)
--
-- Source: docs/research/2026-07-26-round1-venue-traits.md
-- Descriptions were rewritten from Google's editorial summaries and signed off
-- by Colton; the research prose was NOT used verbatim.
--
-- GAP-ONLY BY CONSTRUCTION: every update is guarded by "where <col> is null",
-- so it cannot overwrite anything already curated. Idempotent.
-- ============================================================================

-- ---------- descriptions (16) ----------
update venues v set description = d.description
from (values
  ('Please Don''t Tell', 'You get in through a phone booth inside the hot dog shop next door. Cocktails are the point and the room is small and dark — a date spot, not a group one. Reserve ahead; walk-ins wait.'),
  ('The Wayland', 'Cocktails that take themselves seriously in a room that doesn''t. Live music on Wednesdays. Outdoor seating makes it easier with a few people.'),
  ('d.b.a.', 'A beer and bourbon list built for people who care, without the lecture. Happy hour runs noon to 9, so timing barely matters. Outdoor seating too.'),
  ('Juke Bar', 'Southern-leaning bar with cocktails and craft beer. A live band plays Sundays. Open until 4, so it works early or late.'),
  ('Holiday Cocktail Lounge', 'An old St. Marks dive that got completely redone — same address, much better drinks. There''s food too. Closes at 2, earlier than the rest of the block, so it''s a first stop rather than a last one.'),
  ('Ten Degrees', 'A small St. Marks wine bar with plates to match. The room doesn''t hold many, so it''s better as a date or a pair of friends than a group.'),
  ('The Headless Widow', 'Cocktails and craft beer with oysters and a kitchen that goes past bar snacks. Works for a date, or a small group that wants to actually eat.'),
  ('Bua', 'St. Marks pub with a patio that fills up in daylight. The happy hour is real, not nominal. Good with a group, especially early.'),
  ('Solas', 'Bar on the ground floor, darker lounge upstairs where a DJ keeps it going. Partner-dance nights run midweek — salsa Wednesday, bachata Thursday — with DJs Friday and Saturday. Built for groups that want to dance without a club door.'),
  ('Goodnight Sonny', 'From the same team as The Wayland, with a raw bar and sandwiches alongside the cocktails. Good for a date, or dinner that turns into drinks.'),
  ('Lucky', 'Small bar with a backyard beer garden and a community-space streak — it hosts events as often as it just opens. Cheap and unfussy, and the garden makes it easy with a group.'),
  ('Mona''s', 'Pool table, Skee-Ball and a jukebox in a brick-walled room. The long-running Tuesday jazz session is the real draw, and seats go early. Good with a group the rest of the week.'),
  ('The Spotted Owl Tavern', 'Vintage-leaning tavern that does real food rather than bar snacks. Cocktails and beer on tap, plus outdoor seating. Solid for a group that wants to sit down.'),
  ('Berlin', 'A small, dark basement room underneath 2A. DJs and live bands most nights, with the dance party Friday and Saturday from 11. Go for the music, not for talking.'),
  ('Club Cumming', 'Drag, cabaret and a rotating cast of whatever else is booked. Something is on most nights, each with its own regulars. Best when you pick a show rather than just turning up.'),
  ('Big Bar', 'Tiny red-lit room, quiet by design. A place to talk rather than somewhere to end up on a big night. Cheap for the block.')
) as d(name, description)
where v.name = d.name and v.description is null;

-- ---------- music (15) ----------
-- Controlled vocabulary: FiltersSheet splits this on "/" and makes a filter
-- chip from each part, so free text would produce chips like "none" or "TV".
-- Venues with no music are deliberately left NULL rather than labelled.
update venues v set music = m.music
from (values
  ('KGB Bar', 'Live'),
  ('The Wayland', 'Live'),
  ('Juke Bar', 'Live'),
  ('Sweet Linda', 'DJ'),
  ('Motel No Tell', 'DJ'),
  ('Solas', 'Latin / DJ'),
  ('Deluxx Fluxx', 'DJ'),
  ('Lucky', 'Live / Jukebox'),
  ('Mona''s', 'Jazz / Jukebox'),
  ('Berlin', 'DJ / Live'),
  ('Club Cumming', 'Live / DJ'),
  ('Big Bar', 'Soul'),
  ('96 Tears', 'Rock'),
  ('Blue & Gold Tavern', 'Jukebox'),
  ('Downtown Social', 'DJ')
) as m(name, music)
where v.name = m.name and v.music is null;

-- ---------- age bands (27) ----------
-- Kept as clean "NN-NN" text: age_range is parsed by ^(\d+)-(\d+)$ and the
-- college half lives in its own boolean (see §26).
update venues v set age_range = a.age_range
from (values
  ('Please Don''t Tell', '24-35'),
  ('The Wayland', '24-34'),
  ('d.b.a.', '25-38'),
  ('Juke Bar', '22-30'),
  ('Holiday Cocktail Lounge', '24-35'),
  ('Ten Degrees', '22-30'),
  ('The Headless Widow', '24-35'),
  ('Wonderland Bar', '22-32'),
  ('Bua', '22-32'),
  ('Superbueno', '24-35'),
  ('Sweet Linda', '23-33'),
  ('Motel No Tell', '21-29'),
  ('Solas', '21-30'),
  ('Paradise Lost', '24-35'),
  ('Goodnight Sonny', '24-34'),
  ('Deluxx Fluxx', '21-29'),
  ('Lucky', '23-35'),
  ('Mona''s', '24-38'),
  ('The York', '24-34'),
  ('The Spotted Owl Tavern', '24-35'),
  ('Accidental Bar', '24-35'),
  ('Berlin', '21-30'),
  ('Little Rebel', '23-33'),
  ('Romeos', '22-30'),
  ('Club Cumming', '24-38'),
  ('Big Bar', '25-38'),
  ('Two Perrys', '23-34')
) as a(name, age_range)
where v.name = a.name and v.age_range is null;

-- ---------- college scene (11) ----------
alter table venues add column if not exists is_college_scene boolean;

update venues set is_college_scene = true
where name in ('Beauty Bar', 'Juke Bar', 'Ten Degrees', 'Bua', 'Motel No Tell', 'Solas', 'Deluxx Fluxx', 'Romeos', '96 Tears', 'Barcade', 'Berlin');

-- ---------- verification ----------
select
  count(*) filter (where description is not null) as with_description,
  count(*) filter (where music is not null)       as with_music,
  count(*) filter (where age_range is not null)   as with_age,
  count(*) filter (where is_college_scene)        as college_scene,
  count(*)                                        as total
from venues where is_active;
