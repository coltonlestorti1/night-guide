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
| 6 | Favorites filter & saved venues | PARTIALLY SHIPPED (core) | **Core "Saved" filter chip SHIPPED 2026-07-17** (map+list narrow, stacks/ANDs w/ filters, device-local `store/saved.ts`, empty state, save via cards/detail). Open sub-ideas → §6 |
| 7 | User onboarding experience | NOT DISCUSSED | Today: `/welcome` (username) + `/welcome/location` (primer), Google-only sign-in. No value/welcome screens, interest/genre/age selection, friend discovery, or progressive onboarding → §7 |
| 8 | Location permissions & services | IN PROGRESS (2026-07-17) | Wiring the no-prompt Permissions API check so the dot can auto-show without a load-time prompt. Branch `feat/live-location-dot`. Spec + plan in `docs/superpowers/`. → §8 |
| 9 | User location dot on map | IN PROGRESS (2026-07-17) | Building the live Google-Maps-style dot: auto-show if already granted + follow via watchPosition + pulse halo. Branch `feat/live-location-dot`. → §9 |
| 10 | Overall app polish (ongoing) | ONGOING BUCKET | Rolling premium-feel backlog (loading/skeletons/empty states/success anim/haptics/map interactions/micro-anim/a11y/perf/nav/typography/transitions) → §10 |
| 11 | Sign-up demographics (gender, age, …) | NOT DISCUSSED | Today `profiles` = username/avatar/ghost_mode only; no gender/age collected. Needs profiles schema change + privacy disclosure → §11 |
| 12 | Group check-in & party size | NOT DISCUSSED | Today check-in is solo, counts 1 head; `activity` count drives pin tiers + "N here now". Party size would change the live crowd signal → §12 |

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

## New feature explorations (added 2026-07-17, Colton) — discuss before building

All five below are **ideas to explore and discuss, not features to implement
automatically.** Each gets the gate: present multiple UX options with pros/cons
and a recommendation before any code.

### 6. Favorites Filter and Saved Venues
**Core already SHIPPED 2026-07-17:** the "Saved" filter chip narrows map + list to
bookmarked venues, stacks/ANDs with other filters, has a "No saved spots yet"
empty state; save/unsave works from venue cards + venue detail + the preview
sheet; saves are device-local (`store/saved.ts`, localStorage). Spec:
`docs/superpowers/specs/2026-07-17-favorites-filter-design.md`.

Open sub-ideas to evaluate (options + pros/cons before recommending):
- **Count badge** — e.g. "Favorites (18)" on the chip. Pro: saved volume at a glance. Con: chip width/clutter on the horizontal scroll row; needs a live count source.
- **Save directly from a map pin** — today saving is via the sheet/cards/detail, not a pin gesture. Pro: faster. Con: pins are tiny tap targets → accidental saves.
- **Stack with future filters** — Favorites already ANDs with Happy hour + category. When **Rooftops / Open Now / Outdoor Seating** chips exist (none built yet), Favorites should compose with them too. Depends on those filters existing first.
- **Iconography** — currently a **bookmark** (matches the existing save affordance). Alternatives: heart (emotional "like"), star (rating-ish). Rec: keep bookmark for consistency unless we rebrand the save gesture app-wide.
- **Account-sync (Phase 2)** — saves are device-local now; syncing to a Supabase per-user table unlocks cross-device + server personalization. Deliberately deferred.

### 7. User Onboarding Experience
**Current state:** `/welcome` (PickUsername) + `/welcome/location` (LocationPrimer),
Google-only sign-in. No welcome/value screens, no interest selection, no walkthrough.

Ideas to evaluate: welcome screens that communicate ENDZ's value fast; account
creation options (Apple / Google / email / phone — today Google-only, Apple
deferred to native); interest selection (bar types, nightlife prefs, music
genres, age verification if needed); friend discovery; optional interactive
walkthrough (only if it adds value); progressive onboarding that avoids
overwhelm; first-run empty states; minimize friction while collecting useful
personalization.

Trade-off flags: every added step lowers completion — each field must earn its
place (YAGNI). Age verification interplays with the 18+ Terms + the on-device
age-band personalization already used in Weekend Favorites. Interest/genre data
only pays off if it feeds recommendations (ties to items 3/4/5). Apple / email /
phone auth is real scope (Apple needs native; email/phone need Supabase auth
providers + verification flows).

### 8. Location Permissions and Location Services
**Current state:** opt-in "Locate me" button + skippable `/welcome/location` primer;
`store/location.ts` is client-only and **coordinates never leave the device**
(hard privacy rule). Distance + "around me" sorting run on-device.

Ideas to evaluate: explain the value before requesting; pick the ideal moment to
ask (not on launch — e.g. the first time distance/nearby actually matters);
handle denial gracefully; approximate vs precise; fallback UX when location is
unavailable; uses — nearby venues, personalized recs, walking distance, live
activity nearby, better search.

Trade-off flags: the browser/PWA grants essentially **one** geolocation prompt —
burning it on launch tanks opt-in. Approximate-vs-precise control is limited on
web until native. Any server-side "nearby" would break the coords-never-leave-
device principle unless we send coarse/opt-in data — needs an explicit decision.

### 9. User Location Dot on Map
**Already partially exists:** `Map.tsx` `placeUserDot()` drops a "you are here" dot,
triggered by the Locate-me button (`handleLocateMe` → requestLocation → dot +
flyTo). So it renders **on-demand only** — nothing shows until the user taps
Locate-me.

Colton's ask ("a dot for where the user is") → options:
- **Auto-show on load IF permission already granted** (no new prompt) — dot appears for returning opted-in users. **Rec: lowest friction.**
- **Persist + live-update** via `watchPosition` while on the map — dot follows the user. Con: battery; we already run a watcher for out-tonight.
- **Prominence/style pass** — clearer dot on the light map (accuracy halo, subtle pulse).

Trade-off: auto-show must **not** trigger a permission prompt on load (respect
item 8's timing) — only render when permission is already granted.

### 10. Overall App Polish (ongoing bucket)
A rolling bucket of premium-feel improvements; **add candidates as spotted, each
discussed before implementing.** Categories (Colton): loading states, skeleton
screens, empty states, success animations, haptic feedback, map interactions,
micro-animations, accessibility, performance, navigation refinements, better
search, cleaner typography/spacing, polished transitions, premium UI details.

Note: some of this already exists (list skeletons, Map filter empty states incl.
the new Saved one, glass/glow/motion tokens). Treat this as a standing list —
specific candidates get appended here over time.

### 11. Sign-up demographics (gender, age, and more)
**Added 2026-07-17 (Colton) — NOT DISCUSSED, gate applies.** Collect gender, age,
"and all that" at first sign-up (the onboarding flow, item 7). Purpose to nail
down in discussion: what fields (gender, age/birthday, interests/genres?), what's
required vs optional, and — critically — how each field earns its place (every
added step lowers completion; YAGNI). Ties to: item 7 onboarding, the 18+ Terms
+ age floor, the on-device age-band personalization already in Weekend Favorites,
and the long-term "age-mix from real check-ins" idea (Decision Log 2026-07-15).
Privacy: gender/age are personal data — collecting + storing them server-side is
a change from today (profiles hold username/avatar/ghost_mode), so this needs a
`profiles` schema change + a Privacy Policy update disclosing what we collect and
why. Age verification interplay with 18+ still open. **Discuss before building.**

### 12. Group check-in & party size
**Added 2026-07-17 (Colton) — NOT DISCUSSED, gate applies.** Two linked asks:
- **Check in *with* friends** — a group/shared check-in, not just solo.
- **"How many people in your party?"** — a party-size input on check-in.
- **Party size feeds the live crowd count** — a check-in of party N should count
  as N people at the venue, so the map's live check-in / activity numbers reflect
  actual heads present, not just number of app users who tapped check-in.

Big open questions for discussion (do NOT build yet): does party size inflate the
same `activity` count that drives pin tiers (Trending/Hot) and the "N here now"
badge, and how do we keep that from being gamed? Are the "friends" in a group
check-in ENDZ users (needs their consent — RLS/privacy) or just a headcount? How
does this interact with the protected core check-in loop (`checkIn()`/`checkOut()`
in `src/lib/checkins.ts`, the `active_check_ins` view, and the analytics events)?
Likely needs a `party_size` column on `check_ins` and a rethink of how `activity`
is aggregated. Touches the most sensitive, most-protected part of the app — the
live crowd signal — so it gets a careful gate. **Discuss before building.**

---

## Decision Log

_Append decisions here as features clear the discussion gate: date, feature, decision, approved scope, what was postponed._

- 2026-07-14 — Tracker created. All features `NOT DISCUSSED`; audits recorded above.
- 2026-07-15 — **Dead venues removed** (Colton): Paul's Cocktail Lounge, Manitoba's, The Bourgeois Pig, Angel's Share — validated closed/moved/never-EV via Google Places. 47 → 43. **Standing decision: no new venues for now — focus on the venues we have** (Ladybird et al. via the discover pipeline can wait).
- 2026-07-15 — **Integration batch MERGED to main + deployed** (Colton): map-pin avatars, named directions, analytics client wiring, onboarding location step, PWA fixes, weekend slots, venue cleanup.
- 2026-07-15 — **Weekend Favorites v2 approved** (Colton): (a) late-night shows top-2 closers; (b) The Grafton gets a **labeled** anchor pick when it doesn't crack the top 2 (explicit label, never rigged rankings); (c) age tailoring — on-device ask-once age NOW nudging ALL slots incl. Overall favorites (venues within a few years of the user's age score higher, missing data neutral); (d) full birthday + social-style onboarding = separate discussion (profiles schema change); (e) LONG-TERM: age-correlated picks from our own check-in data (venue age-mix vs user age ±few yrs, "fluent" and continuous) — depends on analytics events + check-in history (delete→expire); (f) web-scraping venue age data = flagged for discussion (reliability/ToS concerns), our own check-ins are the better source.
- 2026-07-17 — **Consolidation batch SHIPPED + DEPLOYED to production** (Colton pushed `main`): root ErrorBoundary, ghost-mode toggle, Fable design pass (Discover/Social/Profile), **Favorites "Saved" filter**, **`/privacy` + `/terms` legal pages**, **"I'm out tonight" mode**. All verified live on `night-guide.vercel.app`. Ghost-mode persist + out-tonight geolocation→prompt→check-in both E2E-tested with a real signed-in session.
- 2026-07-17 — **Legal decisions locked** (Colton): entity **ENDZ**, contact **clsneaks01@gmail.com**, jurisdiction **New York**, age floor **18+**, deletion via **email (interim; self-serve button later)**, effective date **July 17 2026**. Explainer: `docs/plans/2026-07-17-effective-date-and-deletion-explainer.md`.
- 2026-07-17 — **Venues:** activated 3 dormant (Motel No Tell, Lucky, Little Rebel) → **31 active**. 4 new (Drop Off Service, Copper Still, Hidden Tiger, Chloe 81) **ON HOLD** (Google lookups paused); when added, **Chloe 81 stays dormant** (Lower East Side, off the East Village beachhead). Note: supersedes the 2026-07-15 "no new venues" standing decision — Colton is OK going a bit over 30, keep everything already live.
- 2026-07-17 — **Tracker items 6–10 added** (favorites expansion, onboarding, location permissions, location dot, app polish) — Colton's discussion list; **none approved for build**.
- 2026-07-17 — **Only remaining launch gate: Google OAuth publish** (Colton's click; project Endz/endz-501306, Auth Platform → Audience → Publish + add privacy/terms URLs to the consent screen). Push + deploy done + verified.
- 2026-07-17 — **Items 11 & 12 added** (Colton): **#11 sign-up demographics** (gender/age/etc at first sign-up — needs `profiles` schema change + privacy disclosure; ties to onboarding #7 + age personalization) and **#12 group check-in & party size** (check in with friends, "how many in your party?", party size feeds the live crowd count — touches the protected check-in loop + `activity` aggregation). Both **NOT DISCUSSED, gate applies**. Captured while building the live-location-dot feature (items 9+8).
