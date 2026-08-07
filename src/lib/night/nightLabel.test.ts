import { describe, it, expect } from "vitest";
import { nightLabel } from "./nightLabel";

// Friday 2026-08-07, 10:00 local. Last night is Thursday 2026-08-06.
const NOW = new Date("2026-08-07T10:00:00");

describe("nightLabel", () => {
  it("calls the most recent night 'Last night'", () => {
    expect(nightLabel("2026-08-06", NOW)).toBe("Last night");
  });

  it("names the weekday within the past week", () => {
    expect(nightLabel("2026-08-04", NOW)).toBe("Tuesday");
    expect(nightLabel("2026-08-02", NOW)).toBe("Sunday");
  });

  it("falls back to a date once a weekday would be ambiguous", () => {
    // 8 days back — "Wednesday" would be indistinguishable from this week's.
    expect(nightLabel("2026-07-30", NOW)).toMatch(/Jul/);
  });

  it("still says 'Last night' late the following evening, before the new night ends", () => {
    // 23:00 Friday: the 12-hour lookback lands on Friday 11:00, so last night
    // is still Thursday — the label does not jump to tonight mid-evening.
    expect(nightLabel("2026-08-06", new Date("2026-08-07T23:00:00"))).toBe("Last night");
  });

  it("never renders a time of day", () => {
    for (const d of ["2026-08-06", "2026-08-04", "2026-07-30"]) {
      expect(nightLabel(d, NOW)).not.toMatch(/\d{1,2}:\d{2}|AM|PM/i);
    }
  });
});
