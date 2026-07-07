/**
 * "Popular times" histogram — historical busyness pattern (0–100 per hour).
 * Provider-agnostic: renders whatever popularTimes data exists (see the
 * 2026-07-06 enrichment spec). Live "right now" stays the check-in counts.
 */
import { useState } from "react";
import { PopularTimesDay } from "@/data/enrichment/types";
import { formatTime, DAY_SHORT } from "@/data/enrichment";
import { cn } from "@/lib/utils";

const busynessLabel = (b: number) =>
  b >= 85 ? "usually as busy as it gets" : b >= 60 ? "usually busy" : b >= 30 ? "usually steady" : "usually quiet";

const TAB_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, like the reference UI

export default function PopularTimesChart({ data }: { data: PopularTimesDay[] }) {
  const now = new Date();
  const [day, setDay] = useState(now.getDay());
  const [picked, setPicked] = useState<number | null>(null);
  if (!data || data.length === 0) return null;
  const dayData = data.find((d) => d.day === day);
  const isToday = day === now.getDay();
  const readoutHour = picked ?? (isToday && dayData?.hours.some((h) => h.hour === now.getHours()) ? now.getHours() : null);
  const readout = readoutHour != null ? dayData?.hours.find((h) => h.hour === readoutHour) : undefined;

  return (
    <div className="rounded-2xl glass p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Popular times</h2>
      <div role="tablist" aria-label="Day of week" className="flex gap-1 mb-3">
        {TAB_ORDER.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={day === d}
            onClick={() => { setDay(d); setPicked(null); }}
            className={cn(
              "flex-1 text-[11px] font-medium py-1 rounded-lg uppercase tracking-wide",
              day === d ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/10",
            )}
          >
            {DAY_SHORT[d]}
          </button>
        ))}
      </div>
      {dayData ? (
        <>
          <p className="text-xs text-muted-foreground h-4 mb-2" aria-live="polite">
            {readout ? `${formatTime(readout.hour, 0)}: ${busynessLabel(readout.busyness)}` : " "}
          </p>
          <div className="flex items-end gap-0.5 h-24" role="img"
            aria-label={`Busyness by hour, ${DAY_SHORT[day]}. Tap a bar for details.`}>
            {dayData.hours.map((h) => (
              <button
                key={h.hour}
                onClick={() => setPicked(h.hour === picked ? null : h.hour)}
                aria-label={`${formatTime(h.hour, 0)}: ${busynessLabel(h.busyness)}`}
                className="flex-1 flex items-end h-full min-w-[6px]"
              >
                <span
                  className={cn(
                    "w-full rounded-t",
                    isToday && h.hour === now.getHours() ? "bg-primary" : "bg-muted-foreground/35",
                    picked === h.hour && "ring-2 ring-ring",
                  )}
                  style={{ height: `${Math.max(h.busyness, 4)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 mt-1">
            {dayData.hours.map((h) => (
              <span key={h.hour} className="flex-1 text-center text-[9px] text-muted-foreground/70">
                {h.hour % 3 === 0 ? formatTime(h.hour, 0).replace(" ", "").replace("M", "").toLowerCase() : ""}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No data for {DAY_SHORT[day]} yet.</p>
      )}
    </div>
  );
}
