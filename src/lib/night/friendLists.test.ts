import { describe, it, expect } from "vitest";
import { isMissingFunction, mapFriendRows, mapListRows, mapStatsRow } from "./friendLists";

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

describe("mapFriendRows", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "u1",
    username: "sam",
    display_name: "Sam",
    avatar_url: "http://x/a.png",
    ...over,
  });

  it("maps a person through unchanged", () => {
    const out = mapFriendRows([row()]);
    expect(out).toEqual([
      { id: "u1", username: "sam", display_name: "Sam", avatar_url: "http://x/a.png" },
    ]);
  });

  it("normalises a missing display name to null, not undefined", () => {
    // ProfileAvatar falls back to the username on null. undefined would make
    // `display_name && ...` render nothing while still taking the truthy path
    // elsewhere.
    const out = mapFriendRows([row({ display_name: undefined })]);
    expect(out[0].display_name).toBeNull();
  });

  it("normalises a missing avatar to null", () => {
    expect(mapFriendRows([row({ avatar_url: undefined })])[0].avatar_url).toBeNull();
  });

  it("returns an empty list for null and undefined", () => {
    // The RPC answers "not your friend" and "has no friends" with the same
    // zero rows on purpose, so this path is the common one, not an edge case.
    expect(mapFriendRows(null)).toEqual([]);
    expect(mapFriendRows(undefined)).toEqual([]);
    expect(mapFriendRows([])).toEqual([]);
  });

  it("preserves order, which the function sorts by name", () => {
    const out = mapFriendRows([
      row({ id: "a", username: "alex", display_name: "Alex" }),
      row({ id: "b", username: "sam", display_name: "Sam" }),
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
