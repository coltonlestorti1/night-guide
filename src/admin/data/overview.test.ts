import { describe, it, expect } from "vitest";
import { fillDailyGaps, isMissingFunction, type DailyCount } from "./overview";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("isMissingFunction", () => {
  // PGRST202 is what actually comes back — verified against the live project
  // on 2026-07-28. Checking only Postgres' 42883 silently missed it and showed
  // the raw PostgREST message instead of the setup hint.
  it("treats PostgREST's schema-cache miss as a missing function", () => {
    expect(isMissingFunction("PGRST202")).toBe(true);
  });

  it("also treats Postgres undefined_function as missing", () => {
    expect(isMissingFunction("42883")).toBe(true);
  });

  it("does not swallow unrelated errors", () => {
    expect(isMissingFunction("42501")).toBe(false); // insufficient_privilege
    expect(isMissingFunction(undefined)).toBe(false);
  });
});

describe("fillDailyGaps", () => {
  it("emits one point per day inclusive of both ends", () => {
    const out = fillDailyGaps([], d("2026-07-25"), d("2026-07-28"));
    expect(out.map((r) => r.day)).toEqual([
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
      "2026-07-28",
    ]);
  });

  it("fills days with no rows as real zeros, not gaps", () => {
    const rows: DailyCount[] = [{ day: "2026-07-26", total: 3 }];
    const out = fillDailyGaps(rows, d("2026-07-25"), d("2026-07-27"));
    expect(out).toEqual([
      { day: "2026-07-25", total: 0 },
      { day: "2026-07-26", total: 3 },
      { day: "2026-07-27", total: 0 },
    ]);
  });

  it("accepts a full timestamp from the RPC's date cast", () => {
    const rows = [{ day: "2026-07-26T00:00:00+00:00", total: 5 }] as DailyCount[];
    const out = fillDailyGaps(rows, d("2026-07-26"), d("2026-07-26"));
    expect(out).toEqual([{ day: "2026-07-26", total: 5 }]);
  });

  it("coerces string counts, which is how Postgres bigint arrives", () => {
    const rows = [{ day: "2026-07-26", total: "7" }] as unknown as DailyCount[];
    const out = fillDailyGaps(rows, d("2026-07-26"), d("2026-07-26"));
    expect(out[0].total).toBe(7);
  });

  it("ignores rows outside the window rather than widening it", () => {
    const rows: DailyCount[] = [
      { day: "2026-07-01", total: 99 },
      { day: "2026-07-26", total: 1 },
    ];
    const out = fillDailyGaps(rows, d("2026-07-26"), d("2026-07-26"));
    expect(out).toEqual([{ day: "2026-07-26", total: 1 }]);
  });

  it("returns a single point when the window is one day", () => {
    expect(fillDailyGaps([], d("2026-07-28"), d("2026-07-28"))).toHaveLength(1);
  });
});
