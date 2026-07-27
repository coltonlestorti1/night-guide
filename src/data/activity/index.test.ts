import { describe, it, expect } from "vitest";
import { getBaseline, getEvents, ALL_BASELINE_IDS, ALL_EVENTS } from "./index";

describe("activity data", () => {
  it("covers all 56 live venues", () => {
    expect(ALL_BASELINE_IDS.length).toBe(56);
  });

  it("gives every venue an archetype and a line_pattern", () => {
    for (const id of ALL_BASELINE_IDS) {
      const b = getBaseline(id)!;
      expect(b.archetype).toBeTruthy();
      expect(["door_pick", "capacity_wait", "occasion", "none"]).toContain(b.line_pattern);
    }
  });

  it("returns undefined for an unknown venue", () => {
    expect(getBaseline("not-a-venue")).toBeUndefined();
  });

  it("returns events for a venue that has them", () => {
    const events = getEvents("berlin");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.venue_id === "berlin")).toBe(true);
  });

  it("returns an empty array for a venue with no events", () => {
    expect(getEvents("not-a-venue")).toEqual([]);
  });

  it("only references venues that exist in the baseline", () => {
    for (const e of ALL_EVENTS) {
      expect(getBaseline(e.venue_id), `event venue ${e.venue_id} missing`).toBeDefined();
    }
  });

  it("keeps every event day in range and every source a real URL", () => {
    for (const e of ALL_EVENTS) {
      expect(e.day).toBeGreaterThanOrEqual(0);
      expect(e.day).toBeLessThanOrEqual(6);
      expect(e.source_url).toMatch(/^https?:\/\//);
    }
  });

  it("has researched windows for the ten seeded venues", () => {
    const researched = ALL_BASELINE_IDS.filter(
      (id) => getBaseline(id)!.source_type === "research_estimate",
    );
    expect(researched.length).toBe(10);
    for (const id of researched) {
      const b = getBaseline(id)!;
      expect(b.busy_start).toBeTypeOf("number");
      expect(b.peak_start).toBeTypeOf("number");
      expect(b.busy_end!).toBeGreaterThan(b.busy_start!);
      expect(b.peak_end!).toBeGreaterThan(b.peak_start!);
    }
  });
});
