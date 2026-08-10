import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readImpressions,
  recordImpressions,
  cooldownPenalty,
  COOLDOWN_INTERNALS,
} from "./cooldown";

const NOW = new Date("2026-08-09T23:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

/** Minimal in-memory localStorage — there is no jsdom in this project. */
function installStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  installStorage();
});

describe("cooldownPenalty", () => {
  it("applies the full penalty inside the first six hours", () => {
    expect(cooldownPenalty("a", { a: hoursAgo(1) }, NOW)).toBe(COOLDOWN_INTERNALS.MAX_PENALTY);
  });

  it("decays toward zero between six and twenty-four hours", () => {
    const early = cooldownPenalty("a", { a: hoursAgo(9) }, NOW);
    const late = cooldownPenalty("a", { a: hoursAgo(20) }, NOW);
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
    expect(early).toBeLessThan(COOLDOWN_INTERNALS.MAX_PENALTY);
  });

  it("is zero once the window has passed", () => {
    expect(cooldownPenalty("a", { a: hoursAgo(25) }, NOW)).toBe(0);
  });

  it("is zero for a venue never shown", () => {
    expect(cooldownPenalty("zzz", { a: hoursAgo(1) }, NOW)).toBe(0);
  });

  it("never penalises on a future timestamp (clock skew)", () => {
    expect(cooldownPenalty("a", { a: hoursAgo(-5) }, NOW)).toBe(0);
  });

  it("ignores an unparseable timestamp rather than throwing", () => {
    expect(cooldownPenalty("a", { a: "not a date" }, NOW)).toBe(0);
  });
});

describe("the impression log", () => {
  it("round-trips what it records", () => {
    recordImpressions(["a", "b"], NOW);
    expect(Object.keys(readImpressions(NOW)).sort()).toEqual(["a", "b"]);
  });

  it("drops entries older than the decay window on read", () => {
    installStorage({
      [COOLDOWN_INTERNALS.KEY]: JSON.stringify({ fresh: hoursAgo(2), stale: hoursAgo(48) }),
    });
    expect(Object.keys(readImpressions(NOW))).toEqual(["fresh"]);
  });

  it("caps the log so it cannot grow without limit", () => {
    const many = Object.fromEntries(
      Array.from({ length: 150 }, (_, i) => [`v${i}`, hoursAgo(1)]),
    );
    installStorage({ [COOLDOWN_INTERNALS.KEY]: JSON.stringify(many) });
    recordImpressions(["new"], NOW);
    expect(Object.keys(readImpressions(NOW)).length).toBeLessThanOrEqual(
      COOLDOWN_INTERNALS.MAX_ENTRIES,
    );
  });

  it("survives corrupt stored JSON", () => {
    installStorage({ [COOLDOWN_INTERNALS.KEY]: "{not json" });
    expect(readImpressions(NOW)).toEqual({});
  });

  it("survives a stored array instead of an object", () => {
    installStorage({ [COOLDOWN_INTERNALS.KEY]: "[1,2,3]" });
    expect(readImpressions(NOW)).toEqual({});
  });

  it("is a no-op when localStorage throws (private mode)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(readImpressions(NOW)).toEqual({});
    expect(() => recordImpressions(["a"], NOW)).not.toThrow();
  });
});
