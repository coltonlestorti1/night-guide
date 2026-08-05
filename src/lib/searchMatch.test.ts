/**
 * Area-name search after the 2026-08-05 street-only neighborhood rule.
 *
 * Before the rule, two labels carried the area inline
 * ('Avenue B / Alphabet City'), so searching "alphabet city" worked by
 * accident. The rule strips that suffix off the card, so these tests pin the
 * behavior that replaces it.
 */
import { describe, it, expect } from "vitest";
import { venueMatches } from "@/lib/searchMatch";
import { Venue } from "@/data/types";

const venue = (over: Partial<Venue> = {}): Venue =>
  ({
    id: "v1",
    title: "Test Bar",
    latitude: 40.727,
    longitude: -73.984,
    serves_alcohol: true,
    category: "bar",
    ...over,
  }) as Venue;

describe("venueMatches — area names", () => {
  it("finds an Avenue C venue by 'alphabet city'", () => {
    expect(venueMatches(venue({ neighborhood: "Avenue C" }), "alphabet city")).toBe(true);
  });

  it("finds an Avenue B venue by 'alphabet city'", () => {
    expect(venueMatches(venue({ neighborhood: "Avenue B" }), "alphabet city")).toBe(true);
  });

  it("finds Avenue C by 'loisaida' — Loisaida Ave IS Avenue C", () => {
    expect(venueMatches(venue({ neighborhood: "Avenue C" }), "loisaida")).toBe(true);
  });

  it("does NOT put 1st Avenue in Alphabet City", () => {
    expect(venueMatches(venue({ neighborhood: "1st Avenue" }), "alphabet city")).toBe(false);
  });

  it("finds any venue by 'east village', including one with no neighborhood", () => {
    expect(venueMatches(venue({ neighborhood: "3rd Avenue" }), "east village")).toBe(true);
    expect(venueMatches(venue(), "east village")).toBe(true);
  });

  it("still matches the street label itself", () => {
    expect(venueMatches(venue({ neighborhood: "St. Marks Place" }), "st marks")).toBe(true);
  });

  it("still matches on name, and rejects a genuine miss", () => {
    expect(venueMatches(venue({ title: "McSorley's Old Ale House" }), "mcsorleys")).toBe(true);
    expect(venueMatches(venue({ neighborhood: "Avenue A" }), "williamsburg")).toBe(false);
  });
});
