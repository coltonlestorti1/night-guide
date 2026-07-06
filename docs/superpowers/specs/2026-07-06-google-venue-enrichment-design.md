# ENDZ — Google Venue Enrichment (Grafton-style venue cards)

**Date:** 2026-07-06
**Status:** Approved (user pre-approved full-auto: spec → plan → build, with scope locked in chat)
**Scope:** Enrich the 19 seeded East Village venues with official Google Places API (New) data — description, hours + computed open-now, price range, rating + review count, phone, website, happy-hour times — rendered on venue cards/detail, plus a hand-curated specials slot and a provider-agnostic popular-times chart. Batch pipeline, free-tier-safe, no scraping from our infrastructure.

---

## Context

User reference: The Grafton's Google Maps card (description, hours "Open · Closes 2 AM", price per person, phone, menu link, popular times histogram). Goal: a comparable card in ENDZ.

**Product decisions (locked with user, 2026-07-06):**

1. **Official Places API only from our infrastructure.** Popular Times is not in any official API; direct scraping from our Google Cloud project is ruled out (ToS breach risks the same account that runs our OAuth).
2. **Popular times = historical pattern, not "active now."** Live activity remains our check-in counts (shipped). The chart answers "when is this bar usually busy."
3. **Popular-times data is provider-agnostic.** The chart renders whatever data exists. A SerpApi adapter ships ready-to-enable (their free tier ≈ 100 searches/mo; 19 venues monthly ≈ 19 calls) but stays OFF until the user decides to create that account — ToS-gray, risk documented, user's call. Long-term provider: our own check-in history (schema already retains expired check-ins; not built in this pass).
4. **Happy hour times come from the official API** (`regularSecondaryOpeningHours`, type `HAPPY_HOUR`) where venues publish them. Deal text (e.g. "$5 drafts til 7") is not on Google → hand-curated specials file, real entries only.
5. **No fake data.** Enrichment JSON starts empty; every UI section renders only when real data exists. Fixtures are for transform tests only and never ship into the app data file.
6. **$0/month hard constraint.** Batch refresh of a fixed venue list, never per-user live lookups. Free-tier allowances (thousands of calls/mo per SKU) dwarf our ~19 calls per refresh. Key is quota-capped (500/day) and restricted to Places API.

## Compliance requirements (binding)

- **Attribution:** wherever Google-sourced content (rating, review count, editorial summary) is displayed, show a "powered by Google"/“Data © Google” attribution adjacent. Muted text line acceptable for validation phase; proper logo asset before public launch.
- **Caching:** Places content may be cached up to 30 days. The refresh script stamps `fetchedAt`; UI treats records older than 30 days as expired (hide Google-sourced sections; log a console warning in dev). Monthly refresh cadence keeps us compliant.
- **openNow staleness:** never display Google's `openNow` boolean (stale at cache time). Store weekly `regularOpeningHours` periods; compute open/closed + "Closes 2 AM" client-side from the current time.

## Design

### 1. Data shape — `src/data/enrichment/types.ts`

```ts
export type WeeklyPeriod = { day: number; openHour: number; openMinute: number; closeHour: number; closeMinute: number; closeDayOffset: 0 | 1 };
export type PopularTimesDay = { day: number; hours: { hour: number; busyness: number }[] }; // busyness 0–100
export type VenueEnrichment = {
  placeId: string;
  fetchedAt: string;                    // ISO; >30d ⇒ treated as expired
  rating?: number; userRatingCount?: number;
  priceRange?: string;                  // e.g. "$10–40"
  editorialSummary?: string;
  phone?: string; websiteUri?: string; googleMapsUri?: string;
  businessStatus?: string;
  hours?: WeeklyPeriod[];               // regular opening hours
  happyHour?: WeeklyPeriod[];           // secondary hours, type HAPPY_HOUR
  popularTimes?: PopularTimesDay[];     // provider-agnostic
  popularTimesSource?: "serpapi";       // future: "checkins"
};
```

- `src/data/enrichment/enrichment.json` — `Record<venueTitle, VenueEnrichment>`, committed, starts `{}`. Join key = exact venue title (identical across Supabase seed and demo data).
- `src/data/enrichment/specials.json` — `Record<venueTitle, Special[]>` (existing `Special` type), hand-curated, starts `{}`.
- `src/data/enrichment/index.ts` — `getEnrichment(title)`, `getSpecials(title)`, `isExpired(e)`, `computeOpenState(hours, now): { open: boolean; closesAt?: string; opensAt?: string } | null`.

### 2. Fetch pipeline — `scripts/enrich-venues.mjs` (Node ≥18, zero deps)

- Reads `GOOGLE_PLACES_API_KEY` from `.env.local` (tiny parser, no dotenv dep).
- `node scripts/enrich-venues.mjs resolve` — for each seeded venue title + "East Village NYC": Places Text Search (New) → writes `scripts/place-ids.json` (title → placeId). Run once / when venues change. Manual review of the mapping is part of the run (wrong-place matches are the main failure mode).
- `node scripts/enrich-venues.mjs refresh` — for each placeId: Place Details (New) with a strict field mask (`id,displayName,rating,userRatingCount,priceRange,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,businessStatus,regularOpeningHours,regularSecondaryOpeningHours`); transforms into `VenueEnrichment`; merges (preserving any `popularTimes` from other providers); writes `enrichment.json`.
- SerpApi provider — `refresh --popular-times`: only runs when `SERPAPI_KEY` present in `.env.local`; otherwise prints a skip notice with the enable-path. Fetches popular times per place, normalizes to `PopularTimesDay[]`.
- Guards: abort if venue list > 100 (runaway protection); 200ms delay between calls; single retry on 5xx; any 4xx aborts the run with the response body shown (bad key / quota hit must be loud).
- Transform is a pure function in `scripts/lib/transform.mjs`; `node scripts/enrich-venues.mjs test` runs it against `scripts/fixtures/place-details.sample.json` and asserts the expected shape (works with no API key — the "key-ready" verification).

### 3. UI

- **`VenueInfoCard` (new component)** on `VenueDetail` under the About section: rows for hours (live-computed "● Open · Closes 2 AM" / "Closed · Opens 4 PM" + expandable week), price range, rating (★ 4.5 · 823 reviews), happy hour times, phone (tel:), website. Footer: attribution line. Whole card hidden when no enrichment / expired.
- **About fallback:** if venue has no seeded description but enrichment has `editorialSummary`, show it (with attribution). Seeded description always wins.
- **Specials section** ("Tonight's specials" style header per copy bank) when curated entries exist.
- **`PopularTimesChart` (new component)** below stat tiles: 7-day tabs (MON–SUN, default today), hour bars 6 PM–3 AM emphasis, current-hour highlight — visual language per the dataviz skill (read before implementing). Hidden when no data.
- **`BarCard` (map drawer / lists):** one compact line when available: "● Open · Closes 2 AM" + "★ 4.5". Nothing else — cards stay scannable.
- `open_now` on `Venue` stays untouched (it remains unset from data sources; enrichment open-state is computed in components via the enrichment module, keeping sources decoupled from Google data).

### 4. What this explicitly does NOT do

- No busyness/live data from Google. No scraping from our project. No per-user API calls (all data is bundled at build time). No new Supabase tables or RLS changes (migration to a `venue_enrichment` table is the documented next step if refresh cadence must decouple from deploys). No SerpApi account creation — adapter is dormant until the user opts in. No fabricated specials/ratings/hours.

## Error handling

- Missing API key: `resolve`/`refresh` exit 1 with setup instructions; `test` still passes.
- Unmatched venue in `resolve` (no result): recorded as `null` in place-ids.json + printed for manual fix; `refresh` skips nulls.
- Venue missing optional fields (most will lack happy hour): field simply absent; UI hides the row.
- App-side: enrichment module is synchronous bundled data — no network, no loading states, no failure modes beyond absent data.

## Verification

`npx tsc --noEmit -p tsconfig.app.json` (bare tsc is a no-op in this repo) + `npm run build` + `node scripts/enrich-venues.mjs test` (fixture transform). Browser (Playwright): with empty enrichment.json nothing new renders and nothing crashes; temporarily inject fixture data → info card, chart, specials render correctly → restore empty file before commit. When the user's API key lands: run `resolve` (review mapping), run `refresh`, spot-check The Grafton against the user's screenshot, then live browser pass with real data.

## User steps on return

1. Confirm `GOOGLE_PLACES_API_KEY` is in `.env.local` (setup instructions already given).
2. Decide on SerpApi (popular times now, ToS-gray) vs. wait for own check-in history.
3. Review the real fetched data on the cards; flag any wrong place matches.
