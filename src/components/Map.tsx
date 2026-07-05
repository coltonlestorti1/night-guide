/**
 * MapLibre GL map component with category-colored branded markers,
 * selected-marker pulse, legend, and viewport state preservation.
 *
 * Tiles come from OpenFreeMap (no key, no account). OSM attribution is
 * mandatory — the compact attribution control handles it; never disable it.
 */
import React, { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Venue, BBox, VenueCategory } from "@/data/types";
import { Navigation, LocateFixed } from "lucide-react";
import { useMapViewStore } from "@/store/mapState";
import { toast } from "sonner";

export type MapProps = {
  venues: Venue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onViewportChanged?: (bbox: BBox) => void;
};

const CATEGORY_COLORS: Record<VenueCategory, string> = {
  bar: "#3b82f6",
  club: "#ef4444",
  lounge: "#a855f7",
};

const CATEGORY_GLYPH: Record<VenueCategory, string> = {
  bar: "🍸",
  club: "🎧",
  lounge: "🛋️",
};

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const Map: React.FC<MapProps> = ({ venues, selectedId, onSelect, onViewportChanged }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { center, zoom, setView } = useMapViewStore();

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    clearMarkers();
    venues.forEach((v) => {
      const color = CATEGORY_COLORS[v.category] || "#3b82f6";
      const isSelected = v.id === selectedId;

      const wrapper = document.createElement("div");
      wrapper.className = "endz-marker";
      wrapper.style.position = "relative";
      wrapper.style.width = "36px";
      wrapper.style.height = "36px";
      wrapper.style.cursor = "pointer";
      if (isSelected) wrapper.style.zIndex = "10";

      if (isSelected) {
        const pulse = document.createElement("div");
        pulse.style.position = "absolute";
        pulse.style.inset = "-6px";
        pulse.style.borderRadius = "50%";
        pulse.style.background = color;
        pulse.style.opacity = "0.35";
        pulse.style.animation = "endz-pulse 1.6s ease-out infinite";
        wrapper.appendChild(pulse);
      }

      const pin = document.createElement("div");
      pin.style.position = "relative";
      pin.style.width = "100%";
      pin.style.height = "100%";
      pin.style.borderRadius = "50%";
      pin.style.background = `radial-gradient(circle at 30% 30%, ${color}, ${color}cc)`;
      pin.style.border = isSelected ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.85)";
      pin.style.boxShadow = isSelected
        ? `0 0 18px ${color}, 0 4px 10px rgba(0,0,0,0.5)`
        : "0 3px 8px rgba(0,0,0,0.45)";
      pin.style.display = "flex";
      pin.style.alignItems = "center";
      pin.style.justifyContent = "center";
      pin.style.fontSize = "16px";
      pin.style.transition = "transform 0.2s";
      pin.textContent = CATEGORY_GLYPH[v.category];
      wrapper.appendChild(pin);

      wrapper.addEventListener("mouseenter", () => { pin.style.transform = "scale(1.12)"; });
      wrapper.addEventListener("mouseleave", () => { pin.style.transform = "scale(1)"; });

      const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([v.longitude, v.latitude])
        .addTo(map.current!);

      wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(v.id);
      });

      markersRef.current.push(marker);
    });
  }, [venues, selectedId, onSelect, clearMarkers]);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center,
      zoom,
      pitch: 0,
      attributionControl: { compact: true },
    });

    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    const onMoveEnd = debounce(() => {
      if (!map.current) return;
      const c = map.current.getCenter();
      const z = map.current.getZoom();
      setView([c.lng, c.lat], z);
      const b = map.current.getBounds();
      onViewportChanged?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    }, 250);

    map.current.on("moveend", onMoveEnd);
    map.current.on("load", () => {
      addMarkers();
      onMoveEnd();
    });

    return () => {
      clearMarkers();
      map.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current?.loaded()) addMarkers();
  }, [addMarkers]);

  const handleLocateMe = useCallback(() => {
    if (!map.current) return;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 1500 });
          toast.success("Found your location");
        },
        () => {
          toast.info("Location unavailable — showing East Village center");
          map.current?.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
        }
      );
    } else {
      toast.info("Geolocation not supported");
      map.current.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
    }
  }, []);

  const handleRecenter = useCallback(() => {
    map.current?.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1200 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" aria-label="Nightlife map" />

      {/* Legend */}
      <div className="absolute top-32 left-3 z-30 glass rounded-xl px-3 py-2 text-[11px] space-y-1 animate-fade-in shadow-lg">
        <div className="font-semibold text-foreground/80 uppercase tracking-wide text-[10px] mb-1">Legend</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--venue-bar))]" /> Bar</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--venue-club))]" /> Club</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--venue-lounge))]" /> Lounge</div>
      </div>

      {/* Floating action buttons */}
      <div className="absolute bottom-44 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className="p-3 rounded-full glass shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="Recenter on East Village"
        >
          <LocateFixed className="h-5 w-5 text-primary" />
        </button>
        <button
          onClick={handleLocateMe}
          className="p-3 rounded-full glass shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="Locate me"
        >
          <Navigation className="h-5 w-5 text-primary" />
        </button>
      </div>
    </div>
  );
};

export default Map;
