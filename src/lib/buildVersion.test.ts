import { describe, it, expect, vi } from "vitest";
import {
  createUpdateChecker,
  readDeployedBuildId,
  CHECK_THROTTLE_MS,
  VERSION_URL,
  type FetchFn,
} from "./buildVersion";

/** Minimal stand-in for a Response — only the bits readDeployedBuildId touches. */
const respond = (ok: boolean, body: unknown): Response =>
  ({
    ok,
    json: async () => {
      if (typeof body === "string") throw new SyntaxError("Unexpected token");
      return body;
    },
  }) as unknown as Response;

const fetchReturning = (res: Response): FetchFn =>
  vi.fn(async () => res) as unknown as FetchFn;

describe("readDeployedBuildId", () => {
  it("returns the deployed buildId", async () => {
    const fetchFn = fetchReturning(respond(true, { buildId: "abc123" }));
    expect(await readDeployedBuildId(fetchFn)).toBe("abc123");
  });

  it("requests version.json with caching disabled", async () => {
    const fetchFn = fetchReturning(respond(true, { buildId: "abc123" }));
    await readDeployedBuildId(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(VERSION_URL, { cache: "no-store" });
  });

  it("returns null on a non-200", async () => {
    expect(await readDeployedBuildId(fetchReturning(respond(false, {})))).toBeNull();
  });

  it("returns null when the network throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as FetchFn;
    expect(await readDeployedBuildId(fetchFn)).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    expect(await readDeployedBuildId(fetchReturning(respond(true, "<!doctype html>")))).toBeNull();
  });

  it("returns null when buildId is missing, empty or not a string", async () => {
    expect(await readDeployedBuildId(fetchReturning(respond(true, {})))).toBeNull();
    expect(await readDeployedBuildId(fetchReturning(respond(true, { buildId: "" })))).toBeNull();
    expect(await readDeployedBuildId(fetchReturning(respond(true, { buildId: 7 })))).toBeNull();
  });
});

describe("createUpdateChecker", () => {
  it("reports current when the ids match", async () => {
    const check = createUpdateChecker("abc123", fetchReturning(respond(true, { buildId: "abc123" })));
    expect(await check(0)).toBe("current");
  });

  it("reports update when the ids differ", async () => {
    const check = createUpdateChecker("abc123", fetchReturning(respond(true, { buildId: "def456" })));
    expect(await check(0)).toBe("update");
  });

  it("reports unknown rather than update when the check fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as FetchFn;
    expect(await createUpdateChecker("abc123", fetchFn)(0)).toBe("unknown");
  });

  it("skips a second check inside the throttle window", async () => {
    const fetchFn = fetchReturning(respond(true, { buildId: "abc123" }));
    const check = createUpdateChecker("abc123", fetchFn);
    await check(0);
    await check(CHECK_THROTTLE_MS - 1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("checks again once the throttle window has passed", async () => {
    const fetchFn = fetchReturning(respond(true, { buildId: "abc123" }));
    const check = createUpdateChecker("abc123", fetchFn);
    await check(0);
    await check(CHECK_THROTTLE_MS);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
