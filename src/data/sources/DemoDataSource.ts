import { DataSource } from "./DataSource";
import { Venue, VenueQuery } from "@/data/types";

import parkBarImg from "@/assets/venues/park-bar.jpg";
import luxFragilImg from "@/assets/venues/lux-fragil.jpg";
import tascaDoChicoImg from "@/assets/venues/tasca-do-chico.jpg";
import redFrogImg from "@/assets/venues/red-frog.jpg";
import ministeriumImg from "@/assets/venues/ministerium.jpg";
import pensaoAmorImg from "@/assets/venues/pensao-amor.jpg";
import byTheWineImg from "@/assets/venues/by-the-wine.jpg";
import urbanBeachImg from "@/assets/venues/urban-beach.jpg";
import villageUndergroundImg from "@/assets/venues/village-underground.jpg";
import cincoLoungeImg from "@/assets/venues/cinco-lounge.jpg";

const LISBON_VENUES: Venue[] = [
  {
    id: "park-bar",
    title: "Park Bar",
    latitude: 38.7139,
    longitude: -9.1468,
    serves_alcohol: true,
    category: "bar",
    venue_type_primary: "rooftop_bar",
    venue_types: ["rooftop_bar", "bar"],
    age_range_min: 21,
    age_range_max: 35,
    avg_price_level: 3,
    music_type: "House / Chill",
    cover_charge: "Free",
    image_url: parkBarImg,
    venue_stats: { crowd_level: "high", wait_minutes: 10 },
  },
  {
    id: "lux-fragil",
    title: "Lux Frágil",
    latitude: 38.7148,
    longitude: -9.1218,
    serves_alcohol: true,
    category: "club",
    venue_type_primary: "nightclub",
    venue_types: ["nightclub", "club"],
    age_range_min: 18,
    age_range_max: 35,
    avg_price_level: 4,
    music_type: "Techno / Electronic",
    cover_charge: "€15",
    image_url: luxFragilImg,
    venue_stats: { crowd_level: "high", wait_minutes: 20 },
  },
  {
    id: "tasca-do-chico",
    title: "Tasca do Chico",
    latitude: 38.7128,
    longitude: -9.1445,
    serves_alcohol: true,
    category: "bar",
    venue_type_primary: "fado_bar",
    venue_types: ["fado_bar", "bar"],
    age_range_min: 21,
    age_range_max: 50,
    avg_price_level: 2,
    music_type: "Fado / Traditional",
    cover_charge: "Free",
    image_url: tascaDoChicoImg,
    venue_stats: { crowd_level: "medium", wait_minutes: 5 },
  },
  {
    id: "red-frog",
    title: "Red Frog Speakeasy",
    latitude: 38.7195,
    longitude: -9.1470,
    serves_alcohol: true,
    category: "lounge",
    venue_type_primary: "speakeasy",
    venue_types: ["speakeasy", "cocktail_bar"],
    age_range_min: 25,
    age_range_max: 45,
    avg_price_level: 4,
    music_type: "Jazz / Soul",
    cover_charge: "Free",
    image_url: redFrogImg,
    venue_stats: { crowd_level: "low", wait_minutes: 0 },
  },
  {
    id: "ministerium",
    title: "Ministerium Club",
    latitude: 38.7082,
    longitude: -9.1355,
    serves_alcohol: true,
    category: "club",
    venue_type_primary: "nightclub",
    venue_types: ["nightclub", "club"],
    age_range_min: 18,
    age_range_max: 30,
    avg_price_level: 3,
    music_type: "Techno / Minimal",
    cover_charge: "€10",
    image_url: ministeriumImg,
    venue_stats: { crowd_level: "high", wait_minutes: 15 },
  },
  {
    id: "pensao-amor",
    title: "Pensão Amor",
    latitude: 38.7072,
    longitude: -9.1437,
    serves_alcohol: true,
    category: "bar",
    venue_type_primary: "bar",
    venue_types: ["bar", "cultural_space"],
    age_range_min: 21,
    age_range_max: 40,
    avg_price_level: 3,
    music_type: "Indie / Eclectic",
    cover_charge: "Free",
    image_url: pensaoAmorImg,
    venue_stats: { crowd_level: "medium", wait_minutes: 5 },
  },
  {
    id: "by-the-wine",
    title: "By the Wine",
    latitude: 38.7107,
    longitude: -9.1403,
    serves_alcohol: true,
    category: "lounge",
    venue_type_primary: "wine_bar",
    venue_types: ["wine_bar", "lounge"],
    age_range_min: 25,
    age_range_max: 50,
    avg_price_level: 3,
    music_type: "Ambient / Acoustic",
    cover_charge: "Free",
    image_url: byTheWineImg,
    venue_stats: { crowd_level: "low", wait_minutes: 0 },
  },
  {
    id: "urban-beach",
    title: "Urban Beach",
    latitude: 38.7058,
    longitude: -9.1310,
    serves_alcohol: true,
    category: "club",
    venue_type_primary: "beach_club",
    venue_types: ["beach_club", "club"],
    age_range_min: 18,
    age_range_max: 35,
    avg_price_level: 3,
    music_type: "Deep House / Tropical",
    cover_charge: "€10",
    image_url: urbanBeachImg,
    venue_stats: { crowd_level: "medium", wait_minutes: 5 },
  },
  {
    id: "village-underground",
    title: "Village Underground",
    latitude: 38.7205,
    longitude: -9.1352,
    serves_alcohol: true,
    category: "club",
    venue_type_primary: "nightclub",
    venue_types: ["nightclub", "cultural_space"],
    age_range_min: 18,
    age_range_max: 35,
    avg_price_level: 2,
    music_type: "Techno / Experimental",
    cover_charge: "€8",
    image_url: villageUndergroundImg,
    venue_stats: { crowd_level: "high", wait_minutes: 10 },
  },
  {
    id: "cinco-lounge",
    title: "Cinco Lounge",
    latitude: 38.7155,
    longitude: -9.1500,
    serves_alcohol: true,
    category: "lounge",
    venue_type_primary: "cocktail_bar",
    venue_types: ["cocktail_bar", "lounge"],
    age_range_min: 25,
    age_range_max: 45,
    avg_price_level: 4,
    music_type: "Lounge / Deep House",
    cover_charge: "Free",
    image_url: cincoLoungeImg,
    venue_stats: { crowd_level: "low", wait_minutes: 0 },
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
