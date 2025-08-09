import { z } from "zod";
import { DataSource } from "./DataSource";
import { Venue, VenueQuery } from "@/data/types";

const VenueSchema = z.object({
  id: z.string(),
  title: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  serves_alcohol: z.boolean(),
  venue_type_primary: z.string().optional(),
  venue_types: z.array(z.string()).optional(),
  age_range_min: z.number().optional(),
  age_range_max: z.number().optional(),
  avg_price_level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().optional(),
  music_type: z.string().nullable().optional(),
  venue_stats: z
    .object({
      crowd_level: z.string().nullable().optional(),
      wait_minutes: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const VenuesSchema = z.array(VenueSchema);

function toQueryString(q: VenueQuery): string {
  const params = new URLSearchParams();
  if (q.bbox) params.set("bbox", q.bbox.join(","));
  if (q.types && q.types.length) params.set("types", q.types.join(","));
  if (q.priceMin != null) params.set("priceMin", String(q.priceMin));
  if (q.priceMax != null) params.set("priceMax", String(q.priceMax));
  if (q.ageMin != null) params.set("ageMin", String(q.ageMin));
  if (q.ageMax != null) params.set("ageMax", String(q.ageMax));
  if (q.hotspots) params.set("hotspots", "1");
  return params.toString();
}

async function fetchWithRetry(url: string, opts: RequestInit & { timeoutMs?: number; retries?: number } = {}) {
  const { timeoutMs = 8000, retries = 3, signal, ...rest } = opts as any;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: signal ?? controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      attempt++;
      if (attempt > retries) throw e;
      const backoff = 400 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

export class ApiDataSource implements DataSource {
  kind: "api" = "api";
  constructor(private baseUrl: string) {
    if (!baseUrl) throw new Error("API not configured");
  }

  async getVenues(q: VenueQuery, signal?: AbortSignal): Promise<Venue[]> {
    const qs = toQueryString(q);
    const res = await fetchWithRetry(`${this.baseUrl.replace(/\/$/, "")}/venues${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    const json = await res.json();
    return VenuesSchema.parse(json) as unknown as Venue[];
  }

  async getVenue(id: string, signal?: AbortSignal): Promise<Venue | null> {
    const res = await fetchWithRetry(`${this.baseUrl.replace(/\/$/, "")}/venues/${id}` as string, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    const json = await res.json();
    return VenueSchema.parse(json) as unknown as Venue;
  }
}
