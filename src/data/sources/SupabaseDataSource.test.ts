import { describe, it, expect } from "vitest";
import { mapVenueRow } from "./SupabaseDataSource";

const base = {
  id: "v1",
  name: "The Grafton",
  type: "bar",
  price: "$$" as const,
  description: null,
  music: null,
  age_range: null,
  lat: 40.7,
  lng: -73.9,
};

describe("mapVenueRow image_url", () => {
  it("carries a real photo URL through", () => {
    const v = mapVenueRow({ ...base, image_url: "https://x.supabase.co/a.jpg" });
    expect(v.image_url).toBe("https://x.supabase.co/a.jpg");
  });

  it("leaves image_url undefined when the column is absent", () => {
    // The column does not exist until the Task 1 DDL is pasted, and
    // select("*") simply returns fewer columns until then.
    expect(mapVenueRow(base).image_url).toBeUndefined();
  });

  it("treats null and empty string as no photo, so the placeholder wins", () => {
    expect(mapVenueRow({ ...base, image_url: null }).image_url).toBeUndefined();
    expect(mapVenueRow({ ...base, image_url: "" }).image_url).toBeUndefined();
  });
});
