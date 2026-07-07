# ENDZ — Map UX Round: Drawer Info Strip, Smoother Search, "Find the Move" Picker

**Date:** 2026-07-06 (late)
**Status:** Approved (user approved design in chat; compact strip / search bundle / rules-based picker all explicitly chosen)
**Scope:** Three client-side features, no schema changes, no new services, $0: (A) enrichment quick-info strip in the map drawer, (C) forgiving search with instant results dropdown, (D) rules-based venue picker as the free AI-concierge v1.

## Context

Google venue enrichment shipped earlier tonight (see `2026-07-06-google-venue-enrichment-design.md`): `src/data/enrichment/` exposes `getEnrichment(title)`, `computeOpenState(hours)`, `describeWeeklyPeriods(ps)`, real data committed for 15 venues. Venue expansion to ~40 is a separate spec (`2026-07-06-venue-expansion-design.md`).

## A. Drawer quick-info strip

- New component `src/components/VenueQuickInfo.tsx`: `{ venue: Venue }` → up to two lines, or null without enrichment:
  - Line 1: `● Open til 2 AM · ★ 4.5 · $10–40` (open state colored emerald/rose; segments render only when the datum exists; separators only between present segments)
  - Line 2 (only when `happyHour` exists): `🍸 Happy hour Mon–Fri 4–7 PM` (via `describeWeeklyPeriods`)
- Mounted in `MapPage.tsx` drawer between the header block and `VenueStatTiles`.
- Full `VenueInfoCard` intentionally NOT in the drawer (drawer = glanceable preview; detail page keeps the full card).

## C. Smoother search

- **Normalization:** new `src/lib/searchMatch.ts` exporting `normalize(s)` (lowercase, strip diacritics via NFD, drop non-alphanumerics, collapse spaces) and `venueMatches(venue, query)` (normalized substring test against title + music_type + neighborhood). `filterVenues` in `DemoDataSource.ts` swaps its search comparison to `venueMatches` — both data sources go through it.
- **Dropdown:** in `TopHeader` (MapPage): when the search input has ≥2 chars, a glass panel below the input lists top 6 matches (name, category chip, `VenueQuickInfo` line-1 style info). Matches come from the already-fetched unfiltered venue list (new `useVenues` call without bbox, or lift the venues array — implementation may pass venues down; TopHeader gains a `venues` prop and an `onPick(venue)` callback).
- **Pick behavior:** tap (or Enter = top hit) → clear dropdown (keep query text), `setSelected(venue)`, and map flies to the venue. `Map.tsx` gains a `flyTo` behavior: when `selectedId` changes to a venue not in view, `map.flyTo({ center, zoom: >= current })`. Escape/blur closes the dropdown.
- **List view:** picking from dropdown in list view just opens the drawer (no map motion needed).

## D. "Find the move" picker (concierge v1, no LLM)

- **Entry:** a `✨ Find the move` chip appended to `PRIMARY_FILTERS` row (value `"vibe-finder"`, opens sheet instead of filtering).
- **UI:** `src/components/VibeFinder.tsx` — a Drawer with three quick-tap rows (single-select each, all optional, defaults marked):
  1. Vibe: 😌 Chill / 📈 Lively / 🔥 Packed (default: none = any)
  2. Drinks: 🍺 Cheap beers / 🍸 Cocktails / 🤷 Whatever (default Whatever)
  3. When: ⚡ Right now (default) / 🌙 Later tonight
  Then a "Show me the move" button → top 3 result cards (reuse `BarCard`) + a "Not these — show 3 more" button (pages through ranked list) + tap-through sets the map selection (closes finder, opens venue drawer).
- **Scoring:** `src/lib/vibeScore.ts` pure function `scoreVenues(venues, prefs, activity, now): ScoredVenue[]`:
  - "Right now": open-now (from enrichment hours) is a hard filter when hours are known; unknown hours = no penalty (don't punish missing data). "Later tonight": drop the open-now gate.
  - Vibe: map live check-in counts (0–2 chill / 3–5 lively / 6+ packed) toward the chosen vibe; venues with no activity data are neutral, latest broadcast vibe from `venue_activity` counts as a signal when present.
  - Drinks: "Cheap beers" favors price level $/$$ and category bar; "Cocktails" favors lounge/club, higher price levels, and title/description keywords (cocktail, speakeasy).
  - Always-on signals: rating (weighted by review count), happy hour active at `now` (bonus), saved venues (small bonus).
  - Output includes `reasons: string[]` — ONLY from real data (e.g. "Open til 2 AM", "★ 4.6 · 1.2k reviews", "Happy hour til 7", "3 here now"). No fabricated reasons ever.
- **Upgrade path:** VibeFinder renders whatever `scoreVenues` returns; a future Claude-backed Edge Function replaces the scorer, not the UI. (Real AI chat deferred: requires Anthropic prepaid credits — user chose free v1 first.)

## Copy

Tone bank compliant: "Find the move" (approved bank), "Show me the move", "Not these — show 3 more". No banned marketing phrases.

## Error handling

All three features are pure client rendering over bundled/cached data — the failure mode is absence, and every component renders nothing (or neutral scoring) on missing data. No network calls added; no loading states needed except reusing venues query state already on MapPage.

## Verification

`npx tsc --noEmit -p tsconfig.app.json` (bare tsc is a no-op) + `npm run build` + Playwright demo-mode pass: drawer strip on The Grafton; search "mcsorleys" → dropdown hit → fly+drawer; VibeFinder "Right now + Cheap beers" returns only open, real-reason cards; venues without enrichment show no empty artifacts.
