# Build Update Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ENDZ notice that a newer build has been deployed and offer the user a one-tap reload, so an iOS home-screen PWA or a long-lived Safari tab stops silently running an old bundle.

**Architecture:** One build ID is computed once per build and published twice — compiled into the bundle via Vite `define`, and emitted to the server as `dist/version.json`. A pure, DOM-free module re-reads `version.json` and compares. A thin React hook runs that check on app start and on foreground return, and a dismissable banner offers the reload. Nothing auto-reloads and `public/sw.js` is not touched.

**Tech Stack:** Vite 5 (+ `@vitejs/plugin-react-swc`), React 18, TypeScript, Vitest (node environment), Tailwind, lucide-react icons, react-router-dom.

**Spec:** `docs/superpowers/specs/2026-08-09-build-update-check-design.md`

## Global Constraints

- **Work in a git worktree, never in `~/Documents/night-guide` directly.** Several Claude sessions share this checkout. Pass absolute paths to file tools and `cd <abs-path> &&` inside every Bash call. See `CLAUDE.md` → "Multi-session safety".
- **`public/sw.js` must end byte-for-byte unchanged.** It is a nine-line network passthrough that caches nothing and is not the cause of the bug. Do not add caching, do not add `vite-plugin-pwa`, do not add Workbox.
- **No auto-reload, ever.** Reload happens only on an explicit user tap. Rationale in the spec: the iOS photo picker backgrounds the app, so a reload on foreground return would discard a half-written post.
- **A failed check must never show the banner.** Network error, non-200, malformed JSON, missing `buildId` → treat as "unknown" and stay silent.
- **Typecheck with `npx tsc --noEmit -p tsconfig.app.json`.** Bare `npx tsc` is a silent no-op in this repo.
- **Tests run in a node environment and only match `src/**/*.test.ts`** (see `vite.config.ts` → `test`). `.tsx` component tests are not executed at all, so all logic worth testing must live in a plain `.ts` module with `fetch` injected.
- **No new runtime dependencies.** Everything here uses what is already installed.
- Banner copy is exactly: `New version available — tap to update` (em dash, not a hyphen).
- Run the full suite with `npm test` (`vitest run`). The baseline before this work is **391 tests passing**.

---

### Task 1: The version-check module (pure, DOM-free)

**Files:**
- Create: `src/lib/buildVersion.ts`
- Test: `src/lib/buildVersion.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `VERSION_URL: string` — `"/version.json"`
  - `CHECK_THROTTLE_MS: number` — `60_000`
  - `type UpdateStatus = "current" | "update" | "unknown"`
  - `type FetchFn = typeof fetch`
  - `readDeployedBuildId(fetchFn: FetchFn): Promise<string | null>`
  - `createUpdateChecker(currentId: string, fetchFn: FetchFn, intervalMs?: number): (now: number) => Promise<UpdateStatus>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/buildVersion.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd <worktree> && npx vitest run src/lib/buildVersion.test.ts
```

Expected: FAIL — `Failed to resolve import "./buildVersion"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/buildVersion.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd <worktree> && npx vitest run src/lib/buildVersion.test.ts
```

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
cd <worktree> && git add src/lib/buildVersion.ts src/lib/buildVersion.test.ts
git commit -m "feat(update): pure build-version check, failures never signal an update"
```

---

### Task 2: Publish one build ID into both the bundle and version.json

**Files:**
- Modify: `vite.config.ts` (whole file — add `resolveBuildId`, the emit plugin, and `define`)
- Modify: `src/vite-env.d.ts` (declare the global)
- Create: `scripts/check-build-id.mjs`
- Modify: `package.json` (add the `check:build-id` script)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: a global constant `__BUILD_ID__: string` available to app source, and `dist/version.json` shaped `{ "buildId": "<id>" }`. Task 3 reads `__BUILD_ID__`.

**Why one computation, not two:** the ID is computed once and handed to both the `define` and the emitted asset. Computing it independently in two places (a timestamp in each, say) would drift by milliseconds and report a phantom update on every single check.

- [ ] **Step 1: Add the build ID to `vite.config.ts`**

Replace the whole file with:

```ts
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

/**
 * Identifies this build. Vercel exposes the commit it is building; locally we
 * ask git; failing both (a tarball, a shallow CI checkout) we fall back to a
 * timestamp, which is still unique per build and that is all this needs to be.
 */
function resolveBuildId(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return `t${Date.now()}`;
  }
}

/**
 * Writes the build id to dist/version.json so a running client can ask the
 * server which build is live. It cannot be a file in public/ — those are copied
 * verbatim and cannot carry a per-build value.
 */
function emitVersionFile(buildId: string): Plugin {
  return {
    name: "endz-build-id",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Resolved once and shared by both consumers below. Two separate
  // computations would drift and report a permanent phantom update.
  const buildId = resolveBuildId();

  return {
    server: {
      host: "::",
      port: 8080,
      fs: {
        // CLAUDE.md mandates working in git worktrees under .claude/worktrees/.
        // A worktree's node_modules resolves to the parent checkout, which is
        // outside the Vite root, so webfonts 403 and the app silently renders in
        // fallback typefaces. Allowing the repo root fixes dev only.
        allow: [".", "../../.."],
      },
    },
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      emitVersionFile(buildId),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
```

- [ ] **Step 2: Declare the global for TypeScript**

Append to `src/vite-env.d.ts` (create the file with this content plus a leading `/// <reference types="vite/client" />` line if it does not exist):

```ts
/** Injected by vite.config.ts at build time — see emitVersionFile(). */
declare const __BUILD_ID__: string;
```

- [ ] **Step 3: Add the drift check script**

Create `scripts/check-build-id.mjs`:

```js
#!/usr/bin/env node
// Proves dist/version.json and the compiled bundle agree on the build id.
//
// If these ever drift, every client sees a permanent "new version" banner that
// reloading never clears — the worst possible failure of this feature, and one
// no unit test can catch because it only exists after a real build.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve(process.cwd(), "dist");

let version;
try {
  version = JSON.parse(await readFile(path.join(dist, "version.json"), "utf8"));
} catch {
  console.error("FAIL: dist/version.json is missing. Run `npm run build` first.");
  process.exit(1);
}

const { buildId } = version;
if (typeof buildId !== "string" || buildId.length === 0) {
  console.error(`FAIL: dist/version.json has no usable buildId: ${JSON.stringify(version)}`);
  process.exit(1);
}

const assets = path.join(dist, "assets");
const js = (await readdir(assets)).filter((f) => f.endsWith(".js"));
let found = false;
for (const file of js) {
  if ((await readFile(path.join(assets, file), "utf8")).includes(buildId)) {
    found = true;
    break;
  }
}

if (!found) {
  console.error(`FAIL: buildId ${buildId} is in version.json but not in any dist/assets/*.js bundle.`);
  process.exit(1);
}

console.log(`PASS: build id ${buildId} matches in version.json and the bundle.`);
```

- [ ] **Step 4: Register the script**

In `package.json`, add to `"scripts"` immediately after the `"check:schema"` line:

```json
    "check:build-id": "node scripts/check-build-id.mjs",
```

**Not yet the `postbuild` hook.** The guard has to be wired to the build to be worth anything — nothing else in the repo runs it, since `scripts/hooks/pre-push` runs only `check:schema` and `.github/workflows/` holds only `supabase-keepalive.yml` — but it cannot pass until Task 3 gives `__BUILD_ID__` a consumer, and a `postbuild` added here would fail every build in between. Task 3 Step 4 adds it.

- [ ] **Step 5: Build, and confirm `version.json` is emitted**

```bash
cd <worktree> && npm run build && cat dist/version.json
```

Expected: `{"buildId":"<12 chars>"}`.

**`npm run check:build-id` will report FAIL at this point, and that is correct.**
Vite's `define` is a substitution, not an injection: it only rewrites the
identifier where source code actually mentions it, and nothing references
`__BUILD_ID__` until Task 3 adds the hook. So the id is genuinely absent from
the bundle until then. The `check:build-id` gate is asserted in Task 4 Step 2,
after a consumer exists. *(Plan defect found during execution — this step
originally demanded PASS here, which is unsatisfiable.)*

- [ ] **Step 6: Verify the ID actually changes between builds**

```bash
cd <worktree> && VERCEL_GIT_COMMIT_SHA=aaaaaaaaaaaaaaaaaaaa npm run build && cat dist/version.json
cd <worktree> && VERCEL_GIT_COMMIT_SHA=bbbbbbbbbbbbbbbbbbbb npm run build && cat dist/version.json
```

Expected: `{"buildId":"aaaaaaaaaaaa"}` then `{"buildId":"bbbbbbbbbbbb"}` — twelve characters, and different. This exercises the `VERCEL_GIT_COMMIT_SHA` branch, which is the one that actually runs in production.

**Do not** try to prove this with a throwaway `git commit` plus `git reset --hard`. At this point in the task the `vite.config.ts` changes are still uncommitted, and a hard reset would delete them.

- [ ] **Step 7: Typecheck and commit**

```bash
cd <worktree> && npx tsc --noEmit -p tsconfig.app.json && npm test
git add vite.config.ts src/vite-env.d.ts scripts/check-build-id.mjs package.json
git commit -m "feat(update): emit one build id into both the bundle and version.json"
```

Expected: 0 type errors, 402 tests passing (391 baseline + 11 from Task 1).

---

### Task 3: The hook, the banner, and the wiring

**Files:**
- Create: `src/hooks/useBuildUpdate.ts`
- Create: `src/components/BuildUpdateBanner.tsx`
- Modify: `src/layouts/AppLayout.tsx` (import, render before `<BottomTabs />`, and add the banner variable to `<main>`'s bottom padding)
- Modify: `src/index.css` (declare `--endz-update-banner-h: 0px` on `:root`)
- Modify: `src/pages/MapPage.tsx`, `src/components/OutTonightPrompt.tsx` (add the same variable to their fixed bottom offsets)
- Modify: `package.json` (the `postbuild` hook — Step 4)

**Why the layout files are in scope:** `AppLayout`'s routes already stack four fixed elements above the bottom edge — the tabs at 0, the Map/List toggle at 96px, "I'm out tonight" at 148px, the check-in prompt at 210px — with gaps of 8px and 22px. There is no free slot to drop a ~54px banner into, so the banner cannot simply be positioned around them; it has to join the stack and push it up. One CSS variable does that.

**Interfaces:**
- Consumes: `createUpdateChecker` from `@/lib/buildVersion` (Task 1); the `__BUILD_ID__` global (Task 2).
- Produces: `useBuildUpdate(): { show: boolean; dismiss: () => void }` and a default-exported `BuildUpdateBanner` component.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useBuildUpdate.ts`:

```ts
import { useEffect, useState } from "react";
import { createUpdateChecker } from "@/lib/buildVersion";

// Deferred so the first check never competes with first paint. The user is
// reading the map; a version fetch can wait a moment.
const START_DELAY_MS = 4_000;

/**
 * True once a newer build is known to be deployed.
 *
 * Checks at app start and on foreground return. Foreground return is the one
 * that matters: an iOS home-screen PWA resumed from the app switcher fires no
 * navigation at all, which is exactly how ENDZ kept serving Colton a build from
 * hours earlier on 2026-08-09.
 */
export function useBuildUpdate(): { show: boolean; dismiss: () => void } {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // .bind keeps the `typeof fetch` signature intact; a (...args) wrapper
    // trips up the overloads.
    const check = createUpdateChecker(__BUILD_ID__, window.fetch.bind(window));
    let latched = false;
    let cancelled = false;

    const run = async () => {
      // Once we know, we know — the answer cannot go back to "current", so
      // stop fetching. The listeners stay attached for the dismiss reset.
      if (latched || cancelled) return;
      const status = await check(Date.now());
      if (cancelled || status !== "update") return;
      latched = true;
      setUpdateReady(true);
    };

    const onForeground = () => {
      if (document.visibilityState !== "visible") return;
      // Coming back is a fresh chance to offer it to someone who waved it away.
      setDismissed(false);
      void run();
    };

    const timer = window.setTimeout(() => void run(), START_DELAY_MS);
    document.addEventListener("visibilitychange", onForeground);
    // pageshow covers a bfcache restore, which can fire no visibilitychange.
    window.addEventListener("pageshow", onForeground);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("pageshow", onForeground);
    };
  }, []);

  return { show: updateReady && !dismissed, dismiss: () => setDismissed(true) };
}
```

- [ ] **Step 2: Write the banner**

Create `src/components/BuildUpdateBanner.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { useBuildUpdate } from "@/hooks/useBuildUpdate";

/** Clearance held between the banner and whatever sits directly above it. */
const STACK_GAP_PX = 8;

/** Kept in sync with the `:root` declaration in src/index.css. */
const STACK_VAR = "--endz-update-banner-h";

/**
 * Offers a reload when a newer build is deployed. Deliberately NOT an
 * auto-reload: posting a photo backgrounds the app for the iOS picker, and
 * returning from it is precisely when an automatic reload would fire and
 * discard a half-written post.
 *
 * Placement: the banner JOINS the bottom stack rather than floating on top of
 * it. AppLayout's routes stack four fixed things above the tab bar — the
 * Map/List toggle at 96px, "I'm out tonight" at 148px, the check-in prompt at
 * 210px, and the tabs themselves at 0 — with no free slot between them. So the
 * banner takes the 96px slot and publishes its own height plus a gap as
 * `--endz-update-banner-h`; AppLayout's content padding and all three map
 * controls add that variable to their offsets and ride up by exactly the same
 * amount while it is showing. Nothing above the banner is covered, and the tab
 * bar below it is never reached: the banner's lower edge sits 40px clear of the
 * tabs' upper edge, and z-40 stays under their z-50 regardless.
 */
const BuildUpdateBanner = () => {
  const { show, dismiss } = useBuildUpdate();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Measured rather than hardcoded: at 375px the copy wraps to a second line,
  // which would silently break a fixed offset and put us back under the
  // Map/List toggle — the exact bug this placement exists to fix.
  useEffect(() => {
    const el = cardRef.current;
    const root = document.documentElement;
    if (!show || !el) return;

    const publish = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty(STACK_VAR, `${height + STACK_GAP_PX}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);

    return () => {
      observer.disconnect();
      root.style.setProperty(STACK_VAR, "0px");
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed z-40 inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))]
                 lg:inset-x-auto lg:left-24 lg:bottom-4 lg:w-80"
      role="status"
    >
      {/* Two sibling buttons, never nested — a <button> inside a <button> is
          invalid HTML and cost us tap targets on the saved-spots row before.
          The row is items-stretch and the padding lives on the children, so
          each button's hit area is its full 44px rather than the ~20px line
          box it would size to under items-center. gap-2 keeps 8px of dead,
          non-interactive space between them: a mis-tap aimed at dismiss lands
          on nothing rather than on the reload. */}
      <div
        ref={cardRef}
        className="flex items-stretch gap-2 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg px-2.5 text-left
                     transition-colors active:bg-accent"
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">New version available — tap to update</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss update notice"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-lg
                     text-muted-foreground transition-colors active:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default BuildUpdateBanner;
```

- [ ] **Step 3: Wire it into the layout, and make room for it**

In `src/layouts/AppLayout.tsx`, add the import beneath the `BottomTabs` import:

```tsx
import BuildUpdateBanner from "@/components/BuildUpdateBanner";
```

render it immediately before `<BottomTabs />`, and add the banner variable to `<main>`'s bottom padding so page content is pushed clear of it rather than sliding under:

```tsx
      <main
        className="pb-[calc(110px+var(--endz-update-banner-h)+env(safe-area-inset-bottom))]
                   lg:pb-[var(--endz-update-banner-h)] lg:pl-20"
      >
        <Outlet />
      </main>
      <BuildUpdateBanner />
      <BottomTabs />
```

Declare the variable on `:root` in `src/index.css`, inside the existing `@layer base` block, so those `calc()`s are valid before the banner has ever mounted:

```css
    --endz-update-banner-h: 0px;
```

Then add the same variable to the three fixed map controls, which is what stops the banner covering them. In `src/pages/MapPage.tsx`:

```tsx
{/* "I'm out tonight" */}
bottom-[calc(148px_+_var(--endz-update-banner-h)_+_env(safe-area-inset-bottom))] lg:bottom-[calc(4.75rem_+_var(--endz-update-banner-h))]

{/* Map / List toggle */}
bottom-[calc(96px_+_var(--endz-update-banner-h)_+_env(safe-area-inset-bottom))] lg:bottom-[calc(1.5rem_+_var(--endz-update-banner-h))]
```

and in `src/components/OutTonightPrompt.tsx`:

```tsx
bottom-[calc(210px_+_var(--endz-update-banner-h)_+_env(safe-area-inset-bottom))] lg:bottom-[calc(7rem_+_var(--endz-update-banner-h))]
```

- [ ] **Step 4: Attach the drift guard to the build**

In `package.json`, immediately after `"build"`:

```json
    "postbuild": "node scripts/check-build-id.mjs",
```

Only now is this safe — `__BUILD_ID__` finally has a consumer, so the id is actually in the bundle and the guard can pass. From here it runs on every `npm run build`, Vercel's included, and real drift fails the deploy instead of shipping a banner that reloading never clears.

- [ ] **Step 5: Typecheck, build and run the suite**

```bash
cd <worktree> && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build
```

Expected: 0 type errors, 402 tests passing, and the build ending in `PASS: build id <id> matches in version.json and the bundle.`

- [ ] **Step 6: Prove the banner renders, then revert the proof**

The banner cannot appear on a dev server (there is no `version.json` — the check returns `"unknown"` and stays silent, which is itself correct behaviour worth seeing). To see the banner, force it:

```bash
cd <worktree> && npm run dev
```

Temporarily change the first line of the `BuildUpdateBanner` body to `const { show, dismiss } = { show: true, dismiss: () => {} };`, load `http://localhost:8080` at 390px wide, and confirm:
1. the strip sits above the tab bar and covers no tab;
2. **the Map/List toggle and the "I'm out tonight" button are both still fully visible and still tappable** — they should have moved up by the strip's height, not disappeared under it;
3. tapping the text reloads the page;
4. tapping the X hides the strip, and the two controls drop back down.

**Then revert that edit** and confirm with `git diff src/components/BuildUpdateBanner.tsx` that nothing remains.

- [ ] **Step 7: Commit**

```bash
cd <worktree> && git add src/hooks/useBuildUpdate.ts src/components/BuildUpdateBanner.tsx \
  src/layouts/AppLayout.tsx src/index.css src/pages/MapPage.tsx \
  src/components/OutTonightPrompt.tsx package.json
git commit -m "feat(update): banner offering a reload when a newer build is deployed"
```

---

### Task 4: Full verification

**Files:** none modified.

**Interfaces:** none.

- [ ] **Step 1: Confirm sw.js was never touched**

```bash
cd <worktree> && git diff origin/main --stat -- public/sw.js
```

Expected: **no output at all.** Any output is a spec violation — revert it.

- [ ] **Step 2: Run every gate**

```bash
cd <worktree> && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build && npm run check:schema
```

Expected: 0 type errors; 402 tests passing; the build ending in `PASS: build id <id> matches...` (that is `postbuild` — `check:build-id` no longer needs invoking by hand); schema guard PASS. Record the real numbers — do not claim these without seeing them.

`npm run lint` fails repo-wide on pre-existing debt in files this branch never touches, so lint the changed files only:

```bash
cd <worktree> && npx eslint $(git diff origin/main --name-only -- '*.ts' '*.tsx')
```

Expected: no output.

- [ ] **Step 3: Confirm no new dependency crept in**

```bash
cd <worktree> && git diff origin/main -- package.json | grep -E '^\+' | grep -v '"check:build-id"' | grep -v '"postbuild"' | grep -v '^\+\+\+'
```

Expected: no output.

- [ ] **Step 4: Hand the device check to Colton**

This is the only test that exercises the real bug, and it cannot be run from a dev server or from Chrome — see `CLAUDE.md` → "Mobile bugs: ask for a screen recording FIRST".

**Two things will make this test report a false failure if they are skipped.** Both are baked into the steps below; do not reorder them.

- **The phone has to already be running a bundle that contains the checker.** A PWA resumed from the app switcher is still running whatever bundle it loaded — which, the first time, is the *old, checker-less* one. That build is exactly the population this feature cannot rescue. Step 2 force-quits and cold-launches once to get past it.
- **There is a 60-second throttle** (`CHECK_THROTTLE_MS`). The app checks ~4 seconds after launch and then ignores any further check for a minute. Foregrounding sooner than that does nothing at all — no banner, and no bug either. Hence the one-minute waits.

Give Colton these steps verbatim after the branch is deployed. Each one is literal; nothing is left to interpretation.

1. Wait until Vercel says the branch is deployed.
2. On the phone, open the app switcher and **swipe ENDZ away to force-quit it.** Then tap the ENDZ **home-screen icon** to launch it fresh. (This is what loads the bundle that can detect updates. Skipping it makes every later step fail for the wrong reason.)
3. Leave ENDZ open on screen for **one full minute.** Do not use the phone for anything else.
4. **Negative case first.** Switch to another app, count to ten, and switch back to ENDZ. Expected: **no banner.** Wait another full minute, then background and return once more. Still expected: **no banner.** (Waiting the minute between attempts matters — return sooner and the check is throttled, so "no banner" would prove nothing.)
5. Now deploy a trivial visible change to the same branch — for example, one word of text — and wait for Vercel to report it live.
6. Switch to another app, count to ten, then switch back to ENDZ **without force-quitting it.**
7. Expected: within a few seconds a strip reading **"New version available — tap to update"** appears above the Map/List toggle. The Map/List toggle and the "I'm out tonight" button should still be fully visible and still tappable while it is there — tap both once to confirm.
8. Tap the **X** on the right of the strip. Expected: the strip disappears and the app is untouched.
9. Background the app and return. Expected: the strip comes straight back — dismissing it is for that visit, not forever, and this path is not throttled.
10. Tap the strip's text. Expected: the app reloads and the change from step 5 is on screen.
11. Repeat steps 2–10 with ENDZ open in a **Safari tab** instead of the home-screen icon.

If the banner never appears at step 7, note whether step 2 was actually done, and how long the app was in the background — those are the two things that produce a false failure.

- [ ] **Step 5: Report honestly**

State which gates were run with their real output, and state plainly that acceptance criteria 1 and 2 are **unverified until Colton completes Step 4** — they depend on an iOS home-screen PWA and a real deploy, neither of which exists locally.

---

## Acceptance criteria (from the spec)

1. After a deploy, an already-open ENDZ shows the banner on next foreground return, on both the iOS home-screen icon and a Safari tab. *(Task 4 Step 4 — Colton)*
2. Tapping the banner loads the new build. *(Task 4 Step 4 — Colton)*
3. No banner ever appears when the build is current, including offline or on a failing network. *(Task 1 tests + Task 4 Step 4 negative case)*
4. No auto-reload, ever. *(Task 3 — reload is only in the button's onClick)*
5. `sw.js` is byte-for-byte unchanged. *(Task 4 Step 1)*
6. Ignoring the banner leaves the app fully usable. *(Task 3 Step 6 — the banner joins the bottom stack and pushes the tab bar's neighbours up via `--endz-update-banner-h`, so it covers no tab, no Map/List toggle, no "I'm out tonight" button and no check-in prompt; z-40 stays under the nav's z-50. Confirmed on device in Task 4 Step 4 item 7.)*
