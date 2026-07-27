/**
 * Blends baseline and live readings. The weight is a function of evidence
 * volume AT THIS VENUE, which reproduces the launch -> traction -> network
 * phases automatically and per venue, instead of by a global switch: a bar
 * with eight people in it should be user-driven today, and a dead bar should
 * stay baseline-driven indefinitely.
 */
import { effectiveCheckIns, liveCrowd } from "@/lib/heat/live";
import { LiveSignals } from "@/lib/heat/types";

const LIVE_WEIGHT_CAP = 0.75;
const HALF_SIGNAL = 4;

export function liveWeight(s: LiveSignals): number {
  const reports = Object.values(s.vibeTally).reduce<number>((a, b) => a + (b ?? 0), 0);
  const signals = effectiveCheckIns(s) + reports;
  if (signals <= 0) return 0;
  return Math.min(LIVE_WEIGHT_CAP, signals / (signals + HALF_SIGNAL));
}

export function blendScore(
  baseline: number,
  s: LiveSignals,
): { score: number; liveWeight: number } {
  const live = liveCrowd(s);
  const w = live == null ? 0 : liveWeight(s);
  const score = Math.round(baseline * (1 - w) + (live ?? 0) * w);
  return { score: Math.max(0, Math.min(100, score)), liveWeight: w };
}
