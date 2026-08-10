import { describe, it, expect } from "vitest";
import { deriveCharacters, characterNote, HEADLINES, type Character } from "./character";
import type { Venue } from "@/data/types";

const venue = (title: string, over: Partial<Venue> = {}): Venue =>
  ({
    id: title,
    title,
    category: "bar",
    neighborhood: "East Village",
    avg_price_level: 3,
    latitude: 40.727,
    longitude: -73.984,
    ...over,
  }) as Venue;

const NOW = new Date("2026-08-09T23:00:00Z");
/** Real enrichment entries — takesReservations/rating read by title. */
const RESERVABLE = "The Grafton"; // reservable: true, rating 4.4
const PACKED_GOOD = "Standings"; // rating 4.6, reservable: false
const BARE = "Nowhere (test)"; // no enrichment at all

describe("deriveCharacters", () => {
  it("calls a quiet venue an easy door", () => {
    const out = deriveCharacters(venue(BARE), { activity: { [BARE]: { count: 0 } }, now: NOW });
    expect(out).toContain("easy-door");
  });

  it("calls a reservable venue an easy door even with some activity", () => {
    const out = deriveCharacters(venue(RESERVABLE), {
      activity: { [RESERVABLE]: { count: 4 } },
      now: NOW,
    });
    expect(out).toContain("easy-door");
  });

  it("calls a packed, well-rated venue worth the wait", () => {
    const out = deriveCharacters(venue(PACKED_GOOD), {
      activity: { [PACKED_GOOD]: { count: 9 } },
      now: NOW,
    });
    expect(out).toContain("worth-it");
  });

  it("never calls a packed venue an easy door", () => {
    const out = deriveCharacters(venue(RESERVABLE), {
      activity: { [RESERVABLE]: { count: 12 } },
      now: NOW,
    });
    expect(out).not.toContain("easy-door");
  });

  it("does not call a packed but poorly rated venue worth the wait", () => {
    const out = deriveCharacters(venue(BARE), { activity: { [BARE]: { count: 9 } }, now: NOW });
    expect(out).not.toContain("worth-it");
  });

  it("marks a cheap venue as value", () => {
    expect(deriveCharacters(venue(BARE, { avg_price_level: 1 }), { now: NOW })).toContain("value");
  });

  it("marks a venue within walking distance as close", () => {
    const out = deriveCharacters(venue(BARE), {
      coords: { lat: 40.7271, lng: -73.9841 },
      now: NOW,
    });
    expect(out).toContain("close");
  });

  it("cannot call anything close without the user's location", () => {
    expect(deriveCharacters(venue(BARE), { now: NOW })).not.toContain("close");
  });

  it("flags a venue a friend is at", () => {
    const out = deriveCharacters(venue(BARE), {
      friends: {
        out: [
          {
            checkInId: "c1",
            profile: { id: "1", username: "maya", display_name: "Maya", avatar_url: null },
            venueId: BARE,
            venueName: BARE,
            vibe: null,
            checkedInAt: NOW.toISOString(),
          },
        ],
      },
      now: NOW,
    });
    expect(out).toContain("friends");
  });
});

describe("notes never claim a ranking the code did not compute", () => {
  const ALL: Character[] = ["fit", "easy-door", "worth-it", "value", "close", "friends"];

  it("avoids comparative claims about the other picks", () => {
    const titles = [RESERVABLE, PACKED_GOOD, BARE];
    const notes = ALL.flatMap((c) =>
      titles.map((t) => characterNote(c, venue(t), { coords: { lat: 40.727, lng: -73.984 }, now: NOW }) ?? ""),
    )
      .join(" ")
      .toLowerCase();
    // "Cheapest of the three" and "the highest rated" both shipped in a first
    // draft and were caught in the browser — nothing compares the picks.
    for (const banned of ["cheapest", "highest", "busiest", "of the three", "best-rated"]) {
      expect(notes).not.toContain(banned);
    }
  });

  it("quotes the real rating when it calls a venue busy", () => {
    expect(characterNote("worth-it", venue(PACKED_GOOD), { now: NOW })).toBe(
      "Busy right now, and rated 4.6",
    );
  });

  it("says nothing about a rating it does not have", () => {
    expect(characterNote("worth-it", venue(BARE), { now: NOW })).toBe("Busy right now");
  });

  it("gives every character a headline", () => {
    for (const c of ALL) expect(HEADLINES[c]).toBeTruthy();
  });
});
