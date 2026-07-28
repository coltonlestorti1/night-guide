/**
 * Daily event volume. One series, so no legend — the heading names it.
 *
 * Hand-rolled rather than Recharts to match TypicalNightChart, the app's other
 * chart. Days with zero events render as a visible baseline tick, not a gap:
 * "nobody used the app that day" is the finding, and an absent bar would read
 * as missing data instead.
 */
import { useState } from "react";

export type BarPoint = { day: string; total: number };

/** "2026-07-28" -> "Jul 28". Parsed as UTC to match the RPC's date cast. */
function label(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const EventsBarChart = ({ data }: { data: BarPoint[] }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const peakIndex = data.reduce((best, d, i) => (d.total > data[best].total ? i : best), 0);

  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]">
        {data.map((d, i) => {
          const pct = (d.total / max) * 100;
          const isHovered = hover === i;
          return (
            <div
              key={d.day}
              className="group relative flex flex-1 flex-col justify-end"
              style={{ height: "100%" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {(isHovered || (i === peakIndex && d.total > 0)) && (
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-background">
                  {d.total} · {label(d.day)}
                </div>
              )}
              <div
                className="rounded-t-[4px] bg-primary transition-opacity"
                style={{
                  height: d.total === 0 ? "2px" : `${Math.max(pct, 3)}%`,
                  opacity: d.total === 0 ? 0.18 : isHovered ? 1 : 0.85,
                }}
                aria-hidden
              />
              <span className="sr-only">
                {label(d.day)}: {d.total} events
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{data.length > 0 && label(data[0].day)}</span>
        <span>{data.length > 0 && label(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
};

export default EventsBarChart;
