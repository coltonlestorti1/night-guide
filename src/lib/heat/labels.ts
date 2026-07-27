import { HeatLabel } from "@/lib/heat/types";

/**
 * "Line Likely" is deliberately absent: it is an overlay driven by the line
 * model, so it can fire at 78 with real evidence and stay off at 92 without.
 * "Closed" is the orchestrator's call, since only it knows the hours.
 */
export function scoreLabel(score: number): HeatLabel {
  if (score >= 75) return "Hot Now";
  if (score >= 55) return "Busy";
  if (score >= 30) return "Building";
  return "Quiet";
}
