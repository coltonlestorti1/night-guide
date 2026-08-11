import { describe, it, expect } from "vitest";
import { isMissingFunction, mapListRows, mapStatsRow } from "./friendLists";

describe("mapListRows", () => {
  it("coerces the numeric score, which PostgREST sends as a string", () => {
    const out = mapListRows([
      { venue_id: "a", bucket: "great", rank_position: 0, score: "9.2" },
    ]);
    expect(out[0].score).toBe(9.2);
    expect(typeof out[0].score).toBe("number");
  });

  it("treats no rows and null alike — both mean 'nothing you may see'", () => {
    expect(mapListRows([])).toEqual([]);
    expect(mapListRows(null)).toEqual([]);
    expect(mapListRows(undefined)).toEqual([]);
  });

  it("preserves the order the server returned rather than re-sorting", () => {
    // The SQL orders by score desc, rank_position asc. Re-sorting here would be
    // a second source of truth for the ranking.
    const out = mapListRows([
      { venue_id: "a", bucket: "great", rank_position: 0, score: "9.2" },
      { venue_id: "b", bucket: "good", rank_position: 0, score: "6.0" },
    ]);
    expect(out.map((r) => r.venueId)).toEqual(["a", "b"]);
  });
});

describe("mapStatsRow", () => {
  it("reads the single row the function returns to someone allowed to see it", () => {
    expect(mapStatsRow([{ been_count: 12, friend_count: 4 }])).toEqual({
      beenCount: 12,
      friendCount: 4,
    });
  });

  it("is null when the gate returned no row, NOT zeroes", () => {
    // Zeroes would render "0 Been" on the profile of someone whose list you
    // merely cannot read — a false claim about a real person.
    expect(mapStatsRow([])).toBeNull();
    expect(mapStatsRow(null)).toBeNull();
    expect(mapStatsRow(undefined)).toBeNull();
  });

  it("keeps a genuine zero when the viewer IS allowed to see it", () => {
    expect(mapStatsRow([{ been_count: 0, friend_count: 0 }])).toEqual({
      beenCount: 0,
      friendCount: 0,
    });
  });
});

describe("isMissingFunction", () => {
  it("is true only for PostgREST's unknown-function code", () => {
    expect(isMissingFunction({ code: "PGRST202" })).toBe(true);
  });

  it("is false for a network failure, so those still throw", () => {
    // The whole point: swallowing every error would hide a real outage behind
    // an empty list.
    expect(isMissingFunction({ code: "" })).toBe(false);
    expect(isMissingFunction({ code: "PGRST301" })).toBe(false);
    expect(isMissingFunction({})).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
  });
});
