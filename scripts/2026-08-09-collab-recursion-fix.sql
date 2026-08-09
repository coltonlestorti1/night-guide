-- ============================================================================
-- 2026-08-09 — FIX: infinite recursion between night_posts and night_post_tags.
--
-- RUN THIS NOW. Until it is applied, reading night_posts fails with
--   42P17 infinite recursion detected in policy for relation "night_posts"
-- which means the feed is DOWN.
--
-- WHAT I GOT WRONG: the collab branch I added to night_posts' SELECT policy
-- queries night_post_tags, and night_post_tags' SELECT policy queries
-- night_posts. Each policy triggers the other. (Postgres applying policies to
-- tables referenced from inside a policy is exactly what the 2026-08-07 probe
-- proved — this is the same mechanism biting from the other side.)
--
-- THE FIX: break the cycle with a SECURITY DEFINER function. It runs as the
-- owner, so its reads of night_post_tags do NOT re-enter that table's policy,
-- and the cycle ends. This is the documented way out of RLS recursion.
--
-- Safety of the function:
--   - It takes NO viewer argument and uses auth.uid() internally, so nobody can
--     ask it about a third party's friendships.
--   - It returns only a boolean.
--   - EXECUTE is revoked from public and granted only to authenticated.
--   - It does NOT bypass the block gate: that lives in night_posts' policy,
--     wrapped AROUND this call, exactly as before.
-- ============================================================================

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

-- Same policy as before, with the recursive subquery replaced by the call.
-- Everything else is byte-identical to the 2026-08-06 policy.
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
        -- Collab, via the SECURITY DEFINER helper so this does not re-enter
        -- night_post_tags' policy. Still INSIDE the not-blocked-by-the-author
        -- guard above, which is what stops collab bypassing a block.
        or post_has_collab_for_me(night_posts.id)
      )
    )
  );

-- ---------------- verification ----------------
-- This SELECT is itself the test: if the recursion were still present it would
-- raise 42P17 instead of returning a row.
select
  (select count(*) from night_posts)                                   as posts_readable,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='night_posts')             as posts_policies,
  (select exists (select 1 from pg_proc
     where proname = 'post_has_collab_for_me'))                         as helper_present;
