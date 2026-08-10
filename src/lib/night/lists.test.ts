import { describe, it, expect } from "vitest";
import { beenList } from "./lists";
import type { RatingRow } from "@/lib/night/ratings";
import type { Venue } from "@/data/types";

const rating = (
  venueId: string,
  bucket: RatingRow["bucket"],
  rankPosition: number,
  score: number,
): RatingRow => ({ venueId, bucket, rankPosition, score });

const venue = (id: string): Venue => ({ id, title: `Venue ${id}`, category: "bar" }) as Venue;

describe("beenList", () => {
  it("orders best first across buckets, because the bands never overlap", () => {
    const venues = [venue("a"), venue("b"), venue("c")];
    const rows = [
      rating("b", "good", 0, 5.0),
      rating("c", "not_great", 0, 1.7),
      rating("a", "great", 0, 8.4),
    ];
    expect(beenList(rows, venues).map((e) => e.venue.id)).toEqual(["a", "b", "c"]);
  });

  it("numbers positions from 1 across the whole list, not per bucket", () => {
    const venues = [venue("a"), venue("b"), venue("c")];
    const rows = [
      rating("a", "great", 0, 8.4),
      rating("b", "great", 1, 7.0),
      rating("c", "good", 0, 5.0),
    ];
    expect(beenList(rows, venues).map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("breaks a rounded-score tie by rank position, so a big bucket stays ordered", () => {
    // scoreFor rounds to one decimal, so neighbours in a large bucket can
    // render the same score. The stored ranking is the truth.
    const venues = [venue("a"), venue("b")];
    const rows = [rating("b", "great", 1, 9.1), rating("a", "great", 0, 9.1)];
    expect(beenList(rows, venues).map((e) => e.venue.id)).toEqual(["a", "b"]);
  });

  it("drops a rating whose venue no longer resolves", () => {
    const rows = [rating("a", "great", 0, 8.4), rating("gone", "great", 1, 7.0)];
    const out = beenList(rows, [venue("a")]);
    expect(out.map((e) => e.venue.id)).toEqual(["a"]);
    expect(out[0].position).toBe(1);
  });

  it("returns an empty list for no ratings, and for undefined", () => {
    expect(beenList([], [venue("a")])).toEqual([]);
    expect(beenList(undefined, [venue("a")])).toEqual([]);
  });

  it("carries the bucket through, so the badge can style a weak rating differently", () => {
    const out = beenList([rating("a", "not_great", 0, 1.7)], [venue("a")]);
    expect(out[0].bucket).toBe("not_great");
    expect(out[0].score).toBe(1.7);
  });

  it("does not mutate the ratings array it was given", () => {
    const rows = [rating("b", "good", 0, 5.0), rating("a", "great", 0, 8.4)];
    beenList(rows, [venue("a"), venue("b")]);
    expect(rows.map((r) => r.venueId)).toEqual(["b", "a"]);
  });
});
