import { describe, it, expect } from "vitest";
import { slugify, matchFileToVenues } from "./photoMatch";
import type { AdminVenueRow } from "./venues";

function venue(id: string, name: string): AdminVenueRow {
  return {
    id, name, type: "bar", price: null, description: null, music: null,
    age_range: null, lat: 40.7, lng: -73.9, neighborhood: null,
    image_url: null, image_source: null, is_college_scene: false,
    has_rooftop: false, has_outdoor: false, is_active: true,
  };
}

const VENUES = [
  venue("v1", "Amor y Amargo"),
  venue("v2", "The Grafton"),
  venue("v3", "Death & Co"),
  venue("v4", "Bar Nine"),
  venue("v5", "Bar Nine"), // deliberate duplicate name
  venue("v6", "Nublu 151"),
];

describe("slugify", () => {
  it("lowercases and collapses separators", () => {
    expect(slugify("Amor y Amargo")).toBe("amor y amargo");
    expect(slugify("amor-y-amargo")).toBe("amor y amargo");
    expect(slugify("amor_y_amargo")).toBe("amor y amargo");
    expect(slugify("  Amor   y  Amargo  ")).toBe("amor y amargo");
  });

  it("drops punctuation so & and 'and' both land", () => {
    expect(slugify("Death & Co")).toBe("death co");
    expect(slugify("death-and-co")).toBe("death co");
  });
});

describe("matchFileToVenues", () => {
  it("matches a hyphenated filename to its venue", () => {
    const m = matchFileToVenues("amor-y-amargo.jpg", VENUES);
    expect(m.venueId).toBe("v1");
    expect(m.confidence).toBe("exact");
  });

  it("ignores the extension and case", () => {
    expect(matchFileToVenues("The_Grafton.PNG", VENUES).venueId).toBe("v2");
  });

  it("ignores a trailing counter from a download", () => {
    expect(matchFileToVenues("the-grafton (1).jpg", VENUES).venueId).toBe("v2");
    expect(matchFileToVenues("the-grafton-2.webp", VENUES).venueId).toBe("v2");
  });

  it("refuses to guess when two venues share a name", () => {
    const m = matchFileToVenues("bar-nine.jpg", VENUES);
    expect(m.confidence).toBe("ambiguous");
    expect(m.venueId).toBeNull();
    expect(m.candidates).toEqual(["v4", "v5"]);
  });

  it("reports no match rather than picking something close", () => {
    const m = matchFileToVenues("some-random-bar.jpg", VENUES);
    expect(m.confidence).toBe("none");
    expect(m.venueId).toBeNull();
  });

  it("does not fuzzy-match a substring — a wrong bar is worse than no bar", () => {
    // "bar" appears inside "Bar Nine" but must not match on its own.
    expect(matchFileToVenues("bar.jpg", VENUES).confidence).toBe("none");
  });

  it("matches a venue whose real name ends in digits, trying the full name before stripping a counter", () => {
    const m = matchFileToVenues("nublu-151.jpg", VENUES);
    expect(m.venueId).toBe("v6");
    expect(m.confidence).toBe("exact");
  });

  it("still strips a genuine download counter when the full name doesn't match anything", () => {
    // "the-grafton-2" isn't a venue on its own — only after the trailing
    // counter is stripped does it resolve to "The Grafton".
    expect(matchFileToVenues("the-grafton-2.webp", VENUES).venueId).toBe("v2");
  });
});
