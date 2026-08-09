-- ============================================================================
-- 2026-08-09 — three minors from the full security review
--
-- All three are POLICY/FUNCTION changes; no client code changes with them.
-- Additive and idempotent. Safe to re-run.
--
--   1. You cannot block someone who blocked you first.
--   2. plan_guest_list_open() answers about ANY plan, for ANY caller.
--   3. A 'private' tag is visible to the person it names, which the design
--      says it must not be.
--
-- PART 4 PROVES ALL THREE by role-impersonation inside a rolled-back
-- transaction, so the last thing you see is a PASS/FAIL table.
-- ============================================================================


-- ============================================================================
-- 1. BLOCKING MUST NEVER BE REFUSABLE
--
-- "users create own friend requests" refuses EVERY insert when the target has
-- a 'blocked' row pointing at you:
--
--   and not exists (select 1 from friendships rev
--                    where rev.user_id = friendships.friend_id
--                      and rev.friend_id = friendships.user_id
--                      and rev.status = 'blocked')
--
-- That guard is right for a friend REQUEST — it stops someone spamming a
-- person who blocked them. It is wrong for a BLOCK. blockUser() deletes the
-- pair rows then inserts (me, them, 'blocked'); the delete matches nothing
-- (the block row belongs to them and the DELETE policy correctly refuses it),
-- and the insert is then rejected 42501. The user sees "couldn't block".
--
-- They are in fact still protected, because every policy tests the block edge
-- in BOTH directions. But the app tells them the opposite, and if the other
-- person later unblocks, the block they believed they had never existed.
--
-- Blocking someone is never a request and must never be refusable.
-- ============================================================================

drop policy if exists "users create own friend requests" on friendships;
create policy "users create own friend requests"
  on friendships for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      -- A block is always allowed, including against someone who blocked you.
      status = 'blocked'
      -- Anything else is a request, and a request is still refused by a block.
      or not exists (
        select 1 from friendships rev
        where rev.user_id = friendships.friend_id
          and rev.friend_id = friendships.user_id
          and rev.status = 'blocked'
      )
    )
  );


-- ============================================================================
-- 2. plan_guest_list_open() IS NOT CALLER-SCOPED
--
-- Every other plan helper answers a question about the CALLER
-- (is_plan_host / is_plan_member / can_request_join). This one answers a
-- question about the PLAN, for anybody who can name it, and it is SECURITY
-- DEFINER so RLS never applies. Any signed-in user holding a plan uuid learns
-- whether that plan hides its guest list.
--
-- Low severity on its own — plan ids are unguessable uuids and one boolean
-- leaks — but it is the only helper of the five that does not gate on the
-- caller, and gating costs nothing. The rsvps SELECT policy already calls it
-- ONLY alongside is_plan_member(), so the added check is redundant there and
-- changes no legitimate behavior.
-- ============================================================================

create or replace function public.plan_guest_list_open(pid uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from plans
    where id = pid
      and hide_guest_list = false
      -- Answer only for a plan the caller is actually on.
      and (public.is_plan_host(pid) or public.is_plan_member(pid))
  );
$$;

revoke execute on function public.plan_guest_list_open(uuid) from public;
revoke execute on function public.plan_guest_list_open(uuid) from anon;
grant  execute on function public.plan_guest_list_open(uuid) to authenticated;


-- ============================================================================
-- 3. A 'private' TAG IS VISIBLE TO THE PERSON IT NAMES
--
-- The design comment on this policy says a private tag "is a note to self" and
-- is "never shown to them". The policy's first branch says otherwise:
--
--   using ( auth.uid() = tagged_user_id  or ... )
--
-- — unconditional on state. So the tagged person can read a 'private' tag on a
-- 'nobody' post: they learn a hidden post names them, complete with post_id and
-- created_at. They cannot read the post itself, so no content leaks, and
-- listMyPendingTags filters to state='pending' so nothing renders it today.
-- The gap is that the database does not enforce what the design states, and the
-- next client that queries this table inherits the leak.
--
-- 'private' is reachable ONLY on a 'nobody' post (the INSERT policy forces it)
-- and the widen/narrow trigger moves rows in and out of it. The tagged person
-- keeps DELETE rights either way — that policy is separate and needs no SELECT.
-- ============================================================================

drop policy if exists "tags visible with their post" on night_post_tags;
create policy "tags visible with their post"
  on night_post_tags for select to authenticated
  using (
    -- The tagged person sees their own tag — unless it is 'private', which
    -- belongs to the author's hidden post and was never theirs to know about.
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
-- 4. PROOF — role-impersonation, rolled back. Nothing below persists.
--
-- Harness rules from scripts/2026-08-09-collab-tags-rls-test.sql: every
-- scenario re-establishes its own role immediately before its own operation,
-- admin is restored before every _res write including inside exception
-- handlers, and role_at_op surfaces 'BAD HARNESS: ran as <role>' so a
-- wrong-role run can never be mistaken for a policy verdict.
-- ============================================================================

begin;

create temp table _res(
  id serial, n int, scenario text, expected text, actual text,
  role_at_op text, verdict text
);

do $$
declare
  v_a uuid; v_b uuid; v_venue uuid; v_post uuid;
  v_role text; v_n int;
begin
  -- Two real profiles with NO existing friendship row in either direction, so
  -- a stray real row cannot make a scenario pass for the wrong reason.
  select p1.id, p2.id into v_a, v_b
    from profiles p1 cross join profiles p2
   where p1.id <> p2.id
     and not exists (select 1 from friendships f
                      where (f.user_id = p1.id and f.friend_id = p2.id)
                         or (f.user_id = p2.id and f.friend_id = p1.id))
   limit 1;
  select id into v_venue from venues where is_active limit 1;

  if v_a is null or v_b is null or v_venue is null then
    insert into _res(n, scenario, expected, actual, verdict)
      values (0, 'SETUP', 'two unrelated profiles + a venue', 'missing',
              'SETUP FAILED — everything below skipped');
    return;
  end if;

  -- ---- 1. B blocks A. Then A must still be able to block B. ----
  insert into friendships (user_id, friend_id, status) values (v_b, v_a, 'blocked');

  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    v_role := current_setting('role');
    insert into friendships (user_id, friend_id, status) values (v_a, v_b, 'blocked');
    perform set_config('role', 'postgres', true);
    insert into _res(n, scenario, expected, actual, role_at_op, verdict)
      values (1, 'A blocks B, who blocked A first', 'insert succeeds', 'inserted',
              case when v_role = 'authenticated' then v_role
                   else 'BAD HARNESS: ran as ' || v_role end,
              case when v_role <> 'authenticated' then 'BAD HARNESS' else 'PASS' end);
  exception when others then
    perform set_config('role', 'postgres', true);
    insert into _res(n, scenario, expected, actual, role_at_op, verdict)
      values (1, 'A blocks B, who blocked A first', 'insert succeeds',
              sqlstate || ' ' || sqlerrm, coalesce(v_role, '?'),
              'FAIL — blocking is still refusable');
  end;

  -- ---- 2. A friend REQUEST from A to B must STILL be refused. ----
  delete from friendships where user_id = v_a and friend_id = v_b;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    v_role := current_setting('role');
    insert into friendships (user_id, friend_id, status) values (v_a, v_b, 'pending');
    perform set_config('role', 'postgres', true);
    insert into _res(n, scenario, expected, actual, role_at_op, verdict)
      values (2, 'A friend-requests B, who blocked A', 'refused 42501',
              'INSERT SUCCEEDED', v_role,
              'FAIL — the block no longer stops requests');
  exception when others then
    perform set_config('role', 'postgres', true);
    insert into _res(n, scenario, expected, actual, role_at_op, verdict)
      values (2, 'A friend-requests B, who blocked A', 'refused 42501',
              sqlstate, coalesce(v_role, '?'),
              case when sqlstate = '42501' then 'PASS' else 'REVIEW' end);
  end;

  -- ---- 3. A 'private' tag must be invisible to the person it names. ----
  insert into night_posts (user_id, venue_id, night_date, visibility)
    values (v_a, v_venue, date '2000-01-01', 'nobody')
    returning id into v_post;
  insert into night_post_tags (post_id, tagged_user_id, state)
    values (v_post, v_b, 'private');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select count(*), current_setting('role') into v_n, v_role
    from night_post_tags where post_id = v_post;
  perform set_config('role', 'postgres', true);
  insert into _res(n, scenario, expected, actual, role_at_op, verdict)
    values (3, 'tagged person reads a private tag naming them', '0 rows',
            v_n::text,
            case when v_role = 'authenticated' then v_role
                 else 'BAD HARNESS: ran as ' || v_role end,
            case when v_role <> 'authenticated' then 'BAD HARNESS'
                 when v_n = 0 then 'PASS' else 'FAIL — still visible' end);

  -- ---- 4. An ACCEPTED tag must still be visible to the tagged person. ----
  update night_posts set visibility = 'friends' where id = v_post;
  update night_post_tags set state = 'tag' where post_id = v_post;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  select count(*), current_setting('role') into v_n, v_role
    from night_post_tags where post_id = v_post;
  perform set_config('role', 'postgres', true);
  insert into _res(n, scenario, expected, actual, role_at_op, verdict)
    values (4, 'tagged person reads their own ACCEPTED tag', '1 row',
            v_n::text,
            case when v_role = 'authenticated' then v_role
                 else 'BAD HARNESS: ran as ' || v_role end,
            case when v_role <> 'authenticated' then 'BAD HARNESS'
                 when v_n = 1 then 'PASS' else 'FAIL — the fix broke the feature' end);

  -- ---- 5. plan_guest_list_open must not answer for a plan you are not on. ----
  declare
    v_plan uuid;
    v_open boolean;
  begin
    insert into plans (creator_id, venue_id, planned_at, hide_guest_list, status)
      values (v_a, v_venue, now() + interval '3 hours', false, 'active')
      returning id into v_plan;

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    v_role := current_setting('role');
    select public.plan_guest_list_open(v_plan) into v_open;
    perform set_config('role', 'postgres', true);
    insert into _res(n, scenario, expected, actual, role_at_op, verdict)
      values (5, 'non-member calls plan_guest_list_open', 'false',
              coalesce(v_open::text, 'null'),
              case when v_role = 'authenticated' then v_role
                   else 'BAD HARNESS: ran as ' || v_role end,
              case when v_role <> 'authenticated' then 'BAD HARNESS'
                   when v_open is not true then 'PASS'
                   else 'FAIL — still answers for strangers' end);

    -- ---- 6. ...but the HOST must still get a true answer. ----
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
                       json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    v_role := current_setting('role');
    select public.plan_guest_list_open(v_plan) into v_open;
    perform set_config('role', 'postgres', true);
    insert into _res(n, scenario, expected, actual, role_at_op, verdict)
      values (6, 'host calls plan_guest_list_open on their own open plan', 'true',
              coalesce(v_open::text, 'null'),
              case when v_role = 'authenticated' then v_role
                   else 'BAD HARNESS: ran as ' || v_role end,
              case when v_role <> 'authenticated' then 'BAD HARNESS'
                   when v_open is true then 'PASS'
                   else 'FAIL — the fix broke the guest list' end);
  end;
end $$;

select n, scenario, expected, actual, role_at_op, verdict
  from _res order by n, id;

rollback;
