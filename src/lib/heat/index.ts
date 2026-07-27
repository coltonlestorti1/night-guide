/**
 * The heat engine's only public entry point.
 *
 * Pure: no network, no React, no clock reads. `now` is always supplied by the
 * caller, which is what makes every golden case reproducible.
 *
 * See docs/superpowers/specs/2026-07-27-activity-heat-system-design.md
 */
import { computeOpenState } from "@/data/enrichment";
import { WeeklyPeriod } from "@/data/enrichment/types";
import { baselineScore, nightMinutes } from "@/lib/heat/baseline";
import { blendScore } from "@/lib/heat/blend";
import { confidenceScore } from "@/lib/heat/confidence";
import { lineRisk } from "@/lib/heat/line";
import { scoreLabel } from "@/lib/heat/labels";
import { HeatResult, LiveSignals, VenueBaseline, WeeklyEvent } from "@/lib/heat/types";

export type HeatInput = {
  baseline: VenueBaseline;
  events: WeeklyEvent[];
  signals: LiveSignals;
  now: Date;
  /** Google hours. Undefined means "unknown", which is treated as open. */
  hours: WeeklyPeriod[] | undefined;
};

/** Above this, the card shows "Line likely". */
const LINE_LIKELY_THRESHOLD = 50;

const CLOSED: HeatResult = {
  score: 0,
  label: "Closed",
  lineRisk: 0,
  lineLikely: false,
  pastPeak: false,
  confidence: 0,
  liveWeight: 0,
  baselineScore: 0,
};

export function computeHeat(input: HeatInput): HeatResult {
  const { baseline, events, signals, now, hours } = input;

  // Closed check runs first and short-circuits everything. A heat score on a
  // shut bar is the most visible possible bug.
  const openState = computeOpenState(hours, now);
  if (openState && !openState.open) return { ...CLOSED };

  const base = baselineScore(baseline, events, now);
  const { score, liveWeight } = blendScore(base, signals);
  const risk = lineRisk(baseline, score, signals, now);
  const confidence = confidenceScore(baseline, signals);

  const min = nightMinutes(now);
  const pastPeak = baseline.peak_end != null && min >= baseline.peak_end && score >= 30;

  return {
    score,
    label: scoreLabel(score),
    lineRisk: risk,
    lineLikely: risk >= LINE_LIKELY_THRESHOLD,
    pastPeak,
    confidence,
    liveWeight,
    baselineScore: base,
  };
}

export type { HeatResult, LiveSignals, VenueBaseline, WeeklyEvent } from "@/lib/heat/types";
