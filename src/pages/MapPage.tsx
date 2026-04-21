/**
 * MapPage — investor-demo-ready Lisbon nightlife map with filters,
 * map/list toggle, results counter, clear filters, and bottom sheet.
 *
 * MAPBOX_TOKEN: Provide via the Profile tab or set VITE_MAPBOX_TOKEN env var.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useConfigStore } from "@/store/config";
import { useFilterStore } from "@/store/filters";
import { useVenues } from "@/hooks/useVenues";
import { BBox, Venue, VenueCategory } from "@/data/types";
import Map from "@/components/Map";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, List, X, MapIcon, KeyRound, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CATEGORIES: { label: string; value: VenueCategory; color: string }[] = [
  { label: "Bar", value: "bar", color: "bg-[hsl(var(--venue-bar))]" },
  { label: "Club", value: "club", color: "bg-[hsl(var(--venue-club))]" },
  { label: "Lounge", value: "lounge", color: "bg-[hsl(var(--venue-lounge))]" },
];

const MUSIC_VIBES = ["Techno", "House", "Jazz", "Fado", "Indie", "Ambient", "Pop"];

/* ── Filter bar ─────────────────────────────── */
const FilterChips = ({ count, hasFilters }: { count: number; hasFilters: boolean }) => {
  const { categories, crowdLevel, musicVibe, set, reset } = useFilterStore();

  const toggleCategory = (cat: VenueCategory) => {
    const next = categories.includes(cat) ? categories.filter((c) => c !== cat) : [...categories, cat];
    set({ categories: next });
  };

  return (
    <div className="fixed top-3 left-0 right-0 z-40 px-3">
      <div className="mx-auto max-w-xl flex flex-wrap items-center gap-2 p-2 rounded-2xl glass animate-fade-in">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              categories.includes(c.value)
                ? `${c.color} text-white border-transparent`
                : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            }`}
            onClick={() => toggleCategory(c.value)}
            aria-pressed={categories.includes(c.value)}
          >
            {c.label}
          </button>
        ))}

        <div className="w-px bg-border/50 self-stretch" />

        <button
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            crowdLevel === "high"
              ? "bg-primary text-primary-foreground border-transparent"
              : "bg-secondary text-foreground border-border hover:bg-secondary/80"
          }`}
          onClick={() => set({ crowdLevel: crowdLevel === "high" ? undefined : "high" })}
          aria-pressed={crowdLevel === "high"}
        >
          🔥 Busy
        </button>

        <select
          value={musicVibe ?? ""}
          onChange={(e) => set({ musicVibe: e.target.value || undefined })}
          className="text-sm px-3 py-1.5 rounded-full border bg-secondary text-foreground border-border appearance-none cursor-pointer"
        >
          <option value="">🎵 All Music</option>
          {MUSIC_VIBES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* results counter + clear */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{count} spots</span>
          {hasFilters && (
            <button onClick={reset} className="text-xs text-primary flex items-center gap-0.5 hover:underline" aria-label="Clear filters">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── No-token fallback with inline token input ──────────────────────── */
const NoTokenFallback = () => {
  const { setConfig } = useConfigStore();
  const [token, setToken] = useState("");

  const save = () => {
    const trimmed = token.trim();
    if (!trimmed.startsWith("pk.")) {
      toast.error("Invalid token — Mapbox public tokens start with 'pk.'");
      return;
    }
    setConfig({ mapboxToken: trimmed });
    toast.success("Mapbox token saved — loading map…");
  };

  return (
    <div className="w-full min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 pt-20 pb-32">
      <div className="w-full max-w-md glass rounded-2xl p-6 animate-fade-in">
        <div className="flex flex-col items-center text-center mb-5">
          <div className="p-3 rounded-full bg-primary/10 mb-3">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Connect Mapbox</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Paste your Mapbox public token below to load the live interactive map of Lisbon.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            type="password"
            placeholder="pk.eyJ1Ijoi..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            autoFocus
          />
          <Button onClick={save} className="w-full">
            Load Map
          </Button>
          <a
            href="https://account.mapbox.com/access-tokens/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Get a free token at mapbox.com <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center mt-4">
          Stored locally in your browser. You can also manage it in the Profile tab.
        </p>
      </div>
    </div>
  );
};

/* ── Loading skeleton ───────────────────────── */
const MapSkeleton = () => (
  <div className="w-full h-[calc(100vh-5rem)] relative">
    <Skeleton className="w-full h-full rounded-none" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center animate-pulse">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    </div>
  </div>
);

/* ── Main page ──────────────────────────────── */
const MapPage = () => {
  const navigate = useNavigate();
  const { mapboxToken } = useConfigStore();
  const filters = useFilterStore();
  const [bbox, setBbox] = useState<BBox | undefined>(undefined);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [mapReady, setMapReady] = useState(false);

  const hasFilters = filters.categories.length > 0 || !!filters.crowdLevel || !!filters.musicVibe;

  const { data, isLoading, isError, refetch } = useVenues({
    bbox: view === "map" ? bbox : undefined, // in list view show all
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    crowdLevel: filters.crowdLevel,
    musicVibe: filters.musicVibe,
  });

  const venues = data ?? [];

  return (
    <section aria-labelledby="map-heading" className="relative">
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map — Lisbon</h1>

      <FilterChips count={venues.length} hasFilters={hasFilters} />

      {/* Map / List toggle */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
        <div className="flex rounded-full glass shadow-lg overflow-hidden">
          <button
            onClick={() => setView("map")}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
              view === "map" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
            }`}
          >
            <MapIcon className="h-4 w-4" /> Map
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
              view === "list" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
            }`}
          >
            <List className="h-4 w-4" /> List
          </button>
        </div>
      </div>

      {view === "map" ? (
        <>
          {!mapboxToken ? (
            <NoTokenFallback />
          ) : (
            <div className="w-full h-[calc(100vh-5rem)]">
              <Map
                accessToken={mapboxToken}
                venues={venues}
                selectedId={selected?.id}
                onSelect={(id) => {
                  const v = venues.find((x) => x.id === id) || null;
                  setSelected(v);
                }}
                onViewportChanged={(b) => {
                  setBbox(b);
                  if (!mapReady) setMapReady(true);
                }}
              />
            </div>
          )}

          {/* Bottom venue preview cards (map view) */}
          <div className="absolute bottom-28 left-0 right-0 px-4 z-30">
            <div className="mx-auto max-w-md">
              {isLoading ? (
                <div className="space-y-3 animate-fade-in">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : isError ? (
                <div className="text-center glass rounded-xl p-4 animate-fade-in">
                  <p className="text-sm text-muted-foreground">Unable to load venues.</p>
                  <button className="underline mt-2 text-primary" onClick={() => refetch()}>Retry</button>
                </div>
              ) : venues.length > 0 ? (
                <div className="space-y-3 animate-fade-in">
                  {venues.slice(0, 3).map((v) => (
                    <BarCard key={v.id} venue={v} onClick={() => setSelected(v)} />
                  ))}
                </div>
              ) : (
                <div className="text-center glass rounded-xl p-4 animate-fade-in">
                  <p className="text-sm text-muted-foreground">No venues match your filters.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* List view */
        <div className="pt-20 pb-32 px-4 max-w-lg mx-auto">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : venues.length > 0 ? (
            <div className="space-y-3 animate-fade-in">
              {venues.map((v) => (
                <BarCard key={v.id} venue={v} onClick={() => setSelected(v)} />
              ))}
            </div>
          ) : (
            <div className="text-center glass rounded-xl p-6 animate-fade-in">
              <p className="text-muted-foreground">No venues match your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Venue bottom sheet */}
      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader>
            <DrawerTitle className="text-lg">{selected?.title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {selected && (
              <div className="animate-fade-in">
                <div className="w-full h-48 rounded-xl overflow-hidden mb-4 bg-secondary">
                  <img
                    src={selected.image_url || ""}
                    alt={selected.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                      selected.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
                      : selected.category === "club" ? "bg-[hsl(var(--venue-club))]"
                      : "bg-[hsl(var(--venue-lounge))]"
                    }`}>
                      {selected.category}
                    </span>
                    {selected.neighborhood && (
                      <span className="text-xs text-muted-foreground">📍 {selected.neighborhood}</span>
                    )}
                    {selected.music_type && <span className="text-muted-foreground">🎵 {selected.music_type}</span>}
                  </div>
                  <div className="flex gap-4 text-muted-foreground">
                    {selected.venue_stats?.crowd_level && (
                      <span>👥 {selected.venue_stats.crowd_level}</span>
                    )}
                    {selected.cover_charge && <span>🎫 {selected.cover_charge}</span>}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/venue/${selected.id}`)}
                  className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default MapPage;
