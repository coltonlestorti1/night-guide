/**
 * Golden cases: every one of these encodes real sourced evidence from
 * docs/research/2026-07-26-signals-merged.md. They are the tests that catch a
 * model which gets line behaviour backwards.
 */
import { describe, it, expect } from "vitest";
import { computeHeat } from "./index";
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

/** No hours data means "unknown", which computeHeat treats as open. */
const OPEN_ALWAYS = undefined;

describe("golden: Death & Co queues early and eases late", () => {
  const deathAndCo = base({
    archetype: "cocktail_room",
    line_pattern: "capacity_wait",
    capacity: 50,
    confidence_base: "medium",
    source_type: "research_estimate",
  });

  it("has line risk at 8 PM Friday", () => {
    const r = computeHeat({
      baseline: deathAndCo, events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 24, 20, 0), hours: OPEN_ALWAYS,
    });
    expect(r.lineRisk).toBeGreaterThan(0);
  });

  it("has less line risk at 1 AM than at 8 PM", () => {
    const early = computeHeat({
      baseline: deathAndCo, events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 24, 20, 0), hours: OPEN_ALWAYS,
    });
    const late = computeHeat({
      baseline: deathAndCo, events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 25, 1, 0), hours: OPEN_ALWAYS,
    });
    expect(late.lineRisk).toBeLessThan(early.lineRisk);
  });
});

describe("golden: Amor y Amargo never claims a line", () => {
  const amor = base({ archetype: "cocktail_room", line_pattern: "none" });

  it("has no line risk even at peak with reports", () => {
    const r = computeHeat({
      baseline: amor, events: [],
      signals: sig({ count15: 9, count45: 9, count90: 9, vibeTally: { packed: 5 } }),
      now: new Date(2026, 6, 25, 23, 0), hours: OPEN_ALWAYS,
    });
    expect(r.lineRisk).toBe(0);
    expect(r.lineLikely).toBe(false);
  });
});

describe("golden: Nowhere is busy on a Monday because of programming", () => {
  it("reaches Busy or better at 10 PM Monday", () => {
    const r = computeHeat({
      baseline: base({ archetype: "dive", line_pattern: "none" }),
      events: [{ venue: "Nowhere", day: 1, name: "Macho Monday", start_min: 22 * 60, source_url: "https://example.com" }],
      signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 27, 22, 0), hours: OPEN_ALWAYS,
    });
    expect(r.score).toBeGreaterThanOrEqual(55);
  });

  it("is quiet on the same Monday without the event", () => {
    const r = computeHeat({
      baseline: base({ archetype: "dive", line_pattern: "none" }),
      events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 27, 22, 0), hours: OPEN_ALWAYS,
    });
    expect(r.score).toBeLessThan(55);
  });
});

describe("golden: a closed venue always scores zero", () => {
  it("scores 0 and reads Closed outside opening hours", () => {
    const r = computeHeat({
      baseline: base({ archetype: "party_bar", line_pattern: "door_pick" }),
      events: [], signals: sig({ count15: 9, count45: 9, count90: 9 }),
      now: new Date(2026, 6, 25, 10, 0),
      // Open Saturdays 6 PM to 2 AM only.
      hours: [{ day: 6, openHour: 18, openMinute: 0, closeHour: 2, closeMinute: 0, closeDayOffset: 1 }],
    });
    expect(r.score).toBe(0);
    expect(r.label).toBe("Closed");
    expect(r.lineRisk).toBe(0);
  });
});

describe("golden: a line_outside report forces line risk", () => {
  it("fires even when the score is low", () => {
    const r = computeHeat({
      baseline: base({ line_pattern: "door_pick" }), events: [],
      signals: sig({ vibeTally: { line_outside: 1 } }),
      now: new Date(2026, 6, 25, 23, 30), hours: OPEN_ALWAYS,
    });
    expect(r.lineRisk).toBeGreaterThanOrEqual(80);
    expect(r.lineLikely).toBe(true);
  });
});

describe("properties", () => {
  const archetypes = [
    "dive", "party_bar", "dance_club", "cocktail_room", "rooftop",
    "pub", "music_venue", "karaoke", "activity_bar",
  ] as const;
  const patterns = ["door_pick", "capacity_wait", "occasion", "none"] as const;

  it("score is always 0-100 across every archetype, pattern and hour", () => {
    for (const archetype of archetypes) {
      for (const line_pattern of patterns) {
        for (let h = 0; h < 24; h++) {
          const r = computeHeat({
            baseline: base({ archetype, line_pattern }), events: [],
            signals: sig({ count15: 3, count45: 5, count90: 7, vibeTally: { packed: 2 } }),
            now: new Date(2026, 6, 25, h, 0), hours: OPEN_ALWAYS,
          });
          expect(r.score).toBeGreaterThanOrEqual(0);
          expect(r.score).toBeLessThanOrEqual(100);
          expect(r.lineRisk).toBeGreaterThanOrEqual(0);
          expect(r.lineRisk).toBeLessThanOrEqual(100);
          expect(r.confidence).toBeGreaterThanOrEqual(0);
          expect(r.confidence).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("pattern none never produces line risk at any hour or heat", () => {
    for (let h = 0; h < 24; h++) {
      const r = computeHeat({
        baseline: base({ line_pattern: "none" }), events: [],
        signals: sig({ count15: 20, count45: 20, count90: 20, vibeTally: { line_outside: 9 } }),
        now: new Date(2026, 6, 25, h, 0), hours: OPEN_ALWAYS,
      });
      expect(r.lineRisk).toBe(0);
    }
  });
});
