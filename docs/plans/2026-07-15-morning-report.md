# Morning Report — 2026-07-15 overnight run

All work is on review branches. **Nothing merged to main, nothing deployed, no DDL run.**

## TL;DR

Five features built and independently verified (I read every diff, ran typecheck +
build myself, and spot-checked the risky logic — agent self-reports were not
trusted). They are pre-combined on **`integration/2026-07-15`**, conflicts already
resolved, builds clean. Your morning path is: test one preview → merge one branch →
paste one SQL block.

## Verified branches

| Branch | Feature | Verified how |
|---|---|---|
| `feat/map-pin-avatars` | Friend faces on venue pins | build + rendered visually in a harness |
| `feat/named-directions` | Directions open the named venue | build + independently generated real URLs (Google: name+address+verified place ID; Apple: name+address, unverified IDs correctly withheld) |
| `feat/analytics-wiring` | Fail-safe event logging (6 core-loop events) | build + confirmed it cannot throw/block UI and no-ops until the events table exists |
| `feat/onboarding-location` | Skippable location step after username | build + race guard correct; privacy copy accurate (location never sent to server) |
| `chore/pwa-icons` | theme-color bug fix + manifest completeness | build + verified the light→dark fix and maskable declarations |
| **`integration/2026-07-15`** | **All five combined** | conflicts in DirectionsButton/VenuePreview/VenueDetail hand-resolved (kept both `title` and `venueId` props), tsc + build pass, zero conflict markers |

Cross-checks that cleared real risks:
- Venue titles in `places.json` match Supabase `venues.name` exactly (apostrophes verified against the seed SQL), so named-directions lookups hit on live data.
- Avatars key by check-in `venue_id` (UUID) which matches production venue ids (SupabaseDataSource).
- Events DDL reviewed: INSERT-only RLS, `with_check` prevents attributing events to another user, no client SELECT — waitlist pattern.

## Your morning steps

1. Open the Vercel preview for `integration/2026-07-15` — poke the map, a venue
   sheet (Directions → should name the venue), and Social.
2. If happy: tell Claude "merge integration" (one fast-forward, one deploy).
   If anything's off: name it; branches are independent and can merge selectively.
3. Paste the **events table DDL** in the Supabase SQL editor (Claude will put it
   on your clipboard — it's in `docs/plans/2026-07-15-analytics-prep.md`).
   Until then analytics silently no-ops; nothing breaks.
4. Two-account sanity check still owed for `feat/unblock-ui` (separate branch,
   not in the integration — block → unblock → re-request).

## Product decisions parked for you

- **Analytics:** count ghost-mode users in internal metrics? (recommend yes);
  "per night" = 6pm–6am? wire sign_in/search/filter events now or later?
- **Named directions:** run the Apple Place ID Lookup runbook (in
  `2026-07-15-named-directions-build.md`) for the 47 venues; add addresses for the
  4 missing (Paul's Cocktail Lounge, Manitoba's, The Bourgeois Pig, Angel's Share).
- **Onboarding:** confirm the location-step copy (see `LocationPrimer.tsx`).
- **Icons:** supply real art per the spec in `2026-07-15-pwa-icons-prep.md`
  (placeholder pink "E" is still live art).
- **Map-pin avatars decisions I made (veto anything):** max 2 faces + "+N" chip
  hanging under the pin; venues with friends float above other pins; photo falls
  back to initial; data = the same RLS-filtered friends-out-tonight feed the venue
  sheet uses (no new privacy surface).

## Launch gate (unchanged)

Security is hardened and live. Remaining to open doors: your click on
**Publish app** in Google Cloud (project Endz), then a stranger-account sign-in test.

---

## ⚠️ Late-night correction (session limit hit ~11:55 PM)

The second overnight wave was cut off by the usage limit (reset 3:40 AM):
- **Weekend Favorites build** — NOT completed (agent terminated early; ignore any partial `feat/weekend-picks` branch)
- **Happy Hours / Find the Move prep docs** — NOT completed
- **4-venue place-data fix** — investigation script ready (scratchpad), not yet run; the 4 venues still fall back to coordinates. Note for the fix: Angel's Share and The Bourgeois Pig may have MOVED/CLOSED at their EV addresses — validate matches by distance + business status, don't take Google's first hit.

Everything in the tables above this line WAS completed and verified. First ask of the morning: say "resume overnight leftovers" and Claude will relaunch the three unfinished tasks.
