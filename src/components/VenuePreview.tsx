/**
 * Venue preview body — shared between the mobile bottom sheet and the desktop
 * right-side panel. Prioritizes name, category, neighborhood, activity, price,
 * music, and the primary actions. Self-contained: owns its saved state so the
 * host only supplies the venue and a close handler.
 */
import { useNavigate } from "react-router-dom";
import { MapPin, X, Bookmark, Flame, Star } from "lucide-react";
import { Venue } from "@/data/types";
import { useSavedStore } from "@/store/saved";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import VenueStatTiles from "@/components/VenueStatTiles";
import CheckInCard from "@/components/CheckInCard";
import DirectionsButton from "@/components/DirectionsButton";
import VenueQuickInfo from "@/components/VenueQuickInfo";
import FriendsHereRow from "@/components/FriendsHereRow";

export default function VenuePreview({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const navigate = useNavigate();
  const { ids: savedIds, toggle: toggleSaved } = useSavedStore();
  const saved = savedIds.includes(venue.id);

  return (
    <div className="px-4 pt-2 pb-6 w-full animate-slide-up">
      {/* Hero image */}
      <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-4 bg-secondary">
        <img
          src={venue.image_url || ""}
          alt={venue.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const t = e.target as HTMLImageElement;
            t.style.display = "none";
            (t.parentElement as HTMLElement).style.background =
              "linear-gradient(135deg, hsl(var(--primary)/0.25), hsl(var(--primary-soft)))";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center hover:bg-black/65 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-white" />
        </button>
        <div className="absolute top-2 left-2 flex gap-1.5">
          {venue.hot_tonight && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--hot))] text-white shadow-sm">
              <Flame className="h-3 w-3" /> Hot Tonight
            </span>
          )}
          {venue.editors_pick && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-[#121212] shadow-sm">
              <Star className="h-3 w-3" /> Editor's Pick
            </span>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h2 className="text-xl font-display font-bold leading-tight truncate">{venue.title}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-white",
              venue.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
              : venue.category === "club" ? "bg-[hsl(var(--venue-club))]"
              : "bg-[hsl(var(--venue-lounge))]"
            )}>{venue.category}</span>
            {venue.neighborhood && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {venue.neighborhood}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => toggleSaved(venue.id)}
          className="shrink-0 h-11 w-11 rounded-full bg-secondary hover:bg-primary-soft flex items-center justify-center transition-colors"
          aria-label={saved ? "Unsave" : "Save"}
        >
          <Bookmark className={cn("h-5 w-5", saved ? "fill-primary text-primary" : "text-foreground")} />
        </button>
      </div>

      <VenueQuickInfo venue={venue} />

      <FriendsHereRow venueId={venue.id} />

      {/* Stats */}
      <div className="mt-3">
        <VenueStatTiles venue={venue} compact />
      </div>
      <CheckInCard venueId={venue.id} />

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <DirectionsButton
          latitude={venue.latitude}
          longitude={venue.longitude}
          className="h-11 rounded-xl w-full"
        />
        <Button className="h-11 rounded-xl" onClick={() => navigate(`/venue/${venue.id}`)}>
          View Details
        </Button>
      </div>
    </div>
  );
}
