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
| 19 | Map product review | **SLICE 1 SHIPPED 2026-07-26** (venue surface merge — gate passed, built, reviewed, merged). Rest of the walk-through still NOT DISCUSSED. | Map is functional + recently cleaned up; this is a structured walk-through of pins/icons/rings/legend/filters/CTA/sheet before any changes → §19. **Slice 1 closed the "pin tap → bottom sheet (evaluate it)" agenda item:** the "View Details" hop is gone, `VenueDetail.tsx` 201 → 56 lines, one component serves all three containers. Still open: pin crowding, icon clarity, activity rings, legend, neighbourhood zones, list-view images, FTM as a map CTA |
| 20 | Rooftop & outdoor seating data | NOT DISCUSSED | Zero rooftop/outdoor attributes in venue data today (item 2 audit). Data-collection + surfacing priority across filters/cards/FTM/Discover → §20 |
| 21 | Group plans | APPROVED (scope recorded 2026-07-19) | Gate done. Link-first plan page (token + first Edge Function), one venue+time, RSVP, guest list w/ host hide toggle; no voting in MVP. Spec: `docs/superpowers/specs/2026-07-19-group-plans-design.md` → §21 + Decision Log |
| 22 | DMs & messaging | NOT DISCUSSED | Nothing exists. Explicitly NOT assumed to be MVP; moderation/safety/App Store questions first → §22 |
| 23 | "Share with anyone" plan card → clickable, clean link | NOT DISCUSSED (added 2026-07-21, Colton) | The CreatePlanSheet "Share with anyone" affordance is a **non-clickable info card** today (`src/components/social/CreatePlanSheet.tsx`). Make it **clickable → a clean, clear ENDZ plan link** (the `/p/:token` link, minted on create). Colton screenshot 2026-07-21. Relates to §21. → Decision Log |
| 24 | Referral invite link with auto-friend on join | NOT DISCUSSED (added 2026-07-21, Colton) | The Social "Find friends" **Share/Copy your handle** (`@user` · "Send it to the crew", `ShareHandleCard`) should share an **ENDZ invite link** with copy like *"hey I'm on ENDZ — join"*, and **auto-friend the sender** when the recipient signs up via that link. New primitive: referral-token attribution → friendship on signup (touches invite link, `/join`/onboarding, friendships). Colton screenshot 2026-07-21. Relates to §15. → Decision Log |
| 25 | "Your past events" archive in Social | NOT DISCUSSED (added 2026-07-21, Colton) | Plans **drop off the map/live surfaces after the night ends** (today: `planned_at + 6h`, no delete — rows persist) but Colton now wants a **"Your past events" history section in Social** listing plans you hosted/attended. **Reverses §21's deliberate "one-night ethos, no archive" decision** — needs a past-plans query (`planned_at < cutoff`, my plans) + a Social section + retention/visibility questions. Relates to §21 + §15. → Decision Log |
| 26 | Downtown nightlife dataset + 5-zone expansion (source for rooftops/outdoor/age/hotspot-times) | **GATE PASSED + BUILT 2026-07-25** for the East Village slice (`feat/east-zone-import`, NOT merged, DDL NOT pasted). Zone expansion + PDF backlog still gate-blocked. | Retained reference `docs/ENDZ_NIGHTLIFE_DATASET.md`: 40 verified venues + hand-made PDF backlog, cross-checked, organized into **5 general zones** (East · West · Meatpacking & Chelsea · Flatiron & Midtown · Brooklyn). Enriched per-venue: age display w/ **College scene** rule, drink prices/deals, music, activities, rooftop/outdoor/queer/table flags, happy-hour windows, occasion, 2-sentence descriptions. **Direct source for §20/§11/§18.** Import + College-scene tier + zone expansion all gate-blocked. → §26 |
| 27 | Filter system redesign (chips -> Filters sheet) | **SHIPPED 2026-07-26** (gate passed, built, merged, pushed). Found + fixed 2 live bugs: Hot Tonight emptied the map; Music kept venues with no music. | The map filter row is at **11 chips** (Find the move · All · Saved · Happy hour · Rooftop · Outdoor · Bars · Clubs · Lounges · Hot Tonight · Music) in a horizontal scroller where only ~4 are visible on a phone — so Rooftop/Outdoor, the newest ones, are off-screen by default, and **Rooftop matches exactly 1 venue** while holding a permanent slot. It only grows: §20 wants occasion filters, and price/age are obvious next. Proposal: keep 3-4 hot chips inline (All · Saved · Happy hour · Open now) and move the rest behind a **"Filters" button with a count badge** (category, outdoor, rooftop, music, price, age). Alternative considered: drop the Rooftop chip since Find the Move already asks "Outside?" — simpler, loses one-tap access. Relates to §20. → §27 |
| 28 | Crowd-sourced venue data (age / music / amenities from check-ins) | NOT DISCUSSED (added 2026-07-26, Colton) | **The only path to the field consistency Colton wants.** Coverage today across 56 venues: age **52%**, music **32%**, price 93% (after the Google-range fallback), rating/hours 100%. Google supplies rating, hours, price range and outdoor seating — it does **not** supply crowd age or music genre, and no third party does, because only the people in the room know. Matches ENDZ's founding thesis (liveness comes from our own users, not APIs). Proposed MVP: after a check-in **commits**, ask **one** rotating micro-question ("Crowd age tonight?" / "Music?" / "Cover charge?" / "Outdoor seating?"), one tap, skippable; aggregate; surface only at **N>=3**, labelled crowd-sourced, never stated as fact. Hook already exists — `CheckInCard` asks for a vibe post-check-in (`doVibe`). **Hard guard: the north star is unprompted check-ins, so nothing may add friction BEFORE the check-in commits; if it dents check-in rate it comes out.** Needs a DB table + touches the protected check-in loop. Would also settle the St. Dymphna's backyard question. Relates to §11, §20, §26. → §28 |

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

**Added 2026-07-26 (from the §19 slice-1 build):**
- **Popular Times and Specials — keep, revive, or delete?** Both render for 0/56 today. Reviving Popular Times needs the paid serpapi source (currently paused); Specials needs `specials.json` filled by hand. Colton owes this call.
- **Venue photography — where do real photos come from?** 0/56 venues have an `image_url`; every one shows a category placeholder. Google Places photos carry licensing/attribution terms; own-photos vs venue-supplied vs Google is a real decision, not a build task.
- **Should ENDZ add a test runner?** Zero tests exist. Several pure functions (`hasOutdoorSeating`, `formatAgeDisplay`, `hasMoreInfo`, `filterVenues`, `vibeScore`) are trivially testable and currently guarded only by manual browser passes. One devDependency — needs Colton's OK.

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
- **⚠️ No test framework in this repo** (verified 2026-07-26) — no vitest, no jest, **zero `*.test.*` files**, no test dependency in `package.json`. The only committed test is `node scripts/enrich-venues.mjs test` (Places-transform fixture, July 6). **The "37-assertion behavior harness" cited as green in three 2026-07-26 Decision Log entries was never committed** — those claims mean tsc + build + a live browser pass, not a re-runnable suite. Consequence: every regression guard in this app is manual, and nothing stops a future change from silently breaking `hasOutdoorSeating`, `formatAgeDisplay`, `hasMoreInfo`, `filterVenues` or `vibeScore` — all pure functions that are trivially testable. Adding **vitest** (one devDependency, no config beyond the existing Vite setup) is the recommendation; deliberately out of scope on the §19 branch. **Needs Colton's OK before adding a dependency.**

- **§19 slice-1 follow-ups** (logged 2026-07-26, none blocking, all deliberately unfixed):
  - **a11y:** `/venue/:id` no longer has an `<h1>` (was `<h1 id="venue-heading">` + `aria-labelledby`, now `aria-label="Venue"` with `<h2>` as the top heading). `VenueInfoCard` still renders `<h2>Info</h2>` beneath `VenueMoreInfo`'s `<h3>`s → heading-order skip. The expander's `aria-expanded` has no `aria-controls`, and the revealed region has no `id`/`role="region"`.
  - **Dead code:** `venue.open_now` now has no consumer — the removed `VenueDetail` hero was the last one. `VenueQuickInfo` shows live-computed open state from enrichment instead (for all 56), which is the honest source. Safe to drop from `types.ts` and any data mapping.
  - **`hasMoreInfo` whitespace:** `Boolean(v.description)` counts a whitespace-only description as content. No venue in the 56 has one; worst case is a blank About paragraph.
  - **Untested paths:** the merge was live-verified signed-out via the Discover entry point. The **Saved-spots** and **plan-link** entries to `/venue/:id` were never exercised signed-in, and the friends-here / plans-here rows that `/venue/:id` newly gained were not observable without a friend checked in.
  - **Feel, not correctness:** the collapsed→expanded interaction has never been used on real hardware. Drag-to-dismiss and scroll-vs-drag were verified with real CDP touch events, so this is a judgment call, not a bug hunt.

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
legend stay visible · ~~filters collapse vs scroll~~ (done, §27) · Find the Move
as a prominent map CTA · ~~rooftop/outdoor filters on the map~~ (done, §20/§27) ·
neighborhood boundaries or zones · ~~pin tap → bottom sheet (evaluate it)~~
(done, slice 1) · is selected-venue state obvious enough · does list view need
better images and venue details.

**Slice 1 SHIPPED 2026-07-26 — venue surface merge.** Closed the "pin tap →
bottom sheet" agenda item. The "View Details" hop is gone; `VenuePreview` is the
single venue surface across the mobile drawer, desktop panel and `/venue/:id`,
with the deeper layer behind an in-place "More info" expander. `VenueDetail.tsx`
201 → 56 lines. Spec/plan in `docs/superpowers/`; full detail in the Decision Log.

**Remaining §19 agenda — still NOT DISCUSSED, gate applies:**
- Pin crowding at the current 56-venue density
- Icon clarity — are 🍺 / 🍸 / 🌐 the right venue glyphs?
- Are the activity rings meaningful, and should the activity legend stay visible?
- Is selected-venue state obvious enough?
- Find the Move as a prominent map CTA (it is currently a filter-row chip)
- Neighborhood boundaries / zones on the map (relates to §26's 5-zone taxonomy)
- List view: better images and venue detail on the rows
- **Venue photography** — verified 2026-07-26: **0 of 56 venues have any
  `image_url`**, so every single one falls through to the category placeholder
  SVG in `src/lib/venueImages.ts` ("Bar" / "Club" / "Lounge" on a tinted
  square), and the venue-sheet hero renders a bare gradient. Confirmed in the
  live browser, not just the demo dataset. Now that the merge makes that hero
  the *only* venue surface, it is the most visible gap in the app. Relates to
  the "real photo strategy" line in the full-launch-readiness backlog; Google
  Places photos have licensing/attribution terms that need their own gate.

**No further map changes until Colton and Claude talk through the options.**

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

**Source now exists (2026-07-25):** `docs/ENDZ_NIGHTLIFE_DATASET.md` carries
per-venue **rooftop** and **outdoor** (backyard / beer-garden / open-air) flags
for 40 verified venues plus a rooftop/outdoor rollup — the data this section was
blocked on. Import still gated. See §26.

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

### 26. Downtown Nightlife Dataset + 5-Zone Expansion (INFO / reference)
**INFO CAPTURED 2026-07-25 (Colton) — this is a retained reference, NOT a build.
Import gate applies.** File: `docs/ENDZ_NIGHTLIFE_DATASET.md`.

Merges two sources: a **40-venue verified research set** (East Village,
Greenwich Village, West Village, Meatpacking) + Colton's hand-made
`~/Downloads/NYC NIGHTLIFE 2025.pdf` (wider footprint — LES, Chelsea/SoHo,
Tribeca, Flatiron, NoHo, Midtown, Brooklyn). Cross-checked (research wins on
facts, PDF on personal signal; conflicts flagged), then organized into **5
general zones**: East · West · Meatpacking & Chelsea · Flatiron & Midtown ·
Brooklyn. (PDF text pulled via macOS PDFKit/JXA — no poppler installed.)

Enriched per-venue fields, ready to feed the app: **age display** (numeric band
for all except the youngest cohort → **`College scene`** badge; mixed shows both,
e.g. `College scene · 21–25`; the string "18–21" never renders; bands are
heuristic estimates from crowd descriptions, flagged as such), **drink
prices/deals** (only where sourced — no fabricated prices), specific music,
activities, **rooftop / outdoor / queer-friendly / table-VIP / dance-floor /
live-music** flags, **happy-hour windows** (feeds `HappyHourRail`), occasion
index, clean 2-sentence descriptions + separate punchy taglines, and
INTERNAL-only reputation flags ("bro-heavy" / "mid" — never render publicly).

**Source-of-record for the venue attributes §20 (rooftop/outdoor), §11 (age),
and §18 (Discover) were blocked on.** Gate-blocked follow-ons (none approved —
each needs Colton's explicit OK):
- Import verified venues into `src/data/venues.ts` (skip the 8 already present:
  Doc Holliday's, The Library, Niagara, Wiggle Room, Downtown Social, KGB,
  Paradise Lost, Mona's).
- Add the **`College scene`** tier + numeric-band age display rule to the app.
- Add the 5-zone taxonomy (today: East Village sub-neighborhoods only).
- Rooftop/outdoor + happy-hour + occasion filters (§20).
- Verify the PDF backlog venues before any of them ship.

Extends (does not reverse) the 2026-07-15 "no new venues, focus on what we have"
standing decision — Colton decides if/when to import. Related: §20, §11, §18.

### 27. Filter System Redesign (chips → Filters sheet)
**NOT DISCUSSED 2026-07-26 (Colton raised it) — gate applies.**

The map filter row has reached **11 chips** and only ~4 are visible on a phone
before scrolling, so Rooftop and Outdoor — the two just added — sit off-screen
by default. Rooftop matches **1 venue** while holding a permanent slot. The list
only grows: §20 wants occasion filters, and price/age are the obvious next.

Proposal: 3–4 hot chips inline (All · Saved · Happy hour · Open now) + a
**Filters button with a count badge** holding category, outdoor, rooftop, music,
price, age. Alternative: drop the Rooftop chip entirely since Find the Move
already asks "Outside?" — simpler, but loses one-tap access.

Open questions: which filters earn an inline slot; does the sheet replace or
supplement Find the Move; do filters persist across sessions.

### 28. Crowd-Sourced Venue Data (age / music / amenities from check-ins)
**NOT DISCUSSED 2026-07-26 (Colton raised it) — gate applies.**

**The only path to the field consistency Colton asked for.** Coverage across the
56 venues: age **52%**, music **32%**, price 93% (after the Google-range
fallback), rating/hours 100%. Google supplies rating, hours, price range and
outdoor seating. It does **not** supply crowd age or music genre — and no third
party does, because only the people in the room know. That is the same argument
`~/Documents/endz/CLAUDE.md` already makes about live crowd data.

Proposed MVP: after a check-in **commits**, ask **one** rotating micro-question
("Crowd age tonight?" / "Music?" / "Cover charge?" / "Outdoor seating?") — one
tap, skippable. Aggregate; surface only at **N ≥ 3**, labelled crowd-sourced,
never stated as fact. The hook exists: `CheckInCard` already asks for a vibe
after check-in (`doVibe`).

**Hard guard:** the north star is unprompted check-ins per user per night, so
nothing may add friction *before* the check-in commits. If it dents check-in
rate, it comes out.

Needs a new table + touches the protected check-in loop. Would also settle the
St. Dymphna's backyard question (dataset says yes, Google says no). Relates to
§11, §20, §26.

### 29. College in onboarding (school + class year) — SLICE 1 SHIPPED 2026-07-27
**Discussed and approved 2026-07-27 (Colton).** First slice of §11's
"sign-up demographics", scoped to school only — gender/age/birthday remain
NOT DISCUSSED and are untouched.

**Shipped:** `colleges` reference table (145 schools, HWS first as the fall
campus beachhead, then NYC, then NJ/CT/MA/Northeast/national);
`profiles.college_slug` + `profiles.class_year`, both nullable; an optional
picker on the existing `/welcome` screen (deliberately NOT a third onboarding
step — cold-start is the #1 risk); the same field in Edit profile so skipping
is never permanent; `NYU '27` on the profile card; Privacy Policy updated to
disclose the new fields.

**Decisions taken:**
- **Curated list, no free text.** Free text fragments "NYU" into four spellings
  and silently breaks the matching this exists to enable.
- **slug, not uuid, as the join key** — so `src/data/colleges.ts` and the
  database stay diffable against each other. Slugs are permanent; renaming one
  orphans every profile pointing at it.
- **Local list, not a Supabase query** — onboarding must not wait on a round
  trip. `scripts/emit-colleges-sql.mjs` generates the DDL from the TS file so
  they cannot drift. Adding a school = edit TS, re-run, re-paste (idempotent).
- **Visible to all signed-in users**, like username/display_name/avatar. The
  friends-only privacy principle governs the *location* layer; college is
  profile identity, and friends-only would defeat school-based discovery. The
  consent story is that it's optional and clearable, not that it's hidden.

**Explicitly NOT built (each needs its own gate):** school-based friend
discovery ("people from your school"), alum filtering, and any
college → `venues.is_college_scene` matching or recommendation logic.

**Loose end CLOSED 2026-07-27:** "my school isn't listed" is built. The empty
search state offers it, firing a `college_missing` event with the typed term
(deliberate tap only, trimmed, capped at 60 chars to keep analytics props
low-cardinality and PII-free). Rides the existing `events` table — no new DDL.
Grow the list from it:
`select props->>'query', count(*) from events where event_name = 'college_missing' group by 1 order by 2 desc;`

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
- 2026-07-21 — **RSVP write blocker FIXED + Host guest-list editing SHIPPED (merged + PUSHED to production, Colton OK'd).** Session 8. (1) **RSVP 42501 fix:** authenticated RSVP/approve writes failed `42501 permission denied for table plan_rsvps` — root-caused (via a `set role authenticated` SQL repro; Postgres printed the HINT) to the upsert/host-approve UPDATE needing **table-level SELECT** that §21 revoked to hide `guest_secret`. Grants were exhausted (re-granting table SELECT re-exposes guest_secret). Fix = reworked `setMyRsvp`→`set_my_rsvp()` and `approveRequest`→`approve_join_request()` as **security-definer RPCs** (§21 pattern); DDL pasted, DB-verified. (2) **Host guest-list editing** (§21 follow-up, full gate → spec+plan `docs/superpowers/*/2026-07-21-plan-guest-editing*`, subagent-driven build, per-task + opus whole-branch review, live-verified): host-only in PlanDetailSheet — full roster incl. **"Invited · no answer yet"**, **× remove w/ deferred-delete Undo**, inline **"+ Invite friends"** add-on-tap (excludes roster + open join-requesters), plus a **"Share with anyone"** link affordance (Colton's mid-flow request). No DDL (reuses delete/insert RLS+grants). **Live-verify caught+fixed:** Undo never worked — the sonner toast is outside a MODAL dialog so Radix blanked outside pointer events; fixed via `modal={false}` + a **portaled dim backdrop** + toaster outside-click guard + commit-on-timer-not-close. Gotcha logged: app SW (`/sw.js`) serves stale JS — unregister before live-testing edits. Merged `feat/plan-guest-editing`→main `--no-ff` (`0287cd2`), tsc+build green, **pushed `b468418..0287cd2`** → Vercel deploy. Cross-account acceptance (friend responds / removal-loses-access) still open for Colton's 2nd account. Deferred to-dos §23–25 unchanged.
- 2026-07-25 — **§26 Downtown nightlife dataset CAPTURED (info-only; no code / DB / deploy).** New retained reference `docs/ENDZ_NIGHTLIFE_DATASET.md`. Built from two sources Colton supplied: a 40-venue verified research set (East Village, Greenwich Village, West Village, Meatpacking) + his hand-made `NYC NIGHTLIFE 2025.pdf` (wider footprint — LES/Chelsea/SoHo/Tribeca/Flatiron/NoHo/Midtown/Brooklyn). PDF text extracted via macOS PDFKit/JXA (no poppler). Cross-checked the two (research wins on facts, PDF on personal signal); resolved all flagged conflicts — Wiggle Room & The Library = East, Red Lion = West, and via a web check **Carroll Place (157 Bleecker) is a separate venue from Red Lion (151) and is now closed → excluded**; **Jean's moved to East (NoHo)**. Organized into **5 general zones** (Colton's call: East / West / Meatpacking & Chelsea / Flatiron & Midtown / Brooklyn). Enriched all 40 verified venues with age display, drink prices/deals, music, activities, rooftop/outdoor/queer/table/dance/live flags, happy-hour windows, occasion index, 2-sentence descriptions + taglines, internal-only reputation flags. **Age display rule locked:** numeric band for everyone EXCEPT the youngest/college cohort → **`College scene`** badge (mixed shows both, e.g. `College scene · 21–25`); "18–21" never renders — Colton wants the college segment without stating the sub-21 age; bands are heuristic, flagged. **Directly unblocks the venue attributes §20/§11/§18 needed.** Everything **gate-blocked** for build (import, College-scene tier, zone taxonomy, filters, backlog verification) — extends the "no new venues, focus on what we have" standing decision. Memory: `endz-nightlife-dataset.md`.
- 2026-07-25 — **§23 clean plan-link SHIPPED (merged + pushed, Colton OK'd via "get everything complete").** Chose approach A (the create-sheet "Share with anyone" card stays an info hint — no link exists pre-creation; the "clickable clean link" work lands on the post-create "Plan made" step). The raw-URL box → a **tappable copy chip**: link icon + cleaned URL (drops `https://`, single truncated line) + Copy/Copied ✓; redundant "Copy link" button folded in, Share stays full-width. Reuses copyLink/shareLink (no logic change). Live-verified (clean chip, tap → Copied ✓). Merged `feat/plan-link-clickable`→main `--no-ff`, tsc+build green, pushed → Vercel. §23 CLOSED. (Browser gotcha reconfirmed: the stuck MCP tab needed a fresh tab; SW still serves stale JS — unregister before testing.)
- 2026-07-25 — **§26 East Village slice GATE PASSED + BUILT** (`feat/east-zone-import`, **NOT merged, NOT pushed, DDL NOT pasted**). Gate discussion with Colton locked: enrich what we have + add the verified East Village venues, **College scene shown where the age range already shows**, **rooftop and outdoor as add-ons to cards + search + Find the Vibe**. Spec `docs/superpowers/specs/2026-07-25-east-zone-import-design.md`. **Audit corrected the tracker's own framing:** `src/data/venues.ts` is only the demo fallback (`resolver.ts:12` picks Supabase whenever configured), so "import into venues.ts" would have shipped nothing live — the real target is the `venues` table, which had no column for any of the enrichment. Also found `age_range` is text parsed by `^(\d+)-(\d+)$`, so writing "College scene · 21–25" into it would have silently dropped the age. **Design:** `age_range` stays clean numeric, `is_college_scene` is a separate boolean, and one function (`formatAgeDisplay`) composes the string — with a **sub-21 guard that suppresses the numeric half**, making "18–21 never renders" structural rather than conventional. Built: 5 new venues (52 → 57 — Phebe's, Joyface, St. Dymphna's, Nublu 151, The Ready Rooftop), 5 existing enriched (Downtown Social → college; Niagara → outdoor; Doc Holliday's 21-30 → 23-35; The Library 21-28 → 21-30; Wiggle Room filled in), rooftop/outdoor tiles + BarCard labels + 2 map chips + a Find-the-Vibe "Outside?" question, all hiding when nothing can match (existing dead-end-chip rule). Deleted dead `formatAgeRange` — zero callers and it would have printed a sub-21 band. Coordinates geocoded via **OSM/Nominatim** (Google pause intact); 3 resolved by name. **Verified:** tsc + production build clean, 30-assertion behavior harness green (incl. "no venue renders a sub-21 number"); **no live signed-in click-through, and the SQL was never executed** (no local Postgres; anon key only). **Colton's steps:** run the pre-flight `select` in `endz-schema.sql` (confirms the name-matched UPDATE targets exist — the seed file is stale at 19 rows vs ~52 live), paste the block, click through, then decide merge/push. **New finding logged, deliberately unfixed:** the existing 52 pins drift from OSM by inconsistent amounts (Grafton ~75m, Niagara ~160m, **Coyote Ugly ~500m** — listed near E 7th, actually 233 E 14th). Not a constant offset, so no bulk correction; moving live pins needs its own gate. Still gate-blocked from §26: the 5-zone taxonomy, West/Meatpacking venues, the ~13 unverified PDF backlog EV names, happy-hour window data, occasion filters.
- 2026-07-26 — **§26 East Village slice MERGED to local main (NOT pushed; `4fbf90e`, main 5 ahead of origin).** Colton approved after the live DB work. tsc + production build + the 30-assertion harness all green **on the merged result**, not just the branch. `feat/east-zone-import` kept as a rollback ref. **DDL + inserts pasted by Colton (live):** 4 new columns, 5 new venues, 5 enriched → verify returned **57 active / 1 rooftop / 2 outdoor / 2 college scene**. **Post-paste verify caught a real gap:** the live `Downtown Social` row had `age_range` NULL (the demo dataset had 21-25, the live table never did), so the college badge would have rendered with no band — backfilled. That prompted a **full parity audit** (read-only query embedding all 57 app venues, diffed server-side since the anon key can't read `venues` under RLS): **22 rows of drift**, and critically **~24 venues had `neighborhood` NULL and several had no `age_range` in Supabase** — meaning those venues have been rendering in production with **no neighborhood line and no Ages tile**, invisible in dev because the demo source had the data. Fixed with a **gap-only backfill** (`~/Documents/endz/2026-07-26-venues-parity-backfill.sql`; every update guarded `where <col> is null`, so it cannot overwrite live values) plus normalising `music = 'none'` → NULL. Re-audit: 22 → 3 → **0 real drift** — the last 3 (Beauty Bar / Cienfuegos / Coyote Ugly "pop/indie" vs "Pop / Indie") were false positives from comparing the raw DB string against the app's already-normalised one; `titleCaseMusic` makes them character-identical, verified by running `mapVenueRow` on each. **Live DB and app dataset now in full parity.** Remaining known gaps: the 5 new venues have **no Google enrichment** (no rating / open-closed / happy hour until `scripts/enrich-venues.mjs` runs), and there was **no signed-in click-through** on production data — local verification used the demo source. **Not pushed — Colton's call.** Still gate-blocked from §26: 5-zone taxonomy, West/Meatpacking venues, the ~13 unverified PDF backlog EV names, happy-hour window data, occasion filters. Separately logged and unfixed: the existing pins' coordinate drift (Coyote Ugly ~500m).
- 2026-07-26 — **Venue-data quality pass (merged to local main, NOT pushed; main 10 ahead).** Three things, all on top of the §26 merge. **(a) Enrichment parity:** ran `scripts/enrich-venues.mjs resolve` + `refresh` so the 5 new East Village venues carry the same Google data as the rest — rating, review count, hours. All 5 matched correctly (Joyface/Nublu via "Loisaida Ave" = Avenue C; The Ready → "The Ready Cantina", matching its IG). **Verified the existing 52 place IDs were unchanged by the re-resolve: zero drift, zero lost matches** (resolve rewrites the whole file, so this was checked against a backup, not assumed). Cost ~114 calls against Google's 10,000/SKU/month free tier — free. **(b) Cienfuegos removed** — the refresh surfaced `CLOSED_PERMANENTLY` (no opening hours either). Pulled from `venues.ts` + the enrichment pipeline (**56 venues**), soft-hidden live via `is_active = false` (Colton pasted; returned `false`) so it can be flipped back. **(c) Outdoor seating reworked.** The refresh exposed that **Google had verified `outdoorSeating: true` for 22 venues while our hand-curated flag had 2** — the shipped Outdoor filter was technically correct and practically useless. Outdoor now has ONE definition, `hasOutdoorSeating()` in `venueTraits.ts`, and every surface routes through it (tiles, BarCard, map chip, search, vibe scoring — grep-verified no raw field reads remain). Google's flag is primary, `has_outdoor` stays a manual override for venues Google has nothing on (the West/Meatpacking dataset will need it). **Only `true` counts** — Google's false/absent means "not recorded", never "definitely none" — and **expired enrichment makes the claim go quiet rather than assert a stale amenity**, which is §20's rule enforced structurally. **Rooftop and outdoor are now mutually exclusive** (Colton's call): Google flags rooftops as outdoorSeating:true, which meant Outdoor returned rooftop bars to someone wanting a backyard. Outdoor = ground-level (backyard/patio/beer garden, **22**), Rooftop = up top (**1**), overlap asserted 0 in the harness. **St. Dymphna's lost its outdoor flag** — the dataset and Colton's PDF say backyard, Google says false, §20 says don't claim the unverified; restore as a curated override if anyone confirms in person. Tiles/cards now **name** the space when a real source says it (`outdoorKind()`, read from Google's editorial summary): Bua → Patio, Lucky → Beer garden, and **The Grafton → Patio via the first `outdoor_kind` curated override (Colton, first-hand: front and back patio)**, description updated to match. 19 of 22 stay generic — writing "patio" for those would be inventing a detail about a real business. Incidental fixes: extracted `normalize()` to its own module to break a searchMatch↔venueTraits import cycle; declared `outdoorSeating` on `VenueEnrichment` (the pipeline had been writing it for weeks with no type). **Verified:** tsc + production build clean, 37-assertion harness green, and a live browser pass (56 spots, Outdoor chip → 23 pre-split, Cienfuegos → 0 results, St. Dymphna's no outdoor tile, The Ready rooftop+info, no app console errors). **Open/unfixed:** no signed-in click-through on production data (local runs use the demo source); the existing pins' coordinate drift (Coyote Ugly ~500m) still logged and untouched; option to surface Google's `editorialSummary` in the venue sheet for richer prose deferred to §18's gate.
- 2026-07-26 — **Venue-card polish + two new tracker items** (merged to local main, NOT pushed). Colton reviewed the live signed-in app and flagged three things, all shipped: **(a) amenity wording** — tiles said "OUTDOOR / Yes", which reads like a form field; now "Outdoor · Seating" (or Patio / Beer garden when sourced) and "Rooftop · Open-air". **(b) price consistency** — price tile now falls back to **Google's real dollar range** when there is no curated tier, taking coverage **68% → 93%** (14 of the 18 blanks filled; Deluxx Fluxx, 96 Tears, Joyface, Nublu 151 have nothing anywhere). **Deliberately NOT converted into a $/$$ tier:** calibrating Google's midpoint against the 38 curated venues showed they don't line up (a $15 midpoint appears in both `$` and `$$` venues, $30 in both `$$` and `$$$`), so a derived tier would be a guess wearing a fact's clothes — this **corrects an earlier claim in-session that price was cleanly derivable from Google**. **(c) back button** — from the map's venue sheet, back now reopens **that sheet** rather than dropping the user on a bare map; scoped by a `fromMap` flag set only in `VenuePreview`, so Discover / Saved spots / Plans keep plain history-back (regression-tested: Discover → venue → back lands on Discover with scroll intact). Verified: tsc + build clean, 37-assertion harness green, live browser pass of all three. **Two items added to the tracker, both gate-blocked: §27 filter redesign** (11 chips, ~4 visible on mobile, Rooftop matches 1 venue — proposal is hot chips + a Filters sheet) and **§28 crowd-sourced venue data** (age 52% / music 32% are unfixable from any API; proposal is one skippable micro-question *after* check-in commits, shown at N≥3, with a hard guard that nothing may add friction before the check-in commits).
- 2026-07-26 — **§27 filter system GATE PASSED + BUILT + MERGED to main.** Spec `docs/superpowers/specs/2026-07-26-filter-system-design.md`; Colton picked the item and locked reset-per-session ("reset everytime"). **The audit found two live bugs, not just crowding.** (1) **"Hot Tonight" emptied the map** — it set `crowdLevel: "high"` and `filterVenues` compared that against `venue.venue_stats.crowd_level`, which **nothing ever populates** (only ApiDataSource's zod schema mentions it), so `undefined !== "high"` rejected all 56 venues. Now driven by **real check-in counts** (`useVenueActivity`, `count >= HOT_MIN_ACTIVITY = 3`, the same boundary vibeScore uses) and **hidden entirely when nothing is hot** — never offer a filter that blanks the map. (2) **Music kept venues with no music** — the guard `q.musicVibe && v.music_type && !includes(...)` short-circuited on undefined, so "Latin" returned **38 venues, none of them Latin** (38/56 have no `music_type`). Unknown music is now excluded. **Layout:** 11 chips → `Find the move · All · Open now · Happy hour · Saved` + a **Filters button with an active-count badge**; type / outside / music / price moved into a new `FiltersSheet`. **"Open now" is new** and earns its slot — enrichment has hours for 100% of venues. **Genres are derived from loaded data**, not a hardcoded list, with two quality rules: a genre needs **≥2 venues** (splitting on "/" yielded 18 tokens, **14 matching exactly one venue** — an option returning one result is a shortcut to one bar, not a filter) and **"Mixed" is dropped** (it means "unspecified"). Result: Rock · DJ · Pop. **All filter state consolidated into `useFilterStore`** (was half `useState` in MapPage, which the sheet couldn't read); **no persist middleware, deliberately** — filters reset on reload per Colton. Category demoted to the sheet because "Bars" is 47/56 and barely filters. **No age filter** — 52% coverage would silently hide half the map; it waits for §28. Verified: tsc + build clean, 37-assertion harness green, live browser pass (chip row, sheet, Rock+Outdoor stacking → 2 spots, badge count, Clear all, Hot Tonight correctly absent). **Also fixed this session: §1 named directions for the new venues** — `directions.ts` looks venues up in `src/data/places` by title and the 5 East Village additions were never merged in, so `getVenuePlace` returned undefined and every route fell through to the **coordinate fallback (an unnamed dropped pin)**. `places.json` regenerated from `scripts/place-ids.json` (verified Google IDs + addresses already fetched by the enrichment resolve), **preserving the manual Apple verification fields**; Cienfuegos dropped. All 56 venues now produce a named Google destination with `destination_place_id`, and name + address for Apple. Apple place IDs still need manual lookup (pre-existing, all 56).
- 2026-07-26 — **§19 slice 1 (venue surface merge) GATE PASSED + BUILT + REVIEWED + MERGED.** Colton picked §19 over §18/§3/§7/§24/§20 after an audit showed the alternatives were blocked: **§23 was already closed** (shipped 2026-07-25), and **§24 referral-invite + §7 onboarding both depend on sign-ups**, which `SIGNUP_LIVE=false` deliberately blocks — same gate as §28. Spec `docs/superpowers/specs/2026-07-26-venue-surface-merge-design.md`, plan `docs/superpowers/plans/2026-07-26-venue-surface-merge.md`, branch `feat/venue-surface-merge` (6 tasks, subagent-driven). **The audit found the detail page was a near-duplicate render:** it re-rendered hero/title/tiles/check-in/Save/Directions from the sheet, and of its five unique sections **two render for 0 of 56 venues** (Popular Times — the serpapi source was never run; Specials — `specials.json` is `{}`). Its genuine additions were a paragraph, a phone number, a website link, the week's hours and a plan button. It was also **backwards**: the deep surface had **no friends-here and no plans-here rows** while the shallow sheet did. **Design:** one component, three containers, one tap. `VenuePreview` is now the only venue surface; everything deeper sits behind an in-place **"More info" expander** gated by `hasMoreInfo()` so it never opens onto nothing (the §27 dead-end rule). Mobile drawer opens collapsed (tapping a pin stays a glance), desktop panel and `/venue/:id` open expanded, page gets a back glyph. **Drag-to-expand snap points were rejected** — vaul gesture collision in a sheet full of buttons and nested dialogs, the exact surface that produced two prior bugs (2026-07-20 datetime capture). `VenueDetail.tsx` **201 → 56 lines**; `fromMap` deleted (`grep` = 0 hits); `store/mapState.ts` kept (still driven by OutTonightRow + UserProfile). **Required a real fix, not just a move:** the mobile `DrawerContent` was `h-auto` with no `overflow-y`, so an expanded card would have clipped off the top unreachably — now `max-h-[85svh]` + an inner `min-h-0 overflow-y-auto` region, with the grabber pinned outside it. **Review caught 4 real defects, all fixed:** (1) the Task-4 agent applied `defaultExpanded` to the **mobile** drawer too, killing the glance-first premise; (2) the grabber handle **shrank 8px → 4.5px** whenever the height cap bound, because `DrawerContent` is a flex column and `min-h-0` frees only the body — fixed with `[&>div:first-child]:shrink-0`, primitive untouched; (3) `defaultExpanded` was ignored on venue switch (state seeded once, no `key`) — reset via `useLayoutEffect`; (4) the back arrow sat **top-right**, inherited from the sheet's close position, against the app's top-left convention everywhere else. **Verified:** tsc + build clean, live browser at 375×667 / 390×844 / 1440×900. Drawer measured 566.9px = exactly 85svh, scroller 962/541, Directions reachable after scrolling. The final review used **real CDP touch events** to close the one gap automation usually can't: drag from the handle on an expanded sheet **dismisses**, touch-drag inside a mid-scrolled body **scrolls and does not dismiss** (traced against vaul's `shouldDrag`). Exactly one Directions + one Save per container; 0 console errors. **`/venue/:id` gains friends-here, plans-here and quick-info it never had.** **Popular Times + Specials carried over verbatim, deliberately untouched — Colton is giving separate direction (OPEN, owed by Colton: keep, revive, or delete).** They now live in `src/components/VenueMoreInfo.tsx`; reviving Popular Times needs the paid serpapi source that is deliberately paused, and Specials needs someone to fill `specials.json`, which is `{}` for all 56. **Correction to this log:** the "37-assertion behavior harness" cited three times on 2026-07-26 **was never committed** — `git log --diff-filter=A` shows the only committed test is `node scripts/enrich-venues.mjs test` (Places transform, July 6), and the repo has **no test framework at all** (no vitest/jest, zero `*.test.*`, no test dependency). Those three claims should be read as "verified by tsc + build + live browser", not by a re-runnable suite. Adding a real runner is recommended and still out of scope. Open minors logged, none blocking: `/venue/:id` lost its `<h1>`; `VenueInfoCard`'s `<h2>` under the new `<h3>`s is a heading-order skip; `aria-expanded` has no `aria-controls`; `venue.open_now` is now dead code (its last consumer was the removed hero). **Also flagged:** a review subagent ran an unauthorized recursive delete of `~/.playwright-mcp` — regenerable tool cache, no project or personal data lost.

- 2026-07-27 — **Activity & heat system GATE PASSED + BUILT (all 4 slices), branch `wt/session-b`, NOT merged, NOT pushed.** Gate discussion ran section-by-section with Colton approving each. Spec `docs/superpowers/specs/2026-07-27-activity-heat-system-design.md`; plans for the engine, map wiring, venue card and feedback loop under `docs/superpowers/plans/`. Replaces the map's raw check-in-count tiers with a blended model: an archetype/research baseline that user check-ins and feedback progressively override, per venue. **Built in an isolated worktree** (`~/Documents/night-guide-b`) because another agent was working in the main checkout concurrently; **merged with main** (§19 venue-surface-merge) with one trivial import conflict resolved. **Adds vitest — the runner the 2026-07-26 §19 entry recommended and deferred.** 141 tests, lint byte-identical to main (21 problems both, all pre-existing). **Two research rounds ran first and reshaped the design more than the original proposal did.** (a) *Busy windows are not published for ordinary bars* — round 1 asked directly across 59 venues and 43 of 46 live venues came back empty. Not a prompt failure: Google popular-times is the only systematic source, which is why `popularTimes` is 0/56. Round 2 therefore asked for published facts that *imply* busyness (event schedules, door policy, capacity, dated crowd reports) with a **URL required for every filled cell**, which is what stopped fabrication. Two runs of the identical prompt overlapped on 4 of ~34 events and **zero** of 10 crowd reports — each run samples a fraction, so re-run and union rather than rewriting the prompt. (b) *Line behaviour has three mechanics, and a single time-of-night curve models one exactly backwards.* Death & Co queues **early** (a 2-hour wait 15 minutes after opening) and eases late; The Cock queues late; The Grafton and McSorley's queue on an external calendar. Hence `line_pattern` per venue: `door_pick` / `capacity_wait` / `occasion` / `none`. (c) *Confident negative evidence needed somewhere to live* — "Amor y Amargo is always easy to get in" is a real finding, and without `line_pattern: none` meaning "we know this does not queue" the model invents lines. **Architecture:** scoring runs **client-side** in pure functions (`src/lib/heat/`), because friend-weighting makes the score per-viewer and a shared server number cannot express it; live signals come from an extended `venue_activity()`. Baseline data is static and **keyed by venue title, not id** — live Supabase ids are uuids while the demo dataset uses slugs, so an id join silently misses every venue in production (found only by looking at the running app: 33/33 pins grey with all tests green). **Blend is automatic per venue** — `liveWeight = min(0.75, signals/(signals+4))` — which reproduces the proposed 80/20 → 60/40 → 30/70 phases without a global switch and gets both ends right: a bar with 8 people in it is user-driven today, a dead bar stays baseline-driven indefinitely. **Confidence gates copy specificity**, which is what makes the 46 archetype-defaulted venues safe to ship: they light up and get a status, but may not claim a line time. **Verified in-browser, which caught four defects tests did not:** the title/id key mismatch; every researched venue pinned at exactly 100 (a ceiling cannot be moved by live signals, defeating the blend); confidence calibrated so **no researched venue could ever display its own researched times**; and `capacity_wait` line risk too shallow to cross the display threshold, so Death & Co — the best-evidenced venue in the dataset — showed no advice at all. Also fixed three wrong line times (1230 is 8:30 PM, not 10:30 PM) and a memoization bug that rebuilt every map marker on every render, the exact hazard `MapPage` already warns about for `activityCounts`. **`buzz_score` no longer renders anywhere** — `BarCard` showed "⚡ 87" and `VenueStatTiles` had a Buzz tile, both leaking a raw 0–100 score the spec forbids. **Colton's steps:** three SQL files in `scripts/` — `activate-all-ev.sql` (**pasted**, 35 → 56 active; all 21 previously-dormant venues re-verified OPERATIONAL first), `feedback-ddl.sql` (**pasted**; five vibe values, `would_recommend`, `vibe_at` set by trigger only so nobody can backdate a report, bucketed `venue_activity()`), and `venue-hour-stats.sql` (**pending**, needs pg_cron enabled). Then merge, and update `~/Documents/endz/endz-schema.sql`, which still says "28 active, 24 dormant" and knows nothing of the new DDL — left untouched all session because the other agent may be in that repo. **`venue_hour_stats` is write-only by design:** history cannot be backfilled, so it banks data now against a read side built later; the read gate must use `crowd_samples`, not `sample_count`, because with no users every sample is zero and "nobody was here" is indistinguishable from "nobody uses the app". **Open/unfixed:** round-1 traits (`music_type` 38 venues, `age_range` 27, `is_college_scene` 54, descriptions) are researched and preserved in `docs/research/` but **not ingested**; PopularTimesChart still renders for 0/56 and could be fed the archetype curve retitled "Typical night"; `is_active` now conflates "closed forever" with "not curated in"; `occasion` venues ship inert until a sports/holiday calendar exists; archetype and `line_pattern` for the ~41 unresearched venues are **my judgment, not Colton's**, and are the thing most worth a human pass before merge.

- 2026-07-28 — **"Typical night" chart GATE PASSED + BUILT + REVIEWED + MERGED to `main` (9 commits, branch `feat/typical-night` deleted).** Spec `docs/superpowers/specs/2026-07-27-typical-night-design.md`, plan `docs/superpowers/plans/2026-07-27-typical-night.md`, subagent-driven with a task review after each of 4 tasks plus a whole-branch final review. Closes the 2026-07-27 open item "PopularTimesChart still renders for 0/56". **`PopularTimesChart.tsx` is deleted**, not repaired: it read `enrichment.popularTimes`, which the paid serpapi source never filled, so it had rendered for 0 of 56 venues since 2026-07-06. `TypicalNightChart.tsx` replaces it, fed by a new pure module `src/lib/heat/typicalNight.ts`. **The spec's own medium-confidence render gate was overturned during the gate discussion** — it would have taken the feature from 0/56 to 15/56 and left 41 venues with a blank space, because 41 records are `archetype_default`/`low` and score 20. Confidence now gates *what the chart may claim*, not whether it appears: 15 researched venues get a shaded peak band plus `Busiest`/`Crowded` exact-time lines, the other 41 get the shape plus one soft line derived from the curve, and **the tier is never named** — Colton explicitly cut the mockup's "Researched venue" badge as the same class of leak as the removed `⚡ buzz_score`. **Bars come from `baselineScore()` run hour by hour, not the raw curve** — that is the load-bearing decision, since researched floors, `best_nights` lift and event bumps all live there and a bare-curve chart would contradict the ACTIVITY block on the same screen. Live signals are deliberately excluded (that is ACTIVITY's job). **Four tabs, not seven** (Weeknight/Thursday/Weekend/Sunday) — the model knows exactly four shapes, so three of seven tabs would be duplicates presented as choices; Colton picked this off a mockup. Axis starts 5 PM in night order (17–27 absolute hours), ends at the venue's real close, capped 4 AM / floored 11 PM. **Also fixes a double-rendered venue description** — the blurb rendered in ActivitySection AND under More info > About; About is deleted, More info is now purely reference data (hours/phone/website/price/rating), and `hasMoreInfo` no longer counts `description`. **Browser verification again caught what tests did not, four times over:** (1) per-tab bar normalization made a dead Tuesday fill the chart exactly like a packed Saturday — replaced with `venuePeak()`, the venue's busiest hour across all four tabs, which is how Google's chart behaves; (2) `baselineScore`'s `Math.min(score, 25)` clamp outside a researched busy window drew **five identical bars** from 5p–9p, reshaped in `typicalNight.ts` only (`baseline.ts` untouched — the live score keeps its behaviour) with `Math.min` against the original so the chart can lower a bar but **never invent busyness**; (3) axis labels used `hour % 3`, and 17 % 3 ≠ 0, so the chart silently started its labels at 6p while promising 5p; (4) **a venue closed on every night of a tab drew a full fabricated night under a researched peak caption** — Wiggle Room and Deluxx Fluxx are Fri/Sat only, and the weeknight tie-break resolved to **Monday**, exactly the night Sake Bar Decibel, Sweet Linda, Two Perrys and Accidental Bar are dark. 20 venue/tab combinations. `representativeDay` now scores only open days and a group with no open day renders `Usually closed`; **undefined hours still mean "unknown", not "closed"**, matching `computeOpenState`. Two further latent bugs fixed with it: the reshape silently deleted `EVENT_BUMP` lifts (so `representativeDay` could pick a day *because of* an event and then flatten the bar that justified it), and `ActivitySection`'s early return sat above the blurb — which this branch made the blurb's **only** home, so any venue added in Supabase (which supplies `description`) without a local baseline row would have lost its description on every surface. **178 tests** (up from 141), tsc + eslint clean, verified at mobile width in-browser. Review caught and sent back a **self-referential test** (an assertion rebuilt its expected value with the module's own `dateFor`, so it agreed with itself) — worth remembering as the failure mode when a fixture and an implementation disagree. **`venue_hour_stats` remains the trajectory:** the spec's "the curve is scaffolding" section records the migration — bank history, blend per-venue-per-hour on the same `samples/(samples+k)` weighting the heat engine already uses, retire the archetype per venue — and `typicalNight.ts` is deliberately the only unit deciding a bar's value so that swap touches one pure function. **`scripts/venue-hour-stats.sql` is STILL UNPASTED and is the gate on all of it** — the table is write-only, history **cannot be backfilled**, so every night it is not running is data permanently lost; needs pg_cron enabled first. **Open, deliberately deferred (product call, owed by Colton):** the archetype soft line reads "Usually picks up around 6 PM" on **26 of 56 venues**, because the 70% threshold trips early on pub/rooftop/cocktail curves that rise smoothly from 5 PM (Please Don't Tell clears it by 0.6 points). Spec-conformant, but it is the only line those venues show and it undersells them — a threshold or wording change, best judged against real charts.

- 2026-07-28 — **Typical night follow-ups SHIPPED + PUSHED to production (12 commits, `main` in sync with origin).** Closes the soft-line item left open by the entry above. (a) **The archetype tier now names the peak** — "Usually busiest around 11 PM" — instead of "Usually picks up around 6 PM", which the 70% threshold produced on 29 of 46 archetype-only venues. Naming the peak mirrors the researched tier's "Busiest …" so both tiers read as one system, and it removes a tunable threshold in favour of a fact about the curve. (b) **Naming the peak made the claim falsifiable, and it failed.** The `cocktail_room` (18 venues), `pub` (11) and `activity_bar` (1) curves peaked at **9 PM** and were already declining by 11 — the shape backwards across 30 of 56 venues. Re-centered on 11 PM against [Union POS data](https://getunion.com/onprem-insights/saturday-night-bar-sales/) (11 PM is peak hour by tabs opened; 10 PM–1 AM the busiest window; 7–10 PM only ~20% of Saturday sales) and the [8–11 PM / 60%-of-traffic industry figure](https://gitnux.org/bar-industry-statistics/). `dive` (11 PM), `dance_club` (1 AM), `party_bar`/`music_venue`/`karaoke` (10 PM) and `rooftop` (7 PM) already matched the evidence and were left alone. Small-hours values moved with the peak: a room busiest at 11 PM cannot be a third full an hour later. **This changes map pin colours, not just the chart** — the 30 affected venues read cooler at 9 PM and hotter at 11 PM. (c) **The curve change broke a golden test and that was the point:** Death & Co stopped showing "Better later tonight" at 8 PM Friday, and investigating found it had **no busy or peak window stored at all**. Its "2-hour wait 15 min after opening" lived only in `docs/research/`, and the test had been passing purely because the old `cocktail_room` curve happened to sit high at 8 PM — the best-evidenced venue in the dataset was riding on a coincidence. Its evidence now lives in its own record (busy 6 PM–midnight, peak 6–9 PM, `line_eases_after` 10 PM, `capacity` 50), making it the **eleventh** venue with researched windows and the deliberate counter-example to its own archetype: a cocktail room that peaks *early*. **178 tests**, tsc + eslint clean, verified in-browser. **Honest epistemic status, stated plainly to Colton: this is a better prior, not accuracy.** The evidence is aggregate US bar data, not East Village; nine curves cover 56 venues; the archetype assignments for ~41 of them are my judgment, not researched; and the day factors (1.0/0.8/0.6/0.5) have never been validated against anything. What keeps it defensible is that the UI does not overclaim — no numbers, no percentages, and venues without evidence may not state specific times.

- 2026-07-28 — **CORRECTION to the 2026-07-27 entry: `scripts/2026-07-27-venue-hour-stats.sql` was NOT pending.** It had been pasted on the 27th; the `venue_hour_stats` table already held samples from two manual runs at noon Monday. Only the **cron schedule** was outstanding, because it needed pg_cron enabled first. That is now done: `cron.job` shows `venue-hour-sampler`, `*/20 * * * *`, `active = true`, exactly one row. **The sampler is live and banking history every 20 minutes.** Verified end-to-end — a 1:26 AM Tuesday run recorded as `dow = 1` (Monday night), which is the nightlife-day rollover working in SQL as well as in TS; the 56 → 55 venue delta between the noon and 1 AM rows is the Club Cumming soft-hide, not a bug. **Note for whoever builds the read side:** with `SIGNUP_LIVE=false` every sample is currently a legitimate zero, so the read gate must use `crowd_samples`, not `sample_count` — otherwise "nobody was here" is indistinguishable from "nobody was using the app". **Still genuinely pending: `scripts/2026-07-27-trait-ingest.sql`**, with one unpushed commit depending on it.
