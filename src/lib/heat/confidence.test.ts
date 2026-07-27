import { describe, it, expect } from "vitest";
import { confidenceScore, mayStateExactTimes } from "./confidence";
import { EMPTY_SIGNALS, LiveSignals, VenueBaseline } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

const base = (o: Partial<VenueBaseline>): VenueBaseline => ({
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
  ...o,
});

describe("confidenceScore", () => {
  it("is low for an archetype default with no signals", () => {
    expect(confidenceScore(base({}), EMPTY_SIGNALS)).toBeLessThan(50);
  });

  it("does not permit exact times for an archetype default", () => {
    expect(mayStateExactTimes(confidenceScore(base({}), EMPTY_SIGNALS))).toBe(false);
  });

  it("is high for a first-hand venue with researched windows", () => {
    const b = base({
      confidence_base: "high",
      source_type: "first_hand",
      busy_start: 1260, busy_end: 1560, peak_start: 1380, peak_end: 1500,
    });
    expect(confidenceScore(b, EMPTY_SIGNALS)).toBeGreaterThanOrEqual(70);
  });

  it("rises with live signal volume even on an archetype default", () => {
    const quiet = confidenceScore(base({}), EMPTY_SIGNALS);
    const busy = confidenceScore(base({}), sig({
      count15: 6, count45: 6, count90: 6, vibeTally: { packed: 3 },
    }));
    expect(busy).toBeGreaterThan(quiet);
  });

  it("stays within 0-100", () => {
    const v = confidenceScore(
      base({ confidence_base: "high", source_type: "first_hand", busy_start: 1, busy_end: 2, peak_start: 1, peak_end: 2 }),
      sig({ count15: 99, count45: 99, count90: 99, vibeTally: { packed: 99 } }),
    );
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe("mayStateExactTimes", () => {
  it("permits exact times only at high confidence", () => {
    expect(mayStateExactTimes(90)).toBe(true);
    expect(mayStateExactTimes(40)).toBe(false);
  });
});
