import { describe, it, expect } from "vitest";
import { METER_SEGMENTS, meterFill, segmentsForScore } from "./meter";
import {
  ACTIVITY_HOT,
  ACTIVITY_QUIET,
  ACTIVITY_TRACK,
  ACTIVITY_TRENDING,
} from "./activityColors";
import { scoreLabel } from "./labels";

describe("segmentsForScore", () => {
  it("never shows zero segments for an open venue", () => {
    // A row of empty boxes is indistinguishable from no data. Quiet is a
    // measurement, and it should look like one.
    expect(segmentsForScore(0)).toBe(1);
    expect(segmentsForScore(1)).toBe(1);
  });

  it("fills all five at the top", () => {
    expect(segmentsForScore(100)).toBe(METER_SEGMENTS);
    expect(segmentsForScore(81)).toBe(METER_SEGMENTS);
  });

  it("gives the same label different readings — the whole point", () => {
    // Both are "Busy". The label flattened them; the meter does not.
    expect(scoreLabel(56)).toBe("Busy");
    expect(scoreLabel(74)).toBe("Busy");
    expect(segmentsForScore(56)).toBe(3);
    expect(segmentsForScore(74)).toBe(4);
  });

  it("never contradicts the band it sits next to", () => {
    // The ranges each label can produce, checked across every score. If a
    // future band edit breaks the correspondence, this fails rather than
    // shipping a meter that argues with the word beside it.
    const allowed: Record<string, number[]> = {
      Quiet: [1, 2],
      Building: [2, 3],
      Busy: [3, 4],
      "Hot Now": [4, 5],
    };
    for (let score = 0; score <= 100; score++) {
      const label = scoreLabel(score);
      expect(allowed[label], `score ${score} (${label})`).toContain(segmentsForScore(score));
    }
  });

  it("clamps out-of-range scores instead of overflowing the meter", () => {
    expect(segmentsForScore(140)).toBe(METER_SEGMENTS);
    expect(segmentsForScore(-20)).toBe(1);
  });

  it("survives a non-finite score rather than rendering NaN blocks", () => {
    expect(segmentsForScore(NaN)).toBe(1);
    expect(segmentsForScore(Infinity)).toBe(1);
  });
});

describe("meterFill", () => {
  it("speaks the map's palette exactly — one vocabulary, two surfaces", () => {
    // A pin and a meter disagreeing about what "hot" looks like is the drift
    // this shares a module to prevent.
    expect(meterFill("Hot Now")).toBe(ACTIVITY_HOT);
    expect(meterFill("Busy")).toBe(ACTIVITY_TRENDING);
    expect(meterFill("Quiet")).toBe(ACTIVITY_QUIET);
  });

  it("gives Building and Busy the same hue — the count separates them", () => {
    expect(meterFill("Building")).toBe(meterFill("Busy"));
  });

  it("never paints Quiet green, which exists nowhere in the map legend", () => {
    expect(meterFill("Quiet")).not.toBe(meterFill("Busy"));
    expect(meterFill("Quiet")).not.toBe(meterFill("Hot Now"));
  });

  it("keeps every lit colour distinct from the empty track", () => {
    for (const l of ["Quiet", "Building", "Busy", "Hot Now"] as const) {
      expect(meterFill(l)).not.toBe(ACTIVITY_TRACK);
    }
  });
});
