import { describe, it, expect } from "vitest";
import { callActionLabel, telHref } from "./venueContact";

describe("telHref", () => {
  it("strips Google's formatting into something a dialer accepts", () => {
    expect(telHref("(212) 777-9637")).toBe("tel:2127779637");
  });

  it("keeps a leading + for international numbers", () => {
    expect(telHref("+1 212-777-9637")).toBe("tel:+12127779637");
  });

  it("survives a number that is already clean", () => {
    expect(telHref("2127779637")).toBe("tel:2127779637");
  });
});

describe("callActionLabel", () => {
  it("offers booking only when Google verified it", () => {
    // 28 of 56 venues at last count.
    expect(callActionLabel(true)).toBe("Call to book");
  });

  it("says plain Call otherwise — absent means 'not recorded', not 'no'", () => {
    // Claiming a dive takes reservations is worse than saying nothing.
    expect(callActionLabel(false)).toBe("Call");
  });

  it("never promises a booking flow, which no venue has a link for", () => {
    expect(callActionLabel(true)).not.toMatch(/reserve now|book now|table/i);
  });
});
