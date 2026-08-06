-- ============================================================================
-- 2026-08-06 — relation_columns(): introspection for the schema drift guard
-- Additive and idempotent. Safe to run more than once.
--
-- WHY
-- scripts/check-schema.mjs verifies that every column the client selects
-- actually exists. It could not check `active_check_ins` — the relation whose
-- drift killed the vibe buttons for a day — because anon has no SELECT grant on
-- it, so the probe came back 42501 (insufficient privilege) instead of a column
-- answer. A guard blind to the exact bug that motivated it is worthless.
--
-- WHAT
-- Returns the column names of one relation in the public schema. Nothing else:
-- no row data, no types, no policies. Column names are already discoverable
-- from PostgREST error messages, so this exposes nothing new.
--
-- SECURITY DEFINER is required — information_schema.columns is filtered by the
-- caller's privileges, which is precisely why the guard could not see the view.
-- search_path is pinned so the definer context cannot be hijacked.
-- ============================================================================

create or replace function public.relation_columns(rel text)
returns table (column_name text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select c.column_name::text
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = rel
   order by c.ordinal_position
$$;

revoke all on function public.relation_columns(text) from public;
grant execute on function public.relation_columns(text) to anon, authenticated;

-- ---------- verification ----------
-- Expect the full column list, including would_recommend, vibe_at and ended_at.
select string_agg(column_name, ', ' order by column_name) as active_check_ins_columns
  from public.relation_columns('active_check_ins');
