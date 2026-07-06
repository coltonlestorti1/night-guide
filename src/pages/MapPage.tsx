/**
 * MapPage — investor-demo-ready East Village nightlife map.
 * Map tiles are free and keyless (MapLibre + OpenFreeMap), so the map
 * renders unconditionally — no token setup screen exists.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFilterStore } from "@/store/filters";
import { useSavedStore } from "@/store/saved";
import { useVenues } from "@/hooks/useVenues";
import { BBox, Venue, VenueCategory } from "@/data/types";
import Map from "@/components/Map";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, List, X, MapIcon, Search, Bookmark,
  Navigation as NavigationIcon, Flame, Star, Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import VenueStatTiles from "@/components/VenueStatTiles";
import CheckInCard from "@/components/CheckInCard";

const PRIMARY_FILTERS: { label: string; value: VenueCategory | "all" | "hot" | "music" }[] = [
  { label: "All", value: "all" },
  { label: "Bars", value: "bar" },
  { label: "Clubs", value: "club" },
  { label: "Lounges", value: "lounge" },
  { label: "Hot Tonight", value: "hot" },
  { label: "Music", value: "music" },
];

// Keep in sync with the music genres that actually exist in the venue data —
// a vibe chip with zero matches is a dead-end filter.
const MUSIC_VIBES = ["Rock", "Pop", "Jazz", "Indie", "Country", "Latin", "Mixed"];

/* ── Header ────────────────────────────────── */
const TopHeader = () => {
  const { search, set } = useFilterStore();
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-3 pt-3 pb-2 bg-gradient-to-b from-background via-background/95 to-background/0">
      <div className="mx-auto max-w-xl">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent">
              ENDZ
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">Find your night in the East Village</p>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search ?? ""}
            onChange={(e) => set({ search: e.target.value || undefined })}
            placeholder="Search bars, clubs, lounges…"
            className="pl-9 h-10 rounded-xl bg-card/80 backdrop-blur-xl border-border/60"
            aria-label="Search venues"
          />
        </div>
      </div>
    </div>
  );
};

/* ── Filter chips ──────────────────────────── */
const FilterChips = ({ count, hasFilters }: { count: number; hasFilters: boolean }) => {
  const { categories, crowdLevel, musicVibe, set, reset } = useFilterStore();
  const [musicOpen, setMusicOpen] = useState(false);

  const isActive = (v: string) => {
    if (v === "all") return categories.length === 0 && !crowdLevel && !musicVibe;
    if (v === "hot") return crowdLevel === "high";
    if (v === "music") return !!musicVibe;
    return categories.includes(v as VenueCategory);
  };

  const handle = (v: string) => {
    if (v === "all") return reset();
    if (v === "hot") return set({ crowdLevel: crowdLevel === "high" ? undefined : "high" });
    if (v === "music") return setMusicOpen((o) => !o);
    const cat = v as VenueCategory;
    set({ categories: categories.includes(cat) ? categories.filter((c) => c !== cat) : [...categories, cat] });
  };

  return (
    <div className="fixed top-[6.25rem] left-0 right-0 z-30 px-3">
      <div className="mx-auto max-w-xl">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {PRIMARY_FILTERS.map((f) => {
            const active = isActive(f.value);
            return (
              <button
                key={f.value}
                onClick={() => handle(f.value)}
                className={cn(
                  "shrink-0 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground border-transparent shadow-md shadow-primary/30"
                    : "bg-card/80 backdrop-blur-xl text-foreground border-border/60 hover:bg-secondary"
                )}
                aria-pressed={active}
              >
                {f.value === "hot" && "🔥 "}
                {f.value === "music" && "🎵 "}
                {f.label}
                {f.value === "music" && musicVibe ? `: ${musicVibe}` : ""}
              </button>
            );
          })}
        </div>

        {musicOpen && (
          <div className="mt-2 flex flex-wrap gap-2 p-2 rounded-2xl glass animate-fade-in">
            {MUSIC_VIBES.map((v) => (
              <button
                key={v}
                onClick={() => { set({ musicVibe: musicVibe === v ? undefined : v }); }}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border transition-colors",
                  musicVibe === v ? "bg-primary text-primary-foreground border-transparent" : "bg-secondary border-border"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{count}</span> spots found
          </span>
          {hasFilters && (
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
  const { ids: savedIds, toggle: toggleSaved } = useSavedStore();
  const [bbox, setBbox] = useState<BBox | undefined>(undefined);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [view, setView] = useState<"map" | "list">("map");

  const hasFilters =
    filters.categories.length > 0 || !!filters.crowdLevel || !!filters.musicVibe || !!filters.search;

  const baseQuery = {
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    crowdLevel: filters.crowdLevel,
    musicVibe: filters.musicVibe,
    search: filters.search,
  };

  const { data, isLoading, isError, refetch } = useVenues({
    ...baseQuery,
    bbox: view === "map" ? bbox : undefined,
  });

  const venues = data ?? [];
  const selectedSaved = selected ? savedIds.includes(selected.id) : false;

  const openDirections = (v: Venue) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.latitude},${v.longitude}`, "_blank");
  };

  return (
    <section aria-labelledby="map-heading" className="relative">
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map — East Village</h1>

      <TopHeader />
      <FilterChips count={venues.length} hasFilters={hasFilters} />

      {/* Map / List toggle — sits clearly above the bottom navigation */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40"
        style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex rounded-full glass shadow-xl overflow-hidden">
          <button
            onClick={() => setView("map")}
            className={cn(
              "px-5 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors",
              view === "map" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
            )}
          >
            <MapIcon className="h-4 w-4" /> Map
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "px-5 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors",
              view === "list" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
            )}
          >
            <List className="h-4 w-4" /> List
          </button>
        </div>
      </div>

      {view === "map" ? (
        <div className="w-full h-[calc(100vh-5rem)]">
          <Map
            venues={venues}
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
          ) : venues.length > 0 ? (
            <div className="space-y-3 animate-fade-in">
              {venues.map((v) => (
                <BarCard key={v.id} venue={v} onClick={() => setSelected(v)} />
              ))}
            </div>
          ) : (
            <div className="text-center glass rounded-2xl p-8 animate-fade-in">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">No spots match your filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try clearing a filter to see more places.</p>
              {hasFilters && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => filters.reset()}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom sheet — venue preview */}
      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="bg-card border-border">
          {selected && (
            <div className="px-4 pt-2 pb-6 max-w-lg mx-auto w-full animate-fade-in">
              {/* Hero image */}
              <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-4 bg-secondary">
                <img
                  src={selected.image_url || ""}
                  alt={selected.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = "none";
                    (t.parentElement as HTMLElement).style.background =
                      "linear-gradient(135deg, hsl(var(--primary)/0.4), hsl(var(--accent)/0.2))";
                  }}
                />
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {selected.hot_tonight && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                      <Flame className="h-3 w-3" /> Hot Tonight
                    </span>
                  )}
                  {selected.editors_pick && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-black">
                      <Star className="h-3 w-3" /> Editor's Pick
                    </span>
                  )}
                </div>
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight truncate">{selected.title}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-white",
                      selected.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
                      : selected.category === "club" ? "bg-[hsl(var(--venue-club))]"
                      : "bg-[hsl(var(--venue-lounge))]"
                    )}>{selected.category}</span>
                    {selected.neighborhood && (
                      <span className="text-xs text-muted-foreground">📍 {selected.neighborhood}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleSaved(selected.id)}
                  className="shrink-0 h-10 w-10 rounded-full bg-secondary hover:bg-secondary/70 flex items-center justify-center transition-colors"
                  aria-label={selectedSaved ? "Unsave" : "Save"}
                >
                  <Bookmark className={cn("h-5 w-5", selectedSaved ? "fill-primary text-primary" : "text-foreground")} />
                </button>
              </div>

              {/* Stats */}
              <div className="mt-3">
                <VenueStatTiles venue={selected} compact />
              </div>
              <CheckInCard venueId={selected.id} />

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="secondary" className="h-11 rounded-xl" onClick={() => openDirections(selected)}>
                  <NavigationIcon className="h-4 w-4 mr-2" /> Directions
                </Button>
                <Button className="h-11 rounded-xl" onClick={() => navigate(`/venue/${selected.id}`)}>
                  View Details
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default MapPage;
