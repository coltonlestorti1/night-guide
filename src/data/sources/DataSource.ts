import { Venue, VenueQuery } from "@/data/types";

export interface DataSource {
  kind: "api" | "supabase" | "null";
  getVenues(q: VenueQuery, signal?: AbortSignal): Promise<Venue[]>;
  getVenue(id: string, signal?: AbortSignal): Promise<Venue | null>;
}
