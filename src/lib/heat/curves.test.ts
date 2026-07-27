import { describe, it, expect } from "vitest";
import { nightlifeDay, dayShape, curveValue, DAY_SHAPE_FACTOR } from "./curves";

describe("nightlifeDay", () => {
  it("returns the calendar day during the evening", () => {
    // Saturday 2026-07-25 at 11 PM
    expect(nightlifeDay(new Date(2026, 6, 25, 23, 0))).toBe(6);
  });

  it("returns the PREVIOUS day in the small hours", () => {
    // Sunday 2026-07-26 at 1 AM is still Saturday night
    expect(nightlifeDay(new Date(2026, 6, 26, 1, 0))).toBe(6);
  });

  it("rolls Sunday 3 AM back to Saturday", () => {
    expect(nightlifeDay(new Date(2026, 6, 26, 3, 0))).toBe(6);
  });

  it("treats 5 AM as the new day", () => {
    expect(nightlifeDay(new Date(2026, 6, 26, 5, 0))).toBe(0);
  });
});

describe("dayShape", () => {
  it("maps days to shapes", () => {
    expect(dayShape(1)).toBe("midweek");
    expect(dayShape(3)).toBe("midweek");
    expect(dayShape(4)).toBe("thu");
    expect(dayShape(5)).toBe("weekend");
    expect(dayShape(6)).toBe("weekend");
    expect(dayShape(0)).toBe("sun");
  });
});

describe("curveValue", () => {
  it("is zero for every archetype at 6 AM", () => {
    expect(curveValue("dive", 6)).toBe(0);
    expect(curveValue("dance_club", 6)).toBe(0);
  });

  it("peaks later for a dance club than for a rooftop", () => {
    expect(curveValue("dance_club", 1)).toBeGreaterThan(curveValue("rooftop", 1));
    expect(curveValue("rooftop", 19)).toBeGreaterThan(curveValue("dance_club", 19));
  });

  it("stays within 0-100 for every archetype and hour", () => {
    const types = [
      "dive", "party_bar", "dance_club", "cocktail_room", "rooftop",
      "pub", "music_venue", "karaoke", "activity_bar",
    ] as const;
    for (const t of types) {
      for (let h = 0; h < 24; h++) {
        const v = curveValue(t, h);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("DAY_SHAPE_FACTOR", () => {
  it("ranks weekend highest and midweek lowest", () => {
    expect(DAY_SHAPE_FACTOR.weekend).toBeGreaterThan(DAY_SHAPE_FACTOR.thu);
    expect(DAY_SHAPE_FACTOR.thu).toBeGreaterThan(DAY_SHAPE_FACTOR.sun);
    expect(DAY_SHAPE_FACTOR.sun).toBeGreaterThan(DAY_SHAPE_FACTOR.midweek);
  });
});
