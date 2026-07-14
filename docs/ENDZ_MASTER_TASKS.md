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

- **Unblock UI** — v1 friends shipped with Remove/Block only. RLS already permits the blocker (`user_id`) to delete the block row; the UI just doesn't exist. Until then, unblocking = deleting the row in Supabase Table Editor.
- **Map-pin friend avatars** — the locked v1 fast-follow (Map.tsx marker code is fragile; that's why it was cut from v1).
- **Location permission in onboarding** — make it one of the first accepts (Colton ask, 2026-07-13).
- **Assisted / auto check-in** — PWA reality: foreground nearby-prompt only; true background needs Capacitor (Colton ask, 2026-07-13).
- **Night Recap** — morning-after bars-visited + ranking. Blocked: `checkIn()`/`checkOut()` currently DELETE history (needs delete→expire change — touches the protected core loop) + needs a ratings table. Recap trail private-to-self, never visible to others.
- **Going-out crew** — MySpace-Top-8-style crew of 5–8 (IG Close Friends analog). Tabled 2026-07-13; needs `close_groups`/`close_group_members`. Resume only on Colton's prompt.
- **Google OAuth out of testing mode** — random users currently CANNOT sign into the map (only added test users). A launch blocker bigger than anything above; needs Google OAuth verification or a decision on auth approach.
- **Declared intent ("going out tonight")** — Phase 1 roadmap item (2026-07-08); needs new `intents` table. Pairs with the friends layer that just shipped.
- **Analytics** — Phase 1 roadmap item; `src/lib/analytics.ts` is a no-op today. Needs an `events` table + wiring. Without it there's no way to measure the north-star metric (unprompted check-ins per active user per night).
- **Real PWA icons** — `icon-192/512.png` are placeholders generated from the favicon; swap for real art before pushing installs.

---

## Decision Log

_Append decisions here as features clear the discussion gate: date, feature, decision, approved scope, what was postponed._

- 2026-07-14 — Tracker created. All features `NOT DISCUSSED`; audits recorded above.
