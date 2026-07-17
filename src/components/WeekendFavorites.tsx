/**
 * Weekend Favorites — category-slotted picks for Thu/Fri/Sat, scored in
 * src/lib/weekendPicks.ts over real data only (Google rating, hours, happy-hour
 * windows, seeded category/music/price/age), each with a one-line reason. Slots
 * with no qualified venue are dropped, and a quality-sorted "Overall favorites"
 * tail keeps the section from shrinking. Nights differ only through real
 * per-day data and the viewer's age setting — never randomness.
 *
 * Age: an ask-once band ("Who are you going out with?" energy — 21-23 etc.)
 * stored on-device; picks nudge toward venues around the viewer's age. A tiny
 * chip lets them change it any time.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { pickWeekendSlots } from "@/lib/weekendPicks";
import { AGE_BANDS, AgeBand, ageOf, getStoredAgeBand, storeAgeBand } from "@/lib/agePref";
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
  const [ageBand, setAgeBand] = useState<AgeBand | null>(() => getStoredAgeBand());
  // Asked once; "skip" dismisses for the session without storing anything.
  const [askAge, setAskAge] = useState<boolean>(() => getStoredAgeBand() === null);
  const [editingAge, setEditingAge] = useState(false);

  const pickBand = (band: AgeBand) => {
    storeAgeBand(band);
    setAgeBand(band);
    setAskAge(false);
    setEditingAge(false);
  };

  const { picks, favorites } = pickWeekendSlots(venues, day, ageBand ? ageOf(ageBand) : null);

  const agePrompt = (askAge || editingAge) && (
    <div className="mb-3 rounded-2xl glass px-3.5 py-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Your age? Sharpens the picks.</p>
        <button
          onClick={() => { setAskAge(false); setEditingAge(false); }}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {AGE_BANDS.map((band) => (
          <button
            key={band}
            onClick={() => pickBand(band)}
            className={cn(
              "flex-1 text-xs py-1 rounded-full border transition-colors",
              ageBand === band
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-secondary border-border hover:bg-accent/15",
            )}
          >
            {band}
          </button>
        ))}
      </div>
    </div>
  );

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
              "flex-1 text-[11px] font-semibold py-1.5 rounded-full uppercase tracking-wide transition-colors",
              day === d
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {d === today ? `${label} · Tonight` : label}
          </button>
        ))}
      </div>

      {agePrompt}

      {picks.length > 0 || favorites.length > 0 ? (
        <>
          <div className="space-y-3">
            {picks.map(({ slot, label, venue, reason }) => (
              <div key={`${slot}-${venue.id}`}>
                <div className="flex items-baseline justify-between gap-2 px-1 mb-1 min-w-0">
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-bold uppercase tracking-wider",
                      slot === "anchor" ? "text-amber-700" : "text-primary",
                    )}
                  >
                    {label}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">{reason}</span>
                </div>
                <BarCard venue={venue} onClick={() => onPick(venue)} />
              </div>
            ))}
          </div>
          {favorites.length > 0 && (
            <>
              <div className="mt-5 mb-2 px-1 flex items-baseline justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Overall favorites
                </h3>
                {ageBand && !editingAge && (
                  <button
                    onClick={() => setEditingAge(true)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label="Change your age setting"
                  >
                    Tuned for {ageBand} · change
                  </button>
                )}
              </div>
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
