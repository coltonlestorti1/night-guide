/**
 * Maps a HeatResult onto the map's three-tier legend. The legend is
 * deliberately simpler than the score labels: the map answers "where is
 * something happening", the venue card explains why.
 *
 * Line Likely has no ring of its own — it renders as Hot, so the shipped
 * legend (Quiet / Trending / Hot / Selected) stays exactly as it is.
 */
import { HeatResult } from "@/lib/heat/types";

export type MapTier = "selected" | "hot" | "trending" | "quiet";

export function heatTier(heat: HeatResult | undefined, isSelected: boolean): MapTier {
  if (isSelected) return "selected";
  if (!heat) return "quiet";
  if (heat.label === "Hot Now") return "hot";
  if (heat.label === "Busy" || heat.label === "Building") return "trending";
  return "quiet";
}
