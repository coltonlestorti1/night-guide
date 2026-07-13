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
import { useLocationStore } from "@/store/location";
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

// Muted category rings for a normal venue — white pins carry a thin ring in
// the venue's category color. Activity (trending/hot) and selection override it.
const CATEGORY_COLORS: Record<VenueCategory, string> = {
  bar: "#5B8DEF",
  club: "#E5544B",
  lounge: "#9B6BE8",
};

const SELECTED_RING = "#6C45FF"; // ENDZ purple
const TRENDING_RING = "#FF8A3D"; // 3–5 checked in
const HOT_RING = "#FF4D67";      // 6+ checked in

// Glyphs come from pinGlyph(): 🍺 bars, 🍸 lounges/cocktail spots, 🪩 clubs.
// Happy hour is a clean amber outer ring — no neon glow.
const HH_RING = "0 0 0 2px #F59E0B";

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
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const requestLocation = useLocationStore((s) => s.request);
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
      const isSelected = v.id === selectedId;
      const count = activity?.[v.id] ?? 0;
      const hh = happyHour?.has(v.id) ?? false;
      // Activity tiers: 0-2 = category ring, 3-5 = trending (orange), 6+ = hot (pink).
      const trending = count >= 3 && count < 6;
      const hot = count >= 6;
      const scale = count >= 3 ? 1.1 : 1;
      // Ring priority: selection > hot > trending > category identity.
      const ring = isSelected
        ? SELECTED_RING
        : hot
        ? HOT_RING
        : trending
        ? TRENDING_RING
        : CATEGORY_COLORS[v.category] || CATEGORY_COLORS.bar;

      const wrapper = document.createElement("div");
      wrapper.className = "endz-marker";
      // No inline position here — it would override .maplibregl-marker's
      // position:absolute and break geo-anchoring (pins stack in page flow).
      wrapper.style.width = "34px";
      wrapper.style.height = "34px";
      wrapper.style.cursor = "pointer";
      if (isSelected) wrapper.style.zIndex = "10";

      if (isSelected) {
        const pulse = document.createElement("div");
        pulse.style.position = "absolute";
        pulse.style.inset = "-5px";
        pulse.style.borderRadius = "50%";
        pulse.style.background = SELECTED_RING;
        pulse.style.opacity = "0.28";
        pulse.style.animation = "endz-pulse 1.8s ease-out infinite";
        wrapper.appendChild(pulse);
      }

      // White pin, colored ring, soft neutral shadow — no neon.
      const pin = document.createElement("div");
      pin.style.position = "relative";
      pin.style.width = "100%";
      pin.style.height = "100%";
      pin.style.borderRadius = "50%";
      pin.style.background = "#ffffff";
      pin.style.border = `${isSelected ? 3 : 2.5}px solid ${ring}`;
      const softShadow = isSelected
        ? "0 4px 12px rgba(17,17,17,0.20), 0 0 0 4px rgba(108,69,255,0.14)"
        : "0 2px 6px rgba(17,17,17,0.16)";
      // Amber outer ring marks an active happy hour; sits under the base shadow.
      pin.style.boxShadow = hh ? `${HH_RING}, ${softShadow}` : softShadow;
      pin.style.display = "flex";
      pin.style.alignItems = "center";
      pin.style.justifyContent = "center";
      pin.style.fontSize = "15px";
      pin.style.transition = "transform 0.2s";
      pin.textContent = pinGlyph(v);
      wrapper.appendChild(pin);

      if (scale !== 1) pin.style.transform = `scale(${scale})`;

      if (count > 0) {
        const badge = document.createElement("div");
        badge.textContent = String(count);
        badge.style.position = "absolute";
        badge.style.top = "-5px";
        badge.style.right = "-5px";
        badge.style.minWidth = "17px";
        badge.style.height = "17px";
        badge.style.padding = "0 4px";
        badge.style.borderRadius = "9px";
        // Badge echoes the activity tier so hot/trending read at a glance.
        badge.style.background = hot ? HOT_RING : trending ? TRENDING_RING : SELECTED_RING;
        badge.style.color = "#ffffff";
        badge.style.fontSize = "10px";
        badge.style.fontWeight = "700";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.border = "2px solid #ffffff";
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
      style: "https://tiles.openfreemap.org/styles/positron",
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

  // Drops (or moves) a "you are here" dot. Only the inner styles are set — never
  // an inline position on the wrapper, which would break MapLibre's anchoring.
  const placeUserDot = useCallback((lng: number, lat: number) => {
    if (!map.current) return;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Your location");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "9999px";
      el.style.background = "#3b82f6";
      el.style.border = "2px solid #ffffff";
      el.style.boxShadow = "0 0 0 5px rgba(59,130,246,0.25)";
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }
  }, []);

  const handleLocateMe = useCallback(async () => {
    if (!map.current) return;
    const coords = await requestLocation();
    if (coords) {
      placeUserDot(coords.lng, coords.lat);
      map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1500 });
      toast.success("Found your location");
    } else {
      toast.info("Location unavailable — showing East Village center");
      map.current.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
    }
  }, [requestLocation, placeUserDot]);

  const handleRecenter = useCallback(() => {
    map.current?.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1200 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" aria-label="Nightlife map" />

      {/* Legend — ring colors carry live activity; the glyph carries category. */}
      <div className="absolute top-32 left-3 z-30 glass rounded-xl px-3 py-2 text-[11px] text-foreground space-y-1.5 animate-fade-in">
        <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Activity</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-[hsl(var(--trending))]" /> Trending</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-[hsl(var(--hot))]" /> Hot</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-primary" /> Selected</div>
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
