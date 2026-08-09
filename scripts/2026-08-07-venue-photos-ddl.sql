-- ============================================================================
-- 2026-08-07 — venue photos
-- Additive and idempotent. Safe to run more than once.
--
-- WHY THIS BUCKET IS PUBLIC, WHEN night-photos IS NOT
-- 718fe0a corrected night-photos from public to private, and that correction
-- was right: a night photo is AUDIENCE-SCOPED, so a public bucket would serve
-- a friends-only image to anyone holding the URL, breaking the promise the
-- audience tiers make from underneath them.
-- A venue photo has no audience to leak past. It is rendered on a card to
-- every user, signed in or out, by definition. Making it private would mean
-- minting signed URLs for 56 essentially-static images on every feed render —
-- defeating CDN caching and adding a round trip per card, in exchange for no
-- privacy whatsoever.
-- The control here is WRITE access, not read access: only admins can put a
-- photo in this bucket or point a venue at one.
-- ============================================================================

-- ---------- columns ----------
-- image_url: the durable public URL of the stored file (a public bucket has
-- one; night_post_photos stores a path precisely because a private bucket
-- does not).
-- image_source: where the photo came from — a URL, "supplied by venue", or a
-- photographer credit. Never rendered in the app. It exists so that a takedown
-- request is one admin edit instead of an investigation, and it is the entire
-- mitigation for sourcing photos from the web.
alter table venues add column if not exists image_url    text;
alter table venues add column if not exists image_source text;

-- ---------- storage bucket (PUBLIC — see the header) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- storage.objects policies ----------
-- Read: public = true already serves the object over the public URL, so this
-- SELECT policy exists for authenticated clients listing the bucket. Stated
-- explicitly rather than left implicit — assuming what a policy "probably"
-- does is how active_check_ins leaked every live check-in on 2026-08-06.
drop policy if exists "venue photos are publicly readable" on storage.objects;
create policy "venue photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

-- Write: admins only, matching the `venues` UPDATE policy in
-- scripts/2026-07-28-admin-ddl.sql. Three separate policies because Postgres
-- has no single "write" verb, and a missing DELETE policy would silently turn
-- every photo replacement into an orphaned file.
drop policy if exists "admins upload venue photos" on storage.objects;
create policy "admins upload venue photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-photos' and public.is_admin());

drop policy if exists "admins update venue photos" on storage.objects;
create policy "admins update venue photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'venue-photos' and public.is_admin())
  with check (bucket_id = 'venue-photos' and public.is_admin());

drop policy if exists "admins delete venue photos" on storage.objects;
create policy "admins delete venue photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and public.is_admin());

-- ---------- verification ----------
-- Run after pasting. Expect: two rows (image_url, image_source), and one
-- bucket row with public = true.
-- select column_name from information_schema.columns
--   where table_name = 'venues' and column_name in ('image_url', 'image_source');
-- select id, public, file_size_limit from storage.buckets where id = 'venue-photos';
