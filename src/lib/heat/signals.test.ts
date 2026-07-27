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
