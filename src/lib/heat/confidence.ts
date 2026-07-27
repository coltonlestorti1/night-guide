/**
 * confidence_base is stored editorial judgement; confidence_score is computed
 * per read and rises with live evidence. A venue on an archetype default can
 * still speak confidently right now if enough people are there reporting.
 *
 * This is what makes the 46 archetype-defaulted venues safe to ship: they light
 * up the map and get a status, but they cannot make specific claims.
 */
import { effectiveCheckIns } from "@/lib/heat/live";
import { LiveSignals, VenueBaseline } from "@/lib/heat/types";

const BASE_POINTS = { high: 60, medium: 40, low: 20 } as const;
const SOURCE_POINTS = { first_hand: 20, research_estimate: 10, archetype_default: 0 } as const;

/** Above this, copy may state exact times. */
export const EXACT_TIME_THRESHOLD = 70;

export function confidenceScore(baseline: VenueBaseline, s: LiveSignals): number {
  let score = BASE_POINTS[baseline.confidence_base] + SOURCE_POINTS[baseline.source_type];

  if (baseline.busy_start != null && baseline.busy_end != null) score += 5;
  if (baseline.peak_start != null && baseline.peak_end != null) score += 5;

  const reports = Object.values(s.vibeTally).reduce<number>((a, b) => a + (b ?? 0), 0);
  const liveEvidence = effectiveCheckIns(s) + reports * 2;
  score += Math.min(25, liveEvidence * 3);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function mayStateExactTimes(confidence: number): boolean {
  return confidence >= EXACT_TIME_THRESHOLD;
}
