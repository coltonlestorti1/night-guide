/**
 * Compact enrichment strip for the map drawer: open state · rating · price,
 * plus a happy-hour line when the venue publishes one. Renders nothing when
 * no enrichment exists — the drawer stays clean for data-less venues.
 */
import { Venue } from "@/data/types";
import { getEnrichment, computeOpenState, describeWeeklyPeriods, getHappyHourState } from "@/data/enrichment";
import { cn } from "@/lib/utils";

export default function VenueQuickInfo({ venue }: { venue: Venue }) {
  const e = getEnrichment(venue.title);
  if (!e) return null;
  const state = computeOpenState(e.hours);

  const segments: React.ReactNode[] = [];
  if (state) {
    segments.push(
      <span key="open" className={cn("font-medium", state.open ? "text-emerald-400" : "text-rose-400")}>
        ● {state.open ? `Open${state.closesAt ? ` til ${state.closesAt}` : ""}` : `Closed${state.opensAt ? ` · opens ${state.opensAt}` : ""}`}
      </span>,
    );
  }
  if (e.rating != null) segments.push(<span key="rating">★ {e.rating.toFixed(1)}</span>);
  if (e.priceRange) segments.push(<span key="price">{e.priceRange}</span>);
  if (segments.length === 0 && !e.happyHour) return null;

  return (
    <div className="mt-1.5 space-y-0.5">
      {segments.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          {segments.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-border">·</span>}
              {s}
            </span>
          ))}
        </p>
      )}
      {e.happyHour && (() => {
        const hh = getHappyHourState(e.happyHour);
        if (hh.status === "active")
          return <p className="text-xs text-amber-400 font-medium">🥂 Happy hour now · til {hh.endsAt}</p>;
        if (hh.status === "upcoming-today")
          return <p className="text-xs text-primary">🥂 Happy hour starts {hh.startsAt}</p>;
        return <p className="text-xs text-primary">🥂 Happy hour {describeWeeklyPeriods(e.happyHour).join(" · ")}</p>;
      })()}
    </div>
  );
}
