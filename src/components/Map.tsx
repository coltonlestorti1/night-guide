import React, { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Venue, BBox } from "@/data/types";

export type MapProps = {
  accessToken?: string;
  venues: Venue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onViewportChanged?: (bbox: BBox) => void;
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

  const geojson = useMemo(() => ({
    type: "FeatureCollection",
    features: venues.map((v) => ({
      type: "Feature",
      properties: { id: v.id },
      geometry: { type: "Point", coordinates: [v.longitude, v.latitude] },
    })),
  }) as any, [venues]);

  useEffect(() => {
    if (!mapContainer.current || !accessToken) return;

    mapboxgl.accessToken = accessToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-73.9851, 40.758],
      zoom: 11,
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
      if (!map.current) return;
      map.current.addSource("venues", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 60,
      });

      map.current.addLayer({
        id: "clusters",
        type: "circle",
        source: "venues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#3b82f6", 10, "#22c55e", 50, "#eab308"],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
        },
      });

      map.current.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "venues",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": "#ffffff" },
      });

      map.current.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "venues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#60a5fa",
          "circle-radius": 7,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0f172a",
        },
      });

      map.current.on("click", "clusters", (e) => {
        const features = map.current!.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties?.cluster_id;
        const source: any = map.current!.getSource("venues");
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.current!.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      map.current.on("click", "unclustered-point", (e) => {
        const f = map.current!.queryRenderedFeatures(e.point, { layers: ["unclustered-point"] })[0];
        const id = String(f.properties?.id);
        onSelect?.(id);
      });

      onMoveEnd();
    });

    return () => {
      map.current?.remove();
    };
  }, [accessToken]);

  useEffect(() => {
    if (!map.current) return;
    const source = map.current.getSource("venues") as mapboxgl.GeoJSONSource | undefined;
    if (source) source.setData(geojson as any);
  }, [geojson]);

  useEffect(() => {
    if (!map.current || !selectedId) return;
    // Highlight could be implemented by adding another layer. Keeping basic for now.
  }, [selectedId]);

  if (!accessToken) {
    return (
      <div className="relative w-full h-[calc(100vh-5rem)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold">Map requires Mapbox token</h1>
          <p className="text-sm text-muted-foreground mt-2">Set your token in Profile to enable the map.</p>
          <a href="/profile" className="inline-block mt-3 underline">Go to Profile</a>
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-[calc(100vh-5rem)]" aria-label="Nightlife map" />;
};

export default Map;
