/**
 * Venue preview body — shared between the mobile bottom sheet and the desktop
 * right-side panel. Prioritizes name, category, neighborhood, activity, price,
 * music, and the primary actions. Self-contained: owns its saved state so the
 * host only supplies the venue and a close handler.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { MapPin, X, ArrowLeft, ChevronDown, Bookmark, Flame, Star, CalendarClock } from "lucide-react";
import { Venue } from "@/data/types";
import { logEvent } from "@/lib/analytics";
import { useSavedStore } from "@/store/saved";
import { useAuthStore } from "@/store/auth";
import { hasMoreInfo } from "@/lib/venueTraits";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";
import VenueStatTiles from "@/components/VenueStatTiles";
import CheckInCard from "@/components/CheckInCard";
import DirectionsButton from "@/components/DirectionsButton";
import VenueQuickInfo from "@/components/VenueQuickInfo";
import ActivitySection from "@/components/ActivitySection";
import VenueMoreInfo from "@/components/VenueMoreInfo";
import TypicalNightChart from "@/components/TypicalNightChart";
import FriendsHereRow from "@/components/FriendsHereRow";
import PlansHereRow from "@/components/PlansHereRow";

export default function VenuePreview({
  venue,
  onClose,
  defaultExpanded = false,
  closeIcon = "close",
}: {
  venue: Venue;
  onClose: () => void;
  /** Desktop panel and the full page open expanded — they have the room, and
      on the page the user navigated here deliberately. */
  defaultExpanded?: boolean;
  /** The page reuses onClose as "go back", so the glyph has to follow. */
  closeIcon?: "close" | "back";
}) {
  const { ids: savedIds, toggle: toggleSaved } = useSavedStore();
  const saved = savedIds.includes(venue.id);
  const signedIn = useAuthStore((s) => s.status) === "signedIn";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [planOpen, setPlanOpen] = useState(false);
  const showMore = hasMoreInfo(venue);
  // The back glyph is currently synonymous with the standalone page — the two
  // sheet containers both close. Page gets top-left back (the app's convention
  // everywhere else) and an untruncated title, since it has the room.
  const isPage = closeIcon === "back";

  // One venue_open per venue surfaced — the single choke point for every open
  // path (map pin, search, list, Find-the-move pick, Social spotlight).
  useEffect(() => {
    logEvent("venue_open", { venue_id: venue.id, category: venue.category });
  }, [venue.id, venue.category]);

  // The sheet is not remounted when a different venue is selected (same JSX
  // position, no key), so the previous venue's expanded state would otherwise
  // carry over. Reset per venue so defaultExpanded actually governs each one.
  // useLayoutEffect, not useEffect: a passive effect lets one frame paint with
  // the new venue still expanded before collapsing.
  useLayoutEffect(() => {
    setExpanded(defaultExpanded);
  }, [venue.id, defaultExpanded]);

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
          className={cn(
            "absolute top-2 h-9 w-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center hover:bg-black/65 transition-colors",
            isPage ? "left-2" : "right-2",
          )}
          aria-label={isPage ? "Back" : "Close"}
        >
          {isPage ? (
            <ArrowLeft className="h-4 w-4 text-white" />
          ) : (
            <X className="h-4 w-4 text-white" />
          )}
        </button>
        {/* Badges shift clear of the back button when it takes the left slot. */}
        <div className={cn("absolute top-2 flex gap-1.5", isPage ? "left-14" : "left-2")}>
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
          <h2 className={cn("text-xl font-display font-bold leading-tight", !isPage && "truncate")}>{venue.title}</h2>
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

      {/* Activity sits above friends/plans: it answers "should I go", which is
          the question this card exists to settle. */}
      <ActivitySection venue={venue} />

      <FriendsHereRow venueId={venue.id} />

      <PlansHereRow venueId={venue.id} venueName={venue.title} />

      {/* Stats */}
      <div className="mt-3">
        <VenueStatTiles venue={venue} compact />
      </div>
      <CheckInCard venueId={venue.id} />

      {/* Actions. Making a plan is a peer of Directions, not something buried
          behind the More-info expander — it's the surface's social payoff and
          the only path that produces a shareable link. */}
      <div className={cn("mt-4 grid gap-2", signedIn ? "grid-cols-2" : "grid-cols-1")}>
        <DirectionsButton
          title={venue.title}
          venueId={venue.id}
          latitude={venue.latitude}
          longitude={venue.longitude}
          className="h-11 rounded-xl w-full"
        />
        {signedIn && (
          <Button
            variant="secondary"
            className="h-11 w-full rounded-xl"
            onClick={() => setPlanOpen(true)}
          >
            <CalendarClock className="h-4 w-4 mr-2" /> Make a plan
          </Button>
        )}
      </div>
      {signedIn && (
        <CreatePlanSheet
          open={planOpen}
          onOpenChange={setPlanOpen}
          initialVenueId={venue.id}
          surface="venue"
        />
      )}

      {/* Typical night sits above More info and outside it: the shape of the
          night is a glance question, not reference data. */}
      <TypicalNightChart venue={venue} />

      {/* The deeper layer, in place — this replaced a "View Details" button
          that navigated to /venue/:id and re-rendered most of this component.
          Hidden entirely when there is nothing behind it (hasMoreInfo). */}
      {showMore && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="w-full h-11 rounded-xl bg-secondary/60 hover:bg-secondary flex items-center justify-between px-4 text-sm font-medium transition-colors"
          >
            <span>{expanded ? "Less info" : "More info"}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
          {expanded && <VenueMoreInfo venue={venue} />}
        </div>
      )}
    </div>
  );
}
