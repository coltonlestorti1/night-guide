import { describe, it, expect } from "vitest";
import { friendVerdict, hasFriendSignal, nameList, FRIEND_HERE_BOOST } from "./friends";
import type { FriendOutTonight, FriendProfile } from "@/lib/friends";

const profile = (id: string, display: string | null, username = id): FriendProfile => ({
  id,
  username,
  display_name: display,
  avatar_url: null,
});

const out = (venueId: string, p: FriendProfile): FriendOutTonight => ({
  checkInId: `c-${p.id}-${venueId}`,
  profile: p,
  venueId,
  venueName: "Somewhere",
  vibe: null,
  checkedInAt: "2026-08-09T23:00:00Z",
});

const maya = profile("1", "Maya Chen");
const dev = profile("2", "Dev Patel");
const sam = profile("3", "Sam Ruiz");
const handleOnly = profile("4", null, "nightowl");

describe("nameList", () => {
  it("uses first names", () => {
    expect(nameList([maya])).toBe("Maya");
  });

  it("joins two with 'and'", () => {
    expect(nameList([maya, dev])).toBe("Maya and Dev");
  });

  it("collapses three or more into a count", () => {
    expect(nameList([maya, dev, sam])).toBe("Maya, Dev and 1 more");
  });

  it("falls back to the username when there is no display name", () => {
    expect(nameList([handleOnly])).toBe("nightowl");
  });

  it("returns empty for nobody", () => {
    expect(nameList([])).toBe("");
  });
});

describe("friendVerdict", () => {
  it("names a single friend who is there now", () => {
    const v = friendVerdict("v1", { out: [out("v1", maya)] });
    expect(v.reason).toBe("Maya is here now");
    expect(v.delta).toBe(FRIEND_HERE_BOOST);
  });

  it("uses a plural verb for two friends", () => {
    const v = friendVerdict("v1", { out: [out("v1", maya), out("v1", dev)] });
    expect(v.reason).toBe("Maya and Dev are here now");
  });

  it("names friends who saved when nobody is out", () => {
    const v = friendVerdict("v1", { saves: { v1: [maya, dev] } });
    expect(v.reason).toBe("Maya and Dev saved this");
  });

  it("prefers 'here now' over 'saved' when both are true, but scores both", () => {
    const v = friendVerdict("v1", { out: [out("v1", maya)], saves: { v1: [dev] } });
    expect(v.reason).toBe("Maya is here now");
    expect(v.delta).toBeGreaterThan(FRIEND_HERE_BOOST);
  });

  it("ignores friends at other venues", () => {
    const v = friendVerdict("v1", { out: [out("v2", maya)] });
    expect(v).toEqual({ delta: 0, reason: null });
  });

  it("is inert with no signals at all", () => {
    expect(friendVerdict("v1", undefined)).toEqual({ delta: 0, reason: null });
    expect(friendVerdict("v1", {})).toEqual({ delta: 0, reason: null });
  });

  it("is inert for a user whose friends are all elsewhere and saved nothing", () => {
    expect(friendVerdict("v1", { out: [], saves: {} })).toEqual({ delta: 0, reason: null });
  });
});

describe("hasFriendSignal", () => {
  it("is true for a friend here now", () => {
    expect(hasFriendSignal("v1", { out: [out("v1", maya)] })).toBe(true);
  });

  it("is true for a friend save", () => {
    expect(hasFriendSignal("v1", { saves: { v1: [maya] } })).toBe(true);
  });

  it("is false with nothing", () => {
    expect(hasFriendSignal("v1", { out: [], saves: { v2: [maya] } })).toBe(false);
    expect(hasFriendSignal("v1", undefined)).toBe(false);
  });
});
