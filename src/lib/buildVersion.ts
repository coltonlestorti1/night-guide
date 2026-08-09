// Is the running bundle the one that is currently deployed?
//
// Nothing else in the app ever asks. Without this, an iOS home-screen PWA
// resumed from the app switcher — or any long-lived Safari tab — keeps running
// whatever bundle it loaded, because neither re-requests index.html. The server
// was never the problem: Vercel already serves index.html with
// max-age=0, must-revalidate, and public/sw.js caches nothing.
//
// Deliberately free of React and the DOM: vite.config.ts runs tests in a node
// environment and only matches src/**/*.test.ts, so this is the layer that can
// actually be tested. See docs/superpowers/specs/2026-08-09-build-update-check-design.md

export const VERSION_URL = "/version.json";
export const CHECK_THROTTLE_MS = 60_000;

export type UpdateStatus = "current" | "update" | "unknown";
export type FetchFn = typeof fetch;

/**
 * The buildId currently deployed, or null if we could not establish it.
 *
 * Every failure mode collapses to null on purpose. A flaky connection, a
 * captive-portal HTML response, a half-finished deploy — none of them are
 * evidence of a new build, and treating them as one would nag users with a
 * reload banner for a version they already have.
 */
export async function readDeployedBuildId(fetchFn: FetchFn): Promise<string | null> {
  try {
    const res = await fetchFn(VERSION_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const id = (body as { buildId?: unknown } | null)?.buildId;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * A throttled checker bound to the build id this bundle was compiled with.
 *
 * `now` is passed in rather than read from Date.now() so the throttle is
 * testable without fake timers.
 */
export function createUpdateChecker(
  currentId: string,
  fetchFn: FetchFn,
  intervalMs: number = CHECK_THROTTLE_MS,
): (now: number) => Promise<UpdateStatus> {
  let lastCheckedAt = Number.NEGATIVE_INFINITY;

  return async (now: number): Promise<UpdateStatus> => {
    if (now - lastCheckedAt < intervalMs) return "unknown";
    lastCheckedAt = now;

    const deployed = await readDeployedBuildId(fetchFn);
    if (deployed === null) return "unknown";
    return deployed === currentId ? "current" : "update";
  };
}
