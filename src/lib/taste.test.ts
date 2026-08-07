import { describe, it, expect } from "vitest";
import { TASTE_MIN_RATINGS, directBoost, inferTaste, tasteBoost } from "./taste";
import type { RatingRow } from "@/lib/night/ratings";
import type { Venue } from "@/data/types";

const rating = (venueId: string, bucket: RatingRow["bucket"], score = 5): RatingRow => ({
  venueId,
  bucket,
  rankPosition: 0,
  score,
});

const venue = (id: string, over: Partial<Venue> = {}): Venue =>
  ({
    id,
    title: `Venue ${id}`,
    category: "bar",
    avg_price_level: 2,
    ...over,
  }) as Venue;

describe("directBoost", () => {
  it("lifts a venue the user rated great and sinks one they rated not great", () => {
    const rows = [rating("a", "great"), rating("b", "not_great")];
    expect(directBoost("a", rows)).toBeGreaterThan(0);
    expect(directBoost("b", rows)).toBeLessThan(0);
  });

  it("is neutral for an unrated venue, and for good", () => {
    expect(directBoost("zzz", [rating("a", "great")])).toBe(0);
    expect(directBoost("a", [rating("a", "good")])).toBe(0);
  });

  it("is neutral when there are no ratings at all", () => {
    expect(directBoost("a", [])).toBe(0);
    expect(directBoost("a", undefined)).toBe(0);
  });

  it("never sinks a venue as hard as a hard filter would", () => {
    // Sinking must be a nudge, not an exclusion — the venue still appears.
    expect(directBoost("b", [rating("b", "not_great")])).toBeGreaterThan(-2);
  });
});

describe("inferTaste", () => {
  const venues = [
    venue("a", { category: "lounge", avg_price_level: 4 }),
    venue("b", { category: "lounge", avg_price_level: 4 }),
    venue("c", { category: "lounge", avg_price_level: 4 }),
  ];

  it("returns null below the minimum number of ratings", () => {
    expect(TASTE_MIN_RATINGS).toBe(3);
    expect(inferTaste([rating("a", "great"), rating("b", "great")], venues)).toBeNull();
  });

  it("infers a profile once the minimum is met", () => {
    const rows = [rating("a", "great"), rating("b", "great"), rating("c", "great")];
    const t = inferTaste(rows, venues);
    expect(t).not.toBeNull();
    expect(t!.categories.lounge).toBeGreaterThan(0);
    expect(t!.priceLevel).toBeCloseTo(4, 5);
  });

  it("counts not_great against a trait rather than ignoring it", () => {
    const rows = [rating("a", "great"), rating("b", "great"), rating("c", "not_great")];
    const t = inferTaste(rows, venues)!;
    expect(t.categories.lounge).toBeLessThan(3);
  });

  it("ignores ratings whose venue is unknown", () => {
    const rows = [rating("a", "great"), rating("b", "great"), rating("gone", "great")];
    const t = inferTaste(rows, venues);
    expect(t).toBeNull(); // only 2 resolvable — below the floor
  });

  it("counts only ratings, never saves or check-ins", () => {
    const t = inferTaste([], venues);
    expect(t).toBeNull();
  });
});

describe("tasteBoost", () => {
  const venues = [
    venue("a", { category: "lounge", avg_price_level: 4 }),
    venue("b", { category: "lounge", avg_price_level: 4 }),
    venue("c", { category: "lounge", avg_price_level: 4 }),
  ];
  const taste = inferTaste(
    [rating("a", "great"), rating("b", "great"), rating("c", "great")],
    venues
  )!;

  it("boosts an unvisited venue matching the inferred taste", () => {
    const { delta } = tasteBoost(venue("new", { category: "lounge", avg_price_level: 4 }), taste);
    expect(delta).toBeGreaterThan(0);
  });

  it("does not boost a venue that shares nothing", () => {
    const { delta } = tasteBoost(venue("new", { category: "club", avg_price_level: 1 }), taste);
    expect(delta).toBeLessThanOrEqual(0);
  });

  it("is capped so it can never outrank an open-now or filter signal", () => {
    const { delta } = tasteBoost(venue("new", { category: "lounge", avg_price_level: 4 }), taste);
    expect(delta).toBeLessThanOrEqual(1.5);
  });

  it("returns a reason only when it actually moved the venue", () => {
    const hit = tasteBoost(venue("new", { category: "lounge", avg_price_level: 4 }), taste);
    expect(hit.reason).toBeTruthy();
    const miss = tasteBoost(venue("new", { category: "club", avg_price_level: 1 }), taste);
    expect(miss.reason).toBeNull();
  });

  it("is inert when there is no taste profile", () => {
    expect(tasteBoost(venue("new"), null)).toEqual({ delta: 0, reason: null });
  });
});
