/**
 * "Line reported" through the scorer (§3 live signals, built 2026-08-10).
 *
 * The rules being pinned, in priority order:
 *   1. no line reports anywhere => output identical to before the feature;
 *   2. ONE report may put a label on a venue but must never move its rank;
 *   3. TWO reports move rank — except for someone who asked for packed, who
 *      came for exactly this;
 *   4. nothing ever states a wait time, because no wait data exists.
 */
import { describe, it, expect } from "vitest";
import { scoreVenues, type VibePrefs } from "./vibeScore";
import { LINE_REASON } from "./move/line";
import type { Venue } from "@/data/types";

const venue = (title: string, over: Partial<Venue> = {}): Venue =>
  ({ id: title, title, category: "bar", avg_price_level: 2, ...over }) as Venue;

const NOW = new Date("2026-08-10T23:00:00Z");
const base: VibePrefs = { when: "later" };
const A = "Bare A (test)";
const B = "Bare B (test)";
const venues = [venue(A), venue(B)];

const withLine = (n: number, count = 5) => ({
  [A]: { count, vibeTally: { line_outside: n } },
  [B]: { count },
});

const scoreOf = (prefs: VibePrefs, activity: Parameters<typeof scoreVenues>[2]) =>
  scoreVenues([venue(A)], prefs, activity, NOW)[0].score;

describe("inert when nobody reports a line", () => {
  it("is identical with no vibe tally at all", () => {
    const before = scoreVenues(venues, base, { [A]: { count: 5 }, [B]: { count: 5 } }, NOW);
    const after = scoreVenues(
      venues,
      base,
      { [A]: { count: 5, vibeTally: { packed: 3 } }, [B]: { count: 5 } },
      NOW,
    );
    expect(after.map((s) => s.score)).toEqual(before.map((s) => s.score));
  });

  it("adds no reason when the tally has no line reports", () => {
    const out = scoreVenues(venues, base, { [A]: { count: 5, vibeTally: { chill: 2 } } }, NOW);
    expect(out.flatMap((s) => s.reasons)).not.toContain(LINE_REASON);
  });
});

describe("one report labels but does not rank", () => {
  it("says a line was reported", () => {
    const out = scoreVenues(venues, base, withLine(1), NOW);
    const a = out.find((s) => s.venue.title === A)!;
    expect(a.reasons).toContain(LINE_REASON);
  });

  it("leaves the score untouched, even for a big group", () => {
    const plain = scoreOf({ ...base, groupSize: "big" }, { [A]: { count: 5 } });
    const lined = scoreOf({ ...base, groupSize: "big" }, withLine(1));
    expect(lined).toBe(plain);
  });
});

describe("two reports move the ranking", () => {
  it("sinks a lined venue for a big group that stated no vibe", () => {
    const plain = scoreOf({ ...base, groupSize: "big" }, { [A]: { count: 5 } });
    const lined = scoreOf({ ...base, groupSize: "big" }, withLine(2));
    expect(lined).toBeLessThan(plain);
  });

  it("sinks a lined venue for someone who asked for chill", () => {
    const plain = scoreOf({ ...base, vibe: "chill" }, { [A]: { count: 5 } });
    const lined = scoreOf({ ...base, vibe: "chill" }, withLine(2));
    expect(lined).toBeLessThan(plain);
  });

  it("does NOT sink it for someone who asked for packed", () => {
    const plain = scoreOf({ ...base, vibe: "packed" }, { [A]: { count: 5 } });
    const lined = scoreOf({ ...base, vibe: "packed" }, withLine(2));
    expect(lined).toBe(plain);
  });

  it("does not sink it for a big group that explicitly asked for packed", () => {
    const prefs: VibePrefs = { ...base, vibe: "packed", groupSize: "big" };
    expect(scoreOf(prefs, withLine(3))).toBe(scoreOf(prefs, { [A]: { count: 5 } }));
  });

  it("still labels it for the packed crowd — they want to know", () => {
    const out = scoreVenues(venues, { ...base, vibe: "packed" }, withLine(3), NOW);
    expect(out.find((s) => s.venue.title === A)!.reasons).toContain(LINE_REASON);
  });
});

describe("never states a wait", () => {
  it("emits no minutes, no queue length, no time claim", () => {
    const sizes: VibePrefs["groupSize"][] = ["solo", "two", "small", "big"];
    const text = sizes
      .flatMap((g) => scoreVenues(venues, { ...base, groupSize: g }, withLine(4), NOW))
      .flatMap((s) => s.reasons)
      .join(" ")
      .toLowerCase();
    for (const banned of ["min", "wait time", "hour", "people deep", "long line"]) {
      expect(text).not.toContain(banned);
    }
  });
});
