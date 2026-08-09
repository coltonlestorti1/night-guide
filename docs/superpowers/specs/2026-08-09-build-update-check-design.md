# Build update check — design

**Date:** 2026-08-09
**Status:** design approved, build NOT approved
**Supersedes the belief that:** the service worker serves stale builds.

## The problem, corrected

ENDZ showed Colton a stale build four separate times on 2026-08-09, and does
the same to users after every deploy. The cause was recorded as the service
worker. **That is the wrong suspect**, and the two things everyone blames are
both already correct:

- `public/sw.js` is a nine-line network passthrough. Its `fetch` listener never
  calls `respondWith`, so it caches nothing. It has one commit in history
  (`0c1b590`), so no older caching version was ever installed on any device
  either.
- Vercel already serves `/` and `/sw.js` with
  `cache-control: public, max-age=0, must-revalidate`. `index.html` revalidates
  on every load. Verified against production on 2026-08-09.

The real gap: **nothing in the app ever checks whether a new build exists.**
`origin/main` contains no `updatefound`, no `controllerchange`, no build stamp,
no reload path. Once the SPA has loaded, it runs that bundle until the page
itself is reloaded.

So the deploy is fine and the server is fine — the client simply never goes
back for the new HTML. Two contexts make that common:

1. **iOS home-screen PWA** (how Colton uses it) — resuming from the app switcher
   fires no navigation, so `index.html` is never re-requested. The app can be
   reopened indefinitely and stay on an old bundle.
2. **A long-lived Safari tab** (how most users will hit it) — same story until
   something forces a reload.

This is why grepping the deployed bundle proved the code had shipped while the
phone disagreed. Nothing was stale on the server. The client was stale.

It also explains why it "looked newer" on the night of 2026-08-09 without any
fix landing: a reload happened by chance. Whether any given user is on the
current build is currently **luck**, and a user on an old build does not report
a bug — they conclude the feature does not exist.

## What we are building

The app learns its own build ID at build time, re-reads the deployed build ID at
a few moments, and when they differ, offers the user a reload.

Non-goals, deliberately: offline support, precaching, `vite-plugin-pwa`,
Workbox, or any change to `sw.js`. Real caching is the one thing that genuinely
can serve a stale build, and adding it to fix a staleness bug — with an App
Store submission pending — is the wrong trade. `sw.js` stays exactly as it is.

## Architecture

### 1. One build ID, two destinations

A small Vite plugin computes the build ID **once** per build and publishes it
twice:

- **into the bundle**, via `define: { __BUILD_ID__: ... }`
- **onto the server**, as `dist/version.json` → `{ "buildId": "<id>" }`,
  emitted through `generateBundle`/`emitFile`.

Computing it once is load-bearing. Two independent computations (say a
timestamp in each) would drift and report a false update on every check.

Source of the ID: `process.env.VERCEL_GIT_COMMIT_SHA`, falling back to the local
git SHA, falling back to a build timestamp. The SHA is preferred because it is
meaningful when debugging and identical across a re-deploy of the same commit.

`version.json` must not be a file in `public/` — static files there are copied
verbatim and cannot carry a per-build value.

### 2. The check itself — `src/lib/buildVersion.ts`

A pure module, no React, no DOM:

```
checkForUpdate(currentId, fetchFn, now) -> "current" | "update" | "unknown"
```

- Fetches `/version.json` with `cache: "no-store"`.
- Same ID → `"current"`. Different ID → `"update"`.
- **Any failure is `"unknown"`, never `"update"`**: network error, non-200,
  malformed JSON, missing `buildId`. A flaky connection must never produce a
  reload banner.
- Throttled: a check within 60s of the previous one is skipped.

This shape is chosen to fit the existing test setup, which is not incidental —
`vite.config.ts` sets `test.environment: "node"` and
`include: ["src/**/*.test.ts"]`. Component tests in `.tsx` are not run at all,
so the logic worth testing must live in a plain `.ts` module with `fetch`
injected.

### 3. Wiring — `src/hooks/useBuildUpdate.ts`

Thin React layer. Runs `checkForUpdate` at:

- **app start**, deferred a few seconds so it does not compete with first paint
- **`visibilitychange` → visible**, which is the foreground-return signal on both
  iOS standalone and Safari
- **`pageshow`**, which covers bfcache restores that fire no visibility change

Once `"update"` is seen it **latches** and no further fetches are made — there
is nothing more to learn, since the answer cannot go back to `"current"`. The
visibility listener itself stays attached after latching, because the banner's
dismiss state resets on foreground return (below); it just no longer fetches.

### 4. The banner — `src/components/BuildUpdateBanner.tsx`

Rendered from `AppLayout`, which covers map, discover, social, profile and venue
detail — every surface of real use. Onboarding and legal routes sit outside it
and are short-lived enough not to matter.

- A thin strip above the bottom tabs, respecting
  `env(safe-area-inset-bottom)`, matching the tab bar's existing offset.
- Does not overlay content, does not block taps, is not a modal.
- Tap → `window.location.reload()`.
- Dismissable. Dismissing hides it until the next foreground return, at which
  point it reappears — the update is still pending, and a permanent strip the
  user cannot silence is its own annoyance.

## Why the banner and not an auto-reload

**Posting a photo backgrounds the app.** The iOS photo picker takes over, and
returning from it is exactly the foreground-return moment an auto-reload would
fire on. That reload would discard a half-written post, with no explanation the
user could act on — a worse bug than the one being fixed.

The reload is the same one second either way. The banner only changes **who
picks the moment**, and the user is the one who knows whether they are mid-flow.

Worst case, someone ignores the banner and stays on an old build a while longer
— which is exactly today's behaviour, except now it is their choice rather than
silent.

## Testing

**Unit** (`src/lib/buildVersion.test.ts`, node environment):

- matching ID → `"current"`
- differing ID → `"update"`
- `fetch` rejects → `"unknown"`
- non-200 → `"unknown"`
- malformed JSON / missing `buildId` → `"unknown"`
- a second call inside 60s is skipped

**Build-level:** `dist/version.json` exists after `npm run build`, and its
`buildId` equals the `__BUILD_ID__` compiled into the bundle. This is the drift
that would break everything, so it gets asserted rather than assumed.

**Manual, on device — the only check that proves the real thing.** Deploy, open
ENDZ from the home-screen icon, deploy again, background and reopen the app,
confirm the banner appears without a cold launch. Safari tab as a second pass.
Neither can be established from a dev server.

## Acceptance criteria

1. After a deploy, an already-open ENDZ shows the banner on next foreground
   return, on both the iOS home-screen icon and a Safari tab.
2. Tapping the banner loads the new build.
3. No banner ever appears when the build is current, including offline or on a
   failing network.
4. No auto-reload, ever.
5. `sw.js` is byte-for-byte unchanged.
6. Ignoring the banner leaves the app fully usable.

## Follow-ups, not in scope

- Forcing an update for a build that must be taken (a hard security fix). Needs
  a "minimum build" concept and its own discussion.
- Surfacing the build ID in the profile/debug view for support.
