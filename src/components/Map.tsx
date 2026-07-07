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
import { pinGlyph } from "@/lib/venueTraits";
import { toast } from "sonner";

export type MapProps = {
  venues: Venue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onViewportChanged?: (bbox: BBox) => void;
  /** venueId -> active check-in count; drives pin tiers and badges */
  activity?: Record<string, number>;
  /** venueIds with an ACTIVE happy hour; pins get the amber ring */
  happyHour?: Set<string>;
};

const CATEGORY_COLORS: Record<VenueCategory, string> = {
  bar: "#3b82f6",
  club: "#ef4444",
  lounge: "#a855f7",
};

// Glyphs come from pinGlyph(): 🍺 bars, 🍸 lounges/cocktail spots, 🪩 clubs.
const HH_RING = "0 0 0 2.5px #f59e0b, 0 0 14px rgba(245,158,11,0.67)";

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const Map: React.FC<MapProps> = ({ venues, selectedId, onSelect, onViewportChanged, activity, happyHour }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { center, zoom, setView } = useMapViewStore();
  const happyHourKey = happyHour ? [...happyHour].sort().join(",") : "";

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
      const count = activity?.[v.id] ?? 0;
      const hh = happyHour?.has(v.id) ?? false;
      // Activity tiers: 0 = as-is, 1-2 = badge, 3-5 = badge + bigger, 6+ = badge + bigger + glow
      const scale = count >= 3 ? 1.15 : 1;
      const hot = count >= 6;

      const wrapper = document.createElement("div");
      wrapper.className = "endz-marker";
      // No inline position here — it would override .maplibregl-marker's
      // position:absolute and break geo-anchoring (pins stack in page flow).
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
      const baseShadow = isSelected
        ? `0 0 18px ${color}, 0 4px 10px rgba(0,0,0,0.5)`
        : hot
        ? `0 0 14px ${color}, 0 3px 8px rgba(0,0,0,0.45)`
        : "0 3px 8px rgba(0,0,0,0.45)";
      // Amber ring marks an active happy hour; coexists with activity/selection glow.
      pin.style.boxShadow = hh ? `${HH_RING}, ${baseShadow}` : baseShadow;
      pin.style.display = "flex";
      pin.style.alignItems = "center";
      pin.style.justifyContent = "center";
      pin.style.fontSize = "16px";
      pin.style.transition = "transform 0.2s";
      pin.textContent = pinGlyph(v);
      wrapper.appendChild(pin);

      if (scale !== 1) pin.style.transform = `scale(${scale})`;

      if (count > 0) {
        const badge = document.createElement("div");
        badge.textContent = String(count);
        badge.style.position = "absolute";
        badge.style.top = "-4px";
        badge.style.right = "-4px";
        badge.style.minWidth = "16px";
        badge.style.height = "16px";
        badge.style.padding = "0 4px";
        badge.style.borderRadius = "8px";
        badge.style.background = "hsl(var(--primary))";
        badge.style.color = "hsl(var(--primary-foreground))";
        badge.style.fontSize = "10px";
        badge.style.fontWeight = "700";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.border = "1.5px solid rgba(255,255,255,0.85)";
        badge.style.zIndex = "2";
        wrapper.appendChild(badge);
      }

      wrapper.addEventListener("mouseenter", () => { pin.style.transform = `scale(${scale * 1.12})`; });
      wrapper.addEventListener("mouseleave", () => { pin.style.transform = scale !== 1 ? `scale(${scale})` : "scale(1)"; });

      const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([v.longitude, v.latitude])
        .addTo(map.current!);

      wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(v.id);
      });

      markersRef.current.push(marker);
    });
    // happyHourKey (stable string) stands in for the Set so markers rebuild
    // only when ring membership actually changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, selectedId, onSelect, clearMarkers, activity, happyHourKey]);

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

  // Fly to the selected venue (e.g. picked from the search dropdown) so the
  // pin is on screen when its drawer opens.
  useEffect(() => {
    if (!map.current || !selectedId) return;
    const v = venues.find((x) => x.id === selectedId);
    if (!v) return;
    map.current.flyTo({
      center: [v.longitude, v.latitude],
      zoom: Math.max(map.current.getZoom(), 15),
      duration: 900,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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
