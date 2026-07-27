import { describe, it, expect } from "vitest";
import { activityCopy } from "./copy";
import { EMPTY_SIGNALS, HeatResult, LiveSignals, VenueBaseline } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

const base = (o: Partial<VenueBaseline>): VenueBaseline => ({
  archetype: "dive", line_pattern: "none", confidence_base: "low",
  source_type: "archetype_default", last_reviewed: "2026-07-27", ...o,
});

const heat = (o: Partial<HeatResult>): HeatResult => ({
  score: 0, label: "Quiet", lineRisk: 0, lineLikely: false, pastPeak: false,
  rising: false, confidence: 80, liveWeight: 0, baselineScore: 0, ...o,
});

const RESEARCHED = base({
  confidence_base: "high", source_type: "first_hand",
  peak_start: 23 * 60, peak_end: 26 * 60, best_nights: [4, 5, 6],
});

describe("closed", () => {
  it("says Closed and nothing else", () => {
    const c = activityCopy(heat({ label: "Closed" }), RESEARCHED, EMPTY_SIGNALS);
    expect(c.status).toBe("Closed");
    expect(c.peakNote).toBeNull();
    expect(c.bestNightsNote).toBeNull();
    expect(c.lineNote).toBeNull();
    expect(c.signalNote).toBeNull();
  });
});

describe("status wording", () => {
  it("quiet", () => {
    expect(activityCopy(heat({ label: "Quiet" }), RESEARCHED, EMPTY_SIGNALS).status)
      .toBe("Quiet right now");
  });

  it("building and rising", () => {
    expect(activityCopy(heat({ label: "Building", rising: true }), base({}), EMPTY_SIGNALS).status)
      .toBe("Starting to pick up");
  });

  it("building with a known peak still ahead", () => {
    const c = activityCopy(
      heat({ label: "Building", rising: true, score: 40 }),
      RESEARCHED, EMPTY_SIGNALS,
    );
    expect(c.status).toBe("Good time to go before it fills up");
  });

  it("busy on baseline reads as a prediction", () => {
    expect(activityCopy(heat({ label: "Busy", liveWeight: 0 }), base({}), EMPTY_SIGNALS).status)
      .toBe("Usually busy around this time");
  });

  it("busy on live signal reads as an observation", () => {
    const c = activityCopy(
      heat({ label: "Busy", liveWeight: 0.6 }), base({}),
      sig({ count15: 5, count45: 5, count90: 5 }),
    );
    expect(c.status).toBe("Likely busy now");
  });

  it("hot", () => {
    expect(activityCopy(heat({ label: "Hot Now" }), base({}), EMPTY_SIGNALS).status).toBe("Hot Now");
  });

  it("past peak", () => {
    expect(activityCopy(heat({ label: "Busy", pastPeak: true }), RESEARCHED, EMPTY_SIGNALS).status)
      .toBe("Still active, but past peak");
  });
});

describe("line note", () => {
  it("names a time at high confidence", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "door_pick", peak_start: 23 * 60, peak_end: 26 * 60 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Line likely after 11 PM");
  });

  it("stays vague at medium confidence", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 55 }),
      base({ line_pattern: "door_pick", peak_start: 23 * 60, peak_end: 26 * 60 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Line likely");
  });

  it("tells a capacity_wait venue to come later", () => {
    const c = activityCopy(
      heat({ label: "Busy", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "capacity_wait" }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Better later tonight");
  });

  it("is null when no line is likely", () => {
    expect(activityCopy(heat({ label: "Hot Now" }), base({}), EMPTY_SIGNALS).lineNote).toBeNull();
  });

  it("never claims a line for a pattern-none venue", () => {
    // Belt and braces: the engine already forces lineLikely false here, but the
    // copy layer must not be the thing standing between a bug and the user.
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: false, confidence: 90 }),
      base({ line_pattern: "none", peak_start: 23 * 60, peak_end: 26 * 60 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBeNull();
  });
});

describe("confidence gating", () => {
  it("emits exact peak times at high confidence", () => {
    expect(activityCopy(heat({ label: "Busy", confidence: 85 }), RESEARCHED, EMPTY_SIGNALS).peakNote)
      .toBe("Usually peaks 11 PM – 2 AM");
  });

  it("suppresses every specific claim at low confidence", () => {
    const c = activityCopy(heat({ label: "Busy", confidence: 30, lineLikely: true }), RESEARCHED, EMPTY_SIGNALS);
    expect(c.peakNote).toBeNull();
    expect(c.bestNightsNote).toBeNull();
    expect(c.lineNote).toBeNull();
    expect(c.status).toBeTruthy();
  });

  it("never emits a time string when confidence is low", () => {
    const c = activityCopy(heat({ label: "Hot Now", confidence: 20, lineLikely: true }), RESEARCHED, EMPTY_SIGNALS);
    const all = [c.status, c.lineNote, c.peakNote, c.bestNightsNote, c.signalNote].join(" ");
    expect(all).not.toMatch(/\d\s?(AM|PM)/);
  });
});

describe("best nights", () => {
  it("lists them at sufficient confidence", () => {
    expect(activityCopy(heat({ label: "Busy", confidence: 85 }), RESEARCHED, EMPTY_SIGNALS).bestNightsNote)
      .toBe("Best nights: Thu, Fri, Sat");
  });

  it("is null when unknown", () => {
    expect(activityCopy(heat({ label: "Busy", confidence: 85 }), base({}), EMPTY_SIGNALS).bestNightsNote)
      .toBeNull();
  });
});

describe("live signal note", () => {
  it("is null with no reports", () => {
    expect(activityCopy(heat({ label: "Busy" }), base({}), EMPTY_SIGNALS).signalNote).toBeNull();
  });

  it("stays singular for one report", () => {
    const c = activityCopy(heat({ label: "Busy" }), base({}), sig({ vibeTally: { packed: 1 } }));
    expect(c.signalNote).toBe("Recently reported busy");
  });

  it("goes plural only at two or more", () => {
    const c = activityCopy(heat({ label: "Busy" }), base({}), sig({ vibeTally: { packed: 3 } }));
    expect(c.signalNote).toBe("Multiple people reported it packed");
  });

  it("stays silent when reports say it is dead", () => {
    // A quiet room needs no announcement, and saying so reads as a warning we
    // have not earned from a couple of reports.
    const c = activityCopy(heat({ label: "Quiet" }), base({}), sig({ vibeTally: { dead: 3 } }));
    expect(c.signalNote).toBeNull();
  });

  it("stays silent for chill too", () => {
    const c = activityCopy(heat({ label: "Quiet" }), base({}), sig({ vibeTally: { chill: 2 } }));
    expect(c.signalNote).toBeNull();
  });
});

describe("never leaks internals", () => {
  it("emits no numbers, percentages or hedging", () => {
    for (const label of ["Quiet", "Building", "Busy", "Hot Now"] as const) {
      for (const confidence of [10, 50, 90]) {
        const c = activityCopy(
          heat({ label, confidence, lineLikely: true, pastPeak: false }),
          RESEARCHED,
          sig({ vibeTally: { packed: 2 } }),
        );
        const all = [c.status, c.lineNote, c.peakNote, c.bestNightsNote, c.signalNote]
          .filter(Boolean).join(" ");
        expect(all).not.toMatch(/%|score|confidence|estimate|approximately|probably/i);
      }
    }
  });
});

describe("researched line time", () => {
  it("prefers the researched line time over the peak start", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "door_pick", peak_start: 23 * 60 + 30, line_likely_after: 23 * 60 + 15 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Line likely after 11:15 PM");
  });

  it("falls back to the peak start when no line time was researched", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "door_pick", peak_start: 23 * 60 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Line likely after 11 PM");
  });
});

describe("moment note", () => {
  const HOT = base({ line_pattern: "door_pick", peak_start: 23 * 60, peak_end: 26 * 60 });

  it("says what to do about a line rather than restating the crowd", () => {
    const c = activityCopy(heat({ label: "Hot Now", lineLikely: true, confidence: 85 }), HOT, EMPTY_SIGNALS);
    expect(c.momentNote).toBe("Expect a wait at the door.");
  });

  it("sends you later at a capacity_wait venue", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "capacity_wait" }), EMPTY_SIGNALS,
    );
    expect(c.momentNote).toBe("Easier later tonight.");
  });

  it("names the hour to come back at when quiet and confident", () => {
    const c = activityCopy(heat({ label: "Quiet", rising: true, confidence: 85 }), HOT, EMPTY_SIGNALS);
    expect(c.momentNote).toBe("Worth coming back around 11 PM.");
  });

  it("stays vague about the hour at medium confidence", () => {
    const c = activityCopy(heat({ label: "Quiet", rising: true, confidence: 55 }), HOT, EMPTY_SIGNALS);
    expect(c.momentNote).toBe("Worth coming back later tonight.");
  });

  it("encourages arriving while it is still building", () => {
    const c = activityCopy(heat({ label: "Building", rising: true, confidence: 85 }), HOT, EMPTY_SIGNALS);
    expect(c.momentNote).toBe("Good time to arrive before it fills.");
  });

  it("says it is winding down past peak", () => {
    const c = activityCopy(heat({ label: "Busy", pastPeak: true, confidence: 85 }), HOT, EMPTY_SIGNALS);
    expect(c.momentNote).toBe("Winding down now.");
  });

  it("is silent when closed", () => {
    expect(activityCopy(heat({ label: "Closed" }), HOT, EMPTY_SIGNALS).momentNote).toBeNull();
  });

  it("is silent at low confidence", () => {
    expect(activityCopy(heat({ label: "Hot Now", confidence: 20 }), HOT, EMPTY_SIGNALS).momentNote).toBeNull();
  });

  it("never simply repeats the status", () => {
    for (const label of ["Quiet", "Building", "Busy", "Hot Now"] as const) {
      const c = activityCopy(heat({ label, rising: true, confidence: 85 }), HOT, EMPTY_SIGNALS);
      if (c.momentNote) expect(c.momentNote.toLowerCase()).not.toContain(c.status.toLowerCase());
    }
  });

  it("still emits no time string at low confidence", () => {
    const c = activityCopy(heat({ label: "Quiet", rising: true, confidence: 20 }), HOT, EMPTY_SIGNALS);
    expect(c.momentNote ?? "").not.toMatch(/\d\s?(AM|PM)/);
  });
});
