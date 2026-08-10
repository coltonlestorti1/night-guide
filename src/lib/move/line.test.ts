import { describe, it, expect } from "vitest";
import { lineSignal, linePenalty, LINE_MIN_TO_SCORE, LINE_MAX_PENALTY } from "./line";

const tally = (n: number) => ({ count: 5, vibeTally: { line_outside: n } });

describe("lineSignal", () => {
  it("reads the count out of the vibe tally", () => {
    expect(lineSignal(tally(3)).reports).toBe(3);
  });

  it("says nothing when nobody reported a line", () => {
    expect(lineSignal({ count: 5, vibeTally: { packed: 4 } })).toEqual({
      reports: 0,
      reported: false,
      corroborated: false,
    });
  });

  it("is silent for a venue with no activity at all", () => {
    expect(lineSignal(undefined).reported).toBe(false);
    expect(lineSignal({ count: 0 }).reported).toBe(false);
  });

  it("falls back to latest_vibe when no tally is served", () => {
    const s = lineSignal({ count: 2, vibe: "line_outside" });
    expect(s.reports).toBe(1);
    expect(s.reported).toBe(true);
  });

  it("does not treat some other latest_vibe as a line", () => {
    expect(lineSignal({ count: 2, vibe: "packed" }).reported).toBe(false);
  });

  it("will say a single report out loud but will not let it move rank", () => {
    const one = lineSignal(tally(1));
    expect(one.reported).toBe(true);
    expect(one.corroborated).toBe(false);
  });

  it("treats two or more as corroborated", () => {
    expect(lineSignal(tally(LINE_MIN_TO_SCORE)).corroborated).toBe(true);
  });
});

describe("linePenalty — a stated preference beats the inference", () => {
  const corroborated = lineSignal(tally(3));

  it("never penalises someone who asked for a packed room", () => {
    expect(linePenalty(corroborated, { vibe: "packed" })).toBe(0);
    expect(linePenalty(corroborated, { vibe: "packed", groupSize: "big" })).toBe(0);
  });

  it("penalises someone who asked for chill", () => {
    expect(linePenalty(corroborated, { vibe: "chill" })).toBeGreaterThan(0);
  });

  it("penalises a big group that stated no vibe", () => {
    expect(linePenalty(corroborated, { groupSize: "big" })).toBeGreaterThan(0);
  });

  it("does nothing for a big group that explicitly asked for packed", () => {
    expect(linePenalty(corroborated, { groupSize: "big", vibe: "packed" })).toBe(0);
  });

  it("does nothing at all for a solo user with no stated vibe", () => {
    expect(linePenalty(corroborated, { groupSize: "solo" })).toBe(0);
  });

  it("never penalises on a single uncorroborated report", () => {
    expect(linePenalty(lineSignal(tally(1)), { vibe: "chill", groupSize: "big" })).toBe(0);
  });

  it("is capped however bad the combination", () => {
    expect(linePenalty(corroborated, { vibe: "chill", groupSize: "big" })).toBeLessThanOrEqual(
      LINE_MAX_PENALTY,
    );
  });
});
