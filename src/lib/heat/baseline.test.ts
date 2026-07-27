import { describe, it, expect } from "vitest";
import { baselineScore } from "./baseline";
import { VenueBaseline, WeeklyEvent } from "./types";

const dive: VenueBaseline = {
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
};

const SAT_11PM = new Date(2026, 6, 25, 23, 0);
const MON_11PM = new Date(2026, 6, 27, 23, 0);
const MON_10PM = new Date(2026, 6, 27, 22, 0);

describe("baselineScore", () => {
  it("scores a weekend night higher than a midweek night", () => {
    expect(baselineScore(dive, [], SAT_11PM)).toBeGreaterThan(
      baselineScore(dive, [], MON_11PM),
    );
  });

  it("stays within 0-100", () => {
    for (let h = 0; h < 24; h++) {
      const s = baselineScore(dive, [], new Date(2026, 6, 25, h, 0));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("lifts a best-night above a non-best-night", () => {
    const withBest: VenueBaseline = { ...dive, best_nights: [1] };
    expect(baselineScore(withBest, [], MON_11PM)).toBeGreaterThan(
      baselineScore(dive, [], MON_11PM),
    );
  });

  it("an event bump can make a Monday busy", () => {
    const event: WeeklyEvent = {
      venue: "x", day: 1, name: "Macho Monday",
      start_min: 22 * 60, source_url: "https://example.com",
    };
    const without = baselineScore(dive, [], MON_10PM);
    const withEvent = baselineScore(dive, [event], MON_10PM);
    expect(withEvent).toBeGreaterThan(without);
    // The spec's acceptance case: the bump must be able to invert a day-shape.
    expect(withEvent).toBeGreaterThanOrEqual(55);
  });

  it("ignores an event on a different day", () => {
    const event: WeeklyEvent = {
      venue: "x", day: 6, name: "Saturday thing",
      start_min: 22 * 60, source_url: "https://example.com",
    };
    expect(baselineScore(dive, [event], MON_10PM)).toBe(baselineScore(dive, [], MON_10PM));
  });

  it("ignores an event with no posted time", () => {
    const event: WeeklyEvent = {
      venue: "x", day: 1, name: "Untimed",
      start_min: null, source_url: "https://example.com",
    };
    expect(baselineScore(dive, [event], MON_10PM)).toBe(baselineScore(dive, [], MON_10PM));
  });

  it("uses researched peak windows when present", () => {
    const researched: VenueBaseline = {
      ...dive,
      peak_start: 23 * 60,
      peak_end: 25 * 60,
      busy_start: 21 * 60,
      busy_end: 26 * 60,
    };
    expect(baselineScore(researched, [], SAT_11PM)).toBeGreaterThanOrEqual(75);
  });

  it("treats time outside a researched busy window as quiet", () => {
    const researched: VenueBaseline = {
      ...dive,
      busy_start: 21 * 60,
      busy_end: 26 * 60,
      peak_start: 23 * 60,
      peak_end: 25 * 60,
    };
    // 6 PM Saturday, well before the researched window opens.
    expect(baselineScore(researched, [], new Date(2026, 6, 25, 18, 0))).toBeLessThanOrEqual(25);
  });
});
