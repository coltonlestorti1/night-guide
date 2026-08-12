import { describe, it, expect } from "vitest";
import { nightChoices, nightLabelFor, ratingAction, PICKER_LABELS } from "./logNight";
import { lastCompletedNightDate, nightDateOf } from "./window";

describe("nightChoices", () => {
  it("offers Tonight during the night window", () => {
    const at11pm = new Date(2026, 7, 12, 23, 0);
    const choices = nightChoices(at11pm);
    expect(choices[0].label).toBe("Tonight");
    expect(choices[0].value).toBe(nightDateOf(at11pm));
  });

  it("offers Tonight in the small hours, which are still that night", () => {
    const at2am = new Date(2026, 7, 12, 2, 0);
    expect(nightChoices(at2am)[0].label).toBe("Tonight");
  });

  it("does NOT offer Tonight at midday — that night has not happened", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    expect(nightChoices(atNoon).map((c) => c.label)).not.toContain("Tonight");
  });

  it("always offers Last night, and it is the last completed night", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    const first = nightChoices(atNoon)[0];
    expect(first.label).toBe("Last night");
    expect(first.value).toBe(lastCompletedNightDate(atNoon));
  });

  it("adds three earlier nights, newest first, with no duplicate dates", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    const values = nightChoices(atNoon).map((c) => c.value);
    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(values.length);
    expect([...values]).toEqual([...values].sort().reverse());
  });

  it("never offers a future night", () => {
    const at11pm = new Date(2026, 7, 12, 23, 0);
    const today = nightDateOf(at11pm);
    for (const c of nightChoices(at11pm)) expect(c.value <= today).toBe(true);
  });
});

describe("nightLabelFor", () => {
  it("names a night that is one of the quick choices", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    expect(nightLabelFor(lastCompletedNightDate(atNoon), atNoon)).toBe("Last night");
  });

  it("returns null for a night older than the chips reach", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    expect(nightLabelFor("2020-01-01", atNoon)).toBeNull();
  });
});

describe("ratingAction", () => {
  it("skips when no bucket was selected", () => {
    expect(ratingAction(null, undefined)).toBe("skip");
    expect(ratingAction(null, "great")).toBe("skip");
  });

  it("ranks a bucket chosen on a venue that has never been rated", () => {
    expect(ratingAction("great", undefined)).toBe("rank");
  });

  it("skips when the chosen bucket matches the existing rating", () => {
    // Logging a second night at a place you already love must not cost you
    // the head-to-heads again.
    expect(ratingAction("great", "great")).toBe("skip");
    expect(ratingAction("not_great", "not_great")).toBe("skip");
  });

  it("ranks when the chosen bucket differs — that is a deliberate re-rate", () => {
    expect(ratingAction("great", "good")).toBe("rank");
    expect(ratingAction("not_great", "great")).toBe("rank");
  });
});

describe("PICKER_LABELS", () => {
  it("covers every bucket with picker-only copy", () => {
    expect(PICKER_LABELS.great).toBe("Loved it");
    expect(PICKER_LABELS.good).toBe("It was ok");
    expect(PICKER_LABELS.not_great).toBe("Not for me");
  });
});
