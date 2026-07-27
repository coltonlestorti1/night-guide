/**
 * The deeper venue layer — everything that used to live only on /venue/:id.
 * Rendered inside VenuePreview behind the "More info" expander, so the map
 * sheet, the desktop panel and the standalone page all share one
 * implementation instead of three near-duplicate renders.
 *
 * Render guard lives in the caller (hasMoreInfo) so the expander row itself
 * can be hidden — this component assumes it has something to show.
 *
 * Reference data only: hours, phone, website, price, rating. The venue blurb
 * is NOT here — it renders once, in ActivitySection at the top of the card.
 */
import { Venue } from "@/data/types";
import { getEnrichment, getSpecials } from "@/data/enrichment";
import VenueInfoCard from "@/components/VenueInfoCard";
import PopularTimesChart from "@/components/PopularTimesChart";

export default function VenueMoreInfo({ venue }: { venue: Venue }) {
  const e = getEnrichment(venue.title);
  const specials = getSpecials(venue.title);

  return (
    <div className="space-y-4 pt-3">
      <VenueInfoCard venue={venue} />

      {/* Carried over unchanged — renders for 0/56 venues today (the serpapi
          popular-times source was never run). Kept, not deleted, pending
          Colton's direction. */}
      {e?.popularTimes && <PopularTimesChart data={e.popularTimes} />}

      {/* Carried over unchanged — specials.json is currently {} for all
          venues. Kept, not deleted, pending Colton's direction. */}
      {specials.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Specials
          </h3>
          <ul className="space-y-2">
            {specials.map((s) => (
              <li key={s.title} className="rounded-xl bg-secondary/60 p-3">
                <p className="text-sm font-medium">{s.title}</p>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
