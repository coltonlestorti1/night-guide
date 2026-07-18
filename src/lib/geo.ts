import type { Feature, FeatureCollection, Polygon } from "geojson";

/** Empty collection used to clear GeoJSON sources (e.g. hide the accuracy halo). */
export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Geographic circle around [lng, lat] with radius in meters, as a GeoJSON
 * polygon (64 segments). Spherical-earth approximation — plenty for an
 * accuracy halo; longitude degrees shrink with cos(lat).
 */
export function circlePolygon(lng: number, lat: number, radiusM: number): Feature<Polygon> {
  const SEGMENTS = 64;
  const latRadius = radiusM / 111320;
  const lngRadius = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * 2 * Math.PI;
    ring.push([lng + lngRadius * Math.cos(theta), lat + latRadius * Math.sin(theta)]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
