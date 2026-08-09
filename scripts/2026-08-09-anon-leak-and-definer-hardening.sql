-- ⚠️⚠️ THIS SCRIPT DID NOT APPLY WHEN IT WAS RUN ON 2026-08-09. ⚠️⚠️
-- Its `begin; ... rollback;` proof section at the bottom discarded the DDL at
-- the top, because the Supabase editor wraps a whole script in ONE transaction
-- so the `begin` was a no-op. The proof ran inside that transaction, saw the
-- changes, and reported PASS on work that was thrown away seconds later.
-- Everything here was re-applied by
-- scripts/2026-08-09-saves-recursion-and-reapply.sql, which contains NO
-- transaction control. DO NOT re-run this file as-is.
--
-- ============================================================================
-- 2026-08-09 — anon 'everyone' leak + SECURITY DEFINER hardening
--
-- Fixes two findings PROVED LIVE by the full review probe the same day:
--
--   CRITICAL  an anonymous caller holding only the publishable key read a live
--             check-in and a venue save. Probe returned 1 row for each.
--   IMPORTANT 18 of 20 SECURITY DEFINER functions pin `search_path = public`
--             without pg_temp, and `anon` still holds EXECUTE on most of them.
--
-- PASTE THE WHOLE FILE IN ONE GO. It is idempotent — safe to re-run.
-- Part 3 verifies the fix and rolls its own fixtures back, so the last thing
-- you see is a result table saying PASS or FAIL.
-- ============================================================================


-- ============================================================================
-- PART 1 — close the anon leak
--
-- ROOT CAUSE: these policies were created with NO `to` clause, so they apply to
-- PUBLIC, which includes `anon`. Supabase grants anon table SELECT by default
-- (this schema already relies on that — see the `revoke select on plan_rsvps
-- from anon` at endz-schema.sql:643), so RLS was the only gate. The two SELECT
-- policies below each contain a branch — `visibility = 'everyone'` — that is
-- TRUE without ever dereferencing auth.uid(), so it fired for a signed-out
-- caller. The UI promises "Anyone on ENDZ"; the database meant anyone at all.
--
-- WHY THE OTHER POLICIES ARE IN HERE TOO: every one of them already evaluates
-- FALSE for anon because its USING/WITH CHECK reads auth.uid() or auth.role(),
-- which is null for a signed-out caller. Adding `to authenticated` to those is
-- therefore PROVABLY a no-op on behavior — it cannot break a path that works
-- today, because no such path can exist. They are included so the next person
-- who copies a nearby policy copies a correct one, which is exactly how this
-- bug propagated to two tables in the first place.
--
-- ⚠️ `venues / venues readable by everyone` is DELIBERATELY NOT TOUCHED.
-- The map renders for signed-out visitors and depends on anon reading venues.
-- ============================================================================

-- ---------- the actual leak ----------
alter policy "checkins visible per rules" on check_ins   to authenticated;
alter policy "saves visible per rules"    on venue_saves to authenticated;

-- ---------- consistency: same tables, write side ----------
alter policy "users create own checkins" on check_ins to authenticated;
alter policy "users delete own checkins" on check_ins to authenticated;
alter policy "users update own checkins" on check_ins to authenticated;

alter policy "users create own saves" on venue_saves to authenticated;
alter policy "users delete own saves" on venue_saves to authenticated;
alter policy "users update own saves" on venue_saves to authenticated;

-- ---------- consistency: everything else the probe flagged as {public} ----------
alter policy "users see own friendships"          on friendships to authenticated;
alter policy "users create own friend requests"   on friendships to authenticated;
alter policy "recipient accepts pending request"  on friendships to authenticated;
alter policy "users delete own friendships"       on friendships to authenticated;

alter policy "profiles readable by authenticated" on profiles to authenticated;
alter policy "users insert own profile"           on profiles to authenticated;
alter policy "users update own profile"           on profiles to authenticated;

alter policy "colleges readable by authenticated" on colleges to authenticated;

alter policy "reporters see own reports" on reports to authenticated;
alter policy "users file own reports"    on reports to authenticated;

alter policy "plans visible to host and members" on plans to authenticated;
alter policy "users create own plans"            on plans to authenticated;
alter policy "host updates own plan"             on plans to authenticated;

alter policy "rsvps visible per plan rules"          on plan_rsvps to authenticated;
alter policy "host invites accepted friends"         on plan_rsvps to authenticated;
alter policy "self rsvp on visible plan"             on plan_rsvps to authenticated;
alter policy "friend requests to join opted-in plan" on plan_rsvps to authenticated;
alter policy "users update own rsvp"                 on plan_rsvps to authenticated;
alter policy "host approves join request"            on plan_rsvps to authenticated;
alter policy "own row or host deletes rsvp"          on plan_rsvps to authenticated;


-- ============================================================================
-- PART 2 — SECURITY DEFINER hardening
--
-- 2a. search_path. pg_temp is searched FIRST when it is not listed, so a
--     caller's temp table can shadow public.<table> inside a definer's body.
--     This is the is_admin() fix from earlier today, applied to the other 18.
--     ALTER FUNCTION ... SET is used rather than CREATE OR REPLACE precisely
--     because it does NOT require restating the body — six of these functions
--     have no body recorded in any file in this repo (venue_activity,
--     record_venue_hour_samples, relation_columns, and the three admin_*
--     RPCs), and retyping a body from memory is how a function quietly
--     changes behavior.
--
-- 2b. EXECUTE. `revoke ... from public` does NOT remove anon's grant: Supabase
--     grants EXECUTE to anon EXPLICITLY, so revoking PUBLIC strips the
--     `=X/postgres` entry and leaves `anon=X/postgres` standing. Every comment
--     in this codebase claiming the PUBLIC revoke settled this is wrong — the
--     only two functions actually closed to anon (delete_own_account,
--     record_venue_hour_samples) are the two where someone revoked from anon
--     BY NAME. Both revokes are written out below, every time.
-- ============================================================================

-- ---------- 2a. pin search_path (18 functions) ----------
alter function public.admin_event_counts(timestamptz)        set search_path = public, pg_temp;
alter function public.admin_events_daily(timestamptz)        set search_path = public, pg_temp;
alter function public.admin_overview()                       set search_path = public, pg_temp;
alter function public.approve_join_request(uuid)             set search_path = public, pg_temp;
alter function public.can_request_join(uuid)                 set search_path = public, pg_temp;
alter function public.guard_profile_role()                   set search_path = public, pg_temp;
alter function public.is_plan_host(uuid)                     set search_path = public, pg_temp;
alter function public.is_plan_member(uuid)                   set search_path = public, pg_temp;
alter function public.plan_guest_list_open(uuid)             set search_path = public, pg_temp;
alter function public.plan_rsvp_counts(uuid)                 set search_path = public, pg_temp;
alter function public.plans_on_map()                         set search_path = public, pg_temp;
alter function public.post_has_collab_for_me(uuid)           set search_path = public, pg_temp;
alter function public.record_venue_hour_samples()            set search_path = public, pg_temp;
alter function public.reset_tags_on_widen()                  set search_path = public, pg_temp;
alter function public.set_my_rsvp(uuid, text)                set search_path = public, pg_temp;
alter function public.venue_activity()                       set search_path = public, pg_temp;

-- These two need their extra schema kept, or they break:
--   delete_own_account deletes from auth.users
--   relation_columns reads the system catalogs
alter function public.delete_own_account()   set search_path = public, auth, pg_temp;
alter function public.relation_columns(text) set search_path = public, pg_catalog, pg_temp;

-- ---------- 2b. take EXECUTE away from public AND anon ----------
-- Everything here is called only by a signed-in user, and each one already
-- refuses an anonymous caller through its own internal check — this closes the
-- door in front of that logic rather than relying on it.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_event_counts(timestamptz)',
    'public.admin_events_daily(timestamptz)',
    'public.admin_overview()',
    'public.approve_join_request(uuid)',
    'public.can_request_join(uuid)',
    'public.guard_profile_role()',
    'public.is_admin()',
    'public.is_plan_host(uuid)',
    'public.is_plan_member(uuid)',
    'public.plan_guest_list_open(uuid)',
    'public.plan_rsvp_counts(uuid)',
    'public.plans_on_map()',
    'public.post_has_collab_for_me(uuid)',
    'public.reset_tags_on_widen()',
    'public.set_my_rsvp(uuid, text)',
    'public.venue_delete_impact(uuid)'
  ]
  loop
    execute format('revoke execute on function %s from public', fn);
    execute format('revoke execute on function %s from anon',   fn);
  end loop;
end $$;

-- ---------- 2c. the two that MUST keep anon EXECUTE ----------
-- Verified in the client before writing this, not assumed:
--
--   venue_activity()      — src/hooks/useCheckIns.ts:38 `useVenueActivity` has
--                           NO `enabled` gate and throws on error, so the map
--                           for signed-out visitors depends on it. This is also
--                           its documented purpose: aggregates only, no
--                           identity columns.
--   relation_columns(text) — scripts/check-schema.mjs:35,187 calls it over REST
--                           with VITE_SUPABASE_PUBLISHABLE_KEY. Revoking anon
--                           breaks `npm run check:schema` on every push.
--
-- Only the redundant PUBLIC grant comes off. anon keeps EXECUTE, deliberately.
--
-- ⚠️ ACCEPTED RISK, NOT AN OVERSIGHT: relation_columns stays an anonymous
-- schema-enumeration oracle (any relation's column list). Closing it means
-- giving the drift guard its own credential. Logged as owed work, not fixed
-- here — a fix that breaks the guard that catches schema drift is a bad trade.
revoke execute on function public.venue_activity()       from public;
revoke execute on function public.relation_columns(text) from public;


-- ============================================================================
-- PART 3 — VERIFY. Fixtures roll back; the Part 1/2 changes above are already
-- committed and are NOT affected by this rollback.
--
-- Same harness rules as the review probe: role_at_op is captured AT the
-- impersonated operation and surfaces 'BAD HARNESS: ran as <role>', admin is
-- restored before every _res write including inside exception handlers, and the
-- results query is the LAST statement before rollback with nothing after it.
-- ============================================================================

begin;

create temp table _res(
  id serial, grp text, check_name text, expected text,
  actual text, role_at_op text, verdict text
);

do $$
declare
  v_user uuid; v_venue uuid; v_ci uuid; v_n int; v_role text;
begin
  select id into v_user  from profiles where ghost_mode = false limit 1;
  select id into v_venue from venues   where is_active limit 1;
  if v_user is null or v_venue is null then
    insert into _res(grp, check_name, expected, actual, verdict)
      values ('1','SETUP','a non-ghost profile + an active venue','missing','SETUP FAILED');
    return;
  end if;

  -- Harness sanity FIRST. Without this, a 0 below could just mean the anon
  -- impersonation is broken — which is exactly how the 2026-08-05 check
  -- reported this table as locked while it leaked.
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims',null,true);
  select count(*), current_setting('role') into v_n, v_role from venues;
  perform set_config('role','postgres',true);
  insert into _res(grp,check_name,expected,actual,role_at_op,verdict)
    values ('1','harness: anon still reads venues','> 0 (the map must not break)',
            v_n::text,
            case when v_role='anon' then v_role else 'BAD HARNESS: ran as '||v_role end,
            case when v_role<>'anon' then 'BAD HARNESS'
                 when v_n>0 then 'PASS — signed-out map intact'
                 else 'FAIL — PART 1 BROKE THE PUBLIC MAP' end);

  insert into check_ins (user_id, venue_id, visibility, expires_at)
    values (v_user, v_venue, 'everyone', now() + interval '2 hours')
    returning id into v_ci;
  insert into venue_saves (user_id, venue_id, visibility)
    values (v_user, v_venue, 'everyone')
    on conflict (user_id, venue_id) do update set visibility = 'everyone';

  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims',null,true);
  select count(*), current_setting('role') into v_n, v_role from check_ins where id = v_ci;
  perform set_config('role','postgres',true);
  insert into _res(grp,check_name,expected,actual,role_at_op,verdict)
    values ('1','anon SELECT check_ins (visibility=everyone)','0 — was 1 before this fix',
            v_n::text,
            case when v_role='anon' then v_role else 'BAD HARNESS: ran as '||v_role end,
            case when v_role<>'anon' then 'BAD HARNESS'
                 when v_n=0 then 'PASS — leak closed' else 'FAIL — STILL LEAKING' end);

  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims',null,true);
  select count(*), current_setting('role') into v_n, v_role
    from venue_saves where user_id = v_user and venue_id = v_venue;
  perform set_config('role','postgres',true);
  insert into _res(grp,check_name,expected,actual,role_at_op,verdict)
    values ('1','anon SELECT venue_saves (visibility=everyone)','0 — was 1 before this fix',
            v_n::text,
            case when v_role='anon' then v_role else 'BAD HARNESS: ran as '||v_role end,
            case when v_role<>'anon' then 'BAD HARNESS'
                 when v_n=0 then 'PASS — leak closed' else 'FAIL — STILL LEAKING' end);

  -- The owner must still see their own row, or the fix broke the feature
  -- instead of the leak.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub',v_user,'role','authenticated')::text, true);
  select count(*), current_setting('role') into v_n, v_role from check_ins where id = v_ci;
  perform set_config('role','postgres',true);
  insert into _res(grp,check_name,expected,actual,role_at_op,verdict)
    values ('1','owner still reads their own check-in','1',
            v_n::text,
            case when v_role='authenticated' then v_role else 'BAD HARNESS: ran as '||v_role end,
            case when v_role<>'authenticated' then 'BAD HARNESS'
                 when v_n=1 then 'PASS' else 'FAIL — fix broke the feature' end);
end $$;

-- Part 2 re-read, straight from the catalog.
insert into _res(grp, check_name, expected, actual, verdict)
select '2', 'search_path: ' || p.proname::text, 'includes pg_temp',
       coalesce(array_to_string(p.proconfig,' | '),'(none)'),
       case when array_to_string(p.proconfig,',') like '%pg_temp%' then 'PASS'
            else 'FAIL — still shadowable' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.prosecdef
   and array_to_string(p.proconfig,',') not like '%pg_temp%';

insert into _res(grp, check_name, expected, actual, verdict)
select '2', 'search_path summary', 'all SECURITY DEFINER fns pin pg_temp',
       count(*) filter (where array_to_string(p.proconfig,',') like '%pg_temp%')
         || ' of ' || count(*) || ' pinned',
       case when count(*) = count(*) filter (where array_to_string(p.proconfig,',') like '%pg_temp%')
            then 'PASS' else 'FAIL' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.prosecdef;

insert into _res(grp, check_name, expected, actual, verdict)
select '2', 'EXECUTE still open to anon: ' || p.proname::text,
       'only venue_activity + relation_columns, by design',
       array_to_string(p.proacl::text[],' | '),
       case when p.proname::text in ('venue_activity','relation_columns')
            then 'EXPECTED — anon needed (map / schema guard)'
            else 'FAIL — anon can still call this' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.prosecdef
   and array_to_string(p.proacl::text[],',') ~ '(^|,)(anon)?='
 order by p.proname;

select grp, check_name, expected, actual, role_at_op, verdict
  from _res order by grp, id;

rollback;
