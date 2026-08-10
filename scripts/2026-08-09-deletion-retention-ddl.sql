-- ENDZ — 2026-08-09
-- Deletion and retention: make "delete" actually delete, stop a deleted photo
-- from being re-claimed, and keep a report alive past the account it is about.
--
--   Part 1: night_post_photos INSERT must own the storage path  (ESCALATION)
--   Part 2: reports outlive the account they are about
--   Part 3: admin-only orphan sweep — paths, never content
--
-- Paste the whole file into the Supabase SQL editor in one go.
-- Design: docs/superpowers/specs/2026-08-09-deletion-retention-design.md
-- Idempotent. Safe to run more than once.

begin;

-- ============================================================
-- PART 1 — a photo path you do not own cannot be attached
-- ============================================================
-- The old policy checked only that the POST was yours. It never checked that
-- storage_path sat in your own folder. The unique index on storage_path
-- normally stops you re-using someone else's path — but DELETING A POST FREES
-- THAT INDEX ENTRY, and the file itself was never removed. So:
--
--   1. Alice posts a friends-only photo. Bob (a friend) reads storage_path
--      straight out of the feed payload.
--   2. Alice deletes the post. Row gone, file retained, path unclaimed.
--   3. Bob attaches Alice's path to his own 'everyone' post. The storage read
--      policy joins through BOB's post, so Alice's deleted private photo is
--      now signable by every user on ENDZ.
--
-- This part stands alone: it holds even if every cleanup path fails forever.
--
-- split_part rather than storage.foldername(): storage_path is a plain column
-- on a public table, so there is no reason to reach into the storage schema
-- for a prefix test. uploadNightPhoto() writes '<uid>/<uuid>.jpg'.

drop policy if exists "users add photos to own posts" on night_post_photos;
create policy "users add photos to own posts"
  on night_post_photos for insert to authenticated
  with check (
    exists (
      select 1 from night_posts p
      where p.id = night_post_photos.post_id and p.user_id = auth.uid()
    )
    and split_part(storage_path, '/', 1) = auth.uid()::text
  );


-- ============================================================
-- PART 2 — a report outlives the account it is about
-- ============================================================
-- Both FKs were ON DELETE CASCADE to profiles, so: harass people -> tap
-- Delete Account (Guideline 5.1.1(v) REQUIRES that button) -> every report
-- about you evaporates -> re-register clean. Guideline 1.2 compliance rests
-- on that record existing, and delete_own_account() is self-serve.
--
-- reported_* is snapshotted because a report whose subject is nulled out is an
-- unreadable record. The REPORTER gets no snapshot on purpose: their identity
-- is not what makes a report actionable, and keeping it would retain personal
-- data about someone who asked to be forgotten.

alter table reports add column if not exists reported_username     text;
alter table reports add column if not exists reported_display_name text;

-- Backfill BEFORE the FKs change, while every reported_user_id still resolves.
update reports r
   set reported_username     = p.username,
       reported_display_name = p.display_name
  from profiles p
 where p.id = r.reported_user_id
   and r.reported_username is null;

alter table reports alter column reporter_id      drop not null;
alter table reports alter column reported_user_id drop not null;

-- The constraint names are whatever Postgres generated when the table was
-- created inline, so find them by column rather than guessing
-- 'reports_reporter_id_fkey' and failing silently on a mismatch.
do $$
declare c text;
begin
  for c in
    select distinct con.conname
      from pg_constraint con
      join pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum   = any (con.conkey)
     where con.conrelid = 'public.reports'::regclass
       and con.contype  = 'f'
       and a.attname in ('reporter_id', 'reported_user_id')
  loop
    execute format('alter table reports drop constraint if exists %I', c);
  end loop;
end $$;

alter table reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references profiles (id) on delete set null;

alter table reports
  add constraint reports_reported_user_id_fkey
  foreign key (reported_user_id) references profiles (id) on delete set null;

-- SECURITY DEFINER so the snapshot is written no matter what the reporter can
-- SELECT, and pg_temp is pinned: an unpinned search_path on a definer function
-- is the exact hole already fixed once on is_admin() (2026-08-09).
create or replace function public.reports_snapshot_reported()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select p.username, p.display_name
    into new.reported_username, new.reported_display_name
    from public.profiles p
   where p.id = new.reported_user_id;
  return new;
end;
$$;

drop trigger if exists reports_snapshot_reported_trg on reports;
create trigger reports_snapshot_reported_trg
  before insert on reports
  for each row execute function public.reports_snapshot_reported();


-- ============================================================
-- PART 3 — orphan sweep: admin only, paths never content
-- ============================================================
-- Without this an account-deletion orphan is PERMANENTLY undeletable: the only
-- DELETE policy on these buckets is "your own folder", and the owner no longer
-- exists. Files would accumulate forever with nobody able to remove them.
--
-- Deliberately NOT an admin SELECT policy on night-photos. That is the easy
-- way to build a sweep and it would hand the admin every friends-only photo on
-- the app. Instead: a function that returns PATHS, and a delete policy
-- constrained to paths that are already unreferenced. Neither grants read
-- access to a photo anyone can still see.

create or replace function public.list_orphaned_storage()
returns table (bucket text, path text, created_at timestamptz, bytes bigint)
language sql
security definer
set search_path = public, storage, pg_temp
as $$
  select o.bucket_id,
         o.name,
         o.created_at,
         nullif(o.metadata->>'size', '')::bigint
    from storage.objects o
   where public.is_admin()
     and (
       (o.bucket_id = 'night-photos'
         and not exists (
           select 1 from public.night_post_photos ph
            where ph.storage_path = o.name))
       or
       (o.bucket_id = 'avatars'
         and not exists (
           select 1 from public.profiles pr
            where pr.id::text = split_part(o.name, '/', 1)))
     )
   order by o.created_at;
$$;

-- Revoking from PUBLIC does NOT remove anon's grant — Supabase grants anon
-- EXECUTE explicitly. Both revokes are required (proved 2026-08-09).
revoke execute on function public.list_orphaned_storage() from public;
revoke execute on function public.list_orphaned_storage() from anon;
grant  execute on function public.list_orphaned_storage() to authenticated;

drop policy if exists "admins delete orphaned night photos" on storage.objects;
create policy "admins delete orphaned night photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'night-photos'
    and public.is_admin()
    and not exists (
      select 1 from public.night_post_photos ph
       where ph.storage_path = storage.objects.name)
  );

drop policy if exists "admins delete orphaned avatars" on storage.objects;
create policy "admins delete orphaned avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_admin()
    and not exists (
      select 1 from public.profiles pr
       where pr.id::text = split_part(storage.objects.name, '/', 1))
  );

commit;


-- ============================================================
-- VERIFICATION — run this after the paste and read every row
-- ============================================================

-- 1. Part 1: the INSERT policy must now mention split_part.
--    Expect one row, with_check containing 'split_part'.
select policyname, cmd, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename  = 'night_post_photos'
   and cmd = 'INSERT';

-- 2. Part 2: both FKs must read 'SET NULL' (confdeltype 'n'), both columns
--    nullable. Expect 2 rows, delete_action 'SET NULL', is_nullable YES.
select con.conname,
       a.attname,
       case con.confdeltype
         when 'n' then 'SET NULL' when 'c' then 'CASCADE'
         when 'a' then 'NO ACTION' else con.confdeltype::text end as delete_action,
       not a.attnotnull as is_nullable
  from pg_constraint con
  join pg_attribute a
    on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
 where con.conrelid = 'public.reports'::regclass
   and con.contype  = 'f'
 order by a.attname;

-- 3. Part 2: the snapshot must be backfilled. Expect missing_snapshot = 0.
select count(*) filter (where reported_user_id is not null
                          and reported_username is null) as missing_snapshot,
       count(*) as total_reports
  from reports;

-- 4. Part 2: the trigger exists.
select tgname from pg_trigger
 where tgrelid = 'public.reports'::regclass and not tgisinternal;

-- 5. Part 3: the orphans. Expect the 2 known night-photos files and 0 avatars.
select bucket, count(*) as orphans, sum(bytes) as total_bytes
  from public.list_orphaned_storage()
 group by bucket;

-- 6. Part 3: both admin delete policies exist.
select policyname from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'admins delete orphaned%'
 order by policyname;
