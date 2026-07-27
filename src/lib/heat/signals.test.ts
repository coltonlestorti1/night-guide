import { describe, it, expect } from "vitest";
import { signalsFromActivity } from "./signals";
import { effectiveCheckIns } from "./live";

describe("signalsFromActivity", () => {
  it("returns empty signals for a venue with no activity", () => {
    const s = signalsFromActivity(undefined, 0);
    expect(s.count15).toBe(0);
    expect(s.count45).toBe(0);
    expect(s.count90).toBe(0);
    expect(s.vibeTally).toEqual({});
  });

  it("treats active check-ins as mid-age, never as fresh", () => {
    // The current RPC only knows "active" (within the 3h expiry), so claiming
    // these are 15 minutes old would overstate the evidence.
    const s = signalsFromActivity({ count: 4, vibe: null }, 0);
    expect(s.count15).toBe(0);
    expect(s.count45).toBe(4);
    expect(s.count90).toBe(4);
    expect(effectiveCheckIns(s)).toBeLessThan(4);
    expect(effectiveCheckIns(s)).toBeGreaterThan(0);
  });

  it("carries the friend count through", () => {
    expect(signalsFromActivity({ count: 3, vibe: null }, 2).friendCount).toBe(2);
  });

  it("maps a known vibe into the tally", () => {
    expect(signalsFromActivity({ count: 2, vibe: "packed" }, 0).vibeTally).toEqual({ packed: 1 });
  });

  it("ignores an unknown vibe rather than guessing", () => {
    expect(signalsFromActivity({ count: 2, vibe: "nonsense" }, 0).vibeTally).toEqual({});
  });

  it("accepts the two vibes that only exist after the slice 4 migration", () => {
    expect(signalsFromActivity({ count: 1, vibe: "dead" }, 0).vibeTally).toEqual({ dead: 1 });
    expect(signalsFromActivity({ count: 1, vibe: "line_outside" }, 0).vibeTally)
      .toEqual({ line_outside: 1 });
  });

  it("never reports more friends than check-ins", () => {
    expect(signalsFromActivity({ count: 1, vibe: null }, 5).friendCount).toBe(1);
  });
});

describe("signalsFromActivity with real buckets", () => {
  it("uses the buckets when the DDL has been applied", () => {
    const s = signalsFromActivity(
      { count: 9, vibe: "packed", count15: 2, count45: 5, count90: 9 }, 0,
    );
    expect(s.count15).toBe(2);
    expect(s.count45).toBe(5);
    expect(s.count90).toBe(9);
  });

  it("uses the real vibe tally when present", () => {
    const s = signalsFromActivity(
      { count: 4, vibe: "packed", vibeTally: { packed: 3, chill: 1 } }, 0,
    );
    expect(s.vibeTally).toEqual({ packed: 3, chill: 1 });
  });

  it("still degrades to mid-age on the pre-DDL schema", () => {
    const s = signalsFromActivity({ count: 4, vibe: null }, 0);
    expect(s.count15).toBe(0);
    expect(s.count45).toBe(4);
    expect(s.count90).toBe(4);
  });

  it("carries the recommend tally through", () => {
    const s = signalsFromActivity(
      { count: 3, vibe: null, recommendTally: { yes: 2, no: 1 } }, 0,
    );
    expect(s.recommendTally).toEqual({ yes: 2, no: 1 });
  });

  it("weights fresh buckets above stale ones", () => {
    const fresh = signalsFromActivity({ count: 6, vibe: null, count15: 6, count45: 6, count90: 6 }, 0);
    const stale = signalsFromActivity({ count: 6, vibe: null, count15: 0, count45: 0, count90: 6 }, 0);
    expect(effectiveCheckIns(fresh)).toBeGreaterThan(effectiveCheckIns(stale));
  });
});
