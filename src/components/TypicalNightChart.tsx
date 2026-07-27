/**
 * "Typical night" — the hourly shape a venue usually has.
 *
 * Presentational only: every number and string comes from typicalNight().
 * Replaces the old "popular times" chart, which read enrichment.popularTimes
 * and therefore rendered for 0 of 56 venues (the serpapi source was never run).
 *
 * The chart is a MODEL, never observed measurement, which is why it is titled
 * "Typical night" and why no bar carries a number.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { getBaseline, getEvents } from "@/data/activity";
import { getEnrichment } from "@/data/enrichment";
import { nightlifeDay } from "@/lib/heat/curves";
import {
  TAB_LABEL,
  TAB_ORDER,
  TypicalNightTab,
  defaultTab,
  tabForDay,
  typicalNight,
  venuePeak,
} from "@/lib/heat/typicalNight";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import { cn } from "@/lib/utils";

/** Absolute night hour: 1 AM reads as 25, matching the axis. */
function nowHour(now: Date): number {
  const h = now.getHours();
  return h < 5 ? h + 24 : h;
}

/** 17 -> "5p", 24 -> "12a". Only every third hour is labelled. */
function hourLabel(hour: number): string {
  const clock = hour % 24;
  const suffix = clock < 12 ? "a" : "p";
  const display = clock % 12 === 0 ? 12 : clock % 12;
  return `${display}${suffix}`;
}

export default function TypicalNightChart({ venue }: { venue: Venue }) {
  // A re-render trigger, NOT a timestamp — useMinuteTick returns a counter, so
  // `new Date(tick)` would read 1970. It exists here so the "now" bar and the
  // default tab cross hour and night boundaries without a reload.
  useMinuteTick();
  const baseline = getBaseline(venue.title);
  const [tab, setTab] = useState<TypicalNightTab | null>(null);

  if (!baseline) return null;

  const now = new Date();
  const activeTab = tab ?? defaultTab(now);
  const events = getEvents(venue.title);
  const hours = getEnrichment(venue.title)?.hours;
  const data = typicalNight(baseline, events, hours, activeTab);
  if (data.bars.length === 0) return null;

  // "Now" only means something on the tab covering tonight.
  const isTonight = activeTab === tabForDay(nightlifeDay(now));
  const currentHour = isTonight ? nowHour(now) : null;
  // Scaled against the venue's busiest hour across all four tabs, not this
  // tab's own maximum — otherwise a dead Tuesday fills the chart exactly
  // like a packed Saturday.
  const max = Math.max(1, venuePeak(baseline, events, hours));
  // Labels anchor to the first bar, not to hour % 3 — the axis starts at 5 PM
  // (hour 17), and 17 % 3 !== 0, so an absolute-hour test would silently
  // start the labels at 6p instead of the 5 PM open the chart promises.
  const firstHour = data.bars[0].hour;

  return (
    <section className="mt-3 rounded-2xl bg-secondary/60 p-3" aria-label="Typical night">
      <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
        Typical night
      </h3>

      <div role="tablist" aria-label="Night of week" className="flex gap-1 mb-3">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 text-[10px] font-semibold py-1.5 rounded-lg uppercase tracking-wide transition-colors",
              activeTab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/10",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div
        className="flex items-end gap-0.5 h-20"
        role="img"
        aria-label={`Typical ${TAB_LABEL[activeTab].toLowerCase()} busyness by hour.`}
      >
        {data.bars.map((b) => {
          const inPeak =
            data.peakBand != null &&
            b.hour >= data.peakBand.startHour &&
            b.hour < data.peakBand.endHour;
          return (
            <div key={b.hour} className="flex-1 flex items-end h-full min-w-[6px]">
              <span
                className={cn(
                  "w-full rounded-t transition-colors",
                  b.hour === currentHour
                    ? "bg-primary"
                    : inPeak
                      ? "bg-primary/40"
                      : "bg-muted-foreground/30",
                )}
                style={{ height: `${Math.max((b.value / max) * 100, 4)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-0.5 mt-1">
        {data.bars.map((b) => (
          <span key={b.hour} className="flex-1 text-center text-[9px] text-muted-foreground/70">
            {(b.hour - firstHour) % 3 === 0 ? hourLabel(b.hour) : ""}
          </span>
        ))}
      </div>

      {(data.busiestLine || data.softLine) && (
        <p className="mt-2 text-xs font-semibold">{data.busiestLine ?? data.softLine}</p>
      )}
      {data.crowdedLine && (
        <p className="text-xs text-muted-foreground">{data.crowdedLine}</p>
      )}
    </section>
  );
}
