import { describe, it, expect } from "vitest";
import {
  effectiveCheckIns, crowdFromCheckIns, crowdFromFeedback, liveCrowd, hasLineReport,
} from "./live";
import { EMPTY_SIGNALS, LiveSignals } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

describe("effectiveCheckIns", () => {
  it("is zero with no signals", () => {
    expect(effectiveCheckIns(EMPTY_SIGNALS)).toBe(0);
  });

  it("weights a fresh check-in fully", () => {
    expect(effectiveCheckIns(sig({ count15: 1, count45: 1, count90: 1 }))).toBeCloseTo(1, 5);
  });

  it("discounts an older check-in", () => {
    const old = effectiveCheckIns(sig({ count15: 0, count45: 0, count90: 1 }));
    expect(old).toBeGreaterThan(0);
    expect(old).toBeLessThan(0.2);
  });

  it("weights friends more heavily than strangers", () => {
    const strangers = effectiveCheckIns(sig({ count15: 2, count45: 2, count90: 2 }));
    const friends = effectiveCheckIns(sig({ count15: 2, count45: 2, count90: 2, friendCount: 2 }));
    expect(friends).toBeGreaterThan(strangers);
  });
});

describe("crowdFromCheckIns", () => {
  it("saturates around six effective check-ins", () => {
    expect(crowdFromCheckIns(6)).toBeGreaterThanOrEqual(75);
    expect(crowdFromCheckIns(0)).toBe(0);
    expect(crowdFromCheckIns(100)).toBeLessThanOrEqual(100);
  });

  it("is monotonic", () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = crowdFromCheckIns(i);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("crowdFromFeedback", () => {
  it("is null with no reports", () => {
    expect(crowdFromFeedback(EMPTY_SIGNALS)).toBeNull();
  });

  it("maps packed higher than chill", () => {
    const packed = crowdFromFeedback(sig({ vibeTally: { packed: 1 } }))!;
    const chill = crowdFromFeedback(sig({ vibeTally: { chill: 1 } }))!;
    expect(packed).toBeGreaterThan(chill);
  });

  it("averages mixed reports", () => {
    const mixed = crowdFromFeedback(sig({ vibeTally: { dead: 1, packed: 1 } }))!;
    expect(mixed).toBeGreaterThan(5);
    expect(mixed).toBeLessThan(85);
  });
});

describe("liveCrowd", () => {
  it("is null when there is nothing to go on", () => {
    expect(liveCrowd(EMPTY_SIGNALS)).toBeNull();
  });

  it("prefers feedback when both exist", () => {
    const s = sig({ count15: 1, count45: 1, count90: 1, vibeTally: { packed: 3 } });
    expect(liveCrowd(s)!).toBeGreaterThan(crowdFromCheckIns(effectiveCheckIns(s)));
  });
});

describe("hasLineReport", () => {
  it("detects a line_outside report", () => {
    expect(hasLineReport(sig({ vibeTally: { line_outside: 1 } }))).toBe(true);
  });

  it("is false otherwise", () => {
    expect(hasLineReport(sig({ vibeTally: { packed: 5 } }))).toBe(false);
  });
});
