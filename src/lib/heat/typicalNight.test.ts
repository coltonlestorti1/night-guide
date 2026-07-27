import { describe, it, expect } from "vitest";
import {
  TAB_ORDER,
  defaultTab,
  representativeDay,
  axisHours,
  typicalNight,
  venuePeak,
} from "./typicalNight";
import { VenueBaseline, WeeklyEvent } from "./types";
import { WeeklyPeriod } from "@/data/enrichment/types";

const base = (o: Partial<VenueBaseline> = {}): VenueBaseline => ({
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
  ...o,
});

/** Niagara Bar's real researched record. */
const niagara = base({
  archetype: "dive",
  line_pattern: "door_pick",
  busy_start: 1290, busy_end: 1590,
  peak_start: 1410, peak_end: 1530,
  best_nights: [5, 6],
  confidence_base: "medium",
  source_type: "research_estimate",
});

const period = (day: number, closeHour: number, closeDayOffset: 0 | 1): WeeklyPeriod => ({
  day, openHour: 17, openMinute: 0, closeHour, closeMinute: 0, closeDayOffset,
});

describe("defaultTab", () => {
  it("returns weekend on a Saturday evening", () => {
    // Saturday 2026-07-25, 11 PM
    expect(defaultTab(new Date(2026, 6, 25, 23, 0))).toBe("weekend");
  });

  it("returns weekend at 1 AM Sunday — still Saturday night", () => {
    expect(defaultTab(new Date(2026, 6, 26, 1, 0))).toBe("weekend");
  });

  it("returns sunday on a Sunday evening", () => {
    expect(defaultTab(new Date(2026, 6, 26, 21, 0))).toBe("sunday");
  });

  it("returns thursday on a Thursday", () => {
    expect(defaultTab(new Date(2026, 6, 23, 21, 0))).toBe("thursday");
  });

  it("returns weeknight on a Tuesday", () => {
    expect(defaultTab(new Date(2026, 6, 21, 21, 0))).toBe("weeknight");
  });
});

describe("axisHours", () => {
  it("runs in night order starting at 5 PM, never 0 to 23", () => {
    const hours = axisHours([period(6, 4, 1)], 6);
    expect(hours[0]).toBe(17);
    // Strictly increasing in absolute-hour space.
    for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThan(hours[i - 1]);
  });

  it("ends before a 4 AM close", () => {
    expect(axisHours([period(6, 4, 1)], 6).at(-1)).toBe(27);
  });

  it("ends before a 2 AM close", () => {
    expect(axisHours([period(2, 2, 1)], 2).at(-1)).toBe(25);
  });

  it("floors a 10 PM close at the 11 PM end stop", () => {
    expect(axisHours([period(2, 22, 0)], 2).at(-1)).toBe(22);
  });

  it("caps a 6 AM close at 4 AM", () => {
    expect(axisHours([period(6, 6, 1)], 6).at(-1)).toBe(27);
  });

  it("falls back to a 2 AM end with no hours data", () => {
    expect(axisHours(undefined, 6).at(-1)).toBe(25);
  });
});

describe("representativeDay", () => {
  it("picks the day carrying an event over its dead neighbours", () => {
    const events: WeeklyEvent[] = [
      { venue: "X", day: 2, name: "Karaoke", start_min: 1320, source_url: "https://example.com" },
    ];
    expect(representativeDay(base(), events, "weeknight")).toBe(2);
  });

  it("picks a best_night over its neighbours", () => {
    expect(representativeDay(base({ best_nights: [3] }), [], "weeknight")).toBe(3);
  });

  it("resolves ties to the earliest day in the group", () => {
    expect(representativeDay(base(), [], "weeknight")).toBe(1);
    expect(representativeDay(base(), [], "weekend")).toBe(5);
  });

  it("returns the only day for single-day groups", () => {
    expect(representativeDay(base(), [], "thursday")).toBe(4);
    expect(representativeDay(base(), [], "sunday")).toBe(0);
  });
});

describe("typicalNight bars", () => {
  it("builds one bar per axis hour, in night order", () => {
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    // representativeDay picks day 5 (Friday) when both 5 and 6 are best nights (tiebreak: earliest)
    expect(r.day).toBe(5);
    expect(r.bars.map((b) => b.hour)).toEqual(axisHours([period(6, 4, 1)], 5));
  });

  it("scores the weekend above the weeknight for the same venue", () => {
    const hours = [period(6, 4, 1), period(2, 4, 1)];
    const weekend = typicalNight(niagara, [], hours, "weekend");
    const weeknight = typicalNight(niagara, [], hours, "weeknight");
    const peakOf = (bars: { value: number }[]) => Math.max(...bars.map((b) => b.value));
    expect(peakOf(weekend.bars)).toBeGreaterThan(peakOf(weeknight.bars));
  });

  it("agrees with baselineScore — bars are not drawn from the raw curve", async () => {
    const { baselineScore } = await import("./baseline");
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    // representativeDay picks day 5 when both 5 and 6 are best nights (tiebreak: earliest)
    expect(r.day).toBe(5);
    const bar = r.bars.find((b) => b.hour === 23)!;
    // Day 5 (Friday) in the reference week is 2026-07-31. Bar value must match baselineScore for that date.
    expect(bar.value).toBe(baselineScore(niagara, [], new Date(2026, 6, 31, 23, 0)));
  });

  it("lifts the bars on the day an event lands", () => {
    const events: WeeklyEvent[] = [
      { venue: "X", day: 2, name: "Karaoke", start_min: 1320, source_url: "https://example.com" },
    ];
    const withEvent = typicalNight(base(), events, undefined, "weeknight");
    const without = typicalNight(base(), [], undefined, "weeknight");
    const at10 = (r: { bars: { hour: number; value: number }[] }) =>
      r.bars.find((b) => b.hour === 22)!.value;
    expect(at10(withEvent)).toBeGreaterThan(at10(without));
  });
});

describe("typicalNight copy tiers", () => {
  it("gives a researched venue exact-time lines and no soft line", () => {
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    expect(r.busiestLine).toBe("Busiest 11:30 PM – 1:30 AM");
    expect(r.crowdedLine).toBe("Crowded 9:30 PM – 2:30 AM");
    expect(r.softLine).toBeNull();
  });

  it("gives an archetype-only venue a soft line and no exact times", () => {
    const r = typicalNight(base(), [], [period(6, 4, 1)], "weekend");
    expect(r.busiestLine).toBeNull();
    expect(r.crowdedLine).toBeNull();
    expect(r.softLine).toMatch(/^Usually picks up around \d{1,2}(:\d{2})? (AM|PM)$/);
  });

  it("never hedges in the soft line", () => {
    const r = typicalNight(base({ archetype: "cocktail_room" }), [], undefined, "weeknight");
    expect(r.softLine).not.toMatch(/probably|approximately|estimate|about|roughly/i);
  });

  it("names the hour the shape actually rises, not the peak", () => {
    // Weekend dive: bars peak at 11 PM (80), so 70% = 56, first crossed at 9 PM.
    const r = typicalNight(base({ archetype: "dive" }), [], [period(6, 4, 1)], "weekend");
    expect(r.softLine).toBe("Usually picks up around 9 PM");
  });

  it("names a later hour for a venue that starts later", () => {
    // A dance club's shape is flat until late, so it must not claim 9 PM.
    const club = typicalNight(base({ archetype: "dance_club" }), [], [period(6, 4, 1)], "weekend");
    const dive = typicalNight(base({ archetype: "dive" }), [], [period(6, 4, 1)], "weekend");
    expect(club.softLine).not.toBe(dive.softLine);
  });

  it("marks a peak band covering the researched window", () => {
    const r = typicalNight(niagara, [], [period(6, 4, 1)], "weekend");
    // 1410 min = 11:30 PM, 1530 min = 1:30 AM.
    expect(r.peakBand).toEqual({ startHour: 23, endHour: 26 });
  });

  it("has no peak band without a researched window", () => {
    expect(typicalNight(base(), [], undefined, "weekend").peakBand).toBeNull();
  });
});

describe("venuePeak", () => {
  const peakOf = (bars: { value: number }[]) => Math.max(...bars.map((b) => b.value));

  it("equals the weekend tab's own peak and beats the weeknight tab's, for a weekend-best venue", () => {
    const weekend = typicalNight(niagara, [], undefined, "weekend");
    const weeknight = typicalNight(niagara, [], undefined, "weeknight");
    const peak = venuePeak(niagara, [], undefined);
    expect(peak).toBe(peakOf(weekend.bars));
    expect(peak).toBeGreaterThan(peakOf(weeknight.bars));
  });

  it("is never less than any individual tab's own peak", () => {
    for (const tab of TAB_ORDER) {
      const bars = typicalNight(niagara, [], undefined, tab).bars;
      expect(venuePeak(niagara, [], undefined)).toBeGreaterThanOrEqual(peakOf(bars));
    }
  });
});
