-- ============================================================================
-- 2026-08-07 — night_posts.score: the shareable snapshot of a rating
-- Additive and idempotent. Safe to run more than once.
--
-- WHY A COPY, NOT A JOIN
-- venue_ratings is owner-only by design — its DDL says in as many words not to
-- add a friend or school policy to it. That is deliberate: your ranked list is
-- the whole picture of your taste, and sharing one night out should not make it
-- readable. Widening that table to render a feed would trade a durable privacy
-- boundary for a UI detail.
--
-- So the score is COPIED onto the post at publish time. The post is the
-- shareable artifact and captures the score as it stood when you published it —
-- the same model Beli uses, where a feed entry is a snapshot rather than a live
-- window into someone's list. Re-publishing (editing a post) refreshes it.
--
-- NULLABLE on purpose: rating and publishing are separate acts. You can post a
-- spot without ranking it, and the card simply shows no circle.
-- ============================================================================

alter table night_posts
  add column if not exists score numeric(3,1)
  check (score is null or (score >= 0 and score <= 10));

-- ---------- verification ----------
-- Expect true.
select
  (select count(*) from information_schema.columns
    where table_name = 'night_posts' and column_name = 'score') = 1 as has_score;

-- Expect the full column list including score.
-- relation_columns() returns column_name only — order by that.
select string_agg(column_name, ', ' order by column_name) as night_posts_columns
  from public.relation_columns('night_posts');
