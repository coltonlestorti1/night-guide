/**
 * Weekly happy-hour planner: Today = live urgency (active first, ends-soonest),
 * other days = that weekday's happy hours by start time. Only venues with real
 * Google happy-hour times participate; the rail hides itself when none exist.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import {
  getEnrichment, getHappyHourState, getHappyHourPeriodsForDay,
  formatPeriodRange, DAY_SHORT,
} from "@/data/enrichment";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import BarCard from "@/components/BarCard";
import { cn } from "@/lib/utils";

const TAB_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first

export default function HappyHourRail({
  venues,
  onPick,
  showHeading = true,
}: {
  venues: Venue[];
  onPick: (v: Venue) => void;
  showHeading?: boolean;
}) {
  const now = new Date();
  const [day, setDay] = useState<number>(now.getDay());
  useMinuteTick();

  const hhVenues = venues.filter((v) => getEnrichment(v.title)?.happyHour);
  if (hhVenues.length === 0) return null;

  const isToday = day === now.getDay();
  let rows: { venue: Venue; line: string; active: boolean }[];

  if (isToday) {
    const active: typeof rows = [];
    const upcoming: typeof rows = [];
    for (const venue of hhVenues) {
      const state = getHappyHourState(getEnrichment(venue.title)!.happyHour, now);
      if (state.status === "active") active.push({ venue, line: `🥂 til ${state.endsAt}`, active: true });
      else if (state.status === "upcoming-today") upcoming.push({ venue, line: `🥂 starts ${state.startsAt}`, active: false });
    }
    // ends-soonest / starts-soonest — the line strings sort correctly only by
    // recomputing minutes, so sort on the underlying periods instead:
    const endMin = (v: Venue) => {
      const ps = getHappyHourPeriodsForDay(getEnrichment(v.title)!.happyHour, now.getDay());
      return Math.min(...ps.map((p) => (p.day + p.closeDayOffset) * 1440 + p.closeHour * 60 + p.closeMinute));
    };
    const startMin = (v: Venue) => {
      const ps = getHappyHourPeriodsForDay(getEnrichment(v.title)!.happyHour, now.getDay());
      return Math.min(...ps.map((p) => p.openHour * 60 + p.openMinute));
    };
    active.sort((a, b) => endMin(a.venue) - endMin(b.venue));
    upcoming.sort((a, b) => startMin(a.venue) - startMin(b.venue));
    rows = [...active, ...upcoming];
  } else {
    rows = hhVenues
      .map((venue) => ({ venue, periods: getHappyHourPeriodsForDay(getEnrichment(venue.title)!.happyHour, day) }))
      .filter((r) => r.periods.length > 0)
      .sort((a, b) => a.periods[0].openHour * 60 + a.periods[0].openMinute - (b.periods[0].openHour * 60 + b.periods[0].openMinute))
      .map(({ venue, periods }) => ({ venue, line: `🥂 ${periods.map(formatPeriodRange).join(" · ")}`, active: false }));
  }

  return (
    <div className="mb-6">
      {showHeading && (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Happy hours</h2>
      )}
      <div role="tablist" aria-label="Happy hour day" className="flex gap-1 mb-3">
        {TAB_ORDER.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={day === d}
            onClick={() => setDay(d)}
            className={cn(
              "flex-1 text-[11px] font-medium py-1 rounded-lg uppercase tracking-wide",
              day === d ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/10",
            )}
          >
            {d === now.getDay() ? "Today" : DAY_SHORT[d]}
          </button>
        ))}
      </div>
      {rows.length > 0 ? (
        <div className="space-y-2.5">
          {rows.map(({ venue, line, active }) => (
            <div key={venue.id}>
              <BarCard venue={venue} onClick={() => onPick(venue)} />
              <p className={cn("text-[11px] mt-1 px-1", active ? "text-amber-700 font-medium" : "text-muted-foreground")}>
                {line}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground glass rounded-xl p-4">
          No happy hours listed for {isToday ? "the rest of today" : DAY_SHORT[day]} yet.
        </p>
      )}
    </div>
  );
}
