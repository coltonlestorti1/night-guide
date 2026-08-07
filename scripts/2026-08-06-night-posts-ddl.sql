-- ============================================================================
-- 2026-08-06 — night feed slice 2: night_posts
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-06-night-feed-design.md
-- Plan: docs/superpowers/plans/2026-08-06-night-feed-slice-2-posts.md
--
-- night_date is a DATE, deliberately. A post says "Monday night", never
-- "12:41am". There is no foreign key to check_ins, so no reader can walk from a
-- post back to a timestamped visit. The 2026-08-05 time-bound policy on
-- check_ins is untouched by this file.
-- ============================================================================

create table if not exists night_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  venue_id   uuid not null references venues (id) on delete cascade,
  night_date date not null,
  note       text check (note is null or char_length(note) <= 280),
  visibility text not null default 'friends'
               check (visibility in ('everyone','school','friends','nobody')),
  created_at timestamptz not null default now(),
  unique (user_id, venue_id, night_date)   -- one post per venue per night
);

create index if not exists night_posts_feed_idx
  on night_posts (created_at desc);
create index if not exists night_posts_author_idx
  on night_posts (user_id, night_date desc);

alter table night_posts enable row level security;

-- ---------- READ ----------
-- Blocking is evaluated FIRST and gates every tier below it. Blocking that only
-- applies to the friends tier is not blocking — a blocked user would still read
-- everything posted to 'everyone' or 'school'.
--
-- ghost_mode is deliberately NOT consulted (Colton, 2026-08-07). It suppresses
-- presence — being seen out right now. A post is authored, opt-in, and
-- published the next day; hiding it afterwards would make the publish button a
-- lie. Presence and publication are different disclosures.
--
-- 'nobody' appears nowhere below on purpose: it matches only the author clause.
drop policy if exists "night posts visible per audience" on night_posts;
create policy "night posts visible per audience"
  on night_posts for select to authenticated
  using (
    auth.uid() = user_id
    or (
      not exists (
        select 1 from friendships f
        where f.status = 'blocked'
          and (
            (f.user_id = auth.uid()   and f.friend_id = night_posts.user_id) or
            (f.friend_id = auth.uid() and f.user_id   = night_posts.user_id)
          )
      )
      and (
        visibility = 'everyone'
        or (
          visibility = 'school'
          and exists (
            select 1
              from profiles me
              join profiles them on them.id = night_posts.user_id
             where me.id = auth.uid()
               and me.college_slug is not null       -- null = null is not TRUE,
               and me.college_slug = them.college_slug  -- but say it out loud
          )
        )
        or (
          visibility = 'friends'
          and exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and (
                (f.user_id = auth.uid()   and f.friend_id = night_posts.user_id) or
                (f.friend_id = auth.uid() and f.user_id   = night_posts.user_id)
              )
          )
        )
      )
    )
  );

-- ---------- WRITE ----------
drop policy if exists "users create own posts" on night_posts;
create policy "users create own posts"
  on night_posts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own posts" on night_posts;
create policy "users update own posts"
  on night_posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own posts" on night_posts;
create policy "users delete own posts"
  on night_posts for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- verification ----------
-- Expect four policies: DELETE, INSERT, SELECT, UPDATE.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'night_posts'
 order by cmd;

-- Expect: rls_on true, policy_count 4.
select
  (select relrowsecurity from pg_class where relname = 'night_posts') as rls_on,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'night_posts') as policy_count;
