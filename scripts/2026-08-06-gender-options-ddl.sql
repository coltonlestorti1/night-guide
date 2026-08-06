-- ============================================================================
-- 2026-08-06 — drop 'nonbinary' from the gender options (Colton's call)
--
-- profile_private.gender was created 2026-08-05 accepting
-- ('woman','man','nonbinary','prefer_not_to_say'). The app now offers only
-- three. The constraint MUST be tightened in step with src/lib/profilePrivate.ts
-- or a write of a removed value fails with 23514.
--
-- READ THIS BEFORE RUNNING: step 1 is destructive. Postgres validates existing
-- rows when a check constraint is added, so any row already storing 'nonbinary'
-- would block the new constraint. Step 1 clears those to NULL — the same state
-- as a user who skipped the optional question. That data is not recoverable.
-- The feature shipped 2026-08-06, so the count is expected to be 0; step 0
-- shows you the number before you destroy anything.
-- ============================================================================

-- ---------- 0. look first ----------
select count(*) as rows_that_will_be_cleared
  from profile_private
 where gender = 'nonbinary';

-- ---------- 1. clear removed values ----------
update profile_private set gender = null where gender = 'nonbinary';

-- ---------- 2. swap the constraint ----------
-- The original was an inline check, so Postgres named it profile_private_gender_check.
alter table profile_private drop constraint if exists profile_private_gender_check;

alter table profile_private add constraint profile_private_gender_check
  check (gender in ('woman','man','prefer_not_to_say'));

-- ---------- verification ----------
-- Expect the three-value list, and 0 rows left on the old value.
select pg_get_constraintdef(oid) as gender_constraint
  from pg_constraint
 where conname = 'profile_private_gender_check';

select count(*) filter (where gender = 'nonbinary') as should_be_zero,
       count(*) filter (where gender is null)       as unanswered,
       count(*)                                     as total_rows
  from profile_private;
