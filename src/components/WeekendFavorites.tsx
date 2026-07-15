/**
 * Weekend Favorites — category-slotted picks for Thu/Fri/Sat. Five slots (best
 * first stop / for dancing / late-night / value / overall) scored in
 * src/lib/weekendPicks.ts over real data only (Google rating, hours, happy-hour
 * windows, seeded category/music/price), each with a one-line reason. Slots with
 * no qualified venue are dropped, and a rating-sorted "Overall favorites" tail
 * keeps the section from shrinking. Nights differ only through real per-day
 * data — never randomness.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { pickWeekendSlots } from "@/lib/weekendPicks";
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

  const { picks, favorites } = pickWeekendSlots(venues, day);

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
      {picks.length > 0 || favorites.length > 0 ? (
        <>
          <div className="space-y-3">
            {picks.map(({ slot, label, venue, reason }) => (
              <div key={slot}>
                <div className="flex items-baseline justify-between gap-2 px-1 mb-1 min-w-0">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary/80">{label}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{reason}</span>
                </div>
                <BarCard venue={venue} onClick={() => onPick(venue)} />
              </div>
            ))}
          </div>
          {favorites.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Overall favorites
              </h3>
              <div className="space-y-2.5">
                {favorites.map((venue) => (
                  <BarCard key={venue.id} venue={venue} onClick={() => onPick(venue)} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground glass rounded-xl p-4">No favorites to show for this night yet.</p>
      )}
    </div>
  );
}
