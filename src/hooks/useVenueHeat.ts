import { useMemo } from "react";
import { Venue } from "@/data/types";
import { getBaseline, getEvents } from "@/data/activity";
import { getEnrichment } from "@/data/enrichment";
import { computeHeat } from "@/lib/heat";
import { signalsFromActivity } from "@/lib/heat/signals";
import { EMPTY_SIGNALS, HeatResult, LiveSignals, VenueBaseline } from "@/lib/heat/types";
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

  // Depend on the venue IDS, not the array identity. Callers build `venues`
  // as `data ?? []`, a fresh reference every render, so keying the memo on the
  // array would recompute constantly — and a new heat object rebuilds every
  // map marker (see the same warning on activityCounts in MapPage).
  const venueKey = venues.map((v) => v.id).join(",");

  return useMemo(() => {
    const now = new Date();
    const out: Record<string, HeatResult> = {};
    for (const v of venues) {
      const baseline = getBaseline(v.title);
      if (!baseline) continue; // no activity record — venue stays unstyled
      const friendCount = friendsByVenue?.[v.id]?.length ?? 0;
      out[v.id] = computeHeat({
        baseline,
        events: getEvents(v.title),
        signals: signalsFromActivity(activity?.[v.id], friendCount),
        now,
        hours: getEnrichment(v.title)?.hours,
      });
    }
    return out;
    // `tick` is intentionally a dependency: it is the clock. `venueKey` stands
    // in for `venues` deliberately — see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueKey, activity, friendsByVenue, tick]);
}

/** Heat for one venue, with the baseline and live signals that produced it. */
export function useOneVenueHeat(venue: Venue | undefined): {
  heat: HeatResult | undefined;
  baseline: VenueBaseline | undefined;
  signals: LiveSignals;
} {
  const { data: activity } = useVenueActivity();
  const tick = useMinuteTick();
  const title = venue?.title;
  const id = venue?.id;

  return useMemo(() => {
    if (!title || !id) return { heat: undefined, baseline: undefined, signals: EMPTY_SIGNALS };
    const baseline = getBaseline(title);
    const signals = signalsFromActivity(activity?.[id], 0);
    if (!baseline) return { heat: undefined, baseline: undefined, signals };
    return {
      heat: computeHeat({
        baseline,
        events: getEvents(title),
        signals,
        now: new Date(),
        hours: getEnrichment(title)?.hours,
      }),
      baseline,
      signals,
    };
    // `tick` is the clock — see the note on useVenueHeat above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, id, activity, tick]);
}
