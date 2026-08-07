-- ============================================================================
-- 2026-08-07 — comments on night posts.
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-07-night-comments-design.md
--
-- RLS SUBQUERY INHERITANCE PROBE RESULT: rows_visible = 0, INHERITANCE HOLDS.
-- Run against live 2026-08-07 via scripts/2026-08-07-rls-inheritance-probe.sql.
-- The read policy below therefore INHERITS night_posts' audience rule instead
-- of restating it. There is one copy of that rule, and it lives in
-- scripts/2026-08-06-night-posts-ddl.sql.
--
-- Friends of the post's author may WRITE, including on 'school' and 'everyone'
-- posts. Anyone who can see the post may READ. Those are different gates on
-- purpose: narrow->wide is reversible, wide->narrow is a trust event.
-- ============================================================================

create table if not exists night_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references night_posts (id) on delete cascade,
  user_id    uuid not null constraint night_comments_user_id_fkey
               references profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

-- Ordered by (post_id, created_at) because both reads want a thread oldest
-- first, and the feed preview asks for many post_ids at once.
create index if not exists night_comments_post_idx
  on night_comments (post_id, created_at);

alter table night_comments enable row level security;

-- ---------- READ ----------
-- Two gates, and the second one is the easy one to forget.
--
-- Gate 1 — can you see the post at all. Inherited from night_posts, NOT
-- restated: a second copy of the audience rule is a second thing that can
-- disagree with the first.
--
-- Gate 2 — the viewer-vs-COMMENTER axis. night_posts' policy gates viewer vs.
-- post AUTHOR and says nothing about who wrote a comment underneath. Without
-- this, someone you blocked reaches you through a mutual friend's post.
drop policy if exists "comments visible with their post" on night_comments;
create policy "comments visible with their post"
  on night_comments for select to authenticated
  using (
    exists (select 1 from night_posts p where p.id = night_comments.post_id)
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_comments.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_comments.user_id))
    )
  );

-- ---------- WRITE ----------
-- Friends of the AUTHOR, not "anyone who can see it". A friend commenting on
-- an 'everyone' post is still a friend, so visibility is not consulted here.
drop policy if exists "friends of the author comment" on night_comments;
create policy "friends of the author comment"
  on night_comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
                or (f.friend_id = auth.uid() and f.user_id   = p.user_id))
          )
        )
        -- Belt and braces, checked against the POST AUTHOR (p.user_id), not
        -- the commenter. The first clause above already forces
        -- night_comments.user_id = auth.uid(), so a check against the
        -- commenter would only ever ask "have I blocked myself" — never true,
        -- so it could never reject anything. blockUser() deletes the pair's
        -- 'accepted' row before inserting the block, so 'accepted' and
        -- 'blocked' between viewer and author should never coexist — but that
        -- invariant lives in client code, not in a constraint.
        and not exists (
          select 1 from friendships f
          where f.status = 'blocked'
            and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
              or (f.friend_id = auth.uid() and f.user_id   = p.user_id))
        )
    )
  );

-- ---------- DELETE ----------
-- Your own comment, or ANY comment on your own post. The person whose night it
-- is owns the thread; that is the moderation lever that works with no staff.
drop policy if exists "author or post owner deletes" on night_comments;
create policy "author or post owner deletes"
  on night_comments for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id and p.user_id = auth.uid()
    )
  );

-- ---------- NO UPDATE POLICY, DELIBERATELY ----------
-- Absent policy = denied. "No editing" is a database rule, not a UI promise.
-- Editing would mean either an edit history or silent rewrites underneath
-- someone else's reply. Do not add one without a decision from Colton.

-- ---------- verification ----------
-- Expect exactly three: DELETE, INSERT, SELECT. NO UPDATE row.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'night_comments'
 order by cmd;

-- Expect: rls_on true, policy_count 3.
select
  (select relrowsecurity from pg_class where relname = 'night_comments') as rls_on,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'night_comments') as policy_count;

-- The embed in src/lib/night/comments.ts names this constraint. If it is
-- missing, PostgREST returns an error instead of an author, and the feed shows
-- comments with no name. Expect one row.
select conname from pg_constraint where conname = 'night_comments_user_id_fkey';
