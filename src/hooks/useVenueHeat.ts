import { useMemo } from "react";
import { Venue } from "@/data/types";
import { getBaseline, getEvents } from "@/data/activity";
import { getEnrichment } from "@/data/enrichment";
import { computeHeat } from "@/lib/heat";
import { signalsFromActivity } from "@/lib/heat/signals";
import { HeatResult } from "@/lib/heat/types";
import { useVenueActivity } from "@/hooks/useCheckIns";
import { useMinuteTick } from "@/hooks/useMinuteTick";

/**
 * Per-venue heat for the current moment.
 *
 * Recomputes on the minute tick so venues cross Quiet/Building/Hot boundaries
 * without a reload, the same way open-state already flips.
 */
export function useVenueHeat(
  venues: Venue[],
  friendsByVenue?: Record<string, unknown[]>,
): Record<string, HeatResult> {
  const { data: activity } = useVenueActivity();
  const tick = useMinuteTick();

  return useMemo(() => {
    const now = new Date();
    const out: Record<string, HeatResult> = {};
    for (const v of venues) {
      const baseline = getBaseline(v.id);
      if (!baseline) continue; // no activity record — venue stays unstyled
      const friendCount = friendsByVenue?.[v.id]?.length ?? 0;
      out[v.id] = computeHeat({
        baseline,
        events: getEvents(v.id),
        signals: signalsFromActivity(activity?.[v.id], friendCount),
        now,
        hours: getEnrichment(v.title)?.hours,
      });
    }
    return out;
    // `tick` is intentionally a dependency: it is the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, activity, friendsByVenue, tick]);
}
