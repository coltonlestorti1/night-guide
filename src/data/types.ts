export type Venue = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  serves_alcohol: boolean;
  venue_type_primary?: string;
  venue_types?: string[];
  age_range_min?: number;
  age_range_max?: number;
  avg_price_level?: 1 | 2 | 3 | 4 | 5 | null;
  music_type?: string | null;
  venue_stats?: {
    crowd_level?: string | null;
    wait_minutes?: number | null;
  } | null;
};

export type Special = {
  title: string;
  description?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type Checkin = { venue_id: string; user_id: string; created_at: string };

export type BBox = [west: number, south: number, east: number, north: number];

export type VenueQuery = {
  bbox?: BBox;
  types?: string[];
  priceMin?: number;
  priceMax?: number;
  ageMin?: number;
  ageMax?: number;
  hotspots?: boolean;
};
