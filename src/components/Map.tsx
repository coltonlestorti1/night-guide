/**
 * Mapbox GL map component with category-colored markers, clustering,
 * and viewport state preservation.
 *
 * MAPBOX_TOKEN: Set via Profile screen or env var VITE_MAPBOX_TOKEN.
 */
import React, { useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Venue, BBox, VenueCategory } from "@/data/types";
import { Navigation, LocateFixed } from "lucide-react";
import { useMapViewStore } from "@/store/mapState";
import { toast } from "sonner";

export type MapProps = {
  accessToken?: string;
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

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const Map: React.FC<MapProps> = ({ accessToken, venues, selectedId, onSelect, onViewportChanged }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
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
      const el = document.createElement("div");
      el.style.width = isSelected ? "22px" : "16px";
      el.style.height = isSelected ? "22px" : "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = isSelected ? "3px solid #fff" : "2px solid rgba(0,0,0,0.4)";
      el.style.cursor = "pointer";
      el.style.transition = "transform 0.2s, width 0.2s, height 0.2s";
      el.style.boxShadow = isSelected ? `0 0 12px ${color}` : `0 2px 6px rgba(0,0,0,0.3)`;
      if (isSelected) el.style.zIndex = "10";

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([v.longitude, v.latitude])
        .addTo(map.current!);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(v.id);
      });

      markersRef.current.push(marker);
    });
  }, [venues, selectedId, onSelect, clearMarkers]);

  useEffect(() => {
    if (!mapContainer.current || !accessToken) return;

    mapboxgl.accessToken = accessToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
      pitch: 0,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

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
  }, [accessToken]);

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
          toast.info("Location unavailable — showing Lisbon center");
          map.current?.flyTo({ center: [-9.1393, 38.7223], zoom: 13, duration: 1500 });
        }
      );
    } else {
      toast.info("Geolocation not supported");
      map.current.flyTo({ center: [-9.1393, 38.7223], zoom: 13, duration: 1500 });
    }
  }, []);

  const handleRecenter = useCallback(() => {
    map.current?.flyTo({ center: [-9.1393, 38.7223], zoom: 13, duration: 1200 });
  }, []);

  if (!accessToken) return null; // fallback handled by parent

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" aria-label="Nightlife map" />
      <div className="absolute bottom-28 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className="p-3 rounded-full glass shadow-lg hover:scale-105 transition-transform"
          aria-label="Recenter on Lisbon"
        >
          <LocateFixed className="h-5 w-5 text-primary" />
        </button>
        <button
          onClick={handleLocateMe}
          className="p-3 rounded-full glass shadow-lg hover:scale-105 transition-transform"
          aria-label="Locate me"
        >
          <Navigation className="h-5 w-5 text-primary" />
        </button>
      </div>
    </div>
  );
};

export default Map;
