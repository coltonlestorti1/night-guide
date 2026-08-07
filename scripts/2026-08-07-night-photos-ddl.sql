-- ============================================================================
-- 2026-08-07 — photos on night posts
-- Additive and idempotent. Safe to run more than once.
--
-- Two parts: a PRIVATE storage bucket, and a child table pointing into it.
--
-- WHY A CHILD TABLE, NOT AN ARRAY COLUMN
-- One photo can then be deleted or moderated without rewriting the post, and a
-- report can point at a single image rather than the whole post.
--
-- WHY THE BUCKET IS PRIVATE (corrected AFTER the first draft was applied)
-- The first draft of this script copied the `avatars` bucket and made this
-- public, reasoning that "the post row is the gate". That was wrong, it was
-- APPLIED on 2026-08-07, and this file is the correction. Nothing leaked — the
-- bucket was empty and no upload path had shipped — but re-run this script
-- before any photo is uploaded. A public bucket serves the
-- file to anyone holding the URL regardless of any table policy, so a photo on
-- a "Just me" or friends-only post would sit at a publicly fetchable address —
-- the exact promise the audience tiers make, broken by the storage layer
-- underneath them. Unguessable paths are obscurity, not access control.
-- Reads now go through short-lived signed URLs minted only after the caller has
-- already been allowed to read the row.
--
-- ⚠️ EXIF: the client MUST upload through the canvas re-encode in
-- src/lib/avatarUpload.ts. Camera EXIF carries GPS coordinates and an exact
-- capture time — precisely the data night_posts.night_date exists to withhold.
-- A canvas redraw rebuilds the image from raw pixels and discards metadata; a
-- direct upload of the original File would hand it all back and silently undo
-- the privacy design through a side channel.
-- ============================================================================

-- ---------- storage bucket (PRIVATE) ----------
-- 5 MB and image-only MIME types enforced at the bucket. `public = false`, so
-- storage.objects SELECT below is the only read path and signed URLs are
-- required.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('night-photos', 'night-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- night_post_photos ----------
-- storage_path, not a URL: a private bucket has no durable public URL, and
-- storing one would be a stale secret. The client signs the path on read.
create table if not exists night_post_photos (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references night_posts (id) on delete cascade,
  storage_path text not null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists night_post_photos_post_idx
  on night_post_photos (post_id, sort_order);

-- REPAIR for the first draft of this script, which was applied 2026-08-07 with
-- a public bucket and a `url` column before the flaw was caught. The bucket is
-- flipped to private by the upsert above; this switches the column. Safe
-- because no upload path had shipped, so the table is empty — the guard below
-- refuses rather than silently dropping real rows.
do $$
begin
  if exists (select 1 from night_post_photos) then
    raise exception 'night_post_photos is not empty — migrate url -> storage_path by hand';
  end if;
  execute 'alter table night_post_photos drop column if exists url';
  execute 'alter table night_post_photos add column if not exists storage_path text';
  execute 'alter table night_post_photos alter column storage_path set not null';
end $$;

create unique index if not exists night_post_photos_path_idx
  on night_post_photos (storage_path);

alter table night_post_photos enable row level security;

-- Same reasoning as the storage policy: restate the audience rather than trust
-- a bare existence check to inherit it.
drop policy if exists "night photos follow their post" on night_post_photos;
create policy "night photos follow their post"
  on night_post_photos for select to authenticated
  using (
    exists (
      select 1 from night_posts p
      where p.id = night_post_photos.post_id
        and (
          p.user_id = auth.uid()
          or (
            not exists (
              select 1 from friendships f
              where f.status = 'blocked'
                and (
                  (f.user_id = auth.uid()   and f.friend_id = p.user_id) or
                  (f.friend_id = auth.uid() and f.user_id   = p.user_id)
                )
            )
            and (
              p.visibility = 'everyone'
              or (
                p.visibility = 'school'
                and exists (
                  select 1 from profiles me
                  join profiles them on them.id = p.user_id
                  where me.id = auth.uid()
                    and me.college_slug is not null
                    and me.college_slug = them.college_slug
                )
              )
              or (
                p.visibility = 'friends'
                and exists (
                  select 1 from friendships f
                  where f.status = 'accepted'
                    and (
                      (f.user_id = auth.uid()   and f.friend_id = p.user_id) or
                      (f.friend_id = auth.uid() and f.user_id   = p.user_id)
                    )
                )
              )
            )
          )
        )
    )
  );

drop policy if exists "users add photos to own posts" on night_post_photos;
create policy "users add photos to own posts"
  on night_post_photos for insert to authenticated
  with check (
    exists (
      select 1 from night_posts p
      where p.id = night_post_photos.post_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "users delete photos on own posts" on night_post_photos;
create policy "users delete photos on own posts"
  on night_post_photos for delete to authenticated
  using (
    exists (
      select 1 from night_posts p
      where p.id = night_post_photos.post_id and p.user_id = auth.uid()
    )
  );

-- ---------- storage.objects policies ----------
-- Placed AFTER the table: these reference night_post_photos.storage_path,
-- and Postgres validates a policy expression when it is created.
-- Read is allowed only to someone who can already read the owning post. The
-- audience predicate is restated here rather than inferred from a bare
-- existence check: relying on the subquery to inherit night_posts' RLS is very
-- probably correct, but "very probably" is how active_check_ins leaked every
-- live check-in on 2026-08-06. Say it out loud instead.
drop policy if exists "night photos readable by post audience" on storage.objects;
create policy "night photos readable by post audience"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'night-photos'
    and (
      -- your own folder, always
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
          from night_post_photos ph
          join night_posts p on p.id = ph.post_id
         where ph.storage_path = storage.objects.name
           and (
             p.user_id = auth.uid()
             or (
               not exists (
                 select 1 from friendships f
                 where f.status = 'blocked'
                   and (
                     (f.user_id = auth.uid()   and f.friend_id = p.user_id) or
                     (f.friend_id = auth.uid() and f.user_id   = p.user_id)
                   )
               )
               and (
                 p.visibility = 'everyone'
                 or (
                   p.visibility = 'school'
                   and exists (
                     select 1 from profiles me
                     join profiles them on them.id = p.user_id
                     where me.id = auth.uid()
                       and me.college_slug is not null
                       and me.college_slug = them.college_slug
                   )
                 )
                 or (
                   p.visibility = 'friends'
                   and exists (
                     select 1 from friendships f
                     where f.status = 'accepted'
                       and (
                         (f.user_id = auth.uid()   and f.friend_id = p.user_id) or
                         (f.friend_id = auth.uid() and f.user_id   = p.user_id)
                       )
                   )
                 )
               )
             )
           )
      )
    )
  );

drop policy if exists "night photos publicly readable" on storage.objects;  -- from the first draft

drop policy if exists "users upload own night photos" on storage.objects;
create policy "users upload own night photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'night-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own night photos" on storage.objects;
create policy "users delete own night photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'night-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- verification ----------
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'night_post_photos' order by cmd;

-- Expect: rls_on true, policy_count 3, bucket_exists 1, bucket_public FALSE.
select
  (select relrowsecurity from pg_class where relname = 'night_post_photos') as rls_on,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='night_post_photos') as policy_count,
  (select count(*) from storage.buckets where id = 'night-photos') as bucket_exists,
  (select public from storage.buckets where id = 'night-photos') as bucket_public;
