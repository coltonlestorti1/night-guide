import { DataSource } from "./DataSource";
import { Venue, VenueQuery } from "@/data/types";

export class NullDataSource implements DataSource {
  kind: "null" = "null";
  async getVenues(_q: VenueQuery, _signal?: AbortSignal): Promise<Venue[]> {
    return [];
  }
  async getVenue(_id: string, _signal?: AbortSignal): Promise<Venue | null> {
    return null;
  }
}
