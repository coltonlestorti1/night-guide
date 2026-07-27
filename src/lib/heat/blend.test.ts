import { describe, it, expect } from "vitest";
import { liveWeight, blendScore } from "./blend";
import { EMPTY_SIGNALS, LiveSignals } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

describe("liveWeight", () => {
  it("is zero with no signals", () => {
    expect(liveWeight(EMPTY_SIGNALS)).toBe(0);
  });

  it("never exceeds the 0.75 cap", () => {
    expect(liveWeight(sig({ count15: 100, count45: 100, count90: 100 }))).toBeLessThanOrEqual(0.75);
  });

  it("rises with signal volume", () => {
    const few = liveWeight(sig({ count15: 2, count45: 2, count90: 2 }));
    const many = liveWeight(sig({ count15: 8, count45: 8, count90: 8 }));
    expect(many).toBeGreaterThan(few);
  });
});

describe("blendScore", () => {
  it("returns the baseline unchanged with no signals", () => {
    expect(blendScore(40, EMPTY_SIGNALS).score).toBe(40);
  });

  it("moves toward the live reading when signals exist", () => {
    const { score } = blendScore(20, sig({ count15: 8, count45: 8, count90: 8, vibeTally: { packed: 4 } }));
    expect(score).toBeGreaterThan(20);
  });

  it("keeps a baseline floor: a dead venue cannot be driven to the top", () => {
    const { score, liveWeight: w } = blendScore(
      0,
      sig({ count15: 99, count45: 99, count90: 99, vibeTally: { line_outside: 99 } }),
    );
    expect(w).toBeLessThanOrEqual(0.75);
    expect(score).toBeLessThan(100);
  });

  it("stays within 0-100", () => {
    const { score } = blendScore(100, sig({ count15: 50, count45: 50, count90: 50, vibeTally: { line_outside: 9 } }));
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
