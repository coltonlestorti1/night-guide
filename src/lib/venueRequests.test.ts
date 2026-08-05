import { describe, it, expect } from "vitest";
import { dedupeHits, type PlaceHit } from "./venueRequests";

const hit = (placeId: string, name = "Bar"): PlaceHit => ({ placeId, name });

describe("dedupeHits", () => {
  it("drops repeats within the list, keeping the first", () => {
    const out = dedupeHits([hit("a", "First"), hit("b"), hit("a", "Second")], []);
    expect(out.map((h) => h.placeId)).toEqual(["a", "b"]);
    expect(out[0].name).toBe("First");
  });

  it("drops anything already in the ENDZ venue set", () => {
    expect(dedupeHits([hit("a"), hit("b")], ["b"]).map((h) => h.placeId)).toEqual(["a"]);
  });

  it("drops entries with no place id", () => {
    expect(dedupeHits([{ placeId: "", name: "x" }, hit("a")], [])).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeHits([], [])).toEqual([]);
  });
});
