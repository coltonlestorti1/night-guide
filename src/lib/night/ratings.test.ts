import { describe, it, expect } from "vitest";
import { bucketRows } from "./ratings";
import { BANDS, scoreFor } from "./ranking";

/**
 * Only the pure row-builder is covered. There is no Supabase mock in this repo,
 * and the arithmetic is the part of a bucket rewrite that can silently be
 * wrong — a stale score survives every type check.
 */
describe("bucketRows", () => {
  it("numbers rank_position from 0 in list order", () => {
    const rows = bucketRows("u1", "great", ["a", "b", "c"]);
    expect(rows.map((r) => r.venue_id)).toEqual(["a", "b", "c"]);
    expect(rows.map((r) => r.rank_position)).toEqual([0, 1, 2]);
  });

  it("scores every row for the bucket size it is actually in", () => {
    const rows = bucketRows("u1", "great", ["a", "b"]);
    expect(rows.map((r) => r.score)).toEqual([scoreFor("great", 0, 2), scoreFor("great", 1, 2)]);
  });

  it("re-spreads the survivors after a removal, rather than leaving a gap", () => {
    // Removing the middle of three must not leave "c" scored as if there were
    // still three — that is the whole reason a delete reindexes.
    const before = bucketRows("u1", "great", ["a", "b", "c"]);
    const after = bucketRows("u1", "great", ["a", "c"]);
    expect(after[1].score).not.toBe(before[2].score);
    expect(after[1].score).toBe(scoreFor("great", 1, 2));
  });

  it("stamps the user and bucket onto every row", () => {
    const rows = bucketRows("u1", "not_great", ["a", "b"]);
    expect(rows.every((r) => r.user_id === "u1")).toBe(true);
    expect(rows.every((r) => r.bucket === "not_great")).toBe(true);
  });

  it("returns nothing for an empty order", () => {
    expect(bucketRows("u1", "great", [])).toEqual([]);
  });

  it("keeps every score inside its own band, so a rewrite can never cross a boundary", () => {
    const rows = bucketRows("u1", "good", ["a", "b", "c", "d", "e"]);
    expect(rows.every((r) => r.score >= BANDS.good.lo && r.score <= BANDS.good.hi)).toBe(true);
  });
});
