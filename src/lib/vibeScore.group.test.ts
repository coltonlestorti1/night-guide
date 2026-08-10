/**
 * Guards the §17 group-size rules agreed with Colton on 2026-08-09.
 *
 * The first test is the gate on the whole change: adding group size must not
 * alter a single existing result for anyone who does not use it — the same
 * criterion the 2026-08-07 personalization work was held to.
 *
 * Venue titles are REAL enrichment entries, because takesReservations() reads
 * enrichment by title. "The Grafton" is reservable:true, "Standings" is
 * reservable:false, "The York" has no record at all.
 */
import { describe, it, expect } from "vitest";
import { scoreVenues, type VibePrefs } from "./vibeScore";
import type { Venue } from "@/data/types";

const venue = (title: string, over: Partial<Venue> = {}): Venue =>
  ({
    id: title,
    title,
    category: "bar",
    neighborhood: "East Village",
    avg_price_level: 3,
    ...over,
  }) as Venue;

const NOW = new Date("2026-08-09T23:00:00Z");
const base: VibePrefs = { when: "later" };

const RESERVABLE = "The Grafton";
const NOT_RESERVABLE = "Standings";
/** Has enrichment, but no `reservable` key — the "not recorded" case. */
const NO_RECORD = "The York";
/**
 * Titles with NO enrichment entry at all. Essential for isolating one rule:
 * real venues carry ratings and outdoor seating that move the score
 * independently, and an outdoor +1 silently cancelled the packed −1 here on
 * the first run of these tests.
 */
const BARE_BAR = "Nowhere Bar (test)";
const BARE_LOUNGE = "Nowhere Lounge (test)";

describe("group size is inert when unused", () => {
  it("produces identical output with no group size selected", () => {
    const venues = [venue(RESERVABLE), venue(NOT_RESERVABLE), venue(NO_RECORD)];
    const before = scoreVenues(venues, base, undefined, NOW);
    const after = scoreVenues(venues, { ...base, groupSize: undefined }, undefined, NOW);
    expect(after).toEqual(before);
  });
});

describe("reservations", () => {
  it("lifts a reservable venue for a big group and says so", () => {
    const venues = [venue(NOT_RESERVABLE), venue(RESERVABLE)];
    const out = scoreVenues(venues, { ...base, groupSize: "big" }, undefined, NOW);
    expect(out[0].venue.title).toBe(RESERVABLE);
    expect(out[0].reasons).toContain("Takes reservations");
  });

  it("never sinks a venue with no reservation record", () => {
    const plain = scoreVenues([venue(NO_RECORD)], base, undefined, NOW)[0].score;
    const big = scoreVenues([venue(NO_RECORD)], { ...base, groupSize: "big" }, undefined, NOW)[0]
      .score;
    expect(big).toBeGreaterThanOrEqual(plain);
  });

  it("never sinks a venue Google says takes no reservations", () => {
    const plain = scoreVenues([venue(NOT_RESERVABLE)], base, undefined, NOW)[0].score;
    const big = scoreVenues(
      [venue(NOT_RESERVABLE)],
      { ...base, groupSize: "big" },
      undefined,
      NOW,
    )[0].score;
    expect(big).toBeGreaterThanOrEqual(plain);
  });

  it("weights reservations less for a small group than a big one", () => {
    const one = (g: VibePrefs["groupSize"]) =>
      scoreVenues([venue(RESERVABLE)], { ...base, groupSize: g }, undefined, NOW)[0].score;
    expect(one("big")).toBeGreaterThan(one("small"));
  });
});

describe("a stated crowd preference beats the group-size inference", () => {
  const packed = { [BARE_BAR]: { count: 9 } };
  const score = (prefs: VibePrefs) => scoreVenues([venue(BARE_BAR)], prefs, packed, NOW)[0].score;

  it("sinks a packed venue for a big group that stated no vibe", () => {
    expect(score({ ...base, groupSize: "big" })).toBeLessThan(score(base));
  });

  it("does NOT sink a packed venue when the user explicitly asked for packed", () => {
    const withVibe: VibePrefs = { ...base, vibe: "packed" };
    expect(score({ ...withVibe, groupSize: "big" })).toBe(score(withVibe));
  });

  it("leaves the crowd dimension alone for any stated vibe, not just packed", () => {
    const withVibe: VibePrefs = { ...base, vibe: "chill" };
    expect(score({ ...withVibe, groupSize: "big" })).toBe(score(withVibe));
  });

  it("does not sink packed venues for a small group even with no vibe stated", () => {
    expect(score({ ...base, groupSize: "small" })).toBeGreaterThanOrEqual(score(base));
  });
});

describe("small parties lean intimate", () => {
  // Price level 2 keeps this a PLAIN bar: isCocktailSpot() already treats any
  // bar at price >= 3 as cocktail-forward, which would earn the same lean.
  const plainBar = venue(BARE_BAR, { avg_price_level: 2 });

  it("lifts a lounge for someone going solo", () => {
    const venues = [plainBar, venue(BARE_LOUNGE, { category: "lounge" })];
    const out = scoreVenues(venues, { ...base, groupSize: "solo" }, undefined, NOW);
    expect(out[0].venue.title).toBe(BARE_LOUNGE);
  });

  it("leaves a plain bar alone for a solo night", () => {
    const plain = scoreVenues([plainBar], base, undefined, NOW)[0].score;
    const solo = scoreVenues([plainBar], { ...base, groupSize: "solo" }, undefined, NOW)[0].score;
    expect(solo).toBe(plain);
  });
});

describe("no reason string may ever claim a capacity", () => {
  it("says nothing about fitting a group, at any party size", () => {
    const venues = [venue(RESERVABLE), venue(NOT_RESERVABLE), venue(NO_RECORD)];
    const sizes: VibePrefs["groupSize"][] = ["solo", "two", "small", "big"];
    const text = sizes
      .flatMap((g) => scoreVenues(venues, { ...base, groupSize: g }, undefined, NOW))
      .flatMap((s) => s.reasons)
      .join(" ")
      .toLowerCase();
    for (const banned of ["fits", "room for", "big group", "large group", "seats", "capacity"]) {
      expect(text).not.toContain(banned);
    }
  });
});
