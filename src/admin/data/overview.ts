/**
 * Dashboard data. Every number here traces to a real query — there are no
 * derived vanity metrics and no placeholder series.
 *
 * All three reads go through the admin RPCs in
 * scripts/2026-07-28-admin-ddl.sql. The `events` table was created INSERT-only
 * (deliberately, like `waitlist`), so before that DDL is pasted there is
 * literally no way for a client to read it. A missing function comes back as
 * Postgres 42883 and is reported as "setup incomplete" rather than as a crash.
 */
import { getSupabase } from "@/lib/supabase";

/**
 * Two codes, both meaning "the RPC isn't there":
 *   PGRST202 — PostgREST can't find it in its schema cache. This is the one
 *              that actually fires (verified against the live project
 *              2026-07-28); supabase-js never gets far enough to see a
 *              Postgres error.
 *   42883    — Postgres' own undefined_function, kept as a backstop for the
 *              case where the function exists but a signature doesn't match.
 */
export const UNDEFINED_FUNCTION = "42883";
export const PGRST_NO_FUNCTION = "PGRST202";

export class SetupIncompleteError extends Error {
  constructor() {
    super(
      "Admin RPCs aren't installed yet. Paste scripts/2026-07-28-admin-ddl.sql in the Supabase SQL editor.",
    );
    this.name = "SetupIncompleteError";
  }
}

export type AdminOverview = {
  venues_total: number;
  venues_active: number;
  profiles_total: number;
  check_ins_total: number;
  check_ins_active: number;
  plans_total: number;
  waitlist_total: number;
  events_total: number;
  events_last_7d: number;
  first_event_at: string | null;
  last_event_at: string | null;
};

export type EventCount = { event_name: string; total: number };
export type DailyCount = { day: string; total: number };

export function isMissingFunction(code: string | undefined): boolean {
  return code === PGRST_NO_FUNCTION || code === UNDEFINED_FUNCTION;
}

function rethrow(error: { code?: string; message: string }): never {
  if (isMissingFunction(error.code)) throw new SetupIncompleteError();
  throw new Error(error.message);
}

export async function fetchOverview(): Promise<AdminOverview> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) rethrow(error);
  // The RPC returns a single-row table, so supabase-js hands back an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new SetupIncompleteError();
  return row as AdminOverview;
}

export async function fetchEventCounts(since: Date): Promise<EventCount[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("admin_event_counts", {
    p_since: since.toISOString(),
  });
  if (error) rethrow(error);
  return (data ?? []) as EventCount[];
}

export async function fetchEventsDaily(since: Date): Promise<DailyCount[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("admin_events_daily", {
    p_since: since.toISOString(),
  });
  if (error) rethrow(error);
  return (data ?? []) as DailyCount[];
}

/**
 * Fills gaps so a 14-day chart always has 14 points. Days with no events are
 * real zeros, not missing data — without this a two-event week renders as a
 * misleading straight line between the two days that happened to have rows.
 */
export function fillDailyGaps(
  rows: DailyCount[],
  since: Date,
  until: Date = new Date(),
): DailyCount[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), Number(r.total)]));
  const out: DailyCount[] = [];
  const cursor = new Date(
    Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()),
  );
  const end = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  while (cursor.getTime() <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ day: key, total: byDay.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
