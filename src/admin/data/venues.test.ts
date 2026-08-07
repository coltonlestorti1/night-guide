import { describe, it, expect } from "vitest";
import { normalizeRow, EDITABLE_FIELDS, cleanPatch } from "./venues";

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
