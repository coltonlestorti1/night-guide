import { DataSource } from "./DataSource";
import { Venue, VenueQuery, VenueCategory } from "@/data/types";
import { getSupabase } from "@/lib/supabase";
import { filterVenues } from "./DemoDataSource";

/** Shape of a public.venues row (see endz-schema.sql). */
type VenueRow = {
  id: string;
  name: string;
  type: string;
  price: "$" | "$$" | "$$$" | "$$$$" | null;
  description: string | null;
  music: string | null;
  age_range: string | null;
  lat: number;
  lng: number;
};

const PRICE_LEVEL: Record<string, 1 | 2 | 3 | 4> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };
const CATEGORIES: readonly string[] = ["bar", "club", "lounge"];

function titleCaseMusic(music: string): string {
  return music
    .split("/")
    .map((part) => part.trim().replace(/^./, (c) => c.toUpperCase()))
    .join(" / ");
}

function parseAgeRange(range: string | null): { min?: number; max?: number } {
  const m = range?.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return {};
  return { min: Number(m[1]), max: Number(m[2]) };
}

/**
 * DB row -> app Venue, same rules as the seed transcription. Unknown
 * activity fields (buzz, crowd, hours, cover, images) stay undefined —
 * live data comes from real check-ins later, never invented here.
 */
export function mapVenueRow(row: VenueRow): Venue {
  const age = parseAgeRange(row.age_range);
  const venue: Venue = {
    id: row.id,
    title: row.name,
    latitude: row.lat,
    longitude: row.lng,
    serves_alcohol: true,
    category: (CATEGORIES.includes(row.type) ? row.type : "bar") as VenueCategory,
  };
  if (row.description) venue.description = row.description;
  if (row.price) venue.avg_price_level = PRICE_LEVEL[row.price];
  if (row.music && row.music.toLowerCase() !== "none") venue.music_type = titleCaseMusic(row.music);
  if (age.min !== undefined) venue.age_range_min = age.min;
  if (age.max !== undefined) venue.age_range_max = age.max;
  return venue;
}

export class SupabaseDataSource implements DataSource {
  kind = "supabase" as const;

  async getVenues(q: VenueQuery, _signal?: AbortSignal): Promise<Venue[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let query = supabase.from("venues").select("*");
    if (q.bbox) {
      const [west, south, east, north] = q.bbox;
      query = query.gte("lng", west).lte("lng", east).gte("lat", south).lte("lat", north);
    }
    const { data, error } = await query;
    if (error) throw error;
    return filterVenues((data as VenueRow[]).map(mapVenueRow), q);
  }

  async getVenue(id: string, _signal?: AbortSignal): Promise<Venue | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapVenueRow(data as VenueRow) : null;
  }
}
