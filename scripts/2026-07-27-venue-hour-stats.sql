-- ============================================================================
-- 2026-07-27 — venue_hour_stats: the "gets smarter over time" layer
--
-- WRITE-ONLY IN V1. Nothing reads this yet. It exists now because history is
-- the one thing that cannot be backfilled: every night it is not collecting is
-- a night of real crowd data gone permanently. The read side — replacing the
-- archetype curve for a venue-hour once it has enough samples — lands later,
-- against data this has already banked.
--
-- Privacy: aggregates only. No user ids, no per-row timestamps, no way back to
-- an individual. Same properties as venue_activity(), verified 2026-07-14.
-- The table is readable by NOBODY through the API; only the SECURITY DEFINER
-- sampler writes to it.
-- ============================================================================

create table if not exists venue_hour_stats (
  venue_id        uuid not null references venues (id) on delete cascade,
  -- Nightlife day, not calendar day: 1 AM Sunday belongs to Saturday night.
  dow             smallint not null check (dow between 0 and 6),
  hour            smallint not null check (hour between 0 and 23),
  sample_count    integer not null default 0,
  avg_checkins    real    not null default 0,
  -- 0-100, mapped from reported vibe the same way the engine maps it.
  avg_crowd       real,
  crowd_samples   integer not null default 0,
  last_sampled_at timestamptz not null default now(),
  primary key (venue_id, dow, hour)
);

alter table venue_hour_stats enable row level security;
-- Deliberately NO policies: with RLS on and no policy, PostgREST exposes
-- nothing. The sampler below is SECURITY DEFINER and bypasses this.

-- ---------------------------------------------------------------------------
-- The sampler. Snapshots the CURRENT state of every venue into the rollup as
-- one more observation, updating a running mean. Call it on a schedule.
--
-- Timezone matters: Supabase runs UTC and these venues are in New York, so
-- sampling on UTC hours would file a 9 PM Saturday crowd as 1 AM Sunday.
-- Night rollover matters too: before 5 AM local we bank against the previous
-- day, matching nightlifeDay() in src/lib/heat/curves.ts.
-- ---------------------------------------------------------------------------
create or replace function record_venue_hour_samples()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  local_ts timestamp := now() at time zone 'America/New_York';
  h        smallint  := extract(hour from local_ts)::smallint;
  d        smallint;
  touched  integer;
begin
  -- Nightlife day: before 5 AM, the night belongs to yesterday.
  d := extract(dow from local_ts)::smallint;
  if h < 5 then
    d := (d + 6) % 7;
  end if;

  with observed as (
    select
      v.id as venue_id,
      coalesce(a.active_count, 0)::real as checkins,
      case a.latest_vibe
        when 'dead'         then 5
        when 'chill'        then 30
        when 'building'     then 60
        when 'packed'       then 85
        when 'line_outside' then 95
        else null
      end::real as crowd
    from venues v
    left join venue_activity() a on a.venue_id = v.id
    where v.is_active
  )
  insert into venue_hour_stats as s
    (venue_id, dow, hour, sample_count, avg_checkins, avg_crowd, crowd_samples, last_sampled_at)
  select
    o.venue_id, d, h, 1, o.checkins, o.crowd,
    case when o.crowd is null then 0 else 1 end,
    now()
  from observed o
  on conflict (venue_id, dow, hour) do update set
    -- Running mean: avg = (avg*n + x) / (n+1)
    avg_checkins = (s.avg_checkins * s.sample_count + excluded.avg_checkins)
                   / (s.sample_count + 1),
    sample_count = s.sample_count + 1,
    avg_crowd = case
      when excluded.avg_crowd is null then s.avg_crowd
      when s.avg_crowd is null then excluded.avg_crowd
      else (s.avg_crowd * s.crowd_samples + excluded.avg_crowd) / (s.crowd_samples + 1)
    end,
    crowd_samples = s.crowd_samples
                    + case when excluded.avg_crowd is null then 0 else 1 end,
    last_sampled_at = now();

  get diagnostics touched = row_count;
  return touched;
end $$;

-- Not callable from the client. Only the scheduler runs it.
-- PUBLIC first and non-optionally: Postgres grants EXECUTE to PUBLIC by
-- default on a new function, so revoking from anon/authenticated alone leaves
-- the hole open. Verified 2026-07-27 — the anon key could call this and pad
-- sample_count with junk, poisoning the data the table exists to collect.
revoke all on function record_venue_hour_samples() from public;
revoke all on function record_venue_hour_samples() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduling. Requires pg_cron: Database > Extensions > enable "pg_cron".
-- Every 20 minutes gives 3 samples an hour, which is enough to characterise a
-- venue-hour without bloating the table (it stays at most 168 rows per venue).
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
--
-- select cron.schedule(
--   'venue-hour-sampler',
--   '*/20 * * * *',
--   $$ select record_venue_hour_samples() $$
-- );

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Run one sample by hand; expect a row count equal to your active venue count.
select record_venue_hour_samples();

-- Expect one row per active venue for the current nightlife day + hour.
select dow, hour, count(*) as venues, sum(sample_count) as samples
from venue_hour_stats group by dow, hour order by dow, hour;

-- Sanity: nothing here should be readable through the API. This must return
-- an empty result or a permissions error when run as anon.
-- select * from venue_hour_stats limit 1;
