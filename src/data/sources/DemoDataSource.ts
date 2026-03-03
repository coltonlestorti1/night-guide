import { DataSource } from "./DataSource";
import { Venue, VenueQuery } from "@/data/types";
import { LISBON_VENUES } from "@/data/venues";

function filterVenues(venues: Venue[], q: VenueQuery): Venue[] {
  return venues.filter((v) => {
    if (!v.serves_alcohol) return false;
    if (q.bbox) {
      const [west, south, east, north] = q.bbox;
      if (v.longitude < west || v.longitude > east) return false;
      if (v.latitude < south || v.latitude > north) return false;
    }
    if (q.categories && q.categories.length > 0) {
      if (!q.categories.includes(v.category)) return false;
    }
    if (q.types && q.types.length > 0) {
      const venueTypes = v.venue_types ?? [v.venue_type_primary].filter(Boolean);
      if (!q.types.some((t) => venueTypes.includes(t))) return false;
    }
    if (q.crowdLevel && v.venue_stats?.crowd_level !== q.crowdLevel) return false;
    if (q.musicVibe && v.music_type && !v.music_type.toLowerCase().includes(q.musicVibe.toLowerCase())) return false;
    if (q.priceMin != null && (v.avg_price_level ?? 0) < q.priceMin) return false;
    if (q.priceMax != null && (v.avg_price_level ?? 5) > q.priceMax) return false;
    return true;
  });
}

export class DemoDataSource implements DataSource {
  kind: "demo" = "demo" as any;

  async getVenues(q: VenueQuery, _signal?: AbortSignal): Promise<Venue[]> {
    await new Promise((r) => setTimeout(r, 300));
    return filterVenues(LISBON_VENUES, q);
  }

  async getVenue(id: string, _signal?: AbortSignal): Promise<Venue | null> {
    await new Promise((r) => setTimeout(r, 150));
    return LISBON_VENUES.find((v) => v.id === id) ?? null;
  }
}
