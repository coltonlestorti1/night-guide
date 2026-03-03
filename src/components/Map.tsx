import React, { useCallback, useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Venue, BBox, VenueCategory } from "@/data/types";
import { Navigation } from "lucide-react";

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

const LISBON_CENTER: [number, number] = [-9.1393, 38.7223];

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

  // We use markers instead of layers for category colors
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    clearMarkers();
    venues.forEach((v) => {
      const color = CATEGORY_COLORS[v.category] || "#3b82f6";
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = v.id === selectedId ? "3px solid #fff" : "2px solid rgba(0,0,0,0.4)";
      el.style.cursor = "pointer";
      el.style.transition = "transform 0.2s";
      if (v.id === selectedId) {
        el.style.transform = "scale(1.4)";
        el.style.zIndex = "10";
      }

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
      center: LISBON_CENTER,
      zoom: 13,
      pitch: 0,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    const onMoveEnd = debounce(() => {
      if (!map.current) return;
      const b = map.current.getBounds();
      const bbox: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      onViewportChanged?.(bbox);
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
        },
        () => {
          map.current?.flyTo({ center: LISBON_CENTER, zoom: 13, duration: 1500 });
        }
      );
    } else {
      map.current.flyTo({ center: LISBON_CENTER, zoom: 13, duration: 1500 });
    }
  }, []);

  if (!accessToken) {
    return (
      <div className="relative w-full h-[calc(100vh-5rem)] flex items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-xl font-semibold">Map requires Mapbox token</h1>
          <p className="text-sm text-muted-foreground mt-2">Set your token in Profile to enable the map.</p>
          <a href="/profile" className="inline-block mt-3 text-primary underline">Go to Profile</a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-5rem)]">
      <div ref={mapContainer} className="w-full h-full" aria-label="Nightlife map" />
      <button
        onClick={handleLocateMe}
        className="absolute bottom-28 right-4 z-40 p-3 rounded-full glass shadow-lg hover:scale-105 transition-transform"
        aria-label="Locate me"
      >
        <Navigation className="h-5 w-5 text-primary" />
      </button>
    </div>
  );
};

export default Map;
