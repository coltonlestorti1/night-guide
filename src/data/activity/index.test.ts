import { describe, it, expect } from "vitest";
import { getBaseline, getEvents, ALL_BASELINE_TITLES, ALL_EVENTS } from "./index";

describe("activity data", () => {
  it("covers all 56 live venues", () => {
    expect(ALL_BASELINE_TITLES.length).toBe(56);
  });

  it("gives every venue an archetype and a line_pattern", () => {
    for (const id of ALL_BASELINE_TITLES) {
      const b = getBaseline(id)!;
      expect(b.archetype).toBeTruthy();
      expect(["door_pick", "capacity_wait", "occasion", "none"]).toContain(b.line_pattern);
    }
  });

  it("returns undefined for an unknown venue", () => {
    expect(getBaseline("Not A Venue")).toBeUndefined();
  });

  it("returns events for a venue that has them", () => {
    const events = getEvents("Berlin");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.venue === "Berlin")).toBe(true);
  });

  it("returns an empty array for a venue with no events", () => {
    expect(getEvents("Not A Venue")).toEqual([]);
  });

  it("only references venues that exist in the baseline", () => {
    for (const e of ALL_EVENTS) {
      expect(getBaseline(e.venue), `event venue ${e.venue} missing`).toBeDefined();
    }
  });

  it("keeps every event day in range and every source a real URL", () => {
    for (const e of ALL_EVENTS) {
      expect(e.day).toBeGreaterThanOrEqual(0);
      expect(e.day).toBeLessThanOrEqual(6);
      expect(e.source_url).toMatch(/^https?:\/\//);
    }
  });

  it("has researched windows for the eleven seeded venues", () => {
    // Death & Co is the eleventh: its "2-hour wait from opening" evidence used
    // to live only in the research doc, carried implicitly by the cocktail_room
    // curve sitting high at 8 PM. Re-centering that curve on 11 PM exposed it.
    const windowed = ALL_BASELINE_TITLES.filter((t) => getBaseline(t)!.busy_start != null);
    expect(windowed.length).toBe(11);
    for (const t of windowed) {
      const b = getBaseline(t)!;
      expect(b.peak_start).toBeTypeOf("number");
      expect(b.busy_end!).toBeGreaterThan(b.busy_start!);
      expect(b.peak_end!).toBeGreaterThan(b.peak_start!);
      expect(b.source_type).toBe("research_estimate");
    }
  });

  it("never claims research confidence without evidence behind it", () => {
    // research_estimate covers two kinds: venues with researched WINDOWS, and
    // venues whose line_pattern came from sourced evidence. Either is fine —
    // claiming the label with neither is not.
    for (const t of ALL_BASELINE_TITLES) {
      const b = getBaseline(t)!;
      if (b.source_type !== "research_estimate") continue;
      const hasWindows = b.busy_start != null;
      const hasEvidence = b.evidence_url != null;
      expect(hasWindows || hasEvidence, `${t} claims research with neither`).toBe(true);
    }
  });

  it("only assigns a non-none line_pattern with a reason", () => {
    for (const t of ALL_BASELINE_TITLES) {
      const b = getBaseline(t)!;
      if (b.line_pattern === "none") continue;
      // Either sourced evidence, or the derived door_pick rule (archetype +
      // late close), which leaves source_type as archetype_default.
      const derived = b.source_type === "archetype_default" && b.line_pattern === "door_pick";
      expect(derived || b.source_type === "research_estimate", `${t}`).toBe(true);
    }
  });

  it("keeps every peak window inside its busy window", () => {
    // typicalNight's chart reshaping tests only the BUSY window, so a peak
    // authored outside it would be clamped to the outside-window ceiling —
    // the peak would vanish from the bars while peakBand still highlighted it.
    for (const t of ALL_BASELINE_TITLES) {
      const b = getBaseline(t)!;
      if (b.peak_start == null || b.peak_end == null) continue;
      if (b.busy_start == null || b.busy_end == null) continue;
      expect(b.busy_start, `${t} peak starts before its busy window`).toBeLessThanOrEqual(b.peak_start);
      expect(b.busy_end, `${t} peak ends after its busy window`).toBeGreaterThanOrEqual(b.peak_end);
    }
  });
});
