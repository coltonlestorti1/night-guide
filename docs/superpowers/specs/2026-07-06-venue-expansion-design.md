# ENDZ — Venue Expansion to ~40 (East Village only, additive)

**Date:** 2026-07-06 (late)
**Status:** Approved (user: ~40 total, most popular bars/clubs for the 21–30 crowd, EV only, must stay $0, run alongside the map-UX round)
**Hard rules (user-stated):**
1. **Additive only.** The existing seeded venues are never removed or altered by this pipeline. **The Grafton is the launch-night staple/anchor — it is never on any removal or replacement list, period.**
2. The 4 Google-flagged ghost venues (Manitoba's, The Bourgeois Pig, Angel's Share, Paul's Cocktail Lounge) stay in the app unless the user explicitly says remove after a real-world check. They appear on the review table as keep/remove for the user's decision only.
3. East Village bounding box only (beachhead locked). Approx bbox: lat 40.7205–40.7345, lng −73.9930–−73.9740.
4. $0: batch discovery via the existing restricted key, ~30 calls total, free-trial account cannot be charged.

## Pipeline (extends scripts/enrich-venues.mjs)

1. **`discover` subcommand:** Places API (New) `searchText` with queries ("bars in East Village Manhattan", "clubs in East Village Manhattan", "cocktail lounges East Village Manhattan"), field mask `places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel`, up to ~60 candidates. Filter: inside EV bbox, `types` include bar/night_club, not already in `scripts/place-ids.json` (by placeId), userRatingCount ≥ 100. Rank by `rating × log10(userRatingCount)` (popularity proxy for the 21–30 crowd). Write `scripts/venue-candidates.json` + print a review table (rank, name, address, rating, reviews, price) topped with the 4 ghost-venue keep/remove rows.
2. **USER GATE:** user crosses off candidates / says which ghosts to remove. Nothing downstream runs before this.
3. **`expand` subcommand** (reads the user-approved candidate file): for each approved candidate emit
   - a Supabase INSERT block appended to `scripts/expansion-seed.sql` (name, type mapped bar/night_club/lounge from Google types, price `$`–`$$$$` from priceLevel, lat/lng; description/music/age_range left NULL — never fabricated),
   - a matching `Venue` entry appended to `src/data/venues.ts` (id = kebab-case title; only real fields set),
   - the title added to `scripts/venue-titles.json` and placeId to `scripts/place-ids.json`.
4. **User pastes `scripts/expansion-seed.sql` into the Supabase SQL editor** (same clipboard flow as the original seed).
5. **`refresh`** runs for everyone (existing entries preserved and re-fetched; ~40 calls) → enrichment for new venues lands in the app.

## Sanity guards

- `discover` aborts if it would exceed 100 result fetches (existing >100 guard pattern).
- `expand` refuses titles that collide with existing venue titles (join-key integrity — enrichment is keyed by exact title).
- Demo data (`venues.ts`) and Supabase seed must stay in exact title parity (the enrichment join and the demo fallback both depend on it).

## Verification

Script `test` still passes; tsc + build clean after `venues.ts` grows; Playwright demo-mode: new venues render on map/list with pins, no fabricated stats (empty fields show nothing); after user's SQL paste, live mode count matches demo count (user-verified while signed in).
