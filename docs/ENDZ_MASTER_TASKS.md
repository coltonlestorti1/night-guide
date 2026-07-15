# ENDZ Master Tasks

This is a walk-through-together list, not a build queue. Every major feature here
goes through the Product-Discussion Gate (bottom of this file) before any code or
Supabase change. Items get added over time; decisions get recorded in the
Decision Log as they're made.

**Status legend:** `NOT DISCUSSED` → `IN DISCUSSION` → `APPROVED (scope recorded)` → `IN PROGRESS` → `SHIPPED` / `PARKED`

| # | Feature | Status | Current-state audit (2026-07-14) |
|---|---------|--------|----------------------------------|
| 1 | Apple Maps place links & named navigation | NOT DISCUSSED | Directions use **raw lat/lng only** (`src/lib/directions.ts`) — exactly the failure mode this task describes |
| 2 | Dynamic Happy Hours | NOT DISCUSSED | `HappyHourRail.tsx` is already time-aware (active/upcoming, day tabs, real Google hours); no location/weather/preference inputs, no explanation labels beyond timing |
| 3 | Dynamic Find the Move | NOT DISCUSSED | `VibeFinder.tsx` + `vibeScore.ts` already preference-scored (vibe/drinks/when/distance/HH), not hardcoded; no cooldowns, no diversity rules, no freshness signals |
| 4 | Dynamic Weekend Favorites | NOT DISCUSSED | `WeekendFavorites.tsx` = static rating sort filtered by open-that-night — the most static of the three surfaces; same order every weekend |
| 5 | Recommendation state & impression tracking | NOT DISCUSSED | Nothing exists. Explicitly gated: **do not create schema until recommendation design is approved** |

---

## 1. Apple Maps Place Links and Named Navigation

ENDZ should link users to the actual venue listing in Apple Maps rather than
opening a generic coordinate, dropped pin, or street address.

**User experience goal:** when a user taps "Directions" or "Open in Apple Maps,"
Apple Maps should recognize the destination as the actual bar or venue and
display the venue name during navigation.

Correct:
- Destination: The Spaniard
- Apple Maps opens the recognized venue listing
- Navigation displays the venue name

Avoid:
- Destination: 190 West 4th Street
- An unnamed dropped pin
- Raw latitude and longitude
- A nearby but incorrect business

### Venue-data model to plan for

- `apple_maps_place_id`
- `apple_maps_url`
- `apple_maps_name`
- `apple_maps_last_verified_at`
- `apple_maps_match_status`
- `apple_maps_match_confidence`
- `apple_maps_match_notes`
- `google_place_id` or other external venue identifiers
- canonical venue name
- full address
- latitude and longitude

### Match statuses

- Exact verified match
- Likely match
- Needs review
- No Apple Maps listing found
- Duplicate or conflicting listing
- Listing appears closed
- Listing name differs from ENDZ

### Implementation requirements

- Prefer a verified Apple Maps place identity or unified place URL
- Use venue name and full address when matching
- Use coordinates only as supporting location data
- Do not rely only on coordinates for the final navigation destination
- Verify that the Apple Maps destination displays the correct venue name
- Test similarly named venues and venues located inside hotels or larger buildings
- Handle venues that have changed names
- Handle duplicate Apple Maps listings
- Handle temporarily and permanently closed businesses
- Provide a safe fallback to name plus full address if a verified place match is unavailable
- Never silently navigate to a low-confidence match
- Preserve the ability to offer Google Maps or another navigation provider later

Apple supports unique place identifiers and unified Maps URLs for working with
recognized places and directions. The implementation should use the current
official Apple approach that best preserves the venue's identity.

### East Village venue-data pilot: Apple Maps verification

For every pilot venue, verify:
- The venue has an Apple Maps listing
- The ENDZ venue matches the correct Apple listing
- The venue name appears when navigation opens
- The address and coordinates are correct
- The listing is not closed or duplicated
- The directions button works on iPhone
- A reasonable fallback works on non-Apple devices
- The match date and source are recorded

### Current tasks

- [ ] Audit every existing Directions or Maps button
- [ ] Identify whether navigation currently uses coordinates, addresses, or recognized places
- [ ] Create an external-place-identity strategy
- [ ] Match initial East Village venues to Apple Maps listings
- [ ] Store verified Apple Maps identifiers or URLs
- [ ] Test named navigation on physical iPhones
- [ ] Add reporting for incorrect navigation destinations
- [ ] Prevent low-confidence place matches from being presented as verified

**Audit note (2026-07-14):** `src/lib/directions.ts` builds
`maps.apple.com/?daddr=<lat>,<lng>` and the Google equivalent — coordinates
only, no name, no address, no place identity. `DirectionsButton.tsx`
(used from `VenuePreview`) is the only navigation surface.

**Discussion-prep (2026-07-14):** full audit + Apple research in
`docs/plans/2026-07-14-apple-maps-named-nav-prep.md`. Headline:
`scripts/place-ids.json` already holds Google-verified name + full address for
all 47 venues; Apple unified URLs (iOS 18.4+) support
`directions?destination=<name+addr>&destination-place-id=<ID>`; recommended
approach = manual Place ID Lookup verification for the 47 ($0) with name+address
fallback, Server API automation ($99/yr dev account, 25k calls/day) at scale.

---

## 2. Dynamic Happy Hours

The Happy Hours experience must not show the same static list every time.

Recommendations should respond to:
- Current day / current time
- Whether the happy hour is currently active or starting soon
- User location / neighborhood / distance and travel time
- User preferences / group size
- Indoor, patio, outdoor-seating, and rooftop preferences
- Weather where relevant
- Deal quality
- Venue hours
- Verification status / last-verified timestamp / data confidence
- Recently viewed or dismissed results

Useful sections to plan:
- Happening now · Starting soon · Best value nearby · Outdoor happy hours ·
  Rooftop happy hours · Best for groups · Ending soon · Verified this week ·
  Worth traveling for

Dynamic behavior requirements:
- Do not show expired deals
- Do not show a deal outside its valid day or time
- Do not continually return the same venues merely because they have the highest static score
- Do not rotate results randomly just to create the appearance of variety
- Use meaningful context and eligibility rules
- Apply a reasonable cooldown to recently shown recommendations
- Allow a highly relevant venue to repeat when it remains genuinely the best option
- Explain why the result is being shown
- Show freshness and verification
- Avoid showing the same venues across every section
- Include fallback messaging when there are not enough verified deals

Explanation labels to consider:
- Active for the next 45 minutes · Starts at 5 PM · Verified by venue this week ·
  Best nearby verified deal · Rooftop happy hour · Covered patio available ·
  Strong fit for your group · Information may need reconfirmation

**Audit note (2026-07-14):** `HappyHourRail.tsx` already handles day/time
eligibility (active-first, ends-soonest, per-day tabs, hides without real
data) via Google happy-hour times in `src/data/enrichment`. Missing: location,
preferences, outdoor/rooftop attributes, verification/freshness display,
sections, cooldowns.

---

## 3. Dynamic Find the Move

Find the Move must generate contextual recommendations rather than repeatedly
returning the same static venues.

Return approximately three options with meaningful differences, such as:
- Best overall fit · Best nearby option · Best value · Best for the group ·
  Best atmosphere · Best neighborhood alternative

Inputs may include:
- Current day and time · user location · neighborhood · travel time
- Mood · music · budget · group size · desired activity level · venue type
- Indoor, outdoor, patio, backyard, or rooftop preference
- Hours and closing time · happy hours · line and cover information when credible
- Friends and group activity · saved venues · recently viewed venues ·
  recently dismissed recommendations · user feedback
- Data freshness · data confidence · recent weekend patterns

Dynamic and diversity rules:
- Do not hardcode the final recommendations
- Do not use one permanent "best venue"
- Do not return three venues that are effectively identical
- Avoid showing the exact same three results repeatedly when other qualified options exist
- Add recommendation diversity by neighborhood, venue type, price, atmosphere, or reason
- Apply a recent-impression cooldown
- Allow repetition when the venue remains clearly superior and explain why
- Penalize stale, incomplete, or low-confidence data
- Avoid randomness without product reasoning
- Log which recommendations were shown, selected, dismissed, saved, or shared
- Provide fallback behavior when available data is limited

Each recommendation should explain:
- Why it matches · why it is timely · how far away it is · whether it is open ·
  what data supports it · whether the information is live, verified, recently
  updated, pattern-based, or estimated

**Audit note (2026-07-14):** `VibeFinder.tsx` + `src/lib/vibeScore.ts` already
score on vibe/drinks/when/distance/happy-hour with live check-in activity —
not hardcoded. Missing: differentiated "reason" slots, diversity rules,
cooldowns, freshness/confidence signals, impression logging.

---

## 4. Dynamic Weekend Favorites

The Weekend Favorites / Best Bars This Weekend experience must not be a static
list and must not show identical results every weekend.

Final public name TBD via product discussion + user testing. Candidates:
- Weekend Favorites · This Weekend · Weekend Picks · Best This Weekend ·
  Your Weekend · Weekend Moves

Potential dynamic categories:
- Best for dancing · Best for groups · Best first stop · Best happy hour ·
  Best rooftop · Best patio · Best outdoor option · Best late-night option ·
  Best value · Best nearby · Best casual bar · Best based on preferences ·
  Trending with friends · Most reliable venue information · Worth the trip

Potential ranking inputs:
- Current weekend and date · venue operating hours · recently verified information
- Happy hours · rooftop and outdoor availability · weather
- Line and cover information · user preferences · neighborhood · travel time
- Social signals · historical Friday/Saturday patterns
- Recent saves, shares, and selections · venue-data confidence · recently displayed results

Refresh and rotation requirements:
- Recalculate on an intentional schedule
- Update when important source data changes
- Friday and Saturday results may differ
- Afternoon, early-evening, late-night, and after-midnight results may differ
- Results should not stay unchanged for weeks
- Do not force meaningless daily changes
- Do not display the same venues in every category
- Use category-specific scoring
- Apply impression cooldowns where appropriate
- Allow justified repetition for consistently strong venues
- Clearly communicate why a venue is included this weekend
- Penalize stale or uncertain information
- Store generated rankings and their supporting reasons for later analysis

**Audit note (2026-07-14):** `WeekendFavorites.tsx` = Google-rating sort
(review-count tiebreak) filtered to open-that-night, top 12, Thu/Fri/Sat tabs.
Same order every weekend by construction — the most static surface of the three.

**Discussion-prep (2026-07-14):** `docs/plans/2026-07-14-weekend-favorites-prep.md`.
Data reality: 43/47 rated, 14/47 have happy-hour windows, 0/47 have
popularTimes (serpapi source never ran). Recommended MVP = category-slotted
picks from existing data (no schema, no randomness); impression cooldowns stay
blocked on parked item 5.

---

## 5. Recommendation State and Impression Tracking

Lightweight system to understand what users have recently seen.

Potential records:
- `user_id` or `anonymous_session_id` · `recommendation_surface` · `venue_id` ·
  `neighborhood_id` · `recommendation_reason` · `rank` · `generated_at` ·
  `viewed_at` · `selected_at` · `dismissed_at` · `saved_at` · `shared_at` ·
  `expires_at` · `source_data_version` · `confidence_score`

Potential recommendation surfaces:
- Happy Hours · Find the Move · Tonight's Move · Weekend Favorites ·
  Neighborhood recommendations · Rooftop recommendations · Outdoor recommendations

Purpose:
- Prevent unnecessary repetition
- Measure recommendation usefulness
- Understand which reasons drive selection
- Improve personalization later
- Debug why a recommendation appeared
- Preserve transparency

**Constraints:** do not track unnecessary personal data. **Do not create this
database structure until the recommendation design has been discussed and
approved.**

---

## Required Product-Discussion Gate

For every major feature in this tracker, Claude must discuss the feature with
Colton before implementing it. This especially applies to: Apple Maps place
matching and named navigation · Happy Hours · Find the Move · Tonight's Move ·
Weekend Favorites · venue accuracy · outdoor seating · rooftops · lines and
covers · neighborhoods · friends and social · recommendation scoring ·
data-source integrations · App Store architecture.

Before implementation, Claude must:

1. Read the relevant task and planning documents
2. Audit the existing implementation
3. Explain how the feature currently works
4. Identify what is static, mocked, inaccurate, or incomplete
5. Ask focused product questions one at a time when decisions are needed
6. Present two or three realistic approaches when there is a meaningful choice
7. Recommend the best approach and explain the tradeoffs
8. Define the smallest useful MVP
9. Define what should be postponed
10. Agree on user flow, data behavior, privacy, and acceptance criteria
11. List the files, database areas, APIs, and risks involved
12. Wait for explicit user approval before editing code or changing Supabase

Claude must not:
- Make major product decisions silently
- Implement a recommendation formula before discussing its behavior
- Change database schemas before approval
- Choose an external data provider without discussing price, freshness, licensing, and limitations
- Introduce random result rotation as a substitute for meaningful dynamic recommendations
- Assume a feature is approved merely because it appears in this tracker
- Redesign multiple major features in one implementation session without approval

After a discussion is approved, Claude should:
- Record the decision in this file's Decision Log
- Create or update a focused planning document when needed
- Break implementation into small reversible tasks
- Implement one approved task at a time
- Test mobile, tablet, and desktop behavior
- Update the Session Handoff before ending

---

## Backlog (known, not yet specced — smaller than the numbered features)

- **Unblock UI** — **BUILT 2026-07-14, on `feat/unblock-ui` awaiting Colton's review + merge.** Collapsed "Blocked (n)" section at the bottom of the Social page (below Your Friends); Unblock deletes the block row via the existing friends data layer (`unblockUser` → `deleteFriendshipRow`, optimistic with rollback). Only rows where you're the blocker are shown. tsc + build pass. Remaining: two-account sanity check (block → appears in section → unblock → can re-request), then merge.
- **Map-pin friend avatars** — **BUILT 2026-07-15** on `feat/map-pin-avatars` + combined into `integration/2026-07-15`; awaiting Colton review. Faces (max 2 + "+N") under pins, same RLS-filtered friends-out feed as the venue sheet.
- **Location permission in onboarding** — **BUILT 2026-07-15** on `feat/onboarding-location` + integration branch; skippable /welcome/location step after username. Copy needs Colton's confirm.
- **Assisted / auto check-in** — PWA reality: foreground nearby-prompt only; true background needs Capacitor (Colton ask, 2026-07-13).
- **Night Recap** — morning-after bars-visited + ranking. Blocked: `checkIn()`/`checkOut()` currently DELETE history (needs delete→expire change — touches the protected core loop) + needs a ratings table. Recap trail private-to-self, never visible to others. Feasibility prep (2026-07-14): `docs/plans/2026-07-14-night-recap-prep.md` — delete→expire is view-compatible (all reads go through `active_check_ins`), own-history reads need no RLS change, but an UPDATE policy on `check_ins` is required.
- ~~🐛 setVibe() silently broken~~ **FIXED 2026-07-14** — `check_ins` had RLS enabled but no UPDATE policy, so the `setVibe()` UPDATE (`src/lib/checkins.ts:72`) matched 0 rows without erroring and vibes never saved. Patched live via SQL editor: "users update own checkins" policy (owner-only; identity columns immutable via pre-update snapshot; `expires_at` may only move earlier — which pre-satisfies the delete→expire DDL the Night Recap needs). Verified: 4 policies on `check_ins`. DDL recorded in `endz-schema.sql` check_ins section.
- **Going-out crew** — MySpace-Top-8-style crew of 5–8 (IG Close Friends analog). Tabled 2026-07-13; needs `close_groups`/`close_group_members`. Resume only on Colton's prompt.
- **Google OAuth out of testing mode** — random users currently CANNOT sign into the map (only added test users). A launch blocker bigger than anything above; needs Google OAuth verification or a decision on auth approach.
- **Declared intent ("going out tonight")** — Phase 1 roadmap item (2026-07-08); needs new `intents` table. Pairs with the friends layer that just shipped.
- **Analytics** — **CLIENT WIRING BUILT 2026-07-15** on `feat/analytics-wiring` + integration branch (fail-safe logEvent, 6 core-loop events). **Blocked on Colton running the events-table DDL** (in `docs/plans/2026-07-15-analytics-prep.md`); silently no-ops until then. Open Qs: ghost-mode counting, night boundary, deferred events.
- **Real PWA icons** — manifest/meta **FIXED 2026-07-15** on `chore/pwa-icons` + integration branch (theme-color was light-on-dark bug, maskable declared). **Art still placeholder** — spec for Colton in `docs/plans/2026-07-15-pwa-icons-prep.md`.
- **⏰ Enrichment refresh before ~Aug 6 (2026)** — the whole Google enrichment batch was fetched 2026-07-07 and `getEnrichment()` treats records >30 days old as absent (ToS rule), so hours/ratings/happy-hours ALL go dark unless `node scripts/enrich-venues.mjs refresh` reruns before then. Decide a cadence (e.g. 1st of each month; ~43 API calls, free tier). Found during 2026-07-15 HH/FTM prep.
- **Named directions (item 1 partial build)** — **BUILT 2026-07-15** on `feat/named-directions` + integration branch within the prep doc's recommended approach: Google fully named (43/47 verified place IDs), Apple name+address with runbook for Colton's Place ID verification; 4 venues need addresses. Full Apple named nav still needs the runbook done.
- **Full-launch readiness checklist** — added 2026-07-15 (Colton): audit everything needed beyond features to open ENDZ to the public, not just Google OAuth publishing. Candidates to walk through together: Privacy Policy + Terms of Service pages (waitlist/events/check-ins all collect user data), account deletion / data-export path, support contact, error monitoring (nothing currently catches prod exceptions), Supabase free-tier limits at real user volume (row/API caps, auto-pause), rate limiting on writable tables (events/check-ins/waitlist have no abuse guard), App Store vs. PWA-only decision for v1, content moderation for anything user-generated (block/report already exists for friends — anything else?), custom domain vs. `night-guide.vercel.app`. Needs its own discussion pass — nothing here is scoped or approved yet. **AUDIT DONE 2026-07-15** → `docs/plans/2026-07-15-full-launch-readiness-prep.md` (9 gaps ranked by severity, options + rec each; key finds: no privacy/terms pages, no account deletion, `ghost_mode` has no UI toggle, no error monitoring, no rate limiting). Quick wins flagged: ghost toggle + root error boundary. Gated DB items: rate-limit trigger, account-deletion Edge Function. Walk-through pending Colton.

---

## Decision Log

_Append decisions here as features clear the discussion gate: date, feature, decision, approved scope, what was postponed._

- 2026-07-14 — Tracker created. All features `NOT DISCUSSED`; audits recorded above.
- 2026-07-15 — **Dead venues removed** (Colton): Paul's Cocktail Lounge, Manitoba's, The Bourgeois Pig, Angel's Share — validated closed/moved/never-EV via Google Places. 47 → 43. **Standing decision: no new venues for now — focus on the venues we have** (Ladybird et al. via the discover pipeline can wait).
- 2026-07-15 — **Integration batch MERGED to main + deployed** (Colton): map-pin avatars, named directions, analytics client wiring, onboarding location step, PWA fixes, weekend slots, venue cleanup.
- 2026-07-15 — **Weekend Favorites v2 approved** (Colton): (a) late-night shows top-2 closers; (b) The Grafton gets a **labeled** anchor pick when it doesn't crack the top 2 (explicit label, never rigged rankings); (c) age tailoring — on-device ask-once age NOW nudging ALL slots incl. Overall favorites (venues within a few years of the user's age score higher, missing data neutral); (d) full birthday + social-style onboarding = separate discussion (profiles schema change); (e) LONG-TERM: age-correlated picks from our own check-in data (venue age-mix vs user age ±few yrs, "fluent" and continuous) — depends on analytics events + check-in history (delete→expire); (f) web-scraping venue age data = flagged for discussion (reliability/ToS concerns), our own check-ins are the better source.
