import { describe, it, expect } from "vitest";
import { bucketRows, mergeBucketOrder } from "./ratings";
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

describe("mergeBucketOrder", () => {
  it("keeps the caller's order when it matches the server exactly", () => {
    expect(mergeBucketOrder(["a", "b", "c"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("drops a venue the caller still lists but the server no longer has", () => {
    // THE BUG THIS EXISTS FOR: every write here is an upsert keyed on
    // (user_id, venue_id), so a ghost in the caller's order is INSERTED — a
    // rating deleted in another tab comes back from the dead.
    expect(mergeBucketOrder(["a", "ghost", "c"], ["a", "c"])).toEqual(["a", "c"]);
  });

  it("keeps the venue being added even though the server has never seen it", () => {
    expect(mergeBucketOrder(["a", "new", "c"], ["a", "c"], "new")).toEqual(["a", "new", "c"]);
  });

  it("appends a venue the server has but the caller never knew about", () => {
    // It must appear in the rewrite or its rank_position collides with one we
    // are about to assign. Last is the only position we can defend: it was
    // never compared against anything in this flow.
    expect(mergeBucketOrder(["a", "b"], ["a", "b", "surprise"])).toEqual(["a", "b", "surprise"]);
  });

  it("preserves relative position when a ghost sat above the insertion point", () => {
    // "new" was placed 3rd of 4 by the comparisons. Losing the ghost above it
    // must slide it up, not leave it stranded at index 2 of a 3-item list.
    expect(mergeBucketOrder(["a", "ghost", "new", "d"], ["a", "d"], "new")).toEqual([
      "a",
      "new",
      "d",
    ]);
  });

  it("handles the empty cases without inventing rows", () => {
    expect(mergeBucketOrder([], [])).toEqual([]);
    expect(mergeBucketOrder([], ["a", "b"])).toEqual(["a", "b"]);
    expect(mergeBucketOrder(["a"], [], "a")).toEqual(["a"]);
  });

  it("never duplicates, even when the added venue is already on the server", () => {
    const out = mergeBucketOrder(["b", "a"], ["a", "b"], "a");
    expect(out).toEqual(["b", "a"]);
    expect(new Set(out).size).toBe(out.length);
  });
});
