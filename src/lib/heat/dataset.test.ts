/**
 * Whole-dataset sanity: runs the engine over all 56 live venues at
 * representative times and asserts the properties that only show up in
 * aggregate — headroom, closed handling, and line restraint.
 */
import { describe, it, expect } from "vitest";
import { computeHeat } from "./index";
import { getBaseline, getEvents, ALL_BASELINE_TITLES } from "@/data/activity";
import { getEnrichment } from "@/data/enrichment";
import { EMPTY_SIGNALS } from "./types";

function sweep(now: Date) {
  return ALL_BASELINE_TITLES.map((title) => {
    const baseline = getBaseline(title)!;
    return {
      title,
      pattern: baseline.line_pattern,
      ...computeHeat({
        baseline,
        events: getEvents(title),
        signals: EMPTY_SIGNALS,
        now,
        hours: getEnrichment(title)?.hours,
      }),
    };
  });
}

const SAT_LATE = new Date(2026, 6, 25, 23, 30);
const SAT_AFTERNOON = new Date(2026, 6, 25, 15, 0);
const TUE_EVENING = new Date(2026, 6, 28, 21, 0);

describe("dataset sweep", () => {
  it("leaves headroom: no venue is pinned at 100 on baseline alone", () => {
    // A baseline at the ceiling cannot be moved by live signals, which would
    // defeat the blend. Every venue must have room for real people to matter.
    for (const r of sweep(SAT_LATE)) {
      expect(r.score, `${r.title} is pinned at the ceiling`).toBeLessThan(100);
    }
  });

  it("has a spread of labels on a Saturday night, not one flat value", () => {
    const scores = new Set(sweep(SAT_LATE).map((r) => r.score));
    expect(scores.size).toBeGreaterThan(5);
  });

  it("is quiet or closed everywhere on a Saturday afternoon", () => {
    for (const r of sweep(SAT_AFTERNOON)) {
      expect(["Quiet", "Closed"], `${r.title} was ${r.label}`).toContain(r.label);
    }
  });

  it("claims no lines at all on a Tuesday evening", () => {
    expect(sweep(TUE_EVENING).filter((r) => r.lineLikely)).toEqual([]);
  });

  it("only ever claims a line at a venue whose pattern allows one", () => {
    for (const now of [SAT_LATE, SAT_AFTERNOON, TUE_EVENING]) {
      for (const r of sweep(now)) {
        if (r.lineLikely) expect(r.pattern).not.toBe("none");
      }
    }
  });

  it("never scores a closed venue above zero", () => {
    for (const now of [SAT_LATE, SAT_AFTERNOON, TUE_EVENING]) {
      for (const r of sweep(now)) {
        if (r.label === "Closed") expect(r.score).toBe(0);
      }
    }
  });
});
