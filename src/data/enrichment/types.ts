export type WeeklyPeriod = {
  day: number; // 0 = Sunday … 6 = Saturday
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  closeDayOffset: 0 | 1;
};

export type PopularTimesDay = {
  day: number; // 0 = Sunday … 6 = Saturday
  hours: { hour: number; busyness: number }[]; // busyness 0–100
};

export type VenueEnrichment = {
  placeId: string;
  fetchedAt: string; // ISO; records >30 days old are treated as absent (Google ToS)
  rating?: number;
  userRatingCount?: number;
  priceRange?: string; // e.g. "$10–40"
  editorialSummary?: string;
  phone?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  hours?: WeeklyPeriod[];
  happyHour?: WeeklyPeriod[];
  /**
   * Google's verified outdoor-seating flag. The enrichment pipeline has always
   * written this (scripts/lib/transform.mjs) but the type never declared it.
   * Only `true` is meaningful — `false`/absent means "not recorded", not
   * "definitely none". Read it via hasOutdoorSeating() in venueTraits.
   */
  outdoorSeating?: boolean;
  /** Google-verified. Absent means "not recorded", NEVER "takes no reservations". */
  reservable?: boolean;
  popularTimes?: PopularTimesDay[];
  popularTimesSource?: "serpapi";
};
