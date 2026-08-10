/**
 * Friend signals through the scorer (approved 2026-08-09 — friends may be
 * named). The naming rules themselves live in src/lib/move/friends.test.ts;
 * these check the wiring: that friends move rank, lead the reason list, and
 * stay completely inert for someone with no friends out.
 */
import { describe, it, expect } from "vitest";
import { scoreVenues, type VibePrefs } from "./vibeScore";
import type { Venue } from "@/data/types";
import type { FriendOutTonight, FriendProfile } from "@/lib/friends";

const venue = (title: string, over: Partial<Venue> = {}): Venue =>
  ({ id: title, title, category: "bar", avg_price_level: 2, ...over }) as Venue;

const profile = (id: string, display: string): FriendProfile => ({
  id,
  username: id,
  display_name: display,
  avatar_url: null,
});

const out = (venueId: string, p: FriendProfile): FriendOutTonight => ({
  checkInId: `c-${p.id}`,
  profile: p,
  venueId,
  venueName: venueId,
  vibe: null,
  checkedInAt: "2026-08-09T23:00:00Z",
});

const NOW = new Date("2026-08-09T23:00:00Z");
const base: VibePrefs = { when: "later" };
const A = "Bare A (test)";
const B = "Bare B (test)";
const venues = [venue(A), venue(B)];
const maya = profile("1", "Maya Chen");

describe("friends move the ranking", () => {
  it("lifts a venue where a friend is checked in right now", () => {
    const scored = scoreVenues(venues, base, undefined, NOW, null, {
      friends: { out: [out(B, maya)] },
    });
    expect(scored[0].venue.title).toBe(B);
  });

  it("names the friend, first in the reason list", () => {
    const scored = scoreVenues(venues, base, undefined, NOW, null, {
      friends: { out: [out(B, maya)] },
    });
    expect(scored[0].reasons[0]).toBe("Maya is here now");
  });

  it("lifts a venue friends have saved, more gently than one they are at", () => {
    const saved = scoreVenues([venue(A)], base, undefined, NOW, null, {
      friends: { saves: { [A]: [maya] } },
    })[0].score;
    const here = scoreVenues([venue(A)], base, undefined, NOW, null, {
      friends: { out: [out(A, maya)] },
    })[0].score;
    const none = scoreVenues([venue(A)], base, undefined, NOW, null, {})[0].score;
    expect(saved).toBeGreaterThan(none);
    expect(here).toBeGreaterThan(saved);
  });
});

describe("friends are inert when there are none", () => {
  it("matches the no-signal baseline exactly for empty friend data", () => {
    const before = scoreVenues(venues, base, undefined, NOW, null, {});
    const after = scoreVenues(venues, base, undefined, NOW, null, {
      friends: { out: [], saves: {} },
    });
    expect(after).toEqual(before);
  });

  it("matches the no-signal baseline when friends are all at other venues", () => {
    const before = scoreVenues(venues, base, undefined, NOW, null, {});
    const after = scoreVenues(venues, base, undefined, NOW, null, {
      friends: { out: [out("Somewhere else", maya)] },
    });
    expect(after).toEqual(before);
  });
});

describe("recent impressions decay a venue", () => {
  it("sinks a venue shown an hour ago below an identical one that was not", () => {
    const scored = scoreVenues(venues, base, undefined, NOW, null, {
      impressions: { [A]: new Date(NOW.getTime() - 3_600_000).toISOString() },
    });
    expect(scored[0].venue.title).toBe(B);
  });

  it("is inert with an empty impression log", () => {
    const before = scoreVenues(venues, base, undefined, NOW, null, {});
    const after = scoreVenues(venues, base, undefined, NOW, null, { impressions: {} });
    expect(after).toEqual(before);
  });
});
