import { ChevronRight } from "lucide-react";
import { Venue } from "@/data/types";
import { formatAgeRange, formatPriceLevel } from "@/lib/format";

export default function BarCard({ venue, onClick }: { venue: Venue; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border bg-card hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden flex items-stretch"
      aria-label={`${venue.title} details`}
    >
      {/* Venue Image */}
      {venue.image_url && (
        <div className="w-24 h-24 flex-shrink-0">
          <img
            src={venue.image_url}
            alt={venue.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold leading-tight truncate">{venue.title}</h3>
            {venue.venue_type_primary && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-foreground/90 whitespace-nowrap">
                {venue.venue_type_primary.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Age: {formatAgeRange(venue)}</span>
            <span>Price: {formatPriceLevel(venue.avg_price_level ?? null)}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
            {venue.music_type && <span>{venue.music_type}</span>}
            {venue.venue_stats?.crowd_level && (
              <span className="text-primary">{venue.venue_stats.crowd_level}</span>
            )}
            {venue.venue_stats?.wait_minutes != null && venue.venue_stats.wait_minutes > 0 && (
              <span>{venue.venue_stats.wait_minutes}m wait</span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      </div>
    </button>
  );
}
