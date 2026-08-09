import { describe, it, expect } from "vitest";
import { hasRealPhoto } from "./venueImages";

describe("hasRealPhoto", () => {
  it("is true for a stored photo URL", () => {
    expect(hasRealPhoto({ image_url: "https://x.supabase.co/a.jpg" })).toBe(true);
  });

  it("is false when there is no photo", () => {
    expect(hasRealPhoto({ image_url: null })).toBe(false);
    expect(hasRealPhoto({ image_url: undefined })).toBe(false);
    expect(hasRealPhoto({})).toBe(false);
  });

  it("is false for an empty string", () => {
    // VenuePreview passes `venue.image_url || ""` to its <img>, so the empty
    // string is a real value that reaches this predicate.
    expect(hasRealPhoto({ image_url: "" })).toBe(false);
  });
});
