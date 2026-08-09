-- ============================================================================
-- 2026-08-09 — likes on night posts.
-- Additive and idempotent. Safe to run more than once.
--
-- INHERITS night_posts' audience rule rather than restating it. That is safe
-- and proved: a policy's USING clause DOES get the referenced table's own RLS
-- applied (scripts/2026-08-07-rls-inheritance-probe.sql, run against live
-- 2026-08-07). Same call as night_comments — one copy of the audience rule.
--
-- Note the WITH CHECK below inherits visibility TOO, through the same exists()
-- subquery. That was learned the hard way on comments: the spec claimed the
-- write path ignored visibility and it did not. Here it is deliberate — you
-- must not be able to like a post you cannot see.
--
-- UNLIKE COMMENTS: likes are open to anyone who can SEE the post, not just
-- friends of the author. A like carries no text, so it opens no moderation
-- surface and needs no report path. The friends-only restriction on comments
-- existed because strangers could write under your name; that reason does not
-- apply here.
-- ============================================================================

create table if not exists night_post_likes (
  post_id    uuid not null references night_posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)   -- one like per person per post, by shape
);

-- The feed asks "how many likes on these posts, and did I like them" for a
-- page of posts at once.
create index if not exists night_post_likes_post_idx
  on night_post_likes (post_id);

alter table night_post_likes enable row level security;

-- ---------- READ ----------
-- Two gates, exactly as night_comments:
--   1. can you see the post at all (inherited, not restated)
--   2. the viewer-vs-LIKER block axis, which post visibility does not cover.
-- Without gate 2, someone you blocked contributes to a count you can see and
-- appears in any future "who liked this" list.
drop policy if exists "likes visible with their post" on night_post_likes;
create policy "likes visible with their post"
  on night_post_likes for select to authenticated
  using (
    exists (select 1 from night_posts p where p.id = night_post_likes.post_id)
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_post_likes.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_post_likes.user_id))
    )
  );

-- ---------- WRITE ----------
-- Anyone who can see the post, minus a block edge with its author.
drop policy if exists "see it to like it" on night_post_likes;
create policy "see it to like it"
  on night_post_likes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from night_posts p
      where p.id = night_post_likes.post_id
        and not exists (
          select 1 from friendships f
          where f.status = 'blocked'
            and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
              or (f.friend_id = auth.uid() and f.user_id   = p.user_id))
        )
    )
  );

-- ---------- DELETE (unlike) ----------
-- Your own like only. The post's author cannot remove a like the way they can
-- remove a comment: a comment is speech on their post, a like is not.
drop policy if exists "unlike your own" on night_post_likes;
create policy "unlike your own"
  on night_post_likes for delete to authenticated
  using (auth.uid() = user_id);

-- ---------- NO UPDATE POLICY ----------
-- A like has nothing to update. Absent policy = denied.

-- ---------- verification ----------
-- Expect three: DELETE, INSERT, SELECT. NO UPDATE row.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'night_post_likes'
 order by cmd;

-- Expect rls_on true, policy_count 3, and restates_audience FALSE — the read
-- policy must INHERIT the audience rule, never carry a second copy of it.
select
  (select relrowsecurity from pg_class where relname = 'night_post_likes') as rls_on,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'night_post_likes')       as policy_count,
  (select bool_or(qual::text ilike '%college_slug%') from pg_policies
     where schemaname = 'public' and tablename = 'night_post_likes'
       and cmd = 'SELECT')                                                 as restates_audience;
