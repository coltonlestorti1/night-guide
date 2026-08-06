import { describe, it, expect } from "vitest";
import {
  scoreFor,
  nextComparison,
  insertAt,
  BANDS,
  BUCKET_LABELS,
  type Bucket,
} from "./ranking";

describe("BUCKET_LABELS", () => {
  it("uses the exact agreed copy", () => {
    expect(BUCKET_LABELS.great).toBe("Great");
    expect(BUCKET_LABELS.good).toBe("Good");
    expect(BUCKET_LABELS.not_great).toBe("Not great");
  });
});

describe("BANDS", () => {
  it("does not overlap and covers 0-10 in order", () => {
    expect(BANDS.not_great.lo).toBe(0);
    expect(BANDS.great.hi).toBe(10);
    expect(BANDS.not_great.hi).toBeLessThan(BANDS.good.lo);
    expect(BANDS.good.hi).toBeLessThan(BANDS.great.lo);
  });
});

describe("scoreFor", () => {
  it("puts a lone entry at the band midpoint", () => {
    // 6.7-10.0 -> 8.35, rounded to one decimal. The design doc originally
    // said 8.3; 8.4 is the correct rounding and the doc was corrected.
    expect(scoreFor("great", 0, 1)).toBe(8.4);
    expect(scoreFor("good", 0, 1)).toBe(5.0);
    expect(scoreFor("not_great", 0, 1)).toBe(1.7);
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
