-- ============================================================================
-- 2026-08-06 — night feed slice 1: venue ratings
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-06-night-feed-design.md
-- Plan: docs/superpowers/plans/2026-08-06-night-feed-slice-1-ratings.md
--
-- PRIVATE BY DESIGN. No policy in this file grants SELECT to anyone but the
-- owner. Sharing arrives in slice 2 via night_posts — a different table with a
-- different audience and a per-post visibility column. Do NOT add a friend or
-- school policy to this table to "get the feed working"; that would turn a
-- private ranked list into a readable one without anybody deciding to.
-- ============================================================================

create table if not exists venue_ratings (
  user_id       uuid not null references profiles (id) on delete cascade,
  venue_id      uuid not null references venues (id) on delete cascade,
  bucket        text not null check (bucket in ('great','good','not_great')),
  rank_position int  not null check (rank_position >= 0),
  score         numeric(3,1) not null check (score >= 0 and score <= 10),
  rated_at      timestamptz not null default now(),
  primary key (user_id, venue_id)
);

-- Reads are always "my list, one bucket, in rank order".
create index if not exists venue_ratings_user_bucket_idx
  on venue_ratings (user_id, bucket, rank_position);

alter table venue_ratings enable row level security;

drop policy if exists "own ratings readable" on venue_ratings;
create policy "own ratings readable"
  on venue_ratings for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own ratings insert" on venue_ratings;
create policy "own ratings insert"
  on venue_ratings for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own ratings update" on venue_ratings;
create policy "own ratings update"
  on venue_ratings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own ratings delete" on venue_ratings;
create policy "own ratings delete"
  on venue_ratings for delete to authenticated using (auth.uid() = user_id);

-- rated_at is set server-side only, so a client cannot backdate a rating.
-- Same rule as check_ins.vibe_at.
create or replace function public.touch_venue_rating()
returns trigger language plpgsql as $$
begin
  new.rated_at := now();
  return new;
end $$;

drop trigger if exists venue_ratings_touch on venue_ratings;
create trigger venue_ratings_touch
  before insert or update on venue_ratings
  for each row execute function public.touch_venue_rating();

-- ---------- verification ----------
-- Expect exactly four policies: DELETE, INSERT, SELECT, UPDATE.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'venue_ratings'
 order by cmd;

-- Expect: rls true, four policies, trigger present.
select
  (select relrowsecurity from pg_class where relname = 'venue_ratings') as rls_on,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'venue_ratings') as policy_count,
  (select count(*) from pg_trigger
    where tgname = 'venue_ratings_touch' and not tgisinternal) as trigger_count;
