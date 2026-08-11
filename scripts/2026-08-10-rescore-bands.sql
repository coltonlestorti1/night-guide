-- One-time rescore after the 2026-08-10 band re-cut. Paste in the SQL editor.
--
-- WHY
-- A score is a rendering of a ranking, but it is STORED, not computed on read.
-- Re-cutting the bands in src/lib/night/ranking.ts therefore does nothing to
-- rows that already exist — they keep their old numbers until something happens
-- to rewrite their bucket. This recomputes every row with the new bands.
--
-- Old bands: great 6.7-10.0, good 3.4-6.6, not_great 0.0-3.3
-- New bands: great 7.0-10.0, good 5.0-6.9, not_great 3.0-4.9
-- New rule:  the #1 of a Great list with 5 or more entries scores a flat 10.0.
--
-- This must stay in step with scoreFor() in src/lib/night/ranking.ts. It is the
-- same arithmetic in a second language, which is a duplication worth naming: if
-- the bands move again, this file moves with them.
--
-- The ranking itself is untouched — only the number rendered from it. Every
-- rank_position stays exactly where the user's comparisons put it.
--
-- Updating venue_ratings fires trg_sync_night_post_score, so night_posts.score
-- follows automatically. No second pass needed.

with sized as (
  select user_id, bucket, count(*) as n
    from venue_ratings
   group by user_id, bucket
),
bands as (
  select *
    from (values
      ('great',     7.0::numeric, 10.0::numeric),
      ('good',      5.0,           6.9),
      ('not_great', 3.0,           4.9)
    ) as b(bucket, lo, hi)
)
update venue_ratings r
   set score = case
         when r.bucket::text = 'great' and r.rank_position = 0 and s.n >= 5
           then 10.0
         else round(b.hi - ((r.rank_position + 0.5) * (b.hi - b.lo)) / s.n, 1)
       end
  from sized s, bands b
 where s.user_id = r.user_id
   and s.bucket = r.bucket
   and b.bucket = r.bucket::text;

-- Proof: every score must sit inside its own band, and no two buckets may
-- overlap. Expect zero rows.
select r.user_id, r.venue_id, r.bucket, r.score
  from venue_ratings r
 where not (
   (r.bucket::text = 'great'     and r.score between 7.0 and 10.0) or
   (r.bucket::text = 'good'      and r.score between 5.0 and 6.9)  or
   (r.bucket::text = 'not_great' and r.score between 3.0 and 4.9)
 );
