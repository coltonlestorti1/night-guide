-- ============================================================================
-- 2026-08-07 — photos on night posts
-- Additive and idempotent. Safe to run more than once.
--
-- Two parts: a storage bucket, and a child table pointing at it.
--
-- WHY A CHILD TABLE, NOT AN ARRAY COLUMN
-- One photo can then be deleted or moderated without rewriting the post, and a
-- report can point at a single image rather than the whole post.
--
-- WHY THE PHOTOS ARE SAFE TO STORE AT ALL
-- These are the user's own photographs. None of the Google Places licensing
-- constraints apply — that restriction is about Places content, not about
-- pictures someone took. See scripts/2026-08-06-fix-active-check-ins-view.sql
-- era notes and the venue-photography line in the tracker.
--
-- ⚠️ EXIF: the client MUST upload through the canvas re-encode in
-- src/lib/avatarUpload.ts. Camera EXIF carries GPS coordinates and an exact
-- capture time — precisely the data night_posts.night_date exists to withhold.
-- A canvas redraw rebuilds the image from raw pixels and discards metadata; a
-- direct upload of the original File would hand it all back and silently undo
-- the privacy design through a side channel.
-- ============================================================================

-- ---------- storage bucket ----------
-- Public-read like avatars: a feed image has to load for anyone RLS already
-- allowed to see the post, and signed URLs per image per render would be a lot
-- of round trips for no additional protection — the post row is the gate.
-- 5 MB and image-only MIME types enforced at the bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('night-photos', 'night-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "night photos publicly readable" on storage.objects;
create policy "night photos publicly readable"
  on storage.objects for select
  using (bucket_id = 'night-photos');

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

-- ---------- night_post_photos ----------
create table if not exists night_post_photos (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references night_posts (id) on delete cascade,
  url        text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists night_post_photos_post_idx
  on night_post_photos (post_id, sort_order);

alter table night_post_photos enable row level security;

-- Visibility is inherited from the post, deliberately: the post is the single
-- place audience is decided, and duplicating that logic here would create a
-- second copy of the rule that can disagree with the first.
drop policy if exists "night photos follow their post" on night_post_photos;
create policy "night photos follow their post"
  on night_post_photos for select to authenticated
  using (
    exists (select 1 from night_posts p where p.id = night_post_photos.post_id)
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

-- ---------- verification ----------
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'night_post_photos' order by cmd;

select
  (select relrowsecurity from pg_class where relname = 'night_post_photos') as rls_on,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='night_post_photos') as policy_count,
  (select count(*) from storage.buckets where id = 'night-photos') as bucket_exists;
