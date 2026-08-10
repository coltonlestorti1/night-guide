import { describe, it, expect } from "vitest";
import { selectPicks } from "./select";
import { REPEAT_REASON } from "./cooldown";
import type { ScoredVenue } from "@/lib/vibeScore";
import type { Venue } from "@/data/types";

const venue = (id: string, over: Partial<Venue> = {}): Venue =>
  ({
    id,
    title: `Venue ${id}`,
    category: "bar",
    neighborhood: "East Village",
    avg_price_level: 3,
    ...over,
  }) as Venue;

const sv = (v: Venue, score: number, reasons: string[] = []): ScoredVenue => ({
  venue: v,
  score,
  reasons,
});

const NOW = new Date("2026-08-09T23:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("selectPicks", () => {
  it("always labels the top scorer as the best fit", () => {
    const out = selectPicks([sv(venue("a"), 9), sv(venue("b"), 5), sv(venue("c"), 4)], { now: NOW });
    expect(out[0].venue.id).toBe("a");
    expect(out[0].character).toBe("fit");
    expect(out[0].headline).toBe("Best fit");
  });

  it("returns three even when every venue is identical in kind", () => {
    const ranked = ["a", "b", "c", "d"].map((id, i) => sv(venue(id), 9 - i));
    expect(selectPicks(ranked, { now: NOW })).toHaveLength(3);
  });

  it("returns everything it has when there are fewer than three", () => {
    expect(selectPicks([sv(venue("a"), 9)], { now: NOW })).toHaveLength(1);
    expect(selectPicks([], { now: NOW })).toEqual([]);
  });

  it("prefers a different neighborhood and type over raw rank", () => {
    const ranked = [
      sv(venue("a"), 9),
      sv(venue("b"), 8.9), // identical kind to a — should be passed over
      sv(venue("c", { category: "lounge", neighborhood: "LES", avg_price_level: 1 }), 5),
    ];
    const ids = selectPicks(ranked, { now: NOW }).map((p) => p.venue.id);
    expect(ids).toContain("c");
  });

  it("never gives two picks the same character", () => {
    const ranked = [
      sv(venue("a"), 9),
      sv(venue("b", { neighborhood: "LES", avg_price_level: 1 }), 8),
      sv(venue("c", { category: "club", neighborhood: "Noho", avg_price_level: 1 }), 7),
    ];
    const chars = selectPicks(ranked, { now: NOW }).map((p) => p.character);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it("carries the scorer's reasons through, capped at three", () => {
    const out = selectPicks([sv(venue("a"), 9, ["one", "two", "three", "four"])], { now: NOW });
    expect(out[0].reasons).toEqual(["one", "two", "three"]);
  });

  it("explains a repeat when a recently shown venue is still clearly superior", () => {
    const ranked = [sv(venue("a"), 12), sv(venue("b"), 4)];
    const out = selectPicks(ranked, { now: NOW, impressions: { a: hoursAgo(1) } });
    expect(out[0].reasons).toContain(REPEAT_REASON);
  });

  it("does not claim superiority when the lead is narrow", () => {
    const ranked = [sv(venue("a"), 6), sv(venue("b"), 5.5)];
    const out = selectPicks(ranked, { now: NOW, impressions: { a: hoursAgo(1) } });
    expect(out[0].reasons).not.toContain(REPEAT_REASON);
  });

  it("drops a recently shown venue out of the lead when its margin is narrow", () => {
    const ranked = [sv(venue("a"), 6), sv(venue("b", { neighborhood: "LES" }), 5.5)];
    const out = selectPicks(ranked, { now: NOW, impressions: { a: hoursAgo(1) } });
    expect(out[0].venue.id).toBe("b");
  });

  it("keeps a recently shown venue in the lead when it is still clearly better", () => {
    const ranked = [sv(venue("a"), 12), sv(venue("b", { neighborhood: "LES" }), 4)];
    const out = selectPicks(ranked, { now: NOW, impressions: { a: hoursAgo(1) } });
    expect(out[0].venue.id).toBe("a");
  });

  it("still returns three when every candidate was recently shown", () => {
    const ranked = ["a", "b", "c"].map((id, i) => sv(venue(id, { neighborhood: `N${i}` }), 9 - i));
    const impressions = { a: hoursAgo(1), b: hoursAgo(1), c: hoursAgo(1) };
    expect(selectPicks(ranked, { now: NOW, impressions })).toHaveLength(3);
  });

  it("says nothing about repeats for a venue that was not recently shown", () => {
    const ranked = [sv(venue("a"), 12), sv(venue("b"), 4)];
    const out = selectPicks(ranked, { now: NOW, impressions: {} });
    expect(out[0].reasons).not.toContain(REPEAT_REASON);
  });

  it("never emits a reason or note that claims a capacity", () => {
    const ranked = ["a", "b", "c"].map((id, i) =>
      sv(venue(id, { neighborhood: `N${i}` }), 9 - i, ["Takes reservations"]),
    );
    const text = selectPicks(ranked, { now: NOW })
      .flatMap((p) => [...p.reasons, p.note ?? "", p.headline])
      .join(" ")
      .toLowerCase();
    for (const banned of ["fits", "room for", "big group", "large group", "seats", "capacity"]) {
      expect(text).not.toContain(banned);
    }
  });
});
