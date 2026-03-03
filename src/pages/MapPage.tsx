import { useState } from "react";
import { useConfigStore } from "@/store/config";
import { useFilterStore } from "@/store/filters";
import { useVenues } from "@/hooks/useVenues";
import { BBox, Venue, VenueCategory } from "@/data/types";
import Map from "@/components/Map";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES: { label: string; value: VenueCategory }[] = [
  { label: "Bar", value: "bar" },
  { label: "Club", value: "club" },
  { label: "Lounge", value: "lounge" },
];

const MUSIC_VIBES = ["Techno", "House", "Jazz", "Fado", "Indie", "Ambient"];

const FilterChips = () => {
  const { categories, crowdLevel, musicVibe, set } = useFilterStore();

  const toggleCategory = (cat: VenueCategory) => {
    const next = categories.includes(cat)
      ? categories.filter((c) => c !== cat)
      : [...categories, cat];
    set({ categories: next });
  };

  return (
    <div className="fixed top-3 left-0 right-0 z-40 px-3">
      <div className="mx-auto max-w-xl flex flex-wrap gap-2 p-2 rounded-2xl glass animate-fade-in">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              categories.includes(c.value)
                ? c.value === "bar"
                  ? "bg-[hsl(217,91%,60%)] text-white border-transparent"
                  : c.value === "club"
                  ? "bg-[hsl(0,72%,51%)] text-white border-transparent"
                  : "bg-[hsl(262,83%,58%)] text-white border-transparent"
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
      </div>
    </div>
  );
};

const MapPage = () => {
  const { mapboxToken } = useConfigStore();
  const filters = useFilterStore();
  const [bbox, setBbox] = useState<BBox | undefined>(undefined);
  const [selected, setSelected] = useState<Venue | null>(null);

  const { data, isLoading, isError, refetch } = useVenues({
    bbox,
    hotspots: filters.hotspots,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    crowdLevel: filters.crowdLevel,
    musicVibe: filters.musicVibe,
  });

  return (
    <section aria-labelledby="map-heading" className="relative">
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map — Lisbon</h1>
      <FilterChips />
      <Map
        accessToken={mapboxToken}
        venues={data ?? []}
        selectedId={selected?.id}
        onSelect={(id) => {
          const v = (data ?? []).find((x) => x.id === id) || null;
          setSelected(v);
        }}
        onViewportChanged={setBbox}
      />

      <div className="absolute bottom-20 left-0 right-0 px-4 z-40">
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
          ) : data && data.length > 0 ? (
            <div className="space-y-3 animate-fade-in">
              {data.slice(0, 3).map((v) => (
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

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader>
            <DrawerTitle className="text-lg">{selected?.title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {selected && (
              <div className="animate-fade-in">
                {selected.image_url && (
                  <img
                    src={selected.image_url}
                    alt={selected.title}
                    className="w-full h-48 object-cover rounded-xl mb-4"
                  />
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                      selected.category === "bar" ? "bg-[hsl(217,91%,60%)]"
                      : selected.category === "club" ? "bg-[hsl(0,72%,51%)]"
                      : "bg-[hsl(262,83%,58%)]"
                    }`}>
                      {selected.category}
                    </span>
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
                  onClick={() => (window.location.href = `/discover?venue=${selected.id}`)}
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
