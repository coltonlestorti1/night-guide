/**
 * plan-guest — the first tests for this function, added with the fix for the
 * self-approval bypass (2026-08-09 security review).
 *
 * WHY THIS HARNESS EXISTS AT ALL. plan-guest runs on Deno and holds the SERVICE
 * ROLE key, so RLS — the boundary every other write in this app leans on — does
 * not apply to a single line of it. That makes it the one place where an
 * authorization rule has to be written out in code, and the one place with no
 * test to say whether it still is. Its own header calls it "the most abusable
 * surface"; it shipped with zero coverage.
 *
 * HOW IT WORKS. The module calls Deno.serve(handler) at import time, so
 * stubbing Deno.serve captures the handler and lets us call it with a real
 * Request. `@supabase/supabase-js` is mocked with a small in-memory fake that
 * ACTUALLY EVALUATES the filters (eq / is / or) against rows, rather than
 * returning a canned answer per call site. That distinction is the point: a
 * fake that ignores the WHERE clause would pass just as happily with the guard
 * written wrong, which is the entire class of bug being fixed here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory stand-in for the two tables this function touches.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

const db: { plans: Row[]; plan_rsvps: Row[]; venues: Row[]; profiles: Row[] } = {
  plans: [],
  plan_rsvps: [],
  venues: [],
  profiles: [],
};

/** Records every write the handler attempted, so a test can assert that a
 *  refused request wrote NOTHING — not merely that it returned an error. */
let writeLog: { op: string; table: string; payload: unknown; matched: number }[] = [];

type Filter =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "is"; col: string; val: unknown }
  | { kind: "or"; expr: string };

/** Evaluates one PostgREST `or=(...)` expression against a row. Supports only
 *  the two forms this function uses: `col.is.null` and `col.in.(a,b,c)`. */
function matchesOr(row: Row, expr: string): boolean {
  return splitOrTerms(expr).some((term) => {
    const isNull = term.match(/^(\w+)\.is\.null$/);
    if (isNull) return row[isNull[1]] === null || row[isNull[1]] === undefined;
    const inList = term.match(/^(\w+)\.in\.\(([^)]*)\)$/);
    if (inList) return inList[2].split(",").includes(String(row[inList[1]]));
    // Unsupported syntax must be loud, never silently "no match" — a filter
    // the fake quietly ignores is a filter the test stops checking.
    throw new Error(`fake supabase: unsupported or() term "${term}"`);
  });
}

/** Splits on commas that are NOT inside parentheses — `rsvp.in.(a,b)` is one
 *  term, not three. Getting this wrong would silently widen the filter. */
function splitOrTerms(expr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((r) =>
    filters.every((f) => {
      if (f.kind === "eq") return r[f.col] === f.val;
      if (f.kind === "is") return f.val === null ? r[f.col] == null : r[f.col] === f.val;
      return matchesOr(r, f.expr);
    }),
  );
}

class Builder {
  private filters: Filter[] = [];
  private op: "select" | "update" | "insert" | "upsert" = "select";
  private payload: Row | Row[] = {};

  constructor(private table: keyof typeof db) {}

  select() { return this; }
  order() { return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  insert(p: Row | Row[]) { this.op = "insert"; this.payload = p; return this; }
  upsert(p: Row | Row[]) { this.op = "upsert"; this.payload = p; return this; }
  eq(col: string, val: unknown) { this.filters.push({ kind: "eq", col, val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ kind: "is", col, val }); return this; }
  or(expr: string) { this.filters.push({ kind: "or", expr }); return this; }

  private run(): { data: Row[] | null; error: { code?: string } | null } {
    const rows = db[this.table];
    if (this.op === "select") return { data: applyFilters(rows, this.filters), error: null };

    if (this.op === "update") {
      const hit = applyFilters(rows, this.filters);
      for (const r of hit) Object.assign(r, this.payload);
      writeLog.push({ op: "update", table: this.table, payload: this.payload, matched: hit.length });
      return { data: hit, error: null };
    }

    // insert / upsert — enforce unique (plan_id, user_id) the way Postgres does.
    const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload])[0];
    const clash = rows.find(
      (r) =>
        incoming.plan_id !== undefined &&
        incoming.user_id != null &&
        r.plan_id === incoming.plan_id &&
        r.user_id === incoming.user_id,
    );
    if (clash) {
      if (this.op === "insert") {
        writeLog.push({ op: "insert-rejected", table: this.table, payload: incoming, matched: 0 });
        return { data: null, error: { code: "23505" } };
      }
      Object.assign(clash, incoming); // upsert = ON CONFLICT DO UPDATE
      writeLog.push({ op: "upsert-overwrote", table: this.table, payload: incoming, matched: 1 });
      return { data: [clash], error: null };
    }
    const created = { id: `row-${rows.length + 1}`, ...incoming };
    rows.push(created);
    writeLog.push({ op: this.op, table: this.table, payload: incoming, matched: 1 });
    return { data: [created], error: null };
  }

  maybeSingle() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error });
  }
  single() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error });
  }
  then(res: (v: { data: Row[] | null; error: unknown; count?: number }) => unknown) {
    const { data, error } = this.run();
    return Promise.resolve(res({ data, error, count: data?.length ?? 0 }));
  }
}

let currentUserId: string | null = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (t: keyof typeof db) => new Builder(t),
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: currentUserId ? { id: currentUserId } : null } }),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Capture the handler Deno.serve would have registered.
// ---------------------------------------------------------------------------
let handler: (req: Request) => Promise<Response>;

(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: (k: string) => (k === "SUPABASE_URL" ? "http://localhost" : "service-role-key") },
  serve: (h: (req: Request) => Promise<Response>) => {
    handler = h;
  },
};

const TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ATTACKER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const post = (body: unknown, signedIn: string | null) => {
  currentUserId = signedIn;
  return handler(
    new Request("http://x/plan-guest", {
      method: "POST",
      headers: signedIn
        ? { "content-type": "application/json", authorization: "Bearer fake-jwt" }
        : { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
};

beforeEach(async () => {
  await import("./index.ts");
  db.plans = [
    {
      id: PLAN_ID,
      creator_id: "host-1",
      venue_id: "venue-1",
      // Comfortably in the future so isPast() is false.
      planned_at: new Date(Date.now() + 3_600_000).toISOString(),
      note: null,
      hide_guest_list: false,
      status: "active",
      share_token: TOKEN,
    },
  ];
  db.plan_rsvps = [];
  db.venues = [{ id: "venue-1", name: "The Grafton", lat: 40.7, lng: -73.9 }];
  db.profiles = [{ id: "host-1", username: "host", display_name: "Host", avatar_url: null }];
  writeLog = [];
  currentUserId = null;
});

describe("plan-guest POST — self-approval bypass", () => {
  it("REFUSES to promote a pending 'requested' row, and writes nothing", async () => {
    // The attacker asked to join an opted-in map plan. rsvp='requested' means
    // the host has not approved yet, and is_plan_member() excludes them.
    db.plan_rsvps.push({
      id: "rsvp-1",
      plan_id: PLAN_ID,
      user_id: ATTACKER,
      rsvp: "requested",
      guest_name: null,
      guest_secret: null,
    });

    const res = await post({ token: TOKEN, rsvp: "going" }, ATTACKER);

    expect(res.status).toBe(409);
    // The row must be untouched — a 409 that still wrote would be worse than
    // no guard at all, because it would look refused.
    expect(db.plan_rsvps[0].rsvp).toBe("requested");
    expect(writeLog.filter((w) => w.matched > 0)).toHaveLength(0);
  });

  it("still lets an INVITED member (rsvp null) respond", async () => {
    db.plan_rsvps.push({
      id: "rsvp-1",
      plan_id: PLAN_ID,
      user_id: ATTACKER,
      rsvp: null,
      guest_name: null,
      guest_secret: null,
    });

    const res = await post({ token: TOKEN, rsvp: "going" }, ATTACKER);

    expect(res.status).toBe(201);
    expect(db.plan_rsvps[0].rsvp).toBe("going");
  });

  it("still lets an existing responder CHANGE their answer", async () => {
    db.plan_rsvps.push({
      id: "rsvp-1",
      plan_id: PLAN_ID,
      user_id: ATTACKER,
      rsvp: "maybe",
      guest_name: null,
      guest_secret: null,
    });

    const res = await post({ token: TOKEN, rsvp: "no" }, ATTACKER);

    expect(res.status).toBe(201);
    expect(db.plan_rsvps[0].rsvp).toBe("no");
  });

  it("still lets a brand-new signed-in user RSVP via the link", async () => {
    // Holding the link IS the invitation — this is the deliberate difference
    // from set_my_rsvp(), which refuses to insert for a non-member. Do not
    // "fix" this into a membership check.
    const res = await post({ token: TOKEN, rsvp: "going" }, ATTACKER);

    expect(res.status).toBe(201);
    expect(db.plan_rsvps).toHaveLength(1);
    expect(db.plan_rsvps[0].rsvp).toBe("going");
  });

  it("leaves the guest (signed-out) path alone", async () => {
    const res = await post({ token: TOKEN, rsvp: "going", guest_name: "Sam" }, null);

    expect(res.status).toBe(201);
    expect(db.plan_rsvps[0].guest_name).toBe("Sam");
    expect(db.plan_rsvps[0].user_id).toBeUndefined();
  });
});
