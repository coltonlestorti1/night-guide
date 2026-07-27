import { describe, it, expect } from "vitest";
import { heatTier } from "./tier";
import { HeatResult } from "./types";

const heat = (o: Partial<HeatResult>): HeatResult => ({
  score: 0, label: "Quiet", lineRisk: 0, lineLikely: false,
  pastPeak: false, confidence: 0, liveWeight: 0, baselineScore: 0, ...o,
});

describe("heatTier", () => {
  it("selection always wins", () => {
    expect(heatTier(heat({ label: "Hot Now" }), true)).toBe("selected");
    expect(heatTier(undefined, true)).toBe("selected");
  });

  it("maps the four score labels onto three rings", () => {
    expect(heatTier(heat({ label: "Quiet" }), false)).toBe("quiet");
    expect(heatTier(heat({ label: "Building" }), false)).toBe("trending");
    expect(heatTier(heat({ label: "Busy" }), false)).toBe("trending");
    expect(heatTier(heat({ label: "Hot Now" }), false)).toBe("hot");
  });

  it("renders a closed venue as quiet", () => {
    expect(heatTier(heat({ label: "Closed" }), false)).toBe("quiet");
  });

  it("renders Line Likely as hot, never as its own tier", () => {
    const t = heatTier(heat({ label: "Hot Now", lineLikely: true }), false);
    expect(t).toBe("hot");
  });

  it("falls back to quiet when heat is unknown", () => {
    expect(heatTier(undefined, false)).toBe("quiet");
  });
});
