import { describe, it, expect } from "vitest";
import { lineRisk } from "./line";
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

const SAT_8PM = new Date(2026, 6, 25, 20, 0);
const SAT_1AM = new Date(2026, 6, 26, 1, 0);
const SAT_MIDNIGHT = new Date(2026, 6, 26, 0, 30);

describe("lineRisk", () => {
  it("is always zero for line_pattern none, at any heat", () => {
    for (const score of [0, 50, 90, 100]) {
      expect(lineRisk(base({ line_pattern: "none" }), score, EMPTY_SIGNALS, SAT_MIDNIGHT)).toBe(0);
    }
  });

  it("door_pick fires late at high heat", () => {
    expect(lineRisk(base({ line_pattern: "door_pick" }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT))
      .toBeGreaterThan(0);
  });

  it("door_pick stays quiet at low heat even when late", () => {
    expect(lineRisk(base({ line_pattern: "door_pick" }), 40, EMPTY_SIGNALS, SAT_MIDNIGHT)).toBe(0);
  });

  it("door_pick stays quiet early even at high heat", () => {
    expect(lineRisk(base({ line_pattern: "door_pick" }), 85, EMPTY_SIGNALS, SAT_8PM)).toBe(0);
  });

  it("capacity_wait fires EARLY, not late", () => {
    const b = base({ line_pattern: "capacity_wait" });
    const early = lineRisk(b, 70, EMPTY_SIGNALS, SAT_8PM);
    const late = lineRisk(b, 70, EMPTY_SIGNALS, SAT_1AM);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
  });

  it("a line_outside report forces high risk regardless of pattern", () => {
    const reported = sig({ vibeTally: { line_outside: 1 } });
    expect(lineRisk(base({ line_pattern: "capacity_wait" }), 10, reported, SAT_1AM))
      .toBeGreaterThanOrEqual(80);
  });

  it("but a line_outside report still cannot override pattern none", () => {
    const reported = sig({ vibeTally: { line_outside: 3 } });
    expect(lineRisk(base({ line_pattern: "none" }), 90, reported, SAT_MIDNIGHT)).toBe(0);
  });

  it("occasion produces nothing without a calendar", () => {
    expect(lineRisk(base({ line_pattern: "occasion" }), 90, EMPTY_SIGNALS, SAT_MIDNIGHT)).toBe(0);
  });

  it("small capacity raises door_pick risk", () => {
    const small = lineRisk(base({ line_pattern: "door_pick", capacity: 60 }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    const big = lineRisk(base({ line_pattern: "door_pick", capacity: 900 }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    expect(small).toBeGreaterThan(big);
  });

  it("missing capacity is neutral, never a penalty", () => {
    const none = lineRisk(base({ line_pattern: "door_pick" }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    const big = lineRisk(base({ line_pattern: "door_pick", capacity: 900 }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    expect(none).toBeGreaterThanOrEqual(big);
  });

  it("stays within 0-100", () => {
    const v = lineRisk(base({ line_pattern: "door_pick", capacity: 30 }), 100,
      sig({ vibeTally: { line_outside: 5 } }), SAT_MIDNIGHT);
    expect(v).toBeLessThanOrEqual(100);
  });
});
