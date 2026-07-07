# Map UX Round Implementation Plan (drawer strip, search, Find the Move)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship spec `2026-07-06-map-ux-round-design.md`: enrichment strip in the map drawer, forgiving search with instant dropdown + fly-to-pin, and the rules-based "Find the move" picker.

**Architecture:** Three additive client features over existing data (`src/data/enrichment`, `useVenues`, `useVenueActivity`). New pure modules (`searchMatch`, `vibeScore`) carry the logic; components stay thin. No schema, no network, no new deps.

**Tech Stack:** existing Vite + React + TS + Tailwind/shadcn; lucide icons; vaul Drawer.

## Global Constraints

- Gates: `node scripts/enrich-venues.mjs test`, `npx tsc --noEmit -p tsconfig.app.json` (bare tsc is a no-op), `npm run build`, Playwright demo-mode pass.
- No fabricated data: every rendered datum and every VibeFinder "reason" comes from real venue/enrichment/activity fields; absent data renders nothing / scores neutral.
- Copy from the approved bank; no banned phrases. Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `VenueQuickInfo` strip + mount in drawer

**Files:** Create `src/components/VenueQuickInfo.tsx`; Modify `src/pages/MapPage.tsx` (drawer, after header block ~line 332).

**Interfaces:** Produces `<VenueQuickInfo venue={Venue} />` → null without enrichment. Consumes `getEnrichment`, `computeOpenState`, `describeWeeklyPeriods`.

- [ ] Component: line 1 = segments array built from `[openState, rating, priceRange]` filtered to present, joined with `·` separators (`<span>` list, `text-xs`); open segment emerald when open / rose "Closed"; rating `★ 4.5`; price as-is. Line 2 (if `happyHour`): `🍸 Happy hour {describeWeeklyPeriods(happyHour).join(" · ")}` in `text-xs text-primary`.
- [ ] Mount in MapPage drawer directly under the header `div` (before `{/* Stats */}`).
- [ ] Gates: tsc + build. Commit `feat: add enrichment quick-info strip to map drawer`.

### Task 2: `searchMatch` module + wire into `filterVenues`

**Files:** Create `src/lib/searchMatch.ts`; Modify `src/data/sources/DemoDataSource.ts` (`filterVenues` search clause).

**Interfaces:** `normalize(s: string): string`; `venueMatches(v: Venue, q: string): boolean` — normalized substring across `title`, `music_type ?? ""`, `neighborhood ?? ""`.

- [ ] `normalize`: `s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim()`.
- [ ] `venueMatches`: `normalize(q)` empty → true; else test `normalize(title + " " + music + " " + neighborhood).includes(nq)`.
- [ ] Replace `filterVenues`' existing search comparison with `venueMatches(v, q.search)`.
- [ ] Gates + commit `feat: forgiving venue search matching (case/punctuation/diacritics)`.

### Task 3: search dropdown in `TopHeader` + map fly-to

**Files:** Modify `src/pages/MapPage.tsx` (TopHeader gains props `venues: Venue[]`, `onPick: (v: Venue) => void`); Modify `src/components/Map.tsx` (fly to selected).

**Interfaces:** MapPage passes the current (bbox-free is unnecessary — use fetched `venues`) list; `onPick` = `setSelected(v)`. Map: on `selectedId` change, if marker exists, `map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), speed: 1.2 })`.

- [ ] TopHeader: local `open` state; results = `venues.filter((v) => venueMatches(v, search)).slice(0, 6)` when `search.length >= 2`. Glass panel (`absolute` under input, `z-50`): each row = name + category chip + inline open/rating text (reuse `VenueQuickInfo` line-1 logic via small helper or duplicate two spans — keep simple). `onMouseDown` pick (fires before blur): `onPick(v); setOpen(false)`. Enter picks first result; Escape closes; input `onBlur` closes after 150ms timeout.
- [ ] Map.tsx: `useEffect` on `selectedId` → find venue in current `venues` prop → `flyTo` (skip when marker already well inside viewport: `map.getBounds().contains(...)` check optional; always-fly is acceptable v1).
- [ ] MapPage: `<TopHeader venues={venues} onPick={(v) => { setSelected(v); }} />` (works in both map and list view).
- [ ] Gates + commit `feat: instant search dropdown with fly-to-pin`.

### Task 4: `vibeScore` module

**Files:** Create `src/lib/vibeScore.ts`.

**Interfaces:** 
```ts
export type VibePrefs = { vibe?: "chill" | "lively" | "packed"; drinks?: "beer" | "cocktails"; when: "now" | "later" };
export type ScoredVenue = { venue: Venue; score: number; reasons: string[] };
export function scoreVenues(venues: Venue[], prefs: VibePrefs, activity: Record<string, { count: number; vibe?: string }> | undefined, now?: Date): ScoredVenue[];
```

- [ ] Per venue: `e = getEnrichment(title)`, `state = computeOpenState(e?.hours, now)`.
  - `when === "now"` and `state && !state.open` → excluded. `state?.open` → reason `Open til {closesAt}` +1.
  - Rating: `e.rating` → score `+ (rating - 3.5) * Math.min(1, log10(userRatingCount)/3)` and reason `★ {rating} · {count} reviews` when rating ≥ 4.2.
  - Activity: count 0–2 chill / 3–5 lively / 6+ packed; matches `prefs.vibe` → +2 + reason (`Quiet right now` / `{n} here now`); mismatch by 2 tiers → −1. Missing activity = neutral. Broadcast vibe string equal to prefs.vibe → +1.
  - Drinks: beer → `avg_price_level <= 2` +1.5 (reason `Cheap drinks`), category "bar" +0.5; cocktails → category lounge/club +1, `avg_price_level >= 3` +0.5, normalized title/description contains cocktail|speakeasy +1 (reason `Cocktail spot`).
  - Happy hour active at `now` (any `happyHour` period containing now, same minutes-of-week math as `computeOpenState` — export a small `isWithinPeriods(periods, now)` from `src/data/enrichment/index.ts`) → +1.5, reason `Happy hour til {end}`.
  - Saved bonus handled by caller? No — keep module pure; MapPage may pass nothing. Skip saved bonus (YAGNI, spec listed it as small — cut).
- [ ] Sort desc, return all (UI pages 3 at a time). Reasons capped at 3, real data only.
- [ ] Gates + commit `feat: add rules-based vibe scoring over real venue data`.

### Task 5: `VibeFinder` sheet + filter-row chip

**Files:** Create `src/components/VibeFinder.tsx`; Modify `src/pages/MapPage.tsx` (chip + mount).

**Interfaces:** `<VibeFinder open onOpenChange venues activity onPick={(v) => void} />`.

- [ ] Chip: append `{ label: "Find the move", value: "vibe-finder" }` to `PRIMARY_FILTERS` render with ✨ prefix; `handle("vibe-finder")` → `setVibeOpen(true)` (never toggles filters).
- [ ] Sheet (Drawer): three single-select rows (Vibe 😌/📈/🔥, Drinks 🍺/🍸/🤷 default 🤷, When ⚡ default /🌙) as chip buttons; primary button "Show me the move" → `scoreVenues` → show top 3 as `BarCard`s (`onClick={() => { onPick(v); onOpenChange(false); }}`); secondary "Not these — show 3 more" pages the ranked list (wraps); empty result → "Nothing open matches — try Later tonight." 
- [ ] MapPage: state `vibeOpen`; `onPick` = `setSelected` (map flies via Task 3).
- [ ] Gates + commit `feat: Find the move — rules-based picker sheet`.

### Task 6: Playwright verification (demo mode)

- [ ] `.env.local` aside → dev server → checks: (1) Grafton drawer shows strip + happy-hour line; (2) type `mcsorleys` → dropdown shows McSorley's → click → map flies + drawer opens; (3) Find the move ⚡+🍺 → 3 cards, all reasons real, any closed venue absent when "Right now" (time-dependent: assert against computeOpenState); (4) venue without enrichment (e.g. Manitoba's) → no strip, no crash; console clean. Restore `.env.local`. Screenshot each feature for the user.
- [ ] Final gates on merged state; commit any plan-checkbox updates.

## Execution note

Work directly on a feature branch `map-ux-round`; merge to main after Task 6 with user approval (same flow as google-venue-enrichment).
