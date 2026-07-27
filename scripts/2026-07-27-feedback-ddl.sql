-- ============================================================================
-- 2026-07-27 — feedback loop (activity/heat system, slice 4)
--
-- Additive and idempotent. Nothing existing breaks: `building` keeps its
-- stored value and simply DISPLAYS as "Good crowd", so there is no data
-- migration.
--
-- Postgres requires enum values to be committed before they are used, so the
-- ALTER TYPE statements are first and must be run on their own.
-- ============================================================================

-- ---------- 1. two new vibe options ----------
alter type vibe_level add value if not exists 'dead';
alter type vibe_level add value if not exists 'line_outside';

-- ---------- 2. recommendation quality ----------
do $$ begin
  create type recommend_level as enum ('yes', 'maybe', 'no');
exception when duplicate_object then null;
end $$;

alter table check_ins add column if not exists would_recommend recommend_level;

-- ---------- 3. vibe freshness, set by trigger only ----------
-- A check-in created two hours ago whose vibe was updated a minute ago is
-- FRESH evidence. Without this column there is no way to tell. It is written
-- by a trigger and never by the client: freshness is the heaviest-weighted
-- input in the scoring engine, so a client-writable timestamp would let anyone
-- backdate a report to look current.
alter table check_ins add column if not exists vibe_at timestamptz;

create or replace function set_vibe_at() returns trigger
language plpgsql
as $$
begin
  if new.vibe is distinct from old.vibe and new.vibe is not null then
    new.vibe_at := now();
  end if;
  return new;
end $$;

drop trigger if exists check_ins_vibe_at on check_ins;
create trigger check_ins_vibe_at
  before update on check_ins
  for each row execute function set_vibe_at();

-- Insert path too, for a check-in that arrives with a vibe already set.
create or replace function set_vibe_at_insert() returns trigger
language plpgsql
as $$
begin
  if new.vibe is not null then new.vibe_at := now(); end if;
  return new;
end $$;

drop trigger if exists check_ins_vibe_at_ins on check_ins;
create trigger check_ins_vibe_at_ins
  before insert on check_ins
  for each row execute function set_vibe_at_insert();

-- ---------- 4. bucketed venue_activity() ----------
-- Buckets, not per-row timestamps. The decay curve needs check-in AGE, but
-- returning timestamps would leak "someone arrived at 11:42" and break the
-- identity guarantees verified in the 2026-07-14 audit. Aggregates preserve
-- them. Bucket edges are 15/45/90 minutes to match the decay curve; a check-in
-- stops counting at 90 minutes even though the row lives to the 3-hour expiry.
--
-- SECURITY DEFINER with a pinned search_path, exactly as the previous version.
drop function if exists venue_activity();

create or replace function venue_activity()
returns table (
  venue_id uuid,
  active_count bigint,
  count_15m bigint,
  count_45m bigint,
  count_90m bigint,
  latest_vibe vibe_level,
  vibe_dead bigint,
  vibe_chill bigint,
  vibe_building bigint,
  vibe_packed bigint,
  vibe_line_outside bigint,
  rec_yes bigint,
  rec_maybe bigint,
  rec_no bigint
)
language sql
security definer
set search_path = public
as $$
  select
    c.venue_id,
    count(*)                                                             as active_count,
    count(*) filter (where c.created_at > now() - interval '15 minutes') as count_15m,
    count(*) filter (where c.created_at > now() - interval '45 minutes') as count_45m,
    count(*) filter (where c.created_at > now() - interval '90 minutes') as count_90m,
    (array_agg(c.vibe order by coalesce(c.vibe_at, c.created_at) desc)
       filter (where c.vibe is not null))[1]                             as latest_vibe,
    count(*) filter (where c.vibe = 'dead'         and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_dead,
    count(*) filter (where c.vibe = 'chill'        and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_chill,
    count(*) filter (where c.vibe = 'building'     and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_building,
    count(*) filter (where c.vibe = 'packed'       and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_packed,
    count(*) filter (where c.vibe = 'line_outside' and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_line_outside,
    count(*) filter (where c.would_recommend = 'yes')   as rec_yes,
    count(*) filter (where c.would_recommend = 'maybe') as rec_maybe,
    count(*) filter (where c.would_recommend = 'no')    as rec_no
  from check_ins c
  where c.expires_at > now()
  group by c.venue_id;
$$;

grant execute on function venue_activity() to anon, authenticated;

-- ---------- verification ----------
select * from venue_activity() limit 5;
select enumlabel from pg_enum
  where enumtypid = 'vibe_level'::regtype order by enumsortorder;
