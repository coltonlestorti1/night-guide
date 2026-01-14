import { DataSource } from "./DataSource";
import { Venue, VenueQuery } from "@/data/types";

/**
 * Demo data source with real Geneva, NY venues for testing.
 * These are actual establishments in Geneva, New York.
 */

const GENEVA_VENUES: Venue[] = [
  {
    id: "hog-wallow-tavern",
    title: "Hog Wallow Tavern",
    latitude: 42.8696,
    longitude: -76.9983,
    serves_alcohol: true,
    venue_type_primary: "cocktail_bar",
    venue_types: ["cocktail_bar", "bar"],
    age_range_min: 21,
    age_range_max: 40,
    avg_price_level: 3,
    music_type: "Indie/Alternative",
    venue_stats: {
      crowd_level: "Busy",
      wait_minutes: 5,
    },
  },
  {
    id: "lake-drum-brewing",
    title: "Lake Drum Brewing",
    latitude: 42.8712,
    longitude: -76.9952,
    serves_alcohol: true,
    venue_type_primary: "brewery",
    venue_types: ["brewery", "bar"],
    age_range_min: 21,
    age_range_max: 45,
    avg_price_level: 2,
    music_type: "Acoustic/Folk",
    venue_stats: {
      crowd_level: "Moderate",
      wait_minutes: 0,
    },
  },
  {
    id: "eddie-obriens",
    title: "Eddie O'Brien's Grille & Bar",
    latitude: 42.8689,
    longitude: -76.9978,
    serves_alcohol: true,
    venue_type_primary: "bar",
    venue_types: ["bar", "restaurant"],
    age_range_min: 21,
    age_range_max: 50,
    avg_price_level: 2,
    music_type: "Classic Rock",
    venue_stats: {
      crowd_level: "Busy",
      wait_minutes: 10,
    },
  },
  {
    id: "the-linden",
    title: "The Linden Social Club",
    latitude: 42.8701,
    longitude: -76.9965,
    serves_alcohol: true,
    venue_type_primary: "lounge",
    venue_types: ["lounge", "cocktail_bar"],
    age_range_min: 25,
    age_range_max: 45,
    avg_price_level: 4,
    music_type: "Jazz/Lounge",
    venue_stats: {
      crowd_level: "Moderate",
      wait_minutes: 0,
    },
  },
  {
    id: "flx-live",
    title: "FLX Live",
    latitude: 42.8675,
    longitude: -77.0012,
    serves_alcohol: true,
    venue_type_primary: "music_venue",
    venue_types: ["music_venue", "bar"],
    age_range_min: 18,
    age_range_max: 35,
    avg_price_level: 2,
    music_type: "Live Music/Varies",
    venue_stats: {
      crowd_level: "Packed",
      wait_minutes: 15,
    },
  },
  {
    id: "beef-and-brew",
    title: "Beef & Brew",
    latitude: 42.8720,
    longitude: -76.9945,
    serves_alcohol: true,
    venue_type_primary: "restaurant",
    venue_types: ["restaurant", "bar"],
    age_range_min: 21,
    age_range_max: 55,
    avg_price_level: 3,
    music_type: "Pub Music",
    venue_stats: {
      crowd_level: "Moderate",
      wait_minutes: 5,
    },
  },
  {
    id: "ports-cafe",
    title: "Port's Café",
    latitude: 42.8693,
    longitude: -76.9971,
    serves_alcohol: true,
    venue_type_primary: "cafe_alcohol",
    venue_types: ["cafe_alcohol", "restaurant"],
    age_range_min: 21,
    age_range_max: 40,
    avg_price_level: 3,
    music_type: "Jazz/Blues",
    venue_stats: {
      crowd_level: "Quiet",
      wait_minutes: 0,
    },
  },
  {
    id: "smith-opera-house",
    title: "Smith Opera House",
    latitude: 42.8698,
    longitude: -76.9988,
    serves_alcohol: true,
    venue_type_primary: "music_venue",
    venue_types: ["music_venue"],
    age_range_min: 18,
    age_range_max: 65,
    avg_price_level: 3,
    music_type: "Live Performances",
    venue_stats: {
      crowd_level: "Varies",
      wait_minutes: 0,
    },
  },
  {
    id: "kashong-creek-distillery",
    title: "Kashong Creek Farm Distillery",
    latitude: 42.8450,
    longitude: -77.0120,
    serves_alcohol: true,
    venue_type_primary: "distillery",
    venue_types: ["distillery"],
    age_range_min: 21,
    age_range_max: 55,
    avg_price_level: 3,
    music_type: null,
    venue_stats: {
      crowd_level: "Quiet",
      wait_minutes: 0,
    },
  },
  {
    id: "billsboro-winery",
    title: "Billsboro Winery",
    latitude: 42.8580,
    longitude: -76.9750,
    serves_alcohol: true,
    venue_type_primary: "winery",
    venue_types: ["winery"],
    age_range_min: 21,
    age_range_max: 60,
    avg_price_level: 3,
    music_type: null,
    venue_stats: {
      crowd_level: "Moderate",
      wait_minutes: 0,
    },
  },
];

function filterVenues(venues: Venue[], q: VenueQuery): Venue[] {
  return venues.filter((v) => {
    if (!v.serves_alcohol) return false;
    if (q.bbox) {
      const [west, south, east, north] = q.bbox;
      if (v.longitude < west || v.longitude > east) return false;
      if (v.latitude < south || v.latitude > north) return false;
    }
    if (q.types && q.types.length > 0) {
      const venueTypes = v.venue_types ?? [v.venue_type_primary].filter(Boolean);
      if (!q.types.some((t) => venueTypes.includes(t))) return false;
    }
    if (q.priceMin != null && (v.avg_price_level ?? 0) < q.priceMin) return false;
    if (q.priceMax != null && (v.avg_price_level ?? 5) > q.priceMax) return false;
    if (q.ageMin != null && (v.age_range_max ?? 99) < q.ageMin) return false;
    if (q.ageMax != null && (v.age_range_min ?? 0) > q.ageMax) return false;
    return true;
  });
}

export class DemoDataSource implements DataSource {
  kind: "demo" = "demo" as any; // Using 'demo' for clarity
  
  async getVenues(q: VenueQuery, _signal?: AbortSignal): Promise<Venue[]> {
    // Simulate network delay for realistic feel
    await new Promise((r) => setTimeout(r, 300));
    return filterVenues(GENEVA_VENUES, q);
  }
  
  async getVenue(id: string, _signal?: AbortSignal): Promise<Venue | null> {
    await new Promise((r) => setTimeout(r, 150));
    return GENEVA_VENUES.find((v) => v.id === id) ?? null;
  }
}
