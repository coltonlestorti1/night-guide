import { DataSource } from "./DataSource";
import { Venue, VenueQuery } from "@/data/types";

// Stubbed until Supabase is connected in Lovable (green button > connect Supabase)
// Once connected, replace TODO sections with actual queries using supabase SDK.
export class SupabaseDataSource implements DataSource {
  kind: "supabase" = "supabase";
  // TODO: wire supabase client

  async getVenues(_q: VenueQuery, _signal?: AbortSignal): Promise<Venue[]> {
    // TODO: query public.venues with filters
    return [];
  }

  async getVenue(_id: string, _signal?: AbortSignal): Promise<Venue | null> {
    // TODO: query single venue with related stats/specials
    return null;
  }
}
