import { ChevronRight } from "lucide-react";
import { Venue } from "@/data/types";
import { formatAgeRange, formatPriceLevel } from "@/lib/format";

export default function BarCard({ venue, onClick }: { venue: Venue; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring p-4 flex items-center gap-3"
      aria-label={`${venue.title} details`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold leading-tight">{venue.title}</h3>
          {venue.venue_type_primary && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {venue.venue_type_primary.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          <span>Age: {formatAgeRange(venue)}</span>
          <span>Price: {formatPriceLevel(venue.avg_price_level ?? null)}</span>
          {venue.music_type && <span>Music: {venue.music_type}</span>}
          {venue.venue_stats?.wait_minutes != null && (
            <span>Wait: {venue.venue_stats.wait_minutes}m</span>
          )}
          {venue.venue_stats?.crowd_level && <span>Crowd: {venue.venue_stats.crowd_level}</span>}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
