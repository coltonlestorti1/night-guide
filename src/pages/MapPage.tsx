import { useState } from "react";
import { useConfigStore } from "@/store/config";
import { useFilterStore } from "@/store/filters";
import { useVenues } from "@/hooks/useVenues";
import { BBox, Venue } from "@/data/types";
import Map from "@/components/Map";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

const FilterChips = () => {
  const { hotspots, set } = useFilterStore();
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex gap-2 px-3 py-2 rounded-full bg-background/80 backdrop-blur border">
      <button
        className={`text-sm px-3 py-1 rounded-full border ${hotspots ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
        onClick={() => set({ hotspots: !hotspots })}
        aria-pressed={hotspots}
      >
        Tonight's Hot Spots
      </button>
    </div>
  );
};

const MapPage = () => {
  const { mapboxToken } = useConfigStore();
  const filters = useFilterStore();
  const [bbox, setBbox] = useState<BBox | undefined>(undefined);
  const [selected, setSelected] = useState<Venue | null>(null);

  const { data, isLoading, isError, refetch } = useVenues({ bbox, hotspots: filters.hotspots });

  return (
    <section aria-labelledby="map-heading" className="relative">
      <h1 id="map-heading" className="sr-only">ENDZ Nightlife Map</h1>
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
        <div className="mx-auto max-w-3xl">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : isError ? (
            <div className="text-center bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Unable to load venues.</p>
              <button className="underline mt-2" onClick={() => refetch()}>Retry</button>
            </div>
          ) : (data && data.length > 0 ? (
            <div className="space-y-3">
              {data.slice(0, 3).map((v) => (
                <BarCard key={v.id} venue={v} onClick={() => setSelected(v)} />
              ))}
            </div>
          ) : (
            <div className="text-center bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">No venues to show. Connect an API or Supabase in Profile.</p>
              <a href="/profile" className="underline mt-2 inline-block">Go to Profile</a>
            </div>
          ))}
        </div>
      </div>

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selected?.title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {selected && <BarCard venue={selected} onClick={() => (window.location.href = `/discover?venue=${selected.id}`)} />}
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
};

export default MapPage;
