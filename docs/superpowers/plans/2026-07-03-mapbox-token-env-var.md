# Mapbox Token via Env Var — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live map render automatically for real visitors using a build-time `VITE_MAPBOX_TOKEN` env var, instead of requiring every visitor to manually paste a Mapbox token into the app before the map appears.

**Architecture:** `MapPage.tsx` currently reads the token exclusively from `useConfigStore` (Zustand, persisted to `localStorage`), which is only ever populated by two UI forms (`Profile.tsx` and the in-page `NoTokenFallback` component). This plan adds `import.meta.env.VITE_MAPBOX_TOKEN` as the primary source, falling back to the existing stored-token flow when the env var isn't set — so local contributors without a `.env.local` file, or anyone testing the manual-entry UX, keep working exactly as today.

**Tech Stack:** Vite (env vars via `import.meta.env`, `VITE_`-prefixed keys are the only ones exposed to client code), TypeScript, no test runner is configured in this repo (`package.json` has no `vitest`/`jest`/`@testing-library/*`) — verification steps below use `tsc --noEmit`, `npm run build`, and manual browser checks instead of automated tests.

## Global Constraints

- No budget for this project — every change here must work on free tiers (Vercel free hosting, Mapbox free tier: 50,000 map loads/month) — no new paid dependency may be introduced.
- Real Mapbox tokens must never be committed to git — `.env`/`.env.local` must be gitignored before any real token is placed in one.
- Do not remove the existing manual-token-entry flow (`NoTokenFallback`, `Profile.tsx` field) — it must remain as the fallback path when no env var is set.
- This plan does **not** cover restricting the Mapbox token to your domain in the Mapbox account dashboard — that's a manual step in Mapbox's web UI (account.mapbox.com → your token → URL restrictions), not a code change, and must still be done before the token is used publicly.

---

### Task 1: Declare the env var's TypeScript type and scaffold env files

**Files:**
- Modify: `src/vite-env.d.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `ImportMetaEnv.VITE_MAPBOX_TOKEN: string | undefined` — Task 2 reads this via `import.meta.env.VITE_MAPBOX_TOKEN`.

- [ ] **Step 1: Add the env var type declaration**

Replace the full contents of `src/vite-env.d.ts` (currently just the triple-slash reference) with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Verify the type-check picks it up**

Run: `npx tsc --noEmit`
Expected: no new errors (this file alone doesn't introduce any — it's confirming the baseline type-checks cleanly before further edits).

- [ ] **Step 3: Create the env var template file**

Create `.env.example` with:

```
# Mapbox public token (starts with "pk."). Get a free one at
# https://account.mapbox.com/access-tokens/ — free tier covers 50,000
# map loads/month, plenty for MVP/pitch use.
VITE_MAPBOX_TOKEN=pk.your_token_here
```

- [ ] **Step 4: Gitignore real env files**

`.gitignore` currently has `*.local` (which already catches `.env.local`) but nothing that catches a plain `.env` file. Add an explicit section so both are covered regardless of naming, by inserting this block into `.gitignore` immediately before the existing `# Editor directories and files` section:

```
# Environment variables
.env
.env.local
```

- [ ] **Step 5: Commit**

```bash
git add src/vite-env.d.ts .env.example .gitignore
git commit -m "chore: add VITE_MAPBOX_TOKEN env var type and scaffolding"
```

---

### Task 2: Read the token from the env var, falling back to the stored token

**Files:**
- Modify: `src/pages/MapPage.tsx:1-9` (header comment)
- Modify: `src/pages/MapPage.tsx:206-213` (token resolution)

**Interfaces:**
- Consumes: `ImportMetaEnv.VITE_MAPBOX_TOKEN` (Task 1); `useConfigStore().mapboxToken: string | undefined` (existing, unchanged).
- Produces: local `mapboxToken: string | undefined` variable in `MapPage`, same name and shape as before — every downstream usage (`NoTokenFallback` condition at line 273, `<Map accessToken={mapboxToken}>` at line 278) needs no changes since the variable name and type are preserved.

- [ ] **Step 1: Update the file header comment to document precedence**

In `src/pages/MapPage.tsx`, replace lines 1-6:

```tsx
/**
 * MapPage — investor-demo-ready Lisbon nightlife map.
 *
 * MAPBOX_TOKEN: Provide via Profile tab, the inline setup card on this page,
 * or set VITE_MAPBOX_TOKEN env var. Token is stored locally via useConfigStore.
 */
```

with:

```tsx
/**
 * MapPage — investor-demo-ready Lisbon nightlife map.
 *
 * MAPBOX_TOKEN precedence: the VITE_MAPBOX_TOKEN env var (build-time,
 * what production deploys use) takes priority. If it's unset, falls back
 * to the token saved locally via the Profile tab or the inline setup card
 * on this page (useConfigStore) — this keeps local dev working without a
 * .env.local file, and keeps the manual-entry flow testable.
 */
```

- [ ] **Step 2: Resolve the token from env var first, config store second**

In `src/pages/MapPage.tsx`, replace line 208:

```tsx
  const { mapboxToken } = useConfigStore();
```

with:

```tsx
  const { mapboxToken: storedMapboxToken } = useConfigStore();
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || storedMapboxToken;
```

- [ ] **Step 3: Verify the type-check and production build still pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (this repo has no `.env` yet, so this build exercises the fallback-to-`undefined` path — confirms nothing throws when the env var is absent).

- [ ] **Step 4: Manually verify the fallback path (no env var set)**

Run: `npm run dev`, open the app in a browser, open devtools console and run `localStorage.removeItem("endz-config")`, then reload.
Expected: `NoTokenFallback` renders (the "Unlock the live map" card) — identical to current behavior, confirming the fallback path still works.

- [ ] **Step 5: Manually verify the env var path**

Create a local `.env.local` (gitignored by Task 1) with a real Mapbox token:

```
VITE_MAPBOX_TOKEN=pk.<your real token here>
```

Stop and restart `npm run dev` (Vite only reads `.env*` files at server start), reload the browser.
Expected: the map renders immediately — no "Unlock the live map" card, no manual paste required.

- [ ] **Step 6: Commit**

```bash
git add src/pages/MapPage.tsx
git commit -m "feat: read Mapbox token from VITE_MAPBOX_TOKEN env var, fall back to stored token"
```

---

### Task 3: Document env var setup for local dev and Vercel deployment

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks — this is the last task in this plan.

- [ ] **Step 1: Add a "Configuration" section to README.md**

Insert this new section into `README.md`, immediately after the existing `## How can I edit this code?` section (before `## What technologies are used for this project?`):

```markdown
## Configuration

The map needs a Mapbox public token to render.

**Local development:**
1. Copy `.env.example` to `.env.local`
2. Get a free token at [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/) (50,000 map loads/month free)
3. Set `VITE_MAPBOX_TOKEN=pk.your_token` in `.env.local`
4. Restart `npm run dev` (Vite only reads env files at server start)

Without a token set, the app still runs — it falls back to a manual-entry screen where you can paste a token directly (handy for quick testing without touching `.env.local`).

**Production (Vercel):** set `VITE_MAPBOX_TOKEN` as an environment variable in the Vercel project settings (Project → Settings → Environment Variables) before deploying. Also add your production domain to the token's URL restrictions in the Mapbox dashboard (account.mapbox.com → your token → "URL restrictions") so the token can't be used from other sites.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document VITE_MAPBOX_TOKEN setup for local dev and Vercel"
```
