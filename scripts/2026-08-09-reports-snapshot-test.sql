-- ============================================================================
-- PROOF — filing a report snapshots who it was about.
--
-- SAFE: everything runs inside ONE transaction that ROLLS BACK. The fixture
-- report row is never committed, so it cannot collide with the dedupe indexes
-- on a later run.
--
-- ⚠️ This script contains NO DDL. That matters: a script that mixes DDL with a
-- trailing `rollback` DISCARDS ITS OWN DDL while any proof running inside the
-- transaction still reports PASS — the trap that made three fixes look shipped
-- on 2026-08-09 when they were not. Everything here is test ROWS only.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS
--
-- reports.reported_user_id is now ON DELETE SET NULL, so when the reported
-- account is deleted the FK is nulled and the ONLY thing identifying who the
-- report was about is the reported_username / reported_display_name snapshot.
-- If the trigger fails to write it, the report survives deletion as an
-- unreadable record pointing at nobody — which is worse than the cascade it
-- replaced, because it looks like a moderation record and is not one.
--
-- "Trigger is attached" (proved by catalog read) is NOT the same claim as
-- "trigger writes the right value". This proves the second one, and also that
-- revoking EXECUTE from every role did not stop it firing.
-- ============================================================================

begin;

create temp table _res(
  id serial, n int, scenario text, expected text,
  actual text, role_at_op text, verdict text
) on commit drop;

grant insert, select on _res to authenticated;

do $$
declare
  v_reporter  uuid;
  v_reported  uuid;
  v_username  text;
  v_display   text;
  v_got_user  text;
  v_got_disp  text;
  v_role      text;
  v_admin     text := current_user;
  v_state     text;
  v_have_core boolean := false;
begin
  -- A clean pair: nobody who has already reported the other, or the unique
  -- dedupe index would reject the insert for the wrong reason.
  select p.id into v_reporter from profiles p order by p.id limit 1;

  select p.id, p.username, p.display_name
    into v_reported, v_username, v_display
    from profiles p
   where p.id <> v_reporter
     and not exists (
       select 1 from reports r
        where r.reporter_id = v_reporter
          and r.reported_user_id = p.id
          and r.context = 'profile')
   order by p.id limit 1;

  if v_reporter is null or v_reported is null then
    insert into _res (n, scenario, expected, actual, verdict)
    values (0, 'SETUP: need 2 distinct profiles with no existing report',
            '-', '-', 'SKIP');
  else
    v_have_core := true;
  end if;

  if v_have_core then
    -- ---- #1 File a report as the reporter. Expect it to land.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_reporter, 'role', 'authenticated')::text, true);
    select current_setting('role', true) into v_role;
    begin
      insert into reports (reporter_id, reported_user_id, reason, details)
      values (v_reporter, v_reported, 'harassment', 'snapshot probe');
      v_state := 'inserted';
    exception when others then
      v_state := SQLSTATE || ' ' || SQLERRM;
    end;
    perform set_config('role', v_admin, true);
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (1, 'reporter files a report (trigger has NO execute grant)',
      'inserted', v_state, v_role,
      case when v_role is distinct from 'authenticated'
             then 'BAD HARNESS: ran as ' || coalesce(v_role, 'null')
           when v_state = 'inserted' then 'PASS' else 'FAIL' end);

    -- ---- #2 The snapshot must match the reported user's CURRENT profile.
    -- Read as admin: this is a ground-truth check on what was stored, not an
    -- RLS assertion, so impersonating would only risk the reporter's SELECT
    -- policy hiding the row and making a write failure look like a snapshot
    -- failure.
    select r.reported_username, r.reported_display_name
      into v_got_user, v_got_disp
      from reports r
     where r.reporter_id = v_reporter
       and r.reported_user_id = v_reported
       and r.details = 'snapshot probe'
     order by r.created_at desc limit 1;

    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (2, 'reported_username snapshotted on insert',
      coalesce(v_username, '(null username)'), coalesce(v_got_user, '(NOT WRITTEN)'), null,
      case when v_got_user is not distinct from v_username then 'PASS' else 'FAIL' end);

    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (3, 'reported_display_name snapshotted on insert',
      coalesce(v_display, '(null display_name)'), coalesce(v_got_disp, '(NOT WRITTEN)'), null,
      case when v_got_disp is not distinct from v_display then 'PASS' else 'FAIL' end);

    -- ---- #4 THE POINT OF THE WHOLE CHANGE. Delete the reported profile and
    -- confirm the report SURVIVES with its FK nulled and its snapshot intact.
    -- Before this work both FKs were ON DELETE CASCADE, so the row vanished:
    -- harass, delete your account, and the record went with you.
    --
    -- Deleting a profile as admin inside a rolled-back transaction is how this
    -- gets proved without a throwaway signup. Nothing is committed.
    delete from profiles where id = v_reported;

    select count(*) into v_state
      from reports r
     where r.reporter_id = v_reporter and r.details = 'snapshot probe';
    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (4, 'report SURVIVES the reported account being deleted',
      '1', v_state, null,
      case when v_state = '1' then 'PASS' else 'FAIL' end);

    select r.reported_user_id::text, r.reported_username
      into v_got_disp, v_got_user
      from reports r
     where r.reporter_id = v_reporter and r.details = 'snapshot probe'
     order by r.created_at desc limit 1;

    insert into _res (n, scenario, expected, actual, role_at_op, verdict)
    values (5, 'FK nulled but the snapshot still names them',
      'null FK + ' || coalesce(v_username, '?'),
      coalesce(v_got_disp, 'null FK') || ' + ' || coalesce(v_got_user, '(LOST)'), null,
      case when v_got_disp is null and v_got_user is not distinct from v_username
             then 'PASS' else 'FAIL' end);
  end if;
end $$;

select n, verdict, actual, expected, role_at_op, scenario
  from _res order by n, id;

rollback;
