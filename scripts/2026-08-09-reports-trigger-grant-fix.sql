-- ENDZ — 2026-08-09
-- Follow-up to 2026-08-09-deletion-retention-ddl.sql.
--
-- reports_snapshot_reported() shipped with the default EXECUTE grant. Postgres
-- grants EXECUTE to PUBLIC on every new function, and — proved on 2026-08-09 —
-- Supabase ALSO grants it to anon explicitly, so `revoke ... from public` on
-- its own leaves anon holding it. Both revokes are required.
--
-- Exploitability is low: calling a trigger function directly raises
-- "trigger functions can only be called as triggers" before the body runs. It
-- is still a SECURITY DEFINER function reachable by an anonymous caller, and
-- this project's standard (22/22 definer functions pinned and revoked on
-- 2026-08-09) is that no such function keeps a grant it does not need. Nothing
-- calls it by name — the trigger fires it as the table owner regardless of who
-- issued the INSERT — so revoking costs nothing.
--
-- Idempotent. Safe to run more than once.

begin;

revoke execute on function public.reports_snapshot_reported() from public;
revoke execute on function public.reports_snapshot_reported() from anon;
revoke execute on function public.reports_snapshot_reported() from authenticated;

commit;

-- ---------------------------------------------------------------------------
-- VERIFICATION. Every row must show got = expect.
-- ---------------------------------------------------------------------------
select 'no role holds EXECUTE on the trigger fn' as check_name,
       (select count(*) from information_schema.role_routine_grants
         where routine_name = 'reports_snapshot_reported'
           and grantee in ('anon', 'authenticated', 'public', 'PUBLIC'))::text as got,
       '0' as expect
union all
-- The trigger must still fire despite nobody holding EXECUTE: it runs as the
-- table owner, not as the caller. This is the check that proves the revoke did
-- not quietly break report filing.
select 'snapshot trigger still attached',
       (select count(*) from pg_trigger
         where tgrelid = 'public.reports'::regclass and not tgisinternal
           and tgname = 'reports_snapshot_reported_trg')::text, '1'
union all
select 'sweep fn still closed to anon',
       (select count(*) from information_schema.role_routine_grants
         where routine_name = 'list_orphaned_storage' and grantee = 'anon')::text, '0';
