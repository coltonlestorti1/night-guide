-- ============================================================================
-- 2026-08-09 — collab nights: tagging who you were out with.
-- Additive and idempotent. Safe to run more than once.
--
-- ⚠️ THIS FILE ALSO REPLACES night_posts' SELECT POLICY. That policy is a
-- shipped security boundary with existing RLS proofs against it. The change is
-- ADDITIVE — one new OR branch — and the proof script is extended in the same
-- commit. Re-run scripts/2026-08-07-night-posts-rls-test.sql after applying.
--
-- STATES (Colton, 2026-08-09). The TAGGED person owns this decision:
--   pending  — you were tagged, you have not decided. Invisible to everyone
--              except you and the post's author.
--   tag      — you agree to be named. Post stays in the AUTHOR's audience.
--   collab   — you are named AND you share it with YOUR friends. The post
--              becomes visible to author's audience ∪ your friends.
--   private  — a note to yourself on your OWN private post. Never shown to the
--              person named, never approved, author-only.
-- Removed = the row is deleted. EITHER party may delete it at any time, and
-- deleting a tag NEVER removes the post — it stays up for the author's
-- audience, just without the tag.
-- ============================================================================

do $$ begin
  create type tag_state as enum ('pending', 'tag', 'collab', 'private');
exception when duplicate_object then null;
end $$;

create table if not exists night_post_tags (
  post_id        uuid not null references night_posts (id) on delete cascade,
  tagged_user_id uuid not null references profiles (id) on delete cascade,
  state          tag_state not null default 'pending',
  created_at     timestamptz not null default now(),
  primary key (post_id, tagged_user_id)
);

create index if not exists night_post_tags_user_idx
  on night_post_tags (tagged_user_id, state);

alter table night_post_tags enable row level security;

-- ---------------------------------------------------------------------------
-- Who can see a tag row.
--   - the post's author, always (it is their post)
--   - the tagged person, always (it is their name)
--   - anyone else ONLY once it is accepted ('tag' or 'collab') AND they can
--     see the post. 'pending' and 'private' are never visible to third
--     parties: a pending tag would name someone who has not agreed yet, and a
--     private tag is a note to self.
-- ---------------------------------------------------------------------------
drop policy if exists "tags visible with their post" on night_post_tags;
create policy "tags visible with their post"
  on night_post_tags for select to authenticated
  using (
    auth.uid() = tagged_user_id
    or exists (select 1 from night_posts p
                where p.id = night_post_tags.post_id and p.user_id = auth.uid())
    or (
      state in ('tag', 'collab')
      and exists (select 1 from night_posts p where p.id = night_post_tags.post_id)
      and not exists (
        select 1 from friendships f
        where f.status = 'blocked'
          and ((f.user_id = auth.uid()   and f.friend_id = night_post_tags.tagged_user_id)
            or (f.friend_id = auth.uid() and f.user_id   = night_post_tags.tagged_user_id))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Only the post's author creates tags.
--   - on a 'nobody' post the tag MUST be 'private' — you cannot publicly name
--     someone in a post nobody can see, and it is never shown to them.
--   - on any other post the tag MUST start 'pending'. The author does not get
--     to decide that someone accepted.
-- ---------------------------------------------------------------------------
drop policy if exists "authors tag their own posts" on night_post_tags;
create policy "authors tag their own posts"
  on night_post_tags for insert to authenticated
  with check (
    exists (
      select 1 from night_posts p
      where p.id = night_post_tags.post_id
        and p.user_id = auth.uid()
        and (
          (p.visibility = 'nobody' and night_post_tags.state = 'private')
          or (p.visibility <> 'nobody' and night_post_tags.state = 'pending')
        )
    )
    -- Cannot tag someone who has blocked you, or whom you have blocked.
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_post_tags.tagged_user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_post_tags.tagged_user_id))
    )
    and night_post_tags.tagged_user_id <> auth.uid()   -- tagging yourself is noise
  );

-- ---------------------------------------------------------------------------
-- ONLY the tagged person changes the state, and only between the public
-- states. The author cannot promote a pending tag to collab on their behalf —
-- that is the entire consent mechanism.
--
-- 'private' is deliberately unreachable here: it belongs to the author's own
-- private post and is never a thing the tagged person accepts.
-- ---------------------------------------------------------------------------
drop policy if exists "tagged person decides" on night_post_tags;
create policy "tagged person decides"
  on night_post_tags for update to authenticated
  using (auth.uid() = tagged_user_id)
  with check (auth.uid() = tagged_user_id and state in ('tag', 'collab'));

-- ---------------------------------------------------------------------------
-- Either party removes it. Removing a tag NEVER removes the post.
-- ---------------------------------------------------------------------------
drop policy if exists "either party removes a tag" on night_post_tags;
create policy "either party removes a tag"
  on night_post_tags for delete to authenticated
  using (
    auth.uid() = tagged_user_id
    or exists (select 1 from night_posts p
                where p.id = night_post_tags.post_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Widening a post must NOT silently publish a name.
-- A 'private' tag only makes sense on a 'nobody' post. If the author later
-- widens that post, the tag reverts to 'pending' so the named person is asked
-- before anyone sees it. Without this, changing one dropdown publishes someone
-- else's name with no consent at all.
-- ---------------------------------------------------------------------------
create or replace function reset_tags_on_widen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.visibility = 'nobody' and new.visibility <> 'nobody' then
    update night_post_tags
       set state = 'pending'
     where post_id = new.id and state = 'private';
  elsif old.visibility <> 'nobody' and new.visibility = 'nobody' then
    -- Narrowing to private: accepted tags become private notes again rather
    -- than lingering as public tags on a post nobody can see.
    update night_post_tags
       set state = 'private'
     where post_id = new.id and state in ('pending', 'tag', 'collab');
  end if;
  return new;
end $$;

drop trigger if exists night_posts_visibility_retags on night_posts;
create trigger night_posts_visibility_retags
  after update of visibility on night_posts
  for each row execute function reset_tags_on_widen();

-- ---------------------------------------------------------------------------
-- night_posts SELECT — ONE new OR branch for collab.
--
-- ⚠️ THE COLLAB LOOKUP MUST GO THROUGH A SECURITY DEFINER HELPER.
-- An inline `select ... from night_post_tags` here causes
--   42P17 infinite recursion detected in policy for relation "night_posts"
-- because night_post_tags' own SELECT policy reads night_posts. Each policy
-- triggers the other. This was shipped broken on 2026-08-09 and took the feed
-- down until scripts/2026-08-09-collab-recursion-fix.sql was applied.
--
-- ⚠️ THE BLOCK GATE APPLIES TO THE POST'S AUTHOR, NOT ONLY THE COLLABORATOR.
-- Someone who blocked YOU but is friends with your collaborator must still not
-- see your post — which is why the collab branch sits INSIDE the not-blocked
-- guard rather than beside it.
-- ---------------------------------------------------------------------------

-- Runs as owner, so reading night_post_tags here does NOT re-enter that
-- table's policy. Takes no viewer argument — auth.uid() internally — so it
-- cannot be used to probe a third party's friendships.
create or replace function post_has_collab_for_me(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from night_post_tags t
      join friendships f
        on f.status = 'accepted'
       and ((f.user_id = auth.uid()   and f.friend_id = t.tagged_user_id)
         or (f.friend_id = auth.uid() and f.user_id   = t.tagged_user_id))
     where t.post_id = p_post
       and t.state = 'collab'
  );
$$;

revoke execute on function post_has_collab_for_me(uuid) from public;
grant execute on function post_has_collab_for_me(uuid) to authenticated;

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
               and me.college_slug is not null
               and me.college_slug = them.college_slug
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
        or post_has_collab_for_me(night_posts.id)
      )
    )
  );

-- ---------------- verification ----------------
-- Expect four on night_post_tags: DELETE, INSERT, SELECT, UPDATE.
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'night_post_tags' order by cmd;

-- Expect: tags_rls true, tag_policies 4, posts_policies 4, trigger_present true.
select
  (select relrowsecurity from pg_class where relname = 'night_post_tags')      as tags_rls,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='night_post_tags')                as tag_policies,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='night_posts')                    as posts_policies,
  (select exists (select 1 from pg_trigger
     where tgname = 'night_posts_visibility_retags'))                          as trigger_present,
  (select exists (select 1 from pg_proc
     where proname = 'post_has_collab_for_me'))                              as helper_present;
