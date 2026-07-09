/**
 * Weekend Favorites — the go-to going-out spots for Thu/Fri/Sat, ranked by real
 * Google rating (ties broken by review count) and filtered to venues open that
 * night. No fabricated "popularity": rating is the honest signal until we have
 * our own check-in history to rank on. Venues without a rating are left out;
 * venues with a rating but unknown hours are kept (missing data isn't punished).
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { getEnrichment } from "@/data/enrichment";
import BarCard from "@/components/BarCard";
import { cn } from "@/lib/utils";

const WEEKEND = [
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
] as const;

export default function WeekendFavorites({ venues, onPick }: { venues: Venue[]; onPick: (v: Venue) => void }) {
  const today = new Date().getDay();
  const [day, setDay] = useState<number>(WEEKEND.some((w) => w.day === today) ? today : 5);

  const ratingOf = (v: Venue) => getEnrichment(v.title)?.rating ?? 0;
  const countOf = (v: Venue) => getEnrichment(v.title)?.userRatingCount ?? 0;
  const openThatNight = (v: Venue) => {
    const hours = getEnrichment(v.title)?.hours;
    return !hours || hours.some((p) => p.day === day); // unknown hours: don't exclude
  };

  const ranked = venues
    .filter((v) => ratingOf(v) > 0)
    .filter(openThatNight)
    .sort((a, b) => ratingOf(b) - ratingOf(a) || countOf(b) - countOf(a))
    .slice(0, 12);

  return (
    <div className="mb-6">
      <div role="tablist" aria-label="Weekend night" className="flex gap-1 mb-3">
        {WEEKEND.map(({ day: d, label }) => (
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
            {d === today ? `${label} · Tonight` : label}
          </button>
        ))}
      </div>
      {ranked.length > 0 ? (
        <div className="space-y-2.5">
          {ranked.map((venue, i) => (
            <div key={venue.id} className="flex items-start gap-2">
              <span className="mt-8 w-5 shrink-0 text-center text-xs font-bold text-primary/80">{i + 1}</span>
              <div className="flex-1">
                <BarCard venue={venue} onClick={() => onPick(venue)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground glass rounded-xl p-4">No favorites to show for this night yet.</p>
      )}
    </div>
  );
}
