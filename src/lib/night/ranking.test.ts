import { describe, it, expect } from "vitest";
import { BANDS, BUCKET_LABELS, TOP_SCORE_MIN, bucketForScore, insertAt, nextComparison, scoreFor, type Bucket } from "./ranking";

describe("BUCKET_LABELS", () => {
  it("uses the exact agreed copy", () => {
    expect(BUCKET_LABELS.great).toBe("Great");
    expect(BUCKET_LABELS.good).toBe("Good");
    expect(BUCKET_LABELS.not_great).toBe("Not great");
  });
});

describe("BANDS", () => {
  it("does not overlap, and stays inside 0-10 in order", () => {
    // The floor is deliberately 3.0, not 0: "Not great" means the night was a
    // let-down, not that the place should be condemned.
    expect(BANDS.not_great.lo).toBe(3.0);
    expect(BANDS.great.hi).toBe(10);
    expect(BANDS.not_great.hi).toBeLessThan(BANDS.good.lo);
    expect(BANDS.good.hi).toBeLessThan(BANDS.great.lo);
  });
});

describe("scoreFor", () => {
  it("starts a lone entry on the baseline Colton set", () => {
    // 7.0-10.0 -> 8.5, and the other two follow from their own bands.
    expect(scoreFor("great", 0, 1)).toBe(8.5);
    expect(scoreFor("good", 0, 1)).toBe(6.0);
    expect(scoreFor("not_great", 0, 1)).toBe(4.0);
  });

  it("derives that midpoint from the bands rather than a magic number", () => {
    const buckets: Bucket[] = ["great", "good", "not_great"];
    for (const b of buckets) {
      const mid = (BANDS[b].lo + BANDS[b].hi) / 2;
      expect(scoreFor(b, 0, 1)).toBe(Math.round(mid * 10) / 10);
    }
  });

  it("ranks earlier positions higher", () => {
    expect(scoreFor("great", 0, 2)).toBeGreaterThan(scoreFor("great", 1, 2));
  });

  it("never leaves its band, at any bucket size", () => {
    const buckets: Bucket[] = ["great", "good", "not_great"];
    for (const b of buckets) {
      for (const size of [1, 2, 5, 20, 56]) {
        for (let i = 0; i < size; i++) {
          const s = scoreFor(b, i, size);
          expect(s).toBeGreaterThanOrEqual(BANDS[b].lo);
          expect(s).toBeLessThanOrEqual(BANDS[b].hi);
        }
      }
    }
  });

  it("keeps buckets from overlapping even at their extremes", () => {
    expect(scoreFor("good", 0, 5)).toBeLessThan(scoreFor("great", 4, 5));
    expect(scoreFor("not_great", 0, 5)).toBeLessThan(scoreFor("good", 4, 5));
  });

  it("treats an empty bucket size as a lone entry rather than dividing by zero", () => {
    expect(Number.isFinite(scoreFor("good", 0, 0))).toBe(true);
  });

  it("rounds to one decimal place", () => {
    const s = scoreFor("great", 1, 3);
    expect(Math.round(s * 10) / 10).toBe(s);
  });
});

describe("nextComparison", () => {
  it("returns null for an empty bucket - nothing to compare against", () => {
    expect(nextComparison([], 0, 0)).toBeNull();
  });

  it("asks about the midpoint of the live range", () => {
    expect(nextComparison(["a", "b", "c"], 0, 3)?.venueId).toBe("b");
  });

  it("terminates once the range collapses", () => {
    expect(nextComparison(["a"], 1, 1)).toBeNull();
  });

  it("converges to the last position when the new venue loses every comparison", () => {
    const list = Array.from({ length: 16 }, (_, i) => `v${i}`);
    let lo = 0;
    const hi = list.length;
    let asked = 0;

    // Always answer "the new one is worse": lo moves past the midpoint.
    for (let c = nextComparison(list, lo, hi); c && asked < 20; c = nextComparison(list, lo, hi)) {
      asked++;
      lo = list.indexOf(c.venueId) + 1;
    }

    expect(asked).toBeLessThanOrEqual(5); // ceil(log2(16)) + 1
    expect(lo).toBe(list.length);
  });

  it("converges to the first position when the new venue wins every comparison", () => {
    const list = Array.from({ length: 16 }, (_, i) => `v${i}`);
    const lo = 0;
    let hi = list.length;
    let asked = 0;

    for (let c = nextComparison(list, lo, hi); c && asked < 20; c = nextComparison(list, lo, hi)) {
      asked++;
      hi = list.indexOf(c.venueId);
    }

    expect(asked).toBeLessThanOrEqual(5);
    expect(hi).toBe(0);
  });
});

describe("insertAt", () => {
  it("inserts without dropping anything", () => {
    expect(insertAt(["a", "c"], "b", 1)).toEqual(["a", "b", "c"]);
  });

  it("inserts at the head and the tail", () => {
    expect(insertAt(["a"], "z", 0)).toEqual(["z", "a"]);
    expect(insertAt(["a"], "z", 1)).toEqual(["a", "z"]);
  });

  it("does not mutate its input", () => {
    const original = ["a", "b"];
    insertAt(original, "z", 1);
    expect(original).toEqual(["a", "b"]);
  });
});

describe("the top of a Great list", () => {
  it("is a flat 10.0 once the bucket reaches TOP_SCORE_MIN", () => {
    expect(scoreFor("great", 0, TOP_SCORE_MIN)).toBe(10);
    expect(scoreFor("great", 0, TOP_SCORE_MIN + 12)).toBe(10);
  });

  it("is not yet a 10 while the ranking is too thin to have earned it", () => {
    for (let n = 1; n < TOP_SCORE_MIN; n++) {
      expect(scoreFor("great", 0, n)).toBeLessThan(10);
    }
  });

  it("only ever lifts #1, and only in Great", () => {
    expect(scoreFor("great", 1, TOP_SCORE_MIN)).toBeLessThan(10);
    expect(scoreFor("good", 0, TOP_SCORE_MIN)).toBeLessThanOrEqual(BANDS.good.hi);
    expect(scoreFor("not_great", 0, TOP_SCORE_MIN)).toBeLessThanOrEqual(BANDS.not_great.hi);
  });

  it("still ranks strictly downward with the 10 pinned on top", () => {
    const scores = [0, 1, 2, 3, 4].map((i) => scoreFor("great", i, 5));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });
});

describe("bucketForScore", () => {
  it("maps a score back to the bucket that produced it", () => {
    const buckets: Bucket[] = ["great", "good", "not_great"];
    for (const b of buckets) {
      for (const n of [1, 2, 7]) {
        for (let i = 0; i < n; i++) {
          expect(bucketForScore(scoreFor(b, i, n))).toBe(b);
        }
      }
    }
  });

  it("does not crash on a score from the old bands", () => {
    // Rows written before 2026-08-10 can still be in flight when the backfill
    // runs. A 1.7 has no bucket any more; it must read as the lowest one.
    expect(bucketForScore(1.7)).toBe("not_great");
    expect(bucketForScore(0)).toBe("not_great");
  });
});
