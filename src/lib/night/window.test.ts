import { describe, it, expect } from "vitest";
import { nightDateOf, nightRange } from "./window";

describe("nightDateOf", () => {
  it("dates an evening check-in to that same day", () => {
    expect(nightDateOf(new Date("2026-08-03T22:15:00"))).toBe("2026-08-03");
  });

  it("dates an after-midnight check-in to the evening it began", () => {
    expect(nightDateOf(new Date("2026-08-04T01:30:00"))).toBe("2026-08-03");
  });

  it("treats 6am as the end of the night, not the start of one", () => {
    expect(nightDateOf(new Date("2026-08-04T05:59:00"))).toBe("2026-08-03");
    expect(nightDateOf(new Date("2026-08-04T06:00:00"))).toBe("2026-08-04");
  });

  it("dates a daytime check-in to that day", () => {
    expect(nightDateOf(new Date("2026-08-04T13:00:00"))).toBe("2026-08-04");
  });

  it("rolls a month boundary backwards correctly", () => {
    expect(nightDateOf(new Date("2026-09-01T02:00:00"))).toBe("2026-08-31");
  });

  it("rolls a year boundary backwards correctly", () => {
    expect(nightDateOf(new Date("2027-01-01T03:00:00"))).toBe("2026-12-31");
  });

  it("rolls backwards across a leap day", () => {
    expect(nightDateOf(new Date("2028-03-01T02:00:00"))).toBe("2028-02-29");
  });
});

describe("nightRange", () => {
  it("spans 6pm to 6am the following morning", () => {
    const { start, end } = nightRange("2026-08-03");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(3);
    expect(start.getHours()).toBe(18);
    expect(end.getDate()).toBe(4);
    expect(end.getHours()).toBe(6);
  });

  it("rolls the end into the next month when the night is the last of one", () => {
    const { end } = nightRange("2026-08-31");
    expect(end.getMonth()).toBe(8); // September
    expect(end.getDate()).toBe(1);
  });

  it("round-trips: every moment inside the range maps back to the night-date", () => {
    const nightDate = "2026-08-03";
    const { start, end } = nightRange(nightDate);
    const justInside = new Date(end.getTime() - 60_000);
    expect(nightDateOf(start)).toBe(nightDate);
    expect(nightDateOf(justInside)).toBe(nightDate);
    expect(nightDateOf(end)).not.toBe(nightDate); // end is exclusive
  });
});
