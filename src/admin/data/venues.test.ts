import { describe, it, expect } from "vitest";
import {
  normalizeRow,
  EDITABLE_FIELDS,
  cleanPatch,
  totalDestroyed,
  type VenueDeleteImpact,
} from "./venues";

describe("venue photo columns", () => {
  it("normalizes a missing image column to null, not undefined", () => {
    const row = normalizeRow({ id: "v1", name: "The Grafton", lat: 40.7, lng: -73.9 });
    expect(row.image_url).toBeNull();
    expect(row.image_source).toBeNull();
  });

  it("carries the stored values through", () => {
    const row = normalizeRow({
      id: "v1", name: "The Grafton", lat: 40.7, lng: -73.9,
      image_url: "https://x.supabase.co/a.jpg", image_source: "instagram.com/thegrafton",
    });
    expect(row.image_url).toBe("https://x.supabase.co/a.jpg");
    expect(row.image_source).toBe("instagram.com/thegrafton");
  });

  it("lets the editor write both", () => {
    expect(EDITABLE_FIELDS).toContain("image_url");
    expect(EDITABLE_FIELDS).toContain("image_source");
  });

  it("turns a cleared photo field into null, so Remove really unsets it", () => {
    expect(cleanPatch({ image_url: "" }).image_url).toBeNull();
  });
});

describe("totalDestroyed", () => {
  const zeroImpact: VenueDeleteImpact = {
    check_ins: 0,
    venue_ratings: 0,
    night_posts: 0,
    plans: 0,
    venue_saves: 0,
    venue_hour_stats: 0,
    events: 0,
    venue_requests: 0,
  };

  it("sums every CASCADE table", () => {
    const impact: VenueDeleteImpact = {
      ...zeroImpact,
      check_ins: 5,
      venue_ratings: 2,
      night_posts: 3,
      plans: 1,
      venue_saves: 4,
      venue_hour_stats: 7,
    };
    expect(totalDestroyed(impact)).toBe(5 + 2 + 3 + 1 + 4 + 7);
  });

  it("excludes events — a venue delete sets events.venue_id to null, it does not destroy the row", () => {
    const impact: VenueDeleteImpact = { ...zeroImpact, events: 99 };
    expect(totalDestroyed(impact)).toBe(0);
  });

  it("excludes venue_requests — a nonzero count there BLOCKS the delete, it is never destroyed by it", () => {
    const impact: VenueDeleteImpact = { ...zeroImpact, venue_requests: 1 };
    expect(totalDestroyed(impact)).toBe(0);
  });

  it("returns 0 for a venue with nothing attached", () => {
    expect(totalDestroyed(zeroImpact)).toBe(0);
  });
});
