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
| 8 | Location permissions & services | MERGED + denial UX (2026-07-18) | No-prompt Permissions API check + **location-denied dialog** (platform-specific enable steps on explicit taps; true-deny confirmed before showing). Open: remaining item-8 timing work. → §8 |
| 9 | User location dot on map | MERGED + halo (2026-07-18) | Live Google-Maps-style dot (auto-show if granted + follow + pulse) plus **accuracy halo** (real-meters translucent circle, always-on, no cap). → §9 |
| 10 | Overall app polish (ongoing) | ONGOING BUCKET | Rolling premium-feel backlog (loading/skeletons/empty states/success anim/haptics/map interactions/micro-anim/a11y/perf/nav/typography/transitions) → §10 |
| 11 | Sign-up demographics (gender, age, …) | NOT DISCUSSED | Today `profiles` = username/avatar/ghost_mode only; no gender/age collected. Needs profiles schema change + privacy disclosure → §11 |
| 12 | Group check-in & party size | NOT DISCUSSED | Today check-in is solo, counts 1 head; `activity` count drives pin tiers + "N here now". Party size would change the live crowd signal → §12 |
| 13 | Heat map layer | NOT DISCUSSED | No heat layer today; map uses discrete category pins + activity rings. A density/activity heat map is a new visualization → §13 |
| 14 | Profile buildout (profile + settings hub) | PHASE 1 SHIPPED (2026-07-19) | Edit profile (name/username/photo), saved spots, age pref, privacy + account sections live on main + production. Avatars bucket live; photo upload verified E2E 2026-07-19. Destination = full IG-style profile/settings → §14 + Decision Log |
| 15 | Social page buildout | NOT DISCUSSED | Foundation exists (`Social.tsx` + `components/social/`): requests, search, suggested friends, friends list, share handle, blocked section, out-tonight rows. No plans/crew/friends-tonight surfaces → §15 |
| 16 | Going-out crew | NOT DISCUSSED | Promoted from backlog (tabled 2026-07-13). Nothing built; needs `close_groups`/`close_group_members`. Naming + privacy defaults open → §16 |
| 17 | Group-size-aware discovery | NOT DISCUSSED | No group-size input anywhere in discovery today. Sibling of §12 (party size at check-in = live signal; this = planning input to recs) → §17 |
| 18 | Discover page buildout | NOT DISCUSSED | `Discover.tsx` = exactly 2 tabs (Happy Hours, Weekend Favorites), nothing else. Proposed: more sections, dynamic over time → §18 |
| 19 | Map product review | NOT DISCUSSED | Map is functional + recently cleaned up; this is a structured walk-through of pins/icons/rings/legend/filters/CTA/sheet before any changes → §19 |
| 20 | Rooftop & outdoor seating data | NOT DISCUSSED | Zero rooftop/outdoor attributes in venue data today (item 2 audit). Data-collection + surfacing priority across filters/cards/FTM/Discover → §20 |
| 21 | Group plans | APPROVED (scope recorded 2026-07-19) | Gate done. Link-first plan page (token + first Edge Function), one venue+time, RSVP, guest list w/ host hide toggle; no voting in MVP. Spec: `docs/superpowers/specs/2026-07-19-group-plans-design.md` → §21 + Decision Log |
| 22 | DMs & messaging | NOT DISCUSSED | Nothing exists. Explicitly NOT assumed to be MVP; moderation/safety/App Store questions first → §22 |
| 23 | "Share with anyone" plan card → clickable, clean link | NOT DISCUSSED (added 2026-07-21, Colton) | The CreatePlanSheet "Share with anyone" affordance is a **non-clickable info card** today (`src/components/social/CreatePlanSheet.tsx`). Make it **clickable → a clean, clear ENDZ plan link** (the `/p/:token` link, minted on create). Colton screenshot 2026-07-21. Relates to §21. → Decision Log |
| 24 | Referral invite link with auto-friend on join | NOT DISCUSSED (added 2026-07-21, Colton) | The Social "Find friends" **Share/Copy your handle** (`@user` · "Send it to the crew", `ShareHandleCard`) should share an **ENDZ invite link** with copy like *"hey I'm on ENDZ — join"*, and **auto-friend the sender** when the recipient signs up via that link. New primitive: referral-token attribution → friendship on signup (touches invite link, `/join`/onboarding, friendships). Colton screenshot 2026-07-21. Relates to §15. → Decision Log |
| 25 | "Your past events" archive in Social | NOT DISCUSSED (added 2026-07-21, Colton) | Plans **drop off the map/live surfaces after the night ends** (today: `planned_at + 6h`, no delete — rows persist) but Colton now wants a **"Your past events" history section in Social** listing plans you hosted/attended. **Reverses §21's deliberate "one-night ethos, no archive" decision** — needs a past-plans query (`planned_at < cutoff`, my plans) + a Social section + retention/visibility questions. Relates to §21 + §15. → Decision Log |

---

## Next Up (Top 10) — updated 2026-07-18

Discussion/audit order, not a build queue. Events stay **Coming Soon** (label
only, never in this list as work).

1. Discuss Profile MVP buildout (§14) — biggest gap between current page and user expectation
2. Discuss Social scope: crew, groups, group plans, DMs ordering (§15/§16/§21/§22)
3. Discuss Find the Move inputs: group size, age, rooftop/outdoor (§3 + §17 + §20)
4. Audit rooftop/outdoor data support + define verification rules (§20)
5. Add Coopers & Swifts to the venue verification queue (backlog — verify-first, Google lookups still paused)
6. Finish Apple Maps named navigation (item 1 — Google side shipped; Apple Place-ID runbook pending)
7. Map product review walk-through (§19)
8. Audit Happy Hours / Weekend Favorites / Discover for static or repetitive behavior (§2/§4/§18 — note: venue data is real Google enrichment, not mock; the static risk is ordering/rotation, worst in Weekend Favorites)
9. Discuss age-aware discovery: storage, use, protection (§11)
10. ⏰ Enrichment refresh cadence before ~Aug 14 (backlog — hours/ratings/HH all go dark otherwise; data refetched 2026-07-15, verified 2026-07-19)

---

## Decisions Needing Discussion — updated 2026-07-18

- What should the Profile MVP include? Instagram-like vs utility/settings-focused?
- What settings are needed before user testing?
- Should DMs be MVP or later? Should group plans come before DMs?
- What should "going-out crew" be called?
- How should group size affect recommendations?
- How should age affect recommendations (and how is age data stored/protected)?
- What rooftop and outdoor seating questions should Find the Move ask?
- Which map changes should happen first?
- How should Coopers and Swifts be verified before adding?
- What makes a venue eligible for Discover and Find the Move?

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

**Reaffirmed 2026-07-18 (Colton):** named navigation stays on the list until Apple
Maps opens the real venue listing (bar name shown, not an address/dropped pin) for
**all verified venues, including future additions** (e.g. Coopers & Swifts once
they clear verification). Partial build shipped 2026-07-15 (Google fully named;
Apple name+address); the Apple Place-ID verification runbook is the open piece.

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

**Input buildout (added 2026-07-18, Colton — folds his FTM list into this item):**
Current inputs = vibe, drinks, when, near, happy hour, age (21-25/25-30/30+ —
already in `VibeFinder.tsx`); results already come in sets of 3. To add (each
must be discussed, no scoring changes before the gate): rooftop preference,
outdoor-seating preference, patio/backyard, group size + going-out-with-crew
(→ §17), budget, distance, music, open now vs later tonight, neighborhood
preference. Each of the ~3 results should explain: why it fits, age/vibe/group
fit, rooftop/outdoor availability, happy-hour applicability, proximity, open
status, and whether the data is **verified, estimated, or stale**. Depends on:
§20 (rooftop/outdoor data must exist before FTM can ask about it), §17 (group
size), §11 (age handling).

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

- **Unblock UI** — **MERGED to main** (`5d98e56`; verified on main 2026-07-19 — stale "awaiting merge" note corrected). Collapsed "Blocked (n)" section at the bottom of the Social page; Unblock deletes the block row via the existing friends data layer (`unblockUser` → `deleteFriendshipRow`, optimistic with rollback). Only rows where you're the blocker are shown.
- **Map-pin friend avatars** — **BUILT 2026-07-15** on `feat/map-pin-avatars` + combined into `integration/2026-07-15`; awaiting Colton review. Faces (max 2 + "+N") under pins, same RLS-filtered friends-out feed as the venue sheet.
- **Location permission in onboarding** — **BUILT 2026-07-15** on `feat/onboarding-location` + integration branch; skippable /welcome/location step after username. Copy needs Colton's confirm.
- **Assisted / auto check-in** — PWA reality: foreground nearby-prompt only; true background needs Capacitor (Colton ask, 2026-07-13).
- **Night Recap** — morning-after bars-visited + ranking. Blocked: `checkIn()`/`checkOut()` currently DELETE history (needs delete→expire change — touches the protected core loop) + needs a ratings table. Recap trail private-to-self, never visible to others. Feasibility prep (2026-07-14): `docs/plans/2026-07-14-night-recap-prep.md` — delete→expire is view-compatible (all reads go through `active_check_ins`), own-history reads need no RLS change, but an UPDATE policy on `check_ins` is required.
- ~~🐛 setVibe() silently broken~~ **FIXED 2026-07-14** — `check_ins` had RLS enabled but no UPDATE policy, so the `setVibe()` UPDATE (`src/lib/checkins.ts:72`) matched 0 rows without erroring and vibes never saved. Patched live via SQL editor: "users update own checkins" policy (owner-only; identity columns immutable via pre-update snapshot; `expires_at` may only move earlier — which pre-satisfies the delete→expire DDL the Night Recap needs). Verified: 4 policies on `check_ins`. DDL recorded in `endz-schema.sql` check_ins section.
- **Going-out crew** — **PROMOTED 2026-07-18 to tracker item §16** (was tabled 2026-07-13). See §16 for naming candidates, behavior, and privacy rules.
- **Venue verification queue** (added 2026-07-18) — candidates to verify before any addition; Google lookups still **paused**, do NOT run bulk `enrich resolve`:
  - **Coopers** and **Swifts** (Colton, 2026-07-18) — verify-first: confirm these refer to the intended East Village/NYC bars; check exact names, addresses, operating status, category, coordinates, and Apple Maps/Google Maps identity (item 1 named-nav applies). Add **only after confirmation** — never as verified venues on name alone.
  - Drop Off Service, Copper Still, Hidden Tiger, Chloe 81 (2026-07-17, ON HOLD; Chloe 81 stays dormant — LES, off the EV beachhead).
- **Google OAuth out of testing mode** — random users currently CANNOT sign into the map (only added test users). A launch blocker bigger than anything above; needs Google OAuth verification or a decision on auth approach.
- **Declared intent ("going out tonight")** — Phase 1 roadmap item (2026-07-08); needs new `intents` table. Pairs with the friends layer that just shipped.
- **Analytics** — **CLIENT WIRING BUILT 2026-07-15** on `feat/analytics-wiring` + integration branch (fail-safe logEvent, 6 core-loop events). **Blocked on Colton running the events-table DDL** (in `docs/plans/2026-07-15-analytics-prep.md`); silently no-ops until then. Open Qs: ghost-mode counting, night boundary, deferred events.
- **Real PWA icons** — manifest/meta **FIXED 2026-07-15** on `chore/pwa-icons` + integration branch (theme-color was light-on-dark bug, maskable declared). **Art still placeholder** — spec for Colton in `docs/plans/2026-07-15-pwa-icons-prep.md`.
- **⏰ Enrichment refresh before ~Aug 14 (2026)** — the Google enrichment batch was last fetched **2026-07-15** (all 52 records; verified 2026-07-19) and `getEnrichment()` treats records >30 days old as absent (ToS rule), so hours/ratings/happy-hours ALL go dark unless `node scripts/enrich-venues.mjs refresh` reruns before then. Decide a cadence (e.g. 1st of each month; ~43 API calls, free tier). Found during 2026-07-15 HH/FTM prep.
- **Named directions (item 1 partial build)** — **BUILT 2026-07-15** on `feat/named-directions` + integration branch within the prep doc's recommended approach: Google fully named (43/47 verified place IDs), Apple name+address with runbook for Colton's Place ID verification; 4 venues need addresses. Full Apple named nav still needs the runbook done.
- **Full-launch readiness checklist** — added 2026-07-15 (Colton): audit everything needed beyond features to open ENDZ to the public, not just Google OAuth publishing. Candidates to walk through together: Privacy Policy + Terms of Service pages (waitlist/events/check-ins all collect user data), account deletion / data-export path, support contact, error monitoring (nothing currently catches prod exceptions), Supabase free-tier limits at real user volume (row/API caps, auto-pause), rate limiting on writable tables (events/check-ins/waitlist have no abuse guard), App Store vs. PWA-only decision for v1, content moderation for anything user-generated (block/report already exists for friends — anything else?), custom domain vs. `night-guide.vercel.app`. Needs its own discussion pass — nothing here is scoped or approved yet. **AUDIT DONE 2026-07-15** → `docs/plans/2026-07-15-full-launch-readiness-prep.md` (9 gaps ranked by severity, options + rec each; key finds: no privacy/terms pages, no account deletion, `ghost_mode` has no UI toggle, no error monitoring, no rate limiting). Quick wins flagged: ghost toggle + root error boundary. Gated DB items: rate-limit trigger, account-deletion Edge Function. Walk-through pending Colton. **Potential missing product areas appended 2026-07-18 (Colton)** — additional candidates for the same walk-through, beyond the 9 audited gaps: push-notification strategy (needs Capacitor) · report-incorrect-venue-info flow · recommendation feedback ("was this a good pick?") · admin tools for venue data · analytics events (client wiring built, DDL pending) · empty states for every tab · real photo strategy for venues · production-data vs demo-data distinction · venue detail page depth · TestFlight plan (later) · onboarding flow (§7) · location-permission explanation (§8) · account deletion + blocking/reporting/safety (already in the audit).

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

**Accuracy note (2026-07-17, Colton):** on a laptop/desktop the dot can land a
block+ off — browser geolocation there is WiFi/IP-triangulated, not GPS, so it's
inherently coarse (a phone with real GPS is far tighter; ENDZ is mobile-first).
Not a rendering bug. This is exactly what the **accuracy halo** (the deferred
part of the MVP) is for — a translucent radius around the dot communicates
"approximate," so an off dot reads as uncertainty rather than as wrong. Given the
real-world feedback, promoting the accuracy halo from "cheap follow-up" to
**recommended next follow-up** — discuss before building.

**RESOLVED 2026-07-18:** accuracy halo built and merged (`feat/accuracy-halo` →
main). GeoJSON circle polygon at the fix's reported accuracy in real meters,
`#3b82f6` at 10% opacity, always-on/no-cap (Colton's call — faintness is the
safety valve), clears with the watcher. `request()` now records accuracy so the
Locate-me first paint has a halo. Spec/plan in `docs/superpowers/`.

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

**Age-aware discovery (added 2026-07-18, Colton — folds his "age-aware discovery"
item into this one):** beyond collection, actively use age/age-range to tailor
Discover, Find the Move, Weekend Favorites, and neighborhood recs — e.g. don't
send someone seeking an older crowd to a college-heavy bar, or someone seeking a
young lively crowd to a quiet lounge; tune copy and section ordering. Some of
this already exists: FTM has an age input and Weekend Favorites has on-device
age-band nudging (Decision Log 2026-07-15). Hard rules: age is
**preference/context, not identity labeling**; no hard assumptions or
discriminatory claims; how age data is stored, used, and protected must be
discussed before any server-side collection or new scoring.

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

### 13. Heat map layer
**Added 2026-07-17 (Colton) — NOT DISCUSSED, gate applies.** A heat-map
visualization on the map. Key questions to settle in discussion before any code:
**what does "heat" represent?** Options include live check-in density / crowd
("where's popping right now"), historical popularity by night/time, happy-hour
concentration, or friends' activity. Each implies a different data source and a
different freshness/privacy profile — live crowd heat rides the same `activity`
signal that drives pin tiers (and shares its gaming/thin-data concerns), whereas
historical heat needs stored patterns we may not have yet. Tech: MapLibre
supports a native `heatmap` layer over a GeoJSON point source, so rendering is
cheap; the real work is defining the weight/meaning and how it coexists with the
existing pins (toggle? zoom-dependent?). Pairs naturally with #12 (party size
would enrich the crowd weight) and the analytics/check-in data. **Discuss —
which "heat," MVP scope, and how it reads alongside pins — before building.**

---

## Product-depth batch (added 2026-07-18, Colton) — discuss before building

All of items 14–22 below came from Colton's 2026-07-18 to-do list. Every one is
**NOT DISCUSSED — gate applies.** These are proposed feature sets, not approved
scope.

### 14. Profile Buildout (profile + settings hub)
**Current state (audited 2026-07-18):** `Profile.tsx` = signed-in card (Google
avatar, display name, @username, ENDZ cover band), ghost-mode toggle, sign out,
collapsible developer settings, privacy/terms footer links. That's all — no
edit-profile, bio, photo upload, saved spots, preferences, notifications, help,
or account management.

Proposed sections (candidates, not commitments): profile header (photo, display
name, username, bio/status, Edit Profile) · saved spots + favorite venues +
favorite neighborhoods · going-out / music / budget / age-range /
rooftop-outdoor preferences · privacy settings (location visibility, who sees
check-ins / going-out status / exact venue vs neighborhood-only, appear
offline) · allow friends to invite me to plans · DMs-from-friends-only ·
notification settings · account settings (connected accounts later, blocked
users, report a problem, help/support, terms & privacy, sign out) ·
delete-account (App Store readiness — email-interim already decided, self-serve
later).

Guardrails: Profile must **not** become cluttered — the MVP cut gets discussed
first (Instagram-depth vs utility/settings-focused is an open decision). Several
proposed settings imply features that don't exist yet (plans → §21, DMs → §22,
per-check-in visibility granularity) — settings ship with their features, not
before. Overlaps: saved spots (§6, device-local today), demographics/prefs
(§11), full-launch-readiness gaps (ghost toggle + legal pages already shipped;
account deletion pending).

### 15. Social Page Buildout
**Current state (audited 2026-07-18):** solid foundation in `Social.tsx` +
`components/social/` — friend requests, profile search ("find friends"),
suggested friends, accepted friends list, share-your-handle card, blocked
section, out-tonight rows. What's missing is product direction beyond the
friend graph.

Proposed areas: friends going out tonight / already out / considering
neighborhoods / at venues (privacy permitting — RLS-filtered friends feed
partially exists via out-tonight + map-pin avatars) · going-out crew (§16) ·
group plans (§21) · shared recommendations · invite/share link · DMs + group
chats later (§22).

Guardrails (Colton): the Social page should **not** become a full Instagram
feed right away; DMs/group chats are desired but scope + privacy get discussed
first; MVP likely needs lightweight group planning **before** full messaging.

### 16. Going-Out Crew
**Promoted 2026-07-18 from the backlog** (tabled 2026-07-13; needs
`close_groups`/`close_group_members`). A close nightlife group of ~5–8 people —
IG Close Friends analog.

Name is temporary and gets discussed/tested. Candidates: Crew · Going-Out Crew ·
Night Circle · Close Crew · The Group · Inner Circle · Plans · Night Friends.

Proposed behavior: user manually selects 5–8 people; can reorder, remove,
replace; crew tailors recommendations; crew sees going-out statuses if privacy
allows; crew shares plans; venue/neighborhood voting later. **Private by
default** unless discussed otherwise. Hard rule: **no auto-ranking of friends
and no public MySpace-style ranking without explicit user approval.**

### 17. Group-Size-Aware Discovery
**Current state:** no group-size input exists anywhere in discovery. Sibling of
§12 — party size at check-in is the *live crowd signal*; this is the *planning
input* to recommendations. Keep them linked but distinct in discussion.

User states: solo · with 1–2 · with 3–5 · with 6+ · with my crew (§16).
Find the Move and Discover eventually adjust: bigger groups → larger venues,
no-cover/easy-entry, patios/rooftops/casual bars; smaller groups → cocktail
bars/lounges; large groups → space + reliable entry.

Candidate fields (schema NOT approved): `current_group_size`,
`going_out_with_crew`, `group_budget_preference`, `group_vibe_preference`,
`group_rooftop_preference`, `group_outdoor_preference`,
`group_neighborhood_preference`.

### 18. Discover Page Buildout
**Current state (audited 2026-07-18):** `Discover.tsx` = exactly two tabs —
Happy Hours (`HappyHourRail`) and Weekend Favorites — nothing else. Useful but
thin.

Proposed sections: Tonight's Move · Happy Hours · Weekend Favorites · Rooftops ·
Outdoor Seating · Neighborhoods · Saved Spots · Friends Going Out · Coming
Soon: Events / Bar Happenings (label only — Events stays Coming Soon).

Guardrails: sections should become dynamic over time rather than static
(dynamics work tracked in §2/§4/§5); **do not overbuild Discover before venue
data is more reliable** — Rooftops/Outdoor sections depend on §20 data
existing.

### 19. Map Product Review
**Current state:** map is much cleaner than before (Colton, 2026-07-18), but
major changes need a structured product walk-through first. Overlaps §10
(polish bucket) and §13 (heat map) — this is the discussion umbrella.

Walk-through agenda: pin crowding · icon clarity (are beer/martini/globe the
right venue icons?) · are activity rings meaningful · should the activity
legend stay visible · filters collapse vs scroll · Find the Move as a prominent
map CTA · rooftop/outdoor filters on the map (§20) · neighborhood boundaries or
zones · pin tap → bottom sheet (a preview sheet exists today — evaluate it) ·
is selected-venue state obvious enough · does list view need better images and
venue details.

**No map changes until Colton and Claude talk through the options.**

### 20. Rooftop & Outdoor Seating Data
**Current state (audited 2026-07-18):** venue data has **zero**
rooftop/outdoor attributes (item 2 audit) — this is the blocking dependency for
every rooftop/outdoor mention in §2/§3/§4/§6/§14/§17/§18/§19. Current
venue-data priority.

Surfaces to add to (once data exists): venue filters · venue cards · venue
detail pages · Find the Move · Tonight's Move · Weekend Favorites · Discover
sections.

Hard rules (Colton): rooftops are **separate** from general outdoor seating —
each gets its own icon. Never present a rooftop as public/open unless verified.
Never present outdoor seating as available if it's seasonal, closed,
weather-dependent, or unverified. (Verification/freshness display ties into the
item-1-style verified/estimated/stale vocabulary.)

### 21. Group Plans
**APPROVED 2026-07-19 (gate done; scope in
`docs/superpowers/specs/2026-07-19-group-plans-design.md`).** Link-first plan
page: one venue + time + optional note, one-tap RSVP (going/maybe/can't),
guest list visible with host hide toggle, pick-friends invites + shareable
`/p/:token` link that works for NON-users (name-only RSVP, no account) via an
unguessable token + ENDZ's first Edge Function — existing RLS untouched
(anon-auth explicitly rejected: blast radius on every `authenticated` policy).
Entry points: Social Plans section + venue detail. Works pre-OAuth-publish —
guests never touch Google.

**Not in MVP (logged in spec):** voting/multi-option plans (Colton wants to
see it — v2 with §17 FTM-for-group) · day-of reminders (needs push) · crew
invites (§16) · comments (§22) · venue-TBD plans (declared-intent backlog
stays separate).

**Build authorization:** implementation plan + DDL + Edge Function deploy
each still go through Colton — approval covers the scope, not a silent build.

### 22. DMs & Messaging
**Current state:** nothing exists, and DMs are **not assumed to be MVP**.

Discussion questions: are DMs needed for MVP at all? One-to-one only at first?
Does group messaging wait? Should ENDZ start with shared plans + recommendation
sharing instead? What moderation, blocking (friend-level block exists),
reporting, and privacy controls are required? How does messaging affect App
Store review and safety requirements?

Likely MVP alternative (Colton's lean): share a venue · share a Find the Move
result · lightweight group plan (§21) · comments later · DMs only after privacy
+ moderation are ready.

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
- 2026-07-17 — **Item 13 added** (Colton): **heat map layer** — NOT DISCUSSED, gate applies. Open first question = what "heat" means (live crowd density vs historical vs friends vs happy-hour); MapLibre has a native heatmap layer so rendering is cheap, the meaning/scope is the work. Captured mid-build of the live-location-dot.
- 2026-07-17 — **Location-dot accuracy note** (Colton flagged dot landing a block off on desktop): browser geolocation on laptop = WiFi/IP, coarse by nature; phone GPS is tight. Not a bug. Promoted the **accuracy halo** (deferred MVP part of item 9) to recommended next follow-up — communicates uncertainty visually. See §9.
- 2026-07-17 — **Live location dot (items 9+8) MERGED to main** (Colton OK'd merge; `feat/live-location-dot` → main `--no-ff`). Google-Maps-style own-dot: auto-show for already-granted users (no load-time prompt, Permissions API), follow via reference-counted watchPosition shared with out-tonight, pulse halo. Built subagent-driven, code-reviewed, live-verified (mocked geo); caught+fixed a visibility race + a first-fix paint bug. tsc+build clean on main. **NOT pushed/deployed** (Colton's push). Deferred: **accuracy halo** (promoted to recommended next follow-up after Colton saw a desktop dot land a block off — laptop WiFi geolocation is coarse, phone GPS is tight). Items 8/9 status → MERGED.
- 2026-07-18 — **Main pushed + deployed** (Colton OK): live location dot + ultrareview watcher-guard fix (auto-show effect now gates on cancelled/hidden — closed a permanent watcher-leak race) went to production via Vercel.
- 2026-07-18 — **Accuracy halo (item 9 follow-up) MERGED to main** (Colton OK'd; `feat/accuracy-halo` → main `--no-ff`, then pushed). Real-meters GeoJSON circle under the dot at the fix's reported accuracy; always-on, no threshold/cap (Colton's call), `#3b82f6` @ 10% opacity; pre-style-load fixes buffered + flushed on map load; halo clears with the watcher; `request()` records accuracy for Locate-me. Full gate flow (spec + plan in `docs/superpowers/`), subagent-driven build, live-verified with mocked geo at coarse/tight/moving fixes + zoom scaling + no-prompt rule. Live verify caught + fixed **2 real bugs**: unmount crash (map removed before stopWatching's halo clear — fixed by nulling map ref on remove) and a locate-me post-await null-map race (final whole-branch review, deterministic after the null-ref fix). Optional follow-up logged: declare `@types/geojson` as an explicit devDependency (currently transitive via maplibre-gl).
- 2026-07-18 — **@types/geojson declared** as explicit devDependency (follow-up closed).
- 2026-07-18 — **Location-denied dialog (item 8 denial-UX slice) MERGED to main** (Colton OK'd; `feat/location-denied-dialog` → main `--no-ff`). Trigger: Colton hit the dead-end "Location unavailable" toast on his iPhone with location blocked for Safari. Store now records failure reason (denied/unavailable/timeout — error code was previously discarded); explicit taps (Locate-me, Find-the-move "around me") route TRUE denials to a dialog with platform-specific enable steps (iOS Safari / iOS Chrome+Firefox / Android / iPad / generic); timeouts keep honest toasts. **Explicit taps only** (Colton's call — no banners/nagging). Deep-linking to OS settings from web: impossible (verified); dialog comments note the Capacitor-phase "Open Settings" upgrade. Final review caught: dismissed-prompt ≠ denied (same error code — now re-confirmed via Permissions API with old-iOS-Safari escape hatch) + iOS Chrome/FF needed non-Safari copy. Live-verified all branches incl. UA-emulated platform copy. Spec/plan in `docs/superpowers/`.
- 2026-07-18 — **Product-depth batch added** (Colton's to-do list merged into the tracker; docs-only, no code/DB/deploy changes). New items **§14–§22**: Profile buildout, Social buildout, going-out crew (promoted from backlog), group-size-aware discovery, Discover buildout, map product review, rooftop/outdoor seating data, group plans, DMs & messaging — **all NOT DISCUSSED, gate applies.** Folded into existing items: FTM input buildout → §3; age-aware discovery → §11; Apple Maps named-nav reaffirmed (incl. future venues) → §1; missing-product-areas → full-launch-readiness backlog entry. **Coopers & Swifts** added to a new venue-verification-queue backlog entry (verify-first; lookups still paused). Added visible **Next Up (Top 10)** + **Decisions Needing Discussion** sections. Events stays Coming Soon (label only).
- 2026-07-18 — **§14 Profile MVP (phase 1) APPROVED** (Colton, full gate discussion). Direction: **phased hybrid** — utility/settings hub now, laid out so the **full Instagram-style profile + settings (Colton's explicit end state)** grows into it with §15/§16/§21. Scope: (1) Edit Profile — display name + **username changeable freely** (reuse /welcome uniqueness, no cooldown unless abuse) + **real photo upload** (new Supabase Storage `avatars` bucket, public-read/owner-write — the only Supabase change; no `profiles` schema change); (2) Saved spots section (device-local store, tap→detail); (3) age-band preference exposed; (4) Privacy section (ghost mode moves in); (5) Account & support (sign out, email-interim delete, report a problem). Blocked users stay on Social. **Postponed:** bio (next phase, with viewable profile), going-out/music/budget prefs, notification settings, appear-offline/granular visibility, connected accounts, username cooldowns, self-serve deletion. RLS pre-check: `profiles` "users update own profile" policy exists. Colton authorized: build → review → **push to main when done**.
- 2026-07-19 — **Viewable-profiles slice MERGED + PUSHED** (Colton OK'd; `feat/viewable-profiles` → main `--no-ff` `29dbbb9`, pushed → Vercel deploy). `/u/:username` viewable profile (identity card + relationship button + friends-only out-tonight line via existing RLS feed), editable 150-char bio (`profiles.bio` DDL pasted + recorded), tap-throughs from all 6 person surfaces. Full gate: research → approved (3-layer visibility model) → planned → built → high-effort 8-angle code review (2 fixes applied: self-profile AddButton self-request guard `myId !== profile.id`; honest 42703 bio-error copy — old text falsely claimed other fields saved on an atomic-failed update) → **live-verified 12/12** incl. the friend-graph out-tonight surfaces (2nd account @colton_lestorti checked in). Deferred (logged, not bugs): shared tap-through-button component (dup across 5 row files), duplicated 42703 fallback (harmless, moot post-DDL). Private-profile toggle + content layer (favorite spots hiding) ride with the next content that needs them, per the 3-layer model.
- 2026-07-19 — **Social-structure research DONE + viewable-profiles slice APPROVED** (Colton, gate discussion). Research (2 subagent passes: IG/FB/Snap/BeReal/TikTok + Snap Map/Zenly/Swarm/Partiful/IRL/DICE) distilled in `docs/plans/2026-07-19-social-structure-research.md`; confirms ordering profiles slice → §21 plans (link-first, Partiful-style) → §16 crew (reframed as invisible Close-Friends-style audience tier) → §22 DMs deferred. **Three-layer visibility model locked (Colton):** (1) identity card — avatar/name/@username/bio — always visible to signed-in users; (2) content layer — favorite spots, future posts/rich layout — visible unless the user opts into a **private profile** toggle (toggle ships with the first content that needs it, NOT in this slice — settings ship with their features); (3) liveness — out-tonight/check-ins — always friends-only via RLS, not part of the toggle. **Approved slice scope:** `/u/:username` route + page (identity card + Add-friend/Requested/Friends action + out-tonight-at-X line for friends via existing RLS feed — no policy changes); tap-throughs from FriendRow/OutTonightRow/RequestRow/SuggestedList/search/map-pin avatars; **bio now** (one DDL: `profiles.bio text` + 150-char check; bio field in Edit Profile). Not in slice: counts, activity history, usual spots, out-tonight text payload (queued — research's cheapest win), mutual friends, private-profile toggle. Hard avoids recorded from research: streaks/loss-framed stats, public relationship rankings, stranger-surfacing feeds, mayorship gamification, public heat maps at beachhead scale (→ §13 note), install-required invites (→ §21).
- 2026-07-19 — **§21 Group Plans APPROVED** (Colton, full gate discussion; spec `docs/superpowers/specs/2026-07-19-group-plans-design.md`). Five locked decisions: (1) **Approach B — link-first** `/p/:token` plan page + guest name-only RSVP via unguessable token + **ENDZ's first Edge Function** (anon-auth rejected — anon sessions carry `authenticated`, blast radius on every existing policy; existing RLS stays untouched); (2) guest list **visible by default + host hide toggle**; (3) **no voting in MVP** — one venue + time (Colton wants to see voting later → v2 w/ §17 FTM-for-group); (4) entry points **Social Plans section + venue detail**; (5) invites = **pick friends at create + share link**. MVP: plans + plan_rsvps tables (invited = null-rsvp row; guests = name + edit-secret), auto-age to past, cancel = status (link shows "plan is over"). Postponed: reminders (push), crew invites (§16), comments (§22), venue-TBD. **Not yet authorized: implementation plan, DDL paste, Edge Function deploy — each goes through Colton.** Next step: Colton reviews the spec → writing-plans.
- 2026-07-20 — **§21 Group Plans BUILT + REVIEWED on `feat/group-plans` (NOT merged).** Plan `docs/superpowers/plans/2026-07-19-group-plans.md` executed subagent-driven (10 tasks): plans + plan_rsvps tables w/ RLS (security-definer helpers break the plans↔plan_rsvps policy recursion; column grant hides `guest_secret` from clients), `lib/plans.ts` + `usePlans.ts`, CreatePlanSheet drawer, PlanCard + Social Plans section, VenueDetail entry, **ENDZ's first Edge Function** `supabase/functions/plan-guest` (service-role, token-scoped GET/POST/PATCH) + `lib/planGuest.ts` client + public `/p/:token` PlanPage. Per-task reviews + a Fable whole-branch review (security architecture held, no confirmed holes); fixes in `d45aed3` (createPlan partial-failure no longer throws→dup plans; edit-drawer reseed keyed on closed→open, not editItem identity; edge fn null-body→400; dropdown→AlertDialog handoff). **DDL pasted by Colton (live).** Post-build testing surfaced + fixed **2 bugs**: share icon → arrow (`854b915`); **time picker unresponsive in the drawer** — root cause vaul drag-capture on the datetime-local input, fixed `data-vaul-no-drag` + color-scheme (`3e0f08c`, vs vaul 0.9.9). **Still pending before merge: (a) Colton deploys the Edge Function** (`docs/plans/2026-07-19-plan-guest-deploy-runbook.md`), **(b) live acceptance** (create→link→guest RSVP round-trip + invite/hide/cancel), **(c) Colton re-tests the 2 bug fixes signed in.**
- 2026-07-20 — **§21 Group Plans MERGED to local main (NOT pushed).** Colton signed off on the acceptance pass → `feat/group-plans` merged `--no-ff` into main (merge commit `e8e53df`); tsc + production build green on the merged result. **Not pushed** (22 ahead of origin/main) — awaiting Colton's push/deploy OK; feature branch kept as a rollback ref. Shipped in session 5 before the merge (all typecheck-clean): (a) signed-out **"Welcome to ENDZ" CTA** on `/p/:token` → `/join?source=plan`, which graduates to the real `signInWithGoogle()` flow by flipping the new `SIGNUP_LIVE` flag in `lib/constants.ts` once Google OAuth publishes (spec `docs/superpowers/specs/2026-07-20-guest-cta-design.md`); (b) `/join` waitlist now collects **email + phone** (both required) and **redirects to the map** on submit (map is browsable signed-out — `AppLayout` only redirects `needsUsername`); waitlist table already had both columns, no DDL; (c) **share button copies the link on desktop** (native share sheet only on coarse-pointer devices) via new `sharePlanLink()` helper — fixed the useless-OS-sheet friction on PlanCard + PlanDetailSheet; (d) **create sheet centered** as a Dialog (was a bottom Drawer, now matches PlanDetailSheet), which retired the vaul datetime drag-capture hack. `/join` two-field form + signed-out map redirect live-verified via the MCP browser; guest CTA + centered create sheet still want Colton's signed-in eyes.
- 2026-07-20 — **Map-Plans gate OPENED (NOT approved, NOT built).** Colton wants plans on the map. Discussion recorded in `docs/plans/2026-07-20-map-plans-gate-prep.md`. Vision grew to **4 capabilities + a join primitive**, all wanted in the eventual MVP but **built incrementally / saved to this to-do**: (1) **plan "event" badge** on the venue pin — invitees always, accepted friends when the **host opts in**, maybe friends-of-friends w/ >5 mutuals; tap the bar → **event detail** → **"Request to join"** button (NEW flow — today §21 is host-invite + link-RSVP only, no join-request); (2) **"planning to go" personal signal** — like out-tonight but future-tense, **superseded when the person actually checks in elsewhere**; (3) **custom "approved list"** — per-user allowlist for who sees where you're planning to go (new sharing primitive); (4) **friends-of-friends >5-mutuals tier** (new graph-visibility tier). Pin treatment agreed: **distinct "planning" badge**, not faded avatars. Proposed decomposition (Slice A = event badge + event detail + request-to-join, opt-in→friends; B = personal signal; C = approved list; D = FoF tier). **Open before any spec:** attendee-name consent on the badge, request-to-join approval flow, FoF mechanics, ghost-mode interaction. Gate NOT closed — next = lock Slice A scope → Slice-A spec + acceptance → approval → build.
- 2026-07-19 — **§14 Profile MVP phase 1 BUILT + REVIEWED + MERGED + PUSHED** (per Colton's pre-authorization). Plan `docs/superpowers/plans/2026-07-18-profile-mvp.md`, built inline, live-verified against Colton's real signed-in session on the dev server (username change persists + revert, duplicate rejected via real second account @colton_lestorti, upload fails friendly while bucket absent, saved spots E2E, age band → Weekend Favorites "Tuned for" pill, ghost toggle in new home, mailtos exact). 8-angle code review (subagents) found and I fixed: avatar cleanup now runs only AFTER `profiles.avatar_url` repoints (was: could 404 the live avatar on a failed write); dialog seeds only on open (was: mid-dialog profile update wiped typed input); shared `useUsernameAvailability` hook for dialog + onboarding (errors → unknown, stale responses discarded — was: transient error showed false "available"); Save disabled during upload + field-scoped store revert + post-success re-assert; SavedSpotsList error/empty-join states; focus rings on Account rows; dialog avatar uses the card's Google-metadata fallback; `PLACEHOLDER`→`lib/venueImages`, `SUPPORT_EMAIL`→`lib/constants` (Profile+Privacy+Terms). **Deferred with rationale:** ProfileAvatar reuse in dialog (visual-risk refactor of a Social-shared component), shared age-band hook (remount keeps surfaces in sync today; revisit when FTM consumes age, §3), deep updateProfile/refreshProfile sequencing (pre-existing pattern, mitigated by re-assert). **Colton's one pending step: paste the avatars-bucket DDL** (recorded in `endz-schema.sql`) — photo upload no-ops with a friendly toast until then.
- 2026-07-21 — **Items §23 & §24 added** (Colton, captured mid-map-plans-build; NOT DISCUSSED, gate applies). **#23 "Share with anyone" plan card → clickable clean link:** the CreatePlanSheet info card is non-clickable today; make it tap → a clean/clear ENDZ `/p/:token` plan link (relates to §21). **#24 referral invite link with auto-friend on join:** the Social "Find friends" Share/Copy-your-handle (`ShareHandleCard`, "@user · Send it to the crew") should share an ENDZ **invite link** with copy like *"hey I'm on ENDZ — join"* and **auto-friend the sender** when the recipient signs up through it — a new referral-token→friendship-on-signup primitive (touches invite link + `/join`/onboarding + friendships; relates to §15). Both from Colton screenshots. Captured while building Map-Plans Slice A — **not built, gate applies.**
- 2026-07-21 — **Map-Plans Slice A GATE PASSED + BUILT** (`feat/map-plans`, NOT merged/pushed). Full gate discussion → **9 decisions locked:** scope = plan badge on pin + venue-sheet event detail + request-to-join; **host-approval gatekeeping** (not auto-join); **in-app request badge, no push** (§21's deferral held); approve→going; deny = soft (re-requestable, no tombstone); badge shows **host + "N going" count only**, attendee **names stay member-only** (consent enforced in the `plans_on_map` rpc, not just UI); opt-in **off by default** + create/edit toggle; **ghost mode suppresses** the plan from friends; **friends-of-friends deferred to Slice D**. Spec `docs/superpowers/specs/2026-07-21-map-plans-slice-a-design.md`, plan `docs/superpowers/plans/2026-07-21-map-plans-slice-a.md`. Built **inline** (7 code tasks, tsc+build green each): `plans.show_on_map` + `'requested'` rsvp state + new RLS (`can_request_join`, friend-request INSERT, host-approve UPDATE, self-approval guard, `is_plan_member` excl-requested) + security-definer `plans_on_map()` (curated cols); lib+hooks; CreatePlanSheet toggle; distinct violet clock badge on pins; `PlansHereRow` on the venue sheet; host Requests(N) approve/deny + Social "N to approve" badge. Self-review caught+fixed: profiles col is `display_name` not `name` (pre-paste, in DDL); `'requested'` rows leaking into §21 "Who's in" (excluded at source); innerHTML→namespaced SVG; 42703 pre-DDL grace. **DDL pasted by Colton (2026-07-21, "success, no rows returned").** Pending: signed-in live acceptance → optional /code-review → merge decision. Slices B (personal "planning to go" signal), C (approved-list), D (FoF tier) still deferred to their own gates.
- 2026-07-21 — **Item §25 added + map-plans expiry clarified** (Colton, mid-Slice-A live test). **#25 "Your past events" archive in Social** — NOT DISCUSSED, gate applies; **explicitly reverses §21's "one-night ethos, no archive" decision.** Plans already persist in the DB (expiry is a time filter, not a delete), so a past-events history is a query + a Social section. **Map-plans expiry confirmed:** a plan stays on the map through the night and drops after `planned_at + 6h` (a 9pm plan → gone ~3am) — matches Colton's "goes away only after the night ends"; if he later wants a fixed night boundary (e.g. 5am) instead of +6h it's a one-line change to `plans_on_map()` + `PLAN_EXPIRE_HOURS`. Also this session: **tap a "Planning to go" row → centered detail card** shipped as part of Slice A (members/hosts get the full PlanDetailSheet, non-members a light request card).
