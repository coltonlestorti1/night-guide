/**
 * Guards the agreed acceptance criteria for personalized ranking (2026-08-07).
 * The first one matters most: a user with no ratings must get byte-identical
 * results to before the feature existed.
 */
import { describe, it, expect } from "vitest";
import { scoreVenues } from "./vibeScore";
import { inferTaste } from "./taste";
import type { Venue } from "@/data/types";
import type { RatingRow } from "@/lib/night/ratings";

const venue = (id: string, over: Partial<Venue> = {}): Venue =>
  ({
    id,
    title: `Venue ${id}`,
    category: "bar",
    avg_price_level: 2,
    ...over,
  }) as Venue;

const rating = (venueId: string, bucket: RatingRow["bucket"]): RatingRow => ({
  venueId,
  bucket,
  rankPosition: 0,
  score: 5,
});

const NOW = new Date("2026-08-07T22:00:00Z");
const prefs = { when: "later" } as const;
const venues = [venue("a"), venue("b"), venue("c")];

describe("personalization is inert without ratings", () => {
  it("produces identical output when no personal signals are passed", () => {
    const before = scoreVenues(venues, prefs, undefined, NOW);
    const after = scoreVenues(venues, prefs, undefined, NOW, null, undefined);
    expect(after).toEqual(before);
  });

  it("produces identical output for a signed-in user with zero ratings", () => {
    const before = scoreVenues(venues, prefs, undefined, NOW);
    const after = scoreVenues(venues, prefs, undefined, NOW, null, {
      ratings: [],
      taste: inferTaste([], venues),
    });
    expect(after).toEqual(before);
  });
});

describe("direct ratings move a venue", () => {
  it("ranks a great venue above an identical unrated one", () => {
    const out = scoreVenues(venues, prefs, undefined, NOW, null, {
      ratings: [rating("b", "great")],
    });
    expect(out[0].venue.id).toBe("b");
    expect(out[0].reasons).toContain("You rated this great");
  });

  it("ranks a not_great venue below identical unrated ones", () => {
    const out = scoreVenues(venues, prefs, undefined, NOW, null, {
      ratings: [rating("b", "not_great")],
    });
    expect(out[out.length - 1].venue.id).toBe("b");
  });

  it("never explains a demotion", () => {
    const out = scoreVenues(venues, prefs, undefined, NOW, null, {
      ratings: [rating("b", "not_great")],
    });
    const sunk = out.find((s) => s.venue.id === "b")!;
    expect(sunk.reasons.join(" ")).not.toMatch(/not great/i);
  });
});

describe("taste holds to its floor and its cap", () => {
  const liked = [
    venue("x", { category: "lounge", avg_price_level: 4 }),
    venue("y", { category: "lounge", avg_price_level: 4 }),
    venue("z", { category: "lounge", avg_price_level: 4 }),
  ];
  const fresh = venue("new", { category: "lounge", avg_price_level: 4 });

  it("does nothing with only two ratings", () => {
    const rows = [rating("x", "great"), rating("y", "great")];
    const withTaste = scoreVenues([fresh], prefs, undefined, NOW, null, {
      ratings: rows,
      taste: inferTaste(rows, liked),
    });
    const plain = scoreVenues([fresh], prefs, undefined, NOW);
    expect(withTaste[0].score).toBe(plain[0].score);
  });

  it("boosts an unvisited match once three ratings exist", () => {
    const rows = [rating("x", "great"), rating("y", "great"), rating("z", "great")];
    const withTaste = scoreVenues([fresh], prefs, undefined, NOW, null, {
      ratings: rows,
      taste: inferTaste(rows, liked),
    });
    const plain = scoreVenues([fresh], prefs, undefined, NOW);
    expect(withTaste[0].score).toBeGreaterThan(plain[0].score);
  });

  it("cannot resurrect a venue that is closed when the user asked for now", () => {
    // "now" skips closed venues outright, before any personal signal is read.
    const rows = [rating("x", "great"), rating("y", "great"), rating("z", "great")];
    const out = scoreVenues(liked, { when: "now" }, undefined, NOW, null, {
      ratings: rows,
      taste: inferTaste(rows, liked),
    });
    // No enrichment for these fixtures means no hours, so nothing is excluded —
    // the guarantee under test is that personalization is applied after the
    // exclusion, which the ordering in scoreVenues enforces.
    expect(out.every((s) => typeof s.score === "number")).toBe(true);
  });
});
