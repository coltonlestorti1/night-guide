# Apple Maps Named Navigation — Discussion Prep (2026-07-14)

Prep doc for tracker item 1. **Nothing here is approved or built** — this is the
audit + research so the product discussion can move fast. Decisions go through
the gate, then into the tracker's Decision Log.

---

## How it works today

- `src/lib/directions.ts` builds `https://maps.apple.com/?daddr=<lat>,<lng>`
  (and the Google `dir/?api=1&destination=<lat>,<lng>` equivalent). Raw
  coordinates only — Apple Maps shows a dropped pin, navigation has no venue name.
- `src/components/DirectionsButton.tsx` is the **only** navigation surface
  (used from `VenuePreview` → map drawer + venue detail). One place to change.
- The `Venue` type (`src/data/types.ts`) has `title` + `latitude`/`longitude`
  but **no address field**. `venues.ts` (47 venues) matches.

## Data we already have (bigger than expected)

| Source | Coverage | What's in it |
|---|---|---|
| `scripts/place-ids.json` | **47/47** | Google `placeId`, Google-matched name, **full street address** (e.g. "126 1st Ave, New York, NY 10009, USA") |
| `src/data/enrichment/enrichment.json` | 43/47 | Google `placeId`, `googleMapsUri`, `businessStatus`, hours; 30-day freshness stamp. Missing: Angel's Share, Manitoba's, Paul's Cocktail Lounge, The Bourgeois Pig (likely apostrophe/name-match failures) |
| Apple identity (place ID / URL / verification) | **0/47** | Nothing exists anywhere |

So the tracker's "safe fallback to name + full address" is already possible —
the address data just isn't wired into the app. What's genuinely missing is the
Apple-side place identity.

## Research: Apple's current options

**Unified Maps URLs (iOS 18.4+, macOS 15.4+):** `maps.apple.com` now has path
components that work across devices:

- `maps.apple.com/place?place-id=<ID>` — opens the venue's real place card.
- `maps.apple.com/directions?destination=<address-or-name-or-coord>&destination-place-id=<ID>&mode=walking`
  — named navigation. Note: `destination-place-id` **requires** `destination`
  too, so the name+address string doubles as the built-in fallback.
- Legacy `?daddr=` keeps working on older iOS. Unknown: how pre-18.4 devices
  handle the new paths (probably web Apple Maps in Safari) — a physical-device
  test item.

**Apple Place IDs:** stable identifiers (e.g. `I521E602783BA9605`), designed to
stay valid as long as the place exists, and place-card data stays fresh from
Apple's side. Three ways to obtain them:

1. **Place ID Lookup** — free web tool at developer.apple.com/maps/place-id-lookup/
   (search or tap the map, read off the ID). Manual, fine for 47 venues.
2. **Maps Server API** — search endpoint resolves name+address → place ID.
   Requires Apple Developer Program (**$99/yr**); comes with **25,000 free
   calls/day**, very generous. Automatable verification + re-verification.
3. MapKit / MapKit JS at runtime (needs the dev account too; overkill for this).

Sources: [Unified Maps URLs](https://developer.apple.com/documentation/mapkit/unified-map-urls),
[Place IDs](https://developer.apple.com/documentation/MapKit/identifying-unique-locations-with-place-ids),
[Place ID Lookup](https://developer.apple.com/maps/place-id-lookup/),
[Maps Server API](https://developer.apple.com/documentation/applemapsserverapi/).

## The three realistic approaches

**A. Name + address strings, no Apple place identity.**
Wire `scripts/place-ids.json` addresses into the venue data and send
`destination=<name>, <address>`. Zero setup, ships immediately, big improvement
over a dropped pin. But the match is Apple's geocoder guessing at tap-time —
exactly the "nearby but incorrect business" failure the tracker forbids, with
no verification trail.

**B. Manually verified Apple Place IDs for the 47-venue pilot. (Recommended)**
Use the free Place ID Lookup tool to match each venue once, record
`apple_maps_place_id` + match status + verified date (the tracker's data
model), and build `directions?destination=<name+address>&destination-place-id=<ID>`.
Venues that fail verification fall back to name+address (approach A) and are
marked `needs_review` — never silently low-confidence. Cost: $0, roughly 1–2
hours of lookup work for 47 venues. This *is* the "East Village venue-data
pilot" the tracker describes.

**C. Maps Server API automation.**
$99/yr dev account, then matching + periodic re-verification
(`apple_maps_last_verified_at`) is a script. The right answer at scale (fall
campus expansion = hundreds of venues), premature for 47. Worth noting the
$99 account is needed later anyway for Capacitor/App Store, so B's stored data
upgrades into C's pipeline for free when the time comes.

**Recommendation: B now, C when we scale or once the dev account exists for
Capacitor.** And in the same change, make Google named too: the Google dir URL
accepts `destination` + `destination_place_id`, and we already have verified
Google place IDs for all 47 — that side is nearly free.

## Open product questions (to walk through one at a time)

1. **Where does the Apple place data live?** Options: extend `venues.ts` /
   a sibling `apple-places.json` (static, matches today's architecture) vs.
   Supabase `venues` columns (schema change → approval + clipboard DDL flow).
2. **Who does the 47 lookups?** Claude drives the lookup tool queries and drafts
   the match table; Colton spot-checks + does the physical-iPhone verification
   (the tool may require Apple ID sign-in, and real-device nav tests need a phone).
3. **Fallback UX:** unverified venue → name+address destination with no visual
   difference to the user, or a subtle "unverified" state? (Tracker says never
   *present* low-confidence as verified.)
4. **Pre-18.4 handling:** ship unified URLs only, or detect and fall back to
   legacy `?daddr=` with name+address?

## MVP sketch + acceptance criteria (for discussion)

MVP: add `address` to the venue data (from place-ids.json), store verified
Apple place IDs + match metadata for the 47, rebuild `directions.ts` around the
unified `/directions` URL (name+address destination, place-id when verified),
same for Google with `destination_place_id`.

Accept when: tapping Directions on a verified venue opens Apple Maps with the
venue *name* as the destination (tested on a physical iPhone); unverified
venues navigate by name+address, never bare coordinates; similarly-named venues
(Berlin, Lucky, The Library) route correctly; a closed/duplicate listing is
recorded as such in match notes, not linked.

## Files & risks

- Touch: `src/lib/directions.ts`, `src/components/DirectionsButton.tsx` (accept
  venue identity, not bare coords), `src/data/types.ts` (+address, +apple fields),
  venue data file(s). No Supabase change required if we stay static.
- Risks: generic venue names mismatching (Berlin, Lucky, The Library); venues
  inside larger buildings; pre-18.4 URL behavior unverified; Apple listing churn
  (mitigate: `apple_maps_last_verified_at` + re-verify cadence later via C).
