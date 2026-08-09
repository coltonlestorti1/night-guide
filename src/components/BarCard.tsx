import { useState } from "react";
import { ChevronRight, Bookmark, Flame, Star, Building2, Trees } from "lucide-react";
import { hasOutdoorSeating, hasRooftop, outdoorKind } from "@/lib/venueTraits";
import { Venue } from "@/data/types";
import { useSaves, useFriendSaves } from "@/hooks/useSaves";
import FriendSavesRow from "@/components/FriendSavesRow";
import { useVenueActivity } from "@/hooks/useCheckIns";
import { getEnrichment, computeOpenState } from "@/data/enrichment";
import { useLocationStore } from "@/store/location";
import { haversineMiles, formatMiles } from "@/lib/distance";
import { PLACEHOLDER, venueImageSrc, hasRealPhoto } from "@/lib/venueImages";
import { cn } from "@/lib/utils";
import PhotoLightbox from "@/components/PhotoLightbox";

const crowdLabel: Record<string, string> = { low: "Chill", medium: "Lively", high: "Packed" };
const crowdDot: Record<string, string> = { low: "bg-emerald-400", medium: "bg-amber-400", high: "bg-rose-500" };

export default function BarCard({ venue, onClick }: { venue: Venue; onClick?: () => void }) {
  const imgSrc = venueImageSrc(venue);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const { ids, toggle } = useSaves();
  const saved = ids.includes(venue.id);
  const { data: friendSaves } = useFriendSaves();
  const { data: activity } = useVenueActivity();
  const hereCount = activity?.[venue.id]?.count ?? 0;
  const enrichment = getEnrichment(venue.title);
  const openState = computeOpenState(enrichment?.hours);
  const coords = useLocationStore((s) => s.coords);
  const distance =
    coords && venue.latitude != null && venue.longitude != null
      ? formatMiles(haversineMiles(coords, { lat: venue.latitude, lng: venue.longitude }))
      : null;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
      className="group w-full text-left rounded-2xl glass hover:bg-accent/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden flex items-stretch cursor-pointer"
      aria-label={`${venue.title} details`}
    >
      <div className="relative w-28 h-28 flex-shrink-0 bg-secondary">
        {hasRealPhoto(venue) ? (
          <button
            type="button"
            onClick={(e) => {
              // Without this the tap bubbles to the card root and opens the
              // venue instead of the photo.
              e.stopPropagation();
              setLightboxUrl(venue.image_url!);
            }}
            className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`View photo of ${venue.title}`}
          >
            <img
              src={imgSrc}
              alt={venue.title}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar; }}
            />
          </button>
        ) : (
          <img
            src={imgSrc}
            alt={venue.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar; }}
          />
        )}
        {venue.hot_tonight && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-500/95 text-white shadow">
            <Flame className="h-3 w-3" /> Hot
          </span>
        )}
        {venue.editors_pick && !venue.hot_tonight && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-400/95 text-black shadow">
            <Star className="h-3 w-3" /> Pick
          </span>
        )}
      </div>
      <div className="flex-1 p-3 flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-tight truncate">{venue.title}</h3>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white uppercase tracking-wide",
              venue.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
              : venue.category === "club" ? "bg-[hsl(var(--venue-club))]"
              : "bg-[hsl(var(--venue-lounge))]"
            )}>
              {venue.category}
            </span>
          </div>
          {venue.neighborhood && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">📍 {venue.neighborhood}</p>
          )}
          <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {openState && (
              <span className={openState.open ? "text-emerald-700 font-medium" : undefined}>
                ● {openState.open
                  ? `Open${openState.closesAt ? ` til ${openState.closesAt}` : ""}`
                  : `Closed${openState.opensAt ? ` · Opens ${openState.opensAt}` : ""}`}
              </span>
            )}
            {enrichment?.rating != null && <span>★ {enrichment.rating.toFixed(1)}</span>}
            {distance && <span className="text-primary/90 font-medium">📍 {distance}</span>}
            {hereCount > 0 && (
              <span className="text-primary font-semibold">{hereCount} here now</span>
            )}
            {venue.music_type && <span className="truncate">🎵 {venue.music_type}</span>}
            {/* Separate signals, separate labels — a roof is not a backyard. */}
            {hasRooftop(venue) && (
              <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> Rooftop</span>
            )}
            {hasOutdoorSeating(venue) && (
              <span className="inline-flex items-center gap-1"><Trees className="h-3 w-3" /> {outdoorKind(venue) ?? "Outdoor"}</span>
            )}
            {venue.venue_stats?.crowd_level && (
              <span className="inline-flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", crowdDot[venue.venue_stats.crowd_level])} />
                {crowdLabel[venue.venue_stats.crowd_level]}
              </span>
            )}
          </div>
          <FriendSavesRow friends={friendSaves?.[venue.id]} />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggle(venue.id); }}
          className="p-2 rounded-full hover:bg-accent/30 transition-colors"
          aria-label={saved ? "Unsave venue" : "Save venue"}
        >
          <Bookmark className={cn("h-4 w-4 transition-colors", saved ? "fill-primary text-primary" : "text-muted-foreground")} />
        </button>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      </div>
      <PhotoLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        alt={venue.title}
      />
    </div>
  );
}
