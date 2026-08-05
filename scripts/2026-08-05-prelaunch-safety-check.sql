-- ============================================================================
-- 2026-08-05 — pre-launch safety check (READ-ONLY)
--
-- Every statement is a SELECT. Nothing is created, altered or deleted.
-- Run the whole file and send back the output of all five sections.
--
-- Purpose: confirm the live database is safe to expose to strangers before
-- the Google OAuth consent screen is published. The items below are the ones
-- that cannot be verified from outside with the anon key.
-- ============================================================================


-- ---------- 1. THE CRITICAL ONE: privilege-escalation guard ----------
-- profiles.role now exists, and the "users update own profile" policy has no
-- column-level WITH CHECK. Without this trigger, ANY signed-in user can run
--     update profiles set role = 'super_admin' where id = auth.uid();
-- and own the admin dashboard.
--
-- EXPECT: exactly one row — profiles_guard_role, tgenabled = 'O' (enabled).
-- If this returns ZERO rows, DO NOT PUBLISH OAUTH. Re-run section 4 of
-- scripts/2026-07-28-admin-ddl.sql first.
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.profiles'::regclass
   and not tgisinternal;


-- ---------- 2. every RLS policy, and which roles it applies to ----------
-- The schema record ~/Documents/endz/endz-schema.sql is known to be STALE
-- (it has no admin DDL, and it claims venues are authenticated-only when
-- anon can in fact read them). This is the ground truth.
--
-- LOOK FOR: any policy where roles includes 'anon' or '{public}' on a table
-- other than venues/events. Those are the ones a stranger can reach.
select tablename,
       policyname,
       cmd,
       roles::text,
       coalesce(qual, '(none)')       as using_expr,
       coalesce(with_check, '(none)') as with_check_expr
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd, policyname;


-- ---------- 3. RLS actually ENABLED on every public table ----------
-- A table with policies but rls_enabled = false is wide open — the policies
-- are simply not consulted.
--
-- EXPECT: rls_enabled = true on every row. Any false is a hole.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relrowsecurity, c.relname;


-- ---------- 4. direct table grants to anon/authenticated ----------
-- RLS only filters rows the role is already allowed to touch. A stray
-- INSERT/UPDATE/DELETE grant to `anon` is a separate hole from RLS.
--
-- EXPECT: anon should have SELECT only (and INSERT on events, by design).
-- Any UPDATE or DELETE granted to anon is a finding.
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privs
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
 group by grantee, table_name
 order by grantee, table_name;


-- ---------- 5. SECURITY DEFINER functions and their search_path ----------
-- A SECURITY DEFINER function without a pinned search_path is a classic
-- privilege-escalation vector.
--
-- EXPECT: every security_definer = true row also shows a config containing
-- search_path=public. is_admin, guard_profile_role, the three admin_* RPCs
-- and venue_activity should all appear pinned.
select p.proname,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ', '), '** NO search_path PINNED **') as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosecdef
 order by p.proname;
