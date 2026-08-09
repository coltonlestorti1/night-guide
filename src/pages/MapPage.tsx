/**
 * MapPage — investor-demo-ready East Village nightlife map.
 * Map tiles are free and keyless (MapLibre + OpenFreeMap), so the map
 * renders unconditionally — no token setup screen exists.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFilterStore, activeFilterCount } from "@/store/filters";
import { useVenueHeat } from "@/hooks/useVenueHeat";
import { useSaves } from "@/hooks/useSaves";
import { useVenues } from "@/hooks/useVenues";
import { useVenueActivity } from "@/hooks/useCheckIns";
import { useFriendsOutTonight } from "@/hooks/useFriends";
import { usePlansOnMap } from "@/hooks/usePlans";
import type { PinFriend } from "@/components/Map";
import { BBox, Venue, VenueCategory } from "@/data/types";
import Map from "@/components/Map";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  List, X, MapIcon, Search, Flame, Sparkles, Wine, Bookmark, Clock, SlidersHorizontal
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import VibeFinder from "@/components/VibeFinder";
import FiltersSheet from "@/components/FiltersSheet";
import VenuePreview from "@/components/VenuePreview";
import OutTonightToggle from "@/components/OutTonightToggle";
import OutTonightPrompt from "@/components/OutTonightPrompt";
import { useOutTonightWatcher } from "@/store/outTonight";
import { useIsMobile } from "@/hooks/use-mobile";
import { venueMatches } from "@/lib/searchMatch";
import { hasOutdoorSeating, hasRooftop } from "@/lib/venueTraits";
import { getEnrichment, computeOpenState, getHappyHourState } from "@/data/enrichment";
import { useMinuteTick } from "@/hooks/useMinuteTick";

const PRIMARY_FILTERS: { label: string; value: "all" | "happy-hour" | "saved" | "open-now" | "hot" | "vibe-finder"; Icon?: React.ComponentType<{ className?: string }> }[] = [
  { label: "Find the move", value: "vibe-finder", Icon: Sparkles },
  { label: "All", value: "all" },
  { label: "Open now", value: "open-now", Icon: Clock },
  { label: "Happy hour", value: "happy-hour", Icon: Wine },
  { label: "Saved", value: "saved", Icon: Bookmark },
  // Hot Tonight renders only when live check-ins actually make a venue hot —
  // it used to compare against venue_stats, which nothing populates, so it
  // emptied the map every time.
  { label: "Hot Tonight", value: "hot", Icon: Flame },
];


/* ── Header ────────────────────────────────── */
const TopHeader = ({ venues, onPick }: { venues: Venue[]; onPick: (v: Venue) => void }) => {
  const { search, set } = useFilterStore();
  const [focused, setFocused] = useState(false);
  const query = search ?? "";
  const results = focused && query.trim().length >= 2
    ? venues.filter((v) => venueMatches(v, query)).slice(0, 6)
    : [];

  const pick = (v: Venue) => {
    setFocused(false);
    onPick(v);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-3 pt-3 pb-2 lg:pl-24 bg-gradient-to-b from-background via-background/90 to-background/0">
      <div className="mx-auto max-w-xl lg:mx-0 lg:max-w-sm">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-primary">
              ENDZ
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Find your night in the East Village</p>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => set({ search: e.target.value || undefined })}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) pick(results[0]);
              if (e.key === "Escape") setFocused(false);
            }}
            placeholder="Search spots — bars, clubs, lounges…"
            className="pl-9 h-10 rounded-xl bg-card/80 backdrop-blur-xl border-border/60 transition-shadow focus-visible:shadow-glow focus-visible:border-primary/50"
            aria-label="Search venues"
            role="combobox"
            aria-expanded={results.length > 0}
          />
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl glass shadow-float overflow-hidden z-50 animate-fade-in" role="listbox">
              {results.map((v) => (
                <button
                  key={v.id}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => { e.preventDefault(); pick(v); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/15 flex items-center gap-2 border-b border-border/40 last:border-0"
                >
                  <span className="font-medium text-sm truncate">{v.title}</span>
                  <span className={cn(
                    "shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide text-white",
                    v.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
                    : v.category === "club" ? "bg-[hsl(var(--venue-club))]"
                    : "bg-[hsl(var(--venue-lounge))]"
                  )}>{v.category}</span>
                  <span className="ml-auto shrink-0"><QuickInfoInline venue={v} /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** One-line open/rating summary for dropdown rows; nothing without data. */
const QuickInfoInline = ({ venue }: { venue: Venue }) => {
  const e = getEnrichment(venue.title);
  if (!e) return null;
  const state = computeOpenState(e.hours);
  return (
    <span className="text-[11px] text-muted-foreground">
      {state && (
        <span className={state.open ? "text-emerald-700" : "text-rose-600"}>
          {state.open ? "Open" : "Closed"}
        </span>
      )}
      {state && !state.open && state.opensAt && <> · Opens {state.opensAt}</>}
      {state && e.rating != null && " · "}
      {e.rating != null && `★ ${e.rating.toFixed(1)}`}
    </span>
  );
};

/* ── Filter chips ──────────────────────────── */
/**
 * Four decisions you'd make standing on a corner, plus Find the move and a
 * Filters button. Everything else moved into FiltersSheet (§27) — the row had
 * reached 11 chips with only ~4 visible on a phone.
 */
const FilterChips = ({
  count,
  onVibeFinder,
  onOpenFilters,
  showHot,
  filterCount,
}: {
  count: number;
  onVibeFinder: () => void;
  onOpenFilters: () => void;
  showHot: boolean;
  filterCount: number;
}) => {
  const f = useFilterStore();
  const { set, reset } = f;

  const chips = PRIMARY_FILTERS.filter((c) => c.value !== "hot" || showHot);

  const isActive = (v: string) => {
    if (v === "all") return filterCount === 0;
    if (v === "vibe-finder") return false;
    if (v === "happy-hour") return f.happyHour;
    if (v === "saved") return f.saved;
    if (v === "open-now") return f.openNow;
    if (v === "hot") return f.hot;
    return false;
  };

  const handle = (v: string) => {
    if (v === "vibe-finder") return onVibeFinder();
    if (v === "all") return reset();
    if (v === "happy-hour") return set({ happyHour: !f.happyHour });
    if (v === "saved") return set({ saved: !f.saved });
    if (v === "open-now") return set({ openNow: !f.openNow });
    if (v === "hot") return set({ hot: !f.hot });
  };

  return (
    <div className="fixed top-[6.25rem] left-0 right-0 z-30 px-3 lg:pl-24">
      <div className="mx-auto max-w-xl lg:mx-0 lg:max-w-sm">
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
          style={{
            maskImage: "linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)",
          }}
        >
          {chips.map((c) => {
            const active = isActive(c.value);
            return (
              <button
                key={c.value}
                onClick={() => handle(c.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground border-transparent shadow-glow"
                    : "bg-card/80 backdrop-blur-xl text-foreground border-border/60 hover:bg-secondary"
                )}
                aria-pressed={active}
              >
                {c.Icon && <c.Icon className="h-4 w-4" />}
                {c.label}
              </button>
            );
          })}

          <button
            onClick={onOpenFilters}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
              filterCount > 0
                ? "bg-primary text-primary-foreground border-transparent shadow-glow"
                : "bg-card/80 backdrop-blur-xl text-foreground border-border/60 hover:bg-secondary"
            )}
            aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {filterCount > 0 && (
              <span className="ml-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-background/25 text-[11px] font-semibold inline-flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{count}</span> spots found
          </span>
          {(filterCount > 0 || f.search) && (
            <button onClick={reset} className="text-xs text-primary flex items-center gap-1 hover:underline">
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main page ─────────────────────────────── */
const MapPage = () => {
  const navigate = useNavigate();
  const filters = useFilterStore();
  const isMobile = useIsMobile();
  const [bbox, setBbox] = useState<BBox | undefined>(undefined);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [vibeOpen, setVibeOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const savedIds = useSaves().ids;

  const filterCount = activeFilterCount(filters);

  const baseQuery = {
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    musicVibe: filters.musicVibe,
    search: filters.search,
    priceMax: filters.priceMax,
  };

  const { data, isLoading, isError, refetch } = useVenues({
    ...baseQuery,
    bbox: view === "map" ? bbox : undefined,
  });
  // Find the move scores the full venue set — never the search/filter subset.
  const { data: allVenues } = useVenues({});

  // Out-tonight mode watches location against the full active venue set (stable ref).
  const outTonightVenues = useMemo(() => allVenues ?? [], [allVenues]);
  useOutTonightWatcher(outTonightVenues);

  const venues = data ?? [];

  const location = useLocation();

  // Social's "out tonight" rows land here with a venue to spotlight.
  // Selecting it reuses the search-pick path (Map flies to selectedId).
  // allVenues, not the bbox-filtered set: the target may be off-viewport.
  useEffect(() => {
    const venueId = (location.state as { venueId?: string } | null)?.venueId;
    if (!venueId || !allVenues) return;
    const v = allVenues.find((x) => x.id === venueId);
    if (v) setSelected(v);
    navigate(".", { replace: true, state: null }); // consume the state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, allVenues]);

  const tick = useMinuteTick();
  // Venue ids whose happy hour is running right now; refreshed each minute.
  const hhActiveIds = useMemo(() => {
    void tick;
    const ids = new Set<string>();
    for (const v of venues) {
      if (getHappyHourState(getEnrichment(v.title)?.happyHour).status === "active") ids.add(v.id);
    }
    return ids;
  }, [venues, tick]);

  // 🥂 chip narrows to active happy hours; 🔖 Saved chip narrows to bookmarked
  // venues. Both stack (AND) and are client-side (saved ids live on-device).
  const { data: activityData } = useVenueActivity();

  // Friends checked in, grouped by venue — feeds avatar faces onto pins, and
  // weights their venues' heat (a friend counts for more than a stranger).
  // useFriendsOutTonight is already RLS-filtered (ghost mode, visibility,
  // non-friends excluded), so this exposes nothing the venue sheet doesn't.
  const { data: friendsOut } = useFriendsOutTonight();
  const friendsByVenue = useMemo(() => {
    if (!friendsOut || friendsOut.length === 0) return undefined;
    const map: Record<string, PinFriend[]> = {};
    for (const f of friendsOut) {
      (map[f.venueId] ??= []).push({
        id: f.profile.id,
        name: f.profile.display_name || f.profile.username,
        avatarUrl: f.profile.avatar_url,
      });
    }
    return map;
  }, [friendsOut]);

  // Heat drives pin tiers; activityData still drives the headcount badge.
  const venueHeat = useVenueHeat(venues, friendsByVenue);

  // Hot now means the heat engine says so, not a bare check-in count — which
  // never fired before there were users, leaving the chip permanently hidden.
  const hotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [venueId, h] of Object.entries(venueHeat)) {
      if (h.label === "Hot Now") ids.add(venueId);
    }
    return ids;
  }, [venueHeat]);
  // Hidden entirely when nothing is hot — never offer a filter that empties the map.
  const showHot = hotIds.size > 0;

  let displayVenues = venues;
  if (filters.happyHour) displayVenues = displayVenues.filter((v) => hhActiveIds.has(v.id));
  if (filters.saved) displayVenues = displayVenues.filter((v) => savedIds.includes(v.id));
  if (filters.rooftop) displayVenues = displayVenues.filter((v) => hasRooftop(v));
  if (filters.outdoor) displayVenues = displayVenues.filter((v) => hasOutdoorSeating(v));
  if (filters.openNow) {
    displayVenues = displayVenues.filter(
      (v) => computeOpenState(getEnrichment(v.title)?.hours)?.open === true,
    );
  }
  if (filters.hot) displayVenues = displayVenues.filter((v) => hotIds.has(v.id));

  // Memoized: a new object reference here rebuilds every map marker via
  // addMarkers' dependency array — only do that when activity actually changes.
  const activityCounts = useMemo(
    () =>
      activityData
        ? Object.fromEntries(Object.entries(activityData).map(([id, a]) => [id, a.count]))
        : undefined,
    [activityData]
  );

  // Opted-in plans (mine + friends'), grouped by venue → the distinct planning
  // badge. plans_on_map is RLS/ghost-filtered server-side; count = plans here,
  // goingCount = total people going across them (the headcount on the badge).
  const { data: plansOnMap } = usePlansOnMap();
  const plansByVenue = useMemo(() => {
    if (!plansOnMap || plansOnMap.length === 0) return undefined;
    const map: Record<string, { count: number; goingCount: number }> = {};
    for (const p of plansOnMap) {
      const e = (map[p.venueId] ??= { count: 0, goingCount: 0 });
      e.count += 1;
      e.goingCount += p.goingCount;
    }
    return map;
  }, [plansOnMap]);

  return (
    <section aria-labelledby="map-heading" className="relative">
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map — East Village</h1>

      <TopHeader venues={venues} onPick={(v) => setSelected(v)} />
      <FilterChips
        count={displayVenues.length}
        onVibeFinder={() => setVibeOpen(true)}
        onOpenFilters={() => setFiltersOpen(true)}
        showHot={showHot}
        filterCount={filterCount}
      />
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        venues={allVenues ?? venues}
        resultCount={displayVenues.length}
      />
      <VibeFinder
        open={vibeOpen}
        onOpenChange={setVibeOpen}
        venues={allVenues ?? venues}
        activity={activityData}
        onPick={(v) => setSelected(v)}
      />

      {/* "I'm out tonight" control — stacked above the Map/List toggle.
          --endz-update-banner-h is 0px unless the build-update banner is
          showing, in which case the whole stack rides up by its height. */}
      <div className="fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(148px_+_var(--endz-update-banner-h)_+_env(safe-area-inset-bottom))] lg:bottom-[calc(4.75rem_+_var(--endz-update-banner-h))]">
        <OutTonightToggle />
      </div>

      {/* Out-tonight check-in prompt (renders only when a venue is detected) */}
      <OutTonightPrompt />

      {/* Map / List toggle — above the mobile bottom nav; lower on desktop where the nav is a side rail */}
      <div className="fixed left-1/2 -translate-x-1/2 z-40 bottom-[calc(96px_+_var(--endz-update-banner-h)_+_env(safe-area-inset-bottom))] lg:bottom-[calc(1.5rem_+_var(--endz-update-banner-h))]">
        <div className="relative flex rounded-full glass shadow-float overflow-hidden p-1">
          <span
            className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-200 ease-out"
            style={{ transform: view === "map" ? "translateX(0)" : "translateX(100%)" }}
            aria-hidden="true"
          />
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "relative z-10 px-5 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors",
                view === v ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {v === "map" ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}
              {v === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <div className="w-full h-[calc(100vh-5rem)]">
          <Map
            venues={displayVenues}
            activity={activityCounts}
            heat={venueHeat}
            happyHour={hhActiveIds}
            friendsByVenue={friendsByVenue}
            plansByVenue={plansByVenue}
            selectedId={selected?.id}
            onSelect={(id) => {
              const v = venues.find((x) => x.id === id) || null;
              setSelected(v);
            }}
            onViewportChanged={(b) => setBbox(b)}
          />
        </div>
      ) : (
        /* List view */
        <div className="pt-44 px-4 max-w-lg mx-auto" style={{ paddingBottom: "calc(170px + env(safe-area-inset-bottom))" }}>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
          ) : isError ? (
            <div className="text-center glass rounded-2xl p-6">
              <p className="text-sm text-muted-foreground">Unable to load venues.</p>
              <button className="underline mt-2 text-primary" onClick={() => refetch()}>Retry</button>
            </div>
          ) : displayVenues.length > 0 ? (
            <div className="space-y-3 animate-fade-in">
              {displayVenues.map((v) => (
                <BarCard key={v.id} venue={v} onClick={() => setSelected(v)} />
              ))}
            </div>
          ) : filters.saved && savedIds.length === 0 ? (
            <div className="text-center glass rounded-2xl p-8 animate-fade-in">
              <Bookmark className="h-7 w-7 mx-auto text-primary" />
              <p className="font-medium mt-2">No saved spots yet</p>
              <p className="text-sm text-muted-foreground mt-1">Tap the bookmark on any venue to add it here.</p>
            </div>
          ) : filters.happyHour ? (
            <div className="text-center glass rounded-2xl p-8 animate-fade-in">
              <Wine className="h-7 w-7 mx-auto text-amber-500" />
              <p className="font-medium mt-2">No happy hours running</p>
              <p className="text-sm text-muted-foreground mt-1">Most kick off around 4 PM.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate("/discover")}>
                See the week's happy hours →
              </Button>
            </div>
          ) : (
            <div className="text-center glass rounded-2xl p-8 animate-fade-in">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">No spots match your filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try clearing a filter to see more places.</p>
              {filterCount > 0 && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => filters.reset()}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Venue preview — bottom sheet on mobile, right-side panel on tablet/desktop */}
      {isMobile ? (
        <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          {/* max-h + an inner scroll region: DrawerContent is h-auto with no
              overflow, so an expanded card would otherwise clip off the top of
              the screen with no way to reach it. svh (not vh) so mobile browser
              chrome doesn't eat the bottom action row. The grabber handle lives
              in DrawerContent above this div, so it stays pinned while the body
              scrolls — and keeps its single meaning, drag down to dismiss. */}
          {/* [&>div:first-child]:shrink-0 pins the grabber handle. DrawerContent
              is a flex column, so once max-h binds, the negative free space is
              shared across BOTH children — min-h-0 lets the body shrink but
              does nothing for the handle, which thinned 8px -> 4.5px the moment
              a user expanded the card, degrading the only visible dismiss
              affordance exactly when the sheet is tallest. */}
          <DrawerContent className="bg-card border-border max-h-[85svh] [&>div:first-child]:shrink-0">
            <DrawerTitle className="sr-only">{selected?.title ?? "Venue details"}</DrawerTitle>
            <DrawerDescription className="sr-only">Venue activity, hours, and actions.</DrawerDescription>
            {selected && (
              <div className="max-w-lg mx-auto w-full min-h-0 overflow-y-auto">
                {/* Deliberately NOT defaultExpanded — the mobile sheet opens
                    collapsed so tapping a pin stays a glance. Only the desktop
                    panel and the standalone page open expanded. */}
                <VenuePreview venue={selected} onClose={() => setSelected(null)} />
              </div>
            )}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-md p-0 overflow-y-auto bg-card [&>button]:hidden"
          >
            <SheetTitle className="sr-only">{selected?.title ?? "Venue details"}</SheetTitle>
            <SheetDescription className="sr-only">Venue activity, hours, and actions.</SheetDescription>
            {selected && (
              <div className="pt-4">
                <VenuePreview venue={selected} onClose={() => setSelected(null)} defaultExpanded />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
};

export default MapPage;
