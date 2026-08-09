-- ============================================================================
-- 2026-08-09 — FIX SAVED SPOTS + RE-APPLY everything my earlier scripts lost
--
-- ⚠️ WHY THIS EXISTS. My earlier DDL scripts ended with `begin; ... rollback;`
-- for their proof section. The Supabase editor runs a whole script in ONE
-- transaction, so that `begin` was a no-op and the trailing `rollback`
-- DISCARDED THE DDL AT THE TOP OF THE SAME SCRIPT. The proof queries ran
-- inside that transaction, saw the changes, and reported PASS on work that was
-- thrown away seconds later. Caught because venue_saves' policies still read
-- roles={public}.
--
-- ⚠️ THEREFORE: THIS SCRIPT CONTAINS NO begin/commit/rollback. Do not add one.
-- Behavioural proof (which needs fixture rows) goes in a SEPARATE paste that
-- contains NO DDL — that is the only safe way to combine the two.
--
-- Everything is idempotent, so re-running is safe whether or not a given
-- statement survived the first time.
-- ============================================================================


-- ============================================================================
-- PART A — THE LIVE BUG: saving a venue has never worked
--
-- venue_saves is EMPTY for every user since saves went server-side 2026-08-05.
-- Tapping the bookmark 500s with
--   42P17 infinite recursion detected in policy for relation "venue_saves"
--
-- CAUSE, proved by probe (plain INSERT succeeds; UPDATE and UPSERT both
-- 42P17): the UPDATE policy's WITH CHECK reads venue_saves from inside a
-- venue_saves policy:
--     and exists (select 1 from venue_saves prev where prev.id = venue_saves.id ...)
-- That snapshot pattern was the only way to freeze user_id/venue_id, since RLS
-- has no OLD reference. It recurses, so it has to go.
--
-- What is lost, and why that is acceptable: `auth.uid() = user_id` in the WITH
-- CHECK still prevents reassigning a save to somebody else. The only thing no
-- longer frozen is venue_id on your OWN row, and repointing your own save is
-- indistinguishable from deleting it and saving the other venue. No privilege
-- is gained.
--
-- NOTE: this also breaks setSaveVisibility ("make my saves private"), not just
-- the bookmark button — scenario 3 of the probe returned 42P17 for a plain
-- UPDATE. Both are fixed by this one statement.
-- ============================================================================

drop policy if exists "users update own saves" on venue_saves;
create policy "users update own saves"
  on venue_saves for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================================
-- PART B — RE-APPLY: the anon 'everyone' leak (originally 2026-08-09 #1)
--
-- Proved live earlier today: an anonymous caller holding only the publishable
-- key read a live check-in and a venue save. Both SELECT policies were created
-- with no `to` clause, so they applied to PUBLIC — and each has a
-- `visibility = 'everyone'` branch that never dereferences auth.uid().
--
-- ⚠️ `venues readable by everyone` stays on {public}: the map renders for
-- signed-out visitors and depends on it.
-- ============================================================================

alter policy "checkins visible per rules" on check_ins   to authenticated;
alter policy "saves visible per rules"    on venue_saves to authenticated;

alter policy "users create own checkins" on check_ins to authenticated;
alter policy "users delete own checkins" on check_ins to authenticated;
alter policy "users update own checkins" on check_ins to authenticated;

alter policy "users create own saves" on venue_saves to authenticated;
alter policy "users delete own saves" on venue_saves to authenticated;
-- ("users update own saves" was recreated with `to authenticated` in Part A.)

alter policy "users see own friendships"          on friendships to authenticated;
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
-- PART C — RE-APPLY: SECURITY DEFINER hardening
--
-- pg_temp is searched FIRST when not listed, so a caller's temp table can
-- shadow public.<table> inside a definer body. ALTER FUNCTION ... SET is used
-- rather than CREATE OR REPLACE because six of these have no body recorded
-- anywhere in the repo.
--
-- ⚠️ `revoke ... from public` does NOT remove anon's grant — Supabase grants
-- EXECUTE to anon explicitly. Both revokes, every time.
-- ⚠️ venue_activity and relation_columns KEEP anon EXECUTE deliberately: the
-- signed-out map and scripts/check-schema.mjs depend on them.
-- ============================================================================

alter function public.admin_event_counts(timestamptz)  set search_path = public, pg_temp;
alter function public.admin_events_daily(timestamptz)  set search_path = public, pg_temp;
alter function public.admin_overview()                 set search_path = public, pg_temp;
alter function public.approve_join_request(uuid)       set search_path = public, pg_temp;
alter function public.can_request_join(uuid)           set search_path = public, pg_temp;
alter function public.guard_profile_role()             set search_path = public, pg_temp;
alter function public.is_plan_host(uuid)               set search_path = public, pg_temp;
alter function public.is_plan_member(uuid)             set search_path = public, pg_temp;
alter function public.plan_rsvp_counts(uuid)           set search_path = public, pg_temp;
alter function public.plans_on_map()                   set search_path = public, pg_temp;
alter function public.post_has_collab_for_me(uuid)     set search_path = public, pg_temp;
alter function public.record_venue_hour_samples()      set search_path = public, pg_temp;
alter function public.reset_tags_on_widen()            set search_path = public, pg_temp;
alter function public.set_my_rsvp(uuid, text)          set search_path = public, pg_temp;
alter function public.venue_activity()                 set search_path = public, pg_temp;
alter function public.delete_own_account()   set search_path = public, auth, pg_temp;
alter function public.relation_columns(text) set search_path = public, pg_catalog, pg_temp;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.admin_event_counts(timestamptz)', 'public.admin_events_daily(timestamptz)',
    'public.admin_overview()', 'public.approve_join_request(uuid)',
    'public.can_request_join(uuid)', 'public.guard_profile_role()',
    'public.is_admin()', 'public.is_plan_host(uuid)', 'public.is_plan_member(uuid)',
    'public.plan_guest_list_open(uuid)', 'public.plan_rsvp_counts(uuid)',
    'public.plans_on_map()', 'public.post_has_collab_for_me(uuid)',
    'public.reset_tags_on_widen()', 'public.set_my_rsvp(uuid, text)',
    'public.venue_delete_impact(uuid)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('revoke execute on function %s from anon',   fn);
  end loop;
end $$;

revoke execute on function public.venue_activity()       from public;
revoke execute on function public.relation_columns(text) from public;


-- ============================================================================
-- PART D — RE-APPLY: the three review minors
-- ============================================================================

-- D1. Blocking must never be refusable. The old policy refused EVERY insert
-- while a reverse 'blocked' row existed, counter-blocks included, so you could
-- not block someone who blocked you first — and were told "couldn't block"
-- while actually being protected by their block.
drop policy if exists "users create own friend requests" on friendships;
create policy "users create own friend requests"
  on friendships for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      status = 'blocked'
      or not exists (
        select 1 from friendships rev
        where rev.user_id = friendships.friend_id
          and rev.friend_id = friendships.user_id
          and rev.status = 'blocked'
      )
    )
  );

-- D2. plan_guest_list_open answered about ANY plan for ANY caller — the only
-- one of the five plan helpers not scoped to the caller, and SECURITY DEFINER.
create or replace function public.plan_guest_list_open(pid uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from plans
    where id = pid
      and hide_guest_list = false
      and (public.is_plan_host(pid) or public.is_plan_member(pid))
  );
$$;
revoke execute on function public.plan_guest_list_open(uuid) from public;
revoke execute on function public.plan_guest_list_open(uuid) from anon;
grant  execute on function public.plan_guest_list_open(uuid) to authenticated;

-- D3. A 'private' tag was visible to the person it names, contradicting the
-- design comment directly above the policy.
drop policy if exists "tags visible with their post" on night_post_tags;
create policy "tags visible with their post"
  on night_post_tags for select to authenticated
  using (
    (auth.uid() = tagged_user_id and state <> 'private')
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


-- ============================================================================
-- PART E — VERIFY. Catalog reads only: no fixtures, no transaction, so there
-- is nothing here that a rollback could undo. Behavioural proof is a separate
-- paste. This is the LAST statement, so it is what the editor displays.
-- ============================================================================
select * from (
  select 1 as ord, 'SAVES UPDATE POLICY' as item,
         case when exists (
           select 1 from pg_policies
            where tablename='venue_saves' and cmd='UPDATE'
              and with_check like '%venue_saves prev%')
         then 'FAIL — self-select still there, still recurses'
         else 'PASS — recursion removed' end as verdict
  union all
  select 2, 'POLICIES STILL ON {public}',
         coalesce((select string_agg(tablename||'/'||policyname, ', ')
                     from pg_policies
                    where schemaname='public' and roles::text[] @> array['public']
                      and tablename <> 'venues'), 'none — PASS')
  union all
  select 3, 'venues stays public (must)',
         case when exists (select 1 from pg_policies
                            where tablename='venues' and cmd='SELECT'
                              and roles::text[] @> array['public'])
         then 'PASS — signed-out map intact' else 'FAIL — map will break' end
  union all
  select 4, 'DEFINER search_path',
         (select count(*) filter (where array_to_string(proconfig,',') like '%pg_temp%')
                 || ' of ' || count(*) || ' pin pg_temp'
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.prosecdef)
  union all
  select 5, 'EXECUTE still open to anon',
         coalesce((select string_agg(p.proname::text, ', ')
                     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                    where n.nspname='public' and p.prosecdef
                      and array_to_string(p.proacl::text[],',') ~ '(^|,)(anon)?='),
                  'none')
         || '  (expected: relation_columns, venue_activity)'
  union all
  select 6, 'BLOCK FIX',
         case when exists (select 1 from pg_policies
                            where tablename='friendships'
                              and policyname='users create own friend requests'
                              and with_check like '%status = ''blocked''%')
         then 'PASS' else 'FAIL' end
  union all
  select 7, 'PRIVATE TAG FIX',
         case when exists (select 1 from pg_policies
                            where tablename='night_post_tags' and cmd='SELECT'
                              and qual like '%private%')
         then 'PASS' else 'FAIL' end
  union all
  select 8, 'GUEST LIST HELPER',
         case when (select pg_get_functiondef(p.oid) from pg_proc p
                     join pg_namespace n on n.oid=p.pronamespace
                    where n.nspname='public' and p.proname='plan_guest_list_open')
                   like '%is_plan_member%'
         then 'PASS — caller-scoped' else 'FAIL' end
) x order by ord;
