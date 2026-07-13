# ENDZ — Next-Phase Product & Implementation Roadmap

_Status: planning only. No application code, Supabase schema, routes, auth, env vars, or infra were changed to produce this document. No packages installed. No fake data created._

_Author: planning pass (Opus), 2026-07-13. Starting point: branch `redesign/light-social-theme` (PR #1), on top of the shipped light social-app redesign of the map screen._

---

## 1. Executive Summary

ENDZ answers one question: **"Where's the move tonight?"** Today it does this for the East Village with a live map, rule-based "Find the Move," bundled venue enrichment, and a check-in loop. The next phase turns ENDZ from a single-neighborhood demo into a **trustworthy, socially-driven, multi-neighborhood nightlife app** — without breaking the launch-critical check-in loop or over-building before validation.

Four things gate that:

1. **Venue truth.** Stop depending on static, title-keyed, hardcoded venue/happy-hour data. Move to a canonical venue system with sources, freshness, confidence, and honest data-state labels.
2. **Geographic scalability.** Keep East Village as the **featured beachhead** (a real selling point while we expand), but de-hardcode it into a data-driven city→neighborhood architecture so EV becomes *record #1*, and new areas are additive rather than a rewrite.
3. **Recommendations people trust.** Upgrade Find the Move to ~3 explained options, make Tonight's Move time-aware, and replace the static weekend list with dynamic, category-based rankings — all with transparent scoring and confidence/stale penalties.
4. **A minimum-useful social layer.** Ship username→request→accept friendships (the `friendships` table already exists), a small "close nightlife group" (Top-8-style, better name TBD), going-out status, and privacy-controlled check-ins that feed the recommendations — without becoming a full social network.

**Guiding constraint:** never label something "live," "hot," or "heating up" without genuinely live data behind it. Truthfulness is the product's moat, not a nice-to-have.

**Smallest useful next coding task:** extract all East-Village hardcoding into one config source of truth **without changing visible behavior** (see §23–24). It keeps EV exactly as-is on screen while unlocking the entire expansion architecture.

---

## 2. Current-State Audit

### 2.1 Stack & delivery
- **Frontend:** Vite + React + TypeScript, shadcn/ui, Tailwind, Zustand, TanStack Query, React Router.
- **Map:** MapLibre GL + OpenFreeMap (`positron` light style as of the redesign). No map token anywhere.
- **Backend:** Supabase (Postgres, RLS, Realtime). Client via `src/lib/supabase.ts` (`getSupabase()` singleton; env vars first, Profile-tab config store fallback).
- **Hosting:** Vercel (auto-deploys `main`). Installable PWA (hand-rolled manifest + no-cache SW).
- **CI/jobs:** one GitHub Action — `supabase-keepalive.yml` (Mon+Thu). **No data-refresh job.**

### 2.2 Data flow (as built)
- `resolveDataSource()` (`src/data/resolver.ts`) picks: `ApiDataSource` (if `apiBaseUrl` set) → `SupabaseDataSource` (if `getSupabase()` non-null) → `DemoDataSource` (fallback = `EAST_VILLAGE_VENUES`).
- **`Venue`** type is client-defined (`src/data/types.ts`): `id, title, lat/lng, category (bar|club|lounge), neighborhood?, avg_price_level?, music_type?, image_url?, buzz_score?, hot_tonight?, editors_pick?, venue_stats?…`. Neighborhood is a **free-text string**, not a relation.
- **Enrichment** (`src/data/enrichment/*.json`) is bundled client-side and **keyed by venue title** — a fragile join. Open-now/happy-hour state is computed client-side from this JSON. Refresh is a **manual** node script (`scripts/enrich-venues.mjs`, Google Places API (New), 30-day cache ToS).
- **Supabase tables (from `endz-schema.sql`):** `profiles`, `venues`, `check_ins`, `friendships`, + `active_check_ins` view. RLS policies exist for all, incl. "checkins visible per rules" and friendship request/accept. **`friendships` exists but is unused in the UI.**

### 2.3 Features that exist
- **Map screen** (`MapPage.tsx`, `Map.tsx`): pins (white + activity ring), search + fly-to, filter chips (category, hot, music, happy-hour, Find-the-move), map/list toggle, venue preview (bottom sheet mobile / right panel desktop after redesign), legend, locate/recenter.
- **Find the Move** = `VibeFinder` + `vibeScore.ts`: rule-based, 6 questions (vibe/drinks/when/how-far/happy-hour/age), returns picks. Age is an honest **trait lean**, not real data.
- **Check-in loop** (`lib/checkins.ts`, `hooks/useCheckIns.ts`): one-at-a-time, 3h expiry, vibe enum (chill/building/packed), content-free Realtime poke + 60s poll. Anonymous/guest check-in exists only on an unmerged branch (`phase0-stretch`).
- **Discover** (`Discover.tsx`, 64 lines): Happy-Hours rail (day tabs) + Weekend Favorites (ranked by Google rating — honest proxy, but see §8).
- **Social** (`Social.tsx`, 34 lines): **stub** — "Adding friends is coming soon."
- **Profile / VenueDetail / Join / Qr / PickUsername**: present. Waitlist capture (`/join`, `/qr`) is live.
- **Analytics** (`lib/analytics.ts`): `track(name, payload)` is a **no-op** console stub.

### 2.4 East-Village hardcoding (audit result — must become data-driven)
- `src/data/venues.ts` — `EAST_VILLAGE_VENUES` array + all coordinates.
- `src/components/Map.tsx` — recenter/fallback center `[-73.9833, 40.7270]`, "East Village" copy, "Recenter on East Village" label.
- `src/pages/MapPage.tsx` — header copy "Find your night in the East Village".
- `src/store/mapState.ts` — initial map center/zoom (EV).
- Neighborhood is a free-text string on venues (`"Avenue A"`, etc.) — no city/neighborhood entities, bounds, or relations.

### 2.5 Technical debt / risks flagged
- Enrichment join by **title** (breaks on renames/dupes; no stable external ID mapping in-app).
- No freshness/confidence surfaced to users despite `fetchedAt` existing in enrichment.
- Lint has pre-existing errors in `data/sources/*` and `tailwind.config.ts` (`require`) — not blocking, but noise.
- Bundle >500 kB (no code-splitting) — perf debt, not urgent.
- Secrets: Supabase/Google keys in `.env.local` (gitignored) — **do not surface in any doc**. This roadmap contains none.

**Do-not-break list:** the check-in loop (writes, expiry, Realtime poke, RLS), `active_check_ins` `security_invoker`, waitlist anon-INSERT-only RLS, `getSupabase()` precedence, map marker geo-anchoring (never set inline `position` on marker elements), Google 30-day cache compliance.

---

## 3. Product Principles

1. **Truth over hype.** No "live/hot/heating up" without live data. Every claim is labeled with source + freshness (§11).
2. **The map is the product.** Everything floats over a live map; other surfaces feed back into it.
3. **Mobile-first, responsive everywhere.** One-handed, 3-second usable; clean on tablet/desktop.
4. **Simplest useful version first.** MVP → Next → Later → Don't-build-yet (§18). Protect the check-in loop above all.
5. **Privacy is trust.** Opt-in, consensual location only; friends-only defaults; no background tracking; ghost mode.
6. **Data-driven geography.** No hardcoded city/neighborhood/coords/copy. EV is the featured first record, not a special case in code.
7. **Explainable recommendations.** Rule-based and legible; every pick says *why*. No ML in v1.
8. **Don't fabricate.** Ratings/age/popularity must be honest proxies or our own check-in data — never invented.

---

## 4. UI Direction

**Locked visual system (shipped in the redesign — reuse as the baseline):** warm off-white bg `#F7F7F4`, white cards/nav `#FFFFFF`, charcoal text `#121212`, muted `#707070`, hairline `#E8E8E5`, ENDZ purple `#6C45FF` (branding/active/selected/primary), light-purple state `#EEE9FF`, activity `hot #FF4D67 / trending #FF8A3D / friends #22A67A`. Color comes from photos, avatars, activity, neighborhood imagery — not chrome. Minimal glow/neon/gradients. Optional dark mode later.

**Design language it must feel like:** a real modern social app (Instagram/Snap-Map/Hinge cleanliness) — not a nightclub site, gaming UI, crypto product, SaaS dashboard, or bar directory.

**21st.dev inspiration (searched; not yet implemented):**
- Venue sheet/card → *Place Card* (id 7734: image carousel + rating + tags), *Location Card* (id 7902), *Trip Details Card* (id 7957: header/details/action toolbar → maps to a Find-the-Move result card).
- Social/presence → *Astryx Avatar* (id 17144: AvatarGroup + status dots + overflow — friends-at-venue), *Live Visitor* (id 9575: animated presence), *Profile-Card* (id 2593: user + recent activity + add CTA → friend requests).
- **Two reserved `get_component` retrievals handed to Fable:** (1) **id 7734 Place Card** for the venue sheet, (2) **id 17144 Astryx Avatar** for the friends-present layer. Do not copy any generic SaaS dashboard aesthetic.

**Surfaces to design (state matrix applies to each: default / loading / empty / error / stale):**
Map · Search · Filters · Venue pins · Activity states · Hot zones · Venue preview card · Venue detail page · Discover · Tonight's Move · Find the Move · Neighborhood discovery · Neighborhood detail · Friends & social activity · Profile · Mobile nav (bottom) · Desktop nav (left rail) · Desktop side panels · Data-freshness/confidence labels.

Every surface must preserve existing functionality and avoid unnecessary visual complexity.

---

## 5. Venue Accuracy Plan (canonical venue system)

**Problem:** venue data is static, title-keyed, and mixes demo + Supabase + bundled JSON with no source/freshness/confidence.

**Canonical venue record (target fields):** permanent `endz_venue_id` · external IDs (Google `place_id`, others) · name · address · coordinates · `city_id` · `neighborhood_id` · venue type(s) · business status (operational/closed/moved) · current hours · regular hours · special hours · price level · phone · website · photos · rating + rating_count (where appropriate) · music · crowd/vibe · **source** · `last_source_refresh_at` · `last_verified_at` · verification status · confidence score · suppression flag (closed/duplicate/stale).

**Data states surfaced app-wide (see §11):** Live now · Venue verified · Updated today · Updated recently · Based on recent patterns · Estimated · Needs verification · Stale.

**Pipelines to plan (no code yet):**
- **Ingestion** — from external sources into canonical rows, keyed by stable external ID (not title). Migrate the current title-keyed enrichment to `place_id`-keyed.
- **Duplicate matching** — name+geo proximity + external-ID overlap; staff resolves ambiguous merges.
- **Refresh schedules** — scheduled job (Supabase cron / GitHub Action / edge function) honoring Google's 30-day cache ToS; per-field TTLs (hours refresh more often than photos).
- **Error handling** — source failure ≠ data wipe; keep last-good + mark stale.
- **Stale-data suppression** — hide/deprioritize venues past freshness thresholds or business-status = closed/moved (the 4 known EV closures: Manitoba's, Bourgeois Pig, Angel's Share, Paul's — already nulled in scripts).
- **Venue claim flow** (later) — venue owner claims + edits with staff approval.
- **User correction reports** — "this looks wrong" → moderation queue.
- **Staff moderation** — review queue for claims, corrections, merges, verifications.
- **Data-source priority rules** — venue-submitted/verified > ENDZ-staff-verified > official API > user-submitted > social > unverified.

---

## 6. Happy-Hour Plan (dynamic, verifiable)

**Problem:** happy hours are permanently hardcoded in bundled JSON.

**Structured happy-hour record:** `venue_id` · title · description · days_of_week · start_time · end_time · effective_start_date · effective_end_date · food_specials · drink_specials · restrictions/exclusions · source_type · source_url · submitted_by · verification_status · `last_verified_at` · confidence_score · active/expired.

**Source types:** venue-submitted · venue website · ENDZ staff verified · user-submitted · social-media source · unverified.

**Behavior:** automatic expiration (past `effective_end_date` or unverified beyond TTL) · venue confirmation · user reports · staff review · source freshness · "Verified X days ago" labels · remove expired deals · views for **by-neighborhood / active-now / starting-soon** · surface inside Find the Move & Tonight's Move. **Never show expired/unverified offers as confirmed facts** — badge them "unverified" or hide.

---

## 7. Event Plan

**Support (schema + lifecycle):** ticketed & non-ticketed events · venue-submitted · promoter-submitted · DJ sets · theme nights · karaoke · trivia · guest lists · cover info · start/end times · cancellation handling · duplicate detection · source tracking · verification · expiration.

**MVP boundary:** start with **venue/staff-submitted events only** (no external ticketing integration yet) for the featured neighborhood. External APIs (ticketing, listings) are research/Later. Events influence venue & neighborhood rankings as a **boost with freshness decay**; freshness communicated via §11 labels. Cancellations remove the boost immediately.

---

## 8. Find the Move Plan (≈3 explained options)

**Foundation exists:** `VibeFinder` + `vibeScore.ts` (rule-based). Upgrade, don't replace.

**Inputs:** time · location · neighborhood · distance/travel-time · venue type · mood · occasion · music · budget · group size · desired activity level · happy hours · events · open/closing hours · friends going out / checked in · group preferences · user history · saved venues · **data freshness & confidence** · weekend patterns.

**Output:** ~3 diverse strong options, each explaining — why recommended · how current the data is (live/verified/updated/pattern/estimated) · distance/travel-time · relevant event · relevant happy hour · friend/group signal · price + type · open + how late.

**Ranking (transparent, rule-based; NO ML v1):**
- Weighted additive score across inputs; **confidence penalty** and **stale-data penalty** subtract from score.
- **Diversity constraint** — the 3 picks shouldn't be near-duplicates (vary neighborhood/type/price).
- **Fallback** when data is thin — widen radius / relax filters / say so honestly ("not much live data yet — here's what's usually good").
- **Log every recommendation + inputs + shown labels** (for later analysis; §12), no ML training implied.

**Flows:** mobile = the existing question sheet → 3-card result. Desktop = left-panel questionnaire → results in the right panel or as map-highlighted pins.

**Acceptance:** returns 3 diverse options with visible reasons + freshness on each; degrades gracefully with sparse data; never claims live without live data.

---

## 9. Tonight's Move Plan (time-aware)

Becomes a genuinely useful, **time-of-day-adaptive** surface (not a static promo band). Uses the same scoring engine as Find the Move, pre-composed by daypart:

- **Afternoon:** happy hours starting soon · best first stop · ticketed/reservation events · friends planning to go out · neighborhoods worth considering.
- **Early evening:** happy hour now · places starting to fill (only if backed by check-ins) · dinner+drinks · group-friendly · suggested neighborhoods.
- **Late evening:** best for dancing · events now · open late · friends currently out · strongest venue/neighborhood options.
- **After midnight:** still open · late-night dancing · no-cover · food nearby · travel practicality · safer/closer alternatives.

**Section library (compose per daypart):** Best first stop · Best value now · Happy hours active · Events tonight · Neighborhoods heating up · Best for dancing · Best for groups · Friends going out · Still open late · Best near you · Based on your preferences. **No "hot/live/heating up" language without credible support** — sections with no live backing show pattern/estimated labels or are omitted.

---

## 10. Weekend Recommendation Plan (dynamic categories)

Replace the static "Best Bars This Weekend" (currently Google-rating-ranked) with **dynamic category rankings**: Best for dancing · groups · happy hour · first stop · late-night · event · near you · value · casual night · your-preferences · trending with friends · new venue · neighborhood bar crawl.

**Explain per category:** how it's calculated · required data · refresh cadence · weekend-pattern use · event/happy-hour/social effects · stale penalty · low-confidence treatment · tie-breaks · scheduled recalculation. **Do not rank purely on general online ratings** — ratings are one input, capped, and combined with freshness, events, happy hours, and (where permitted) social signal.

---

## 11. Neighborhood Feature & Expansion Plan

**Steer (locked with user 2026-07-13):** keep **East Village as the featured/marketed beachhead** while building the scalable architecture beneath it. De-hardcode EV so it's *neighborhood record #1*; expansion is additive. "Remove EV hardcoding **without changing visible behavior**" is the first task (§23).

**Data architecture (target):** `cities` → `neighborhoods` (with boundary polygon/bounds, center, default zoom) → `venue.neighborhood_id` relation. Plus: events-by-neighborhood, happy-hours-by-neighborhood, **neighborhood activity scores**, **neighborhood recommendation scores**, neighborhood freshness timestamps, user location, travel-time. All derived, none hardcoded.

**Surfaces:** city selector · neighborhood selector · neighborhood cards in Discover · "Neighborhoods Tonight" · neighborhood heat/activity (only when backed by check-ins) · trending neighborhoods · comparison · **neighborhood detail page** (name · description · activity level · price level · typical crowd · common venue types · music tendencies · best time to arrive · top venues tonight · happy hours active · events tonight · friends/social · nearby neighborhoods · freshness + confidence) · venues/events/happy-hours/friends by neighborhood · travel time · map zoom/filter · nearby neighborhoods.

**Neighborhood recommendation categories:** hottest right now · best for dancing/bar-hopping/casual/happy-hours/groups/late-night/value · closest strong option · where friends are going · best match. **Never label a neighborhood hot/live without credible data.**

**Long-term flow:** "Go to Williamsburg tonight." → "Here are the 3 strongest venues for your group once you arrive."

**Expansion strategy:**
- **Next-neighborhood criteria:** walkable density, existing ENDZ interest, adjacency to EV, venue+happy-hour coverage feasibility, a plausible check-in seed crowd.
- **First expanded MVP:** **2–3 neighborhoods** beyond EV (quality over quantity).
- **Launch-readiness bar per neighborhood:** minimum venue coverage (e.g. ≥20 verified operational venues), some happy-hour + event coverage, freshness within threshold, no empty core surfaces.
- **Avoid empty pages:** don't expose a neighborhood until it clears the bar; show honest "coverage building" states for partial areas; never fabricate activity.
- **Appears across:** Map (bounds/filter), Discover (cards), Find the Move (distance/neighborhood inputs), Tonight's Move (neighborhoods heating up), Weekend (per-neighborhood categories), Social (friends by neighborhood).

---

## 12. Updated Friends & Close-Group Plan

**What exists:** `friendships` table + RLS (request/accept/see-own); check-ins with visibility RLS. **UI is a stub.** So the graph plumbing is partly there; the product isn't.

**Concept:** a nightlife-focused **close group** (~5–8 people you go out with most) — a tasteful, private evolution of "MySpace Top 8," not a public ranking. **Working name "going out crew" is temporary;** propose (don't lock) stronger names: *Circle · Night Circle · Close Crew · Inner Circle · The Group · Plans · Night Friends*. Decide via user testing. Avoid childish/forced nightlife names.

**Basic friendship system:** unique usernames · user search · send/accept/decline request · block · remove · friend list · pending requests · privacy controls.

**Close group:** ~5–8 people · user manually selects & reorders · replace members · influences recommendations/planning · **visibility configurable** · do **not** publicly expose relationship rankings by default (private / friends-only / partial) · don't copy MySpace visually or create social pressure.

**"Going out tonight" status:** Not going out / Maybe / Going out / Already out · visibility private-or-selected-friends · optional neighborhood/venue/time · **auto-expires after the night**.

**Privacy-controlled check-ins:** private / close-group-only / all friends / (friends-of-friends later) · hidden after leaving · disable precise location · neighborhood-only (no exact venue) · appear offline. Build on existing check-in RLS.

**Social page:** close group · requests · friends going out tonight · friends already out · neighborhoods friends are considering · venue plans · group invitations · shared recommendations · recent group activity · **empty states for new users** (must be useful before you have friends — see §18).

**Friends on the map:** avatars at venues when permitted · grouped avatars (→ Astryx AvatarGroup) · neighborhood-level presence when exact location hidden · clear privacy indicators · **no background tracking without explicit permission** · no accidental exact-location exposure.

**Group planning:** suggest venue/neighborhood · vote · share Find-the-Move results · lightweight plan · RSVP yes/maybe/no · approximate meetup time. **Group chat/comments postponed** unless truly necessary.

**Outside-app discovery (Later):** phone contacts · invite links · shareable usernames · IG/Snap sharing. Don't depend on unavailable third-party friend graphs; avoid privacy/policy landmines.

**First social MVP:** username search · requests · accepted friends · close group · going-out status · privacy-controlled check-ins · friends in Social + on map when permitted · share a venue / Find-the-Move result.

**Postpone:** full feed · DMs · stories · complex group chat · public popularity rankings · follower counts · friends-of-friends (until privacy proven) · friendship auto-ranking · gamification.

---

## 13. Privacy & Safety Plan

- **Consensual location only** — opt-in; no covert/background tracking (locked principle). Ghost mode = be present without broadcasting.
- **Per-check-in visibility** — everyone / friends / close-group / nobody; default friends-only. Neighborhood-only option (no exact venue). Auto-hide after leaving; 3h expiry as backstop.
- **Mutual friendships** on the location layer (no one-way following of location).
- **No exact pinpoint** — "at this venue," never raw GPS to others.
- **One-tap off switch.**
- **RLS-enforced** — visibility rules live in Postgres policies, not just the client; the Realtime poke stays content-free (no identities on the wire).
- **Minors/safety** — age gate at onboarding (roadmap item), late-night "safer/closer alternatives" in After-Midnight Tonight's Move.
- **No secrets in client or docs.**

---

## 14. Data-Truth Labeling System

A **product-wide** capability: every recommendation/venue/happy-hour/event/neighborhood/score can show source + freshness.

**User-facing labels:** Live now · Verified by venue · Verified by ENDZ · Updated today · Updated this week · Based on recent weekends · Estimated · Community reported · Needs verification · Information may be outdated.

**Internal-only:** raw confidence score, source-priority tier, last-refresh timestamps, suppression reason.

**Rules:** confidence = f(source tier, `last_verified_at` age, corroboration, report count). Stale data is deprioritized in ranking and badged, not silently shown as fact. Every surface has a "report incorrect info" affordance. "Live" is reserved for genuinely live (current check-ins / venue-confirmed now).

---

## 15. Proposed Supabase Architecture

_Proposals only — no migrations. "Now" = first expanded MVP; "Later" = post-validation._

| Table | Purpose | Key relationships | Privacy | When |
|---|---|---|---|---|
| `profiles` *(exists)* | User identity (name, photo, ghost mode) | 1:1 auth.users | PII; ghost flag | Now |
| `friendships` *(exists)* | Mutual friend graph (request/accept/block) | user↔user | Mutual, RLS see-own | Now |
| `close_groups` | The ~5–8 nightlife group | owner→profiles | Private by default | Now |
| `close_group_members` | Ordered membership | group→profiles, position | Sensitive ranking — private | Now |
| `going_out_statuses` | Tonight intent (status, neighborhood?, venue?, time?, expires) | user, neighborhood?, venue? | Visibility scope | Now |
| `check_ins` *(exists)* | Live presence (venue, vibe, expires) | user→venue | Visibility RLS | Now (protect) |
| `privacy_settings` | Per-user + per-check-in defaults | user | Core privacy | Now |
| `cities` | City registry | — | Public | Now |
| `neighborhoods` | Neighborhood + center/zoom + boundary | city→neighborhood | Public | Now |
| `neighborhood_boundaries` | Polygon/geo (may fold into `neighborhoods`) | 1:1 neighborhood | Public | Now/Later |
| `venues` *(exists, expand)* | Canonical venue (see §5 fields) | city, neighborhood | Public | Now (expand) |
| `venue_external_sources` | External IDs + per-source refresh | venue→source | Internal | Now |
| `venue_verification` | Verification status/history | venue, staff | Internal/moderation | Now |
| `happy_hours` | Structured HH (see §6) | venue | Source/verify | Now |
| `events` | Nightlife programming (see §7) | venue, promoter? | Source/verify | Now/Later |
| `user_reports` | "This looks wrong" corrections | user→(venue/hh/event) | Moderation | Now |
| `venue_claims` | Owner claim flow | venue↔owner | Moderation | Later |
| `neighborhood_scores` | Activity + recommendation scores + freshness | neighborhood | Internal→labeled | Now |
| `venue_scores` | Ranking inputs/outputs + freshness | venue | Internal→labeled | Now |
| `recommendations` | Logged Find-the-Move/Tonight requests + inputs | user | Analytics/privacy | Now/Later |
| `recommendation_results` | Options shown + labels + selection | rec→venues | Analytics | Later |
| `saved_venues` | Bookmarks (currently client `saved` store) | user→venue | Private | Now |
| `user_preferences` | Budget/music/type leanings | user | Private | Now/Later |
| `group_plans` | Lightweight plan for a night | close_group/friends | Scoped | Later |
| `group_plan_options` | Candidate venues/neighborhoods | plan→(venue/neighborhood) | Scoped | Later |
| `group_votes` | RSVP/votes | plan_option→user | Scoped | Later |
| `analytics_events` | MVP event sink (§12) | user? | Minimize PII | Now (minimal) |

Existing `active_check_ins` view + `security_invoker=on` must be preserved.

---

## 16. External Data-Source Research List

_No source is assumed accurate for happy hours without verification._

| Need | Candidate | Provides | Doesn't provide | Cost/limit risk | License/attribution | Freshness | MVP? |
|---|---|---|---|---|---|---|---|
| Venue identity / hours / status / photos | **Google Places API (New)** *(in use)* | place_id, hours, business_status, price, rating, photos, editorial summary, music-ish | **no live busyness, no happy hours, no crowd-age** | Trial cannot auto-charge; quotas non-adjustable; per-req cost later | 30-day cache ToS; attribution | Good if refreshed | **Yes** (core) |
| Map tiles / style | **OpenFreeMap** *(in use)* | vector tiles, positron style | routing/geocoding | Free, keyless | OSM attribution required | Live tiles | **Yes** |
| Geocoding / boundaries | Nominatim (OSM) / OSM extracts | address↔coords, admin/neighborhood polygons | curated nightlife neighborhoods | Rate limits; self-host option | OSM/ODbL attribution | Static-ish | Yes (boundaries) |
| Travel time / distance | Client haversine *(in use)* → OSRM/Valhalla (self-host) | straight-line now; routing later | live traffic (self-host) | Free if self-hosted | OSM | n/a | Now (haversine) / Later (routing) |
| Events / ticketed | Ticketing/listing APIs (research) | event listings, tickets | verified happy hours; small-bar nights | Cost, coverage gaps for dive bars | Varies | Varies | **Later** (start venue-submitted) |
| Happy hours | **None reliable** | — | accurate HH (must verify) | — | — | — | Venue/staff/user-submitted + verify |
| Venue websites | Direct (manual/staff) | HH, events, hours | scale | Manual effort | Respect ToS/robots | Manual | Staff-verified |
| Photos (supplement) | Google / venue-submitted | imagery | rights clarity | — | Licensing care | — | Venue-submitted preferred |

**Takeaway:** live busyness and trustworthy happy hours **only** come from our own users + venue/staff verification. That's the product, not a gap to fill with an API.

---

## 17. Phased Implementation Roadmap

_Each phase: objective · tasks · dependencies · likely files · Supabase/backend/API implications · mobile/desktop · privacy · acceptance · postpone · branch/commit breakdown · risk._

### Phase 0 — Audit, backups, instrumentation
- **Objective:** protect current state; establish visibility before change.
- **Tasks:** confirm branch/deploy workflow (done: `redesign/light-social-theme`, Vercel auto-deploys `main`); tag/snapshot current `main`; finish the static-data + EV-hardcoding audit (this doc §2/§2.4); plan analytics + error monitoring (turn `analytics.ts` no-op into a real sink; add error boundary/reporting).
- **Files:** `lib/analytics.ts`, docs. **Supabase:** none (or add `analytics_events`). **Privacy:** minimize PII in events.
- **Mobile/desktop:** n/a. **Acceptance:** documented audit + monitoring plan; no behavior change. **Postpone:** heavy analytics. **Branches:** `chore/audit-and-instrumentation`. **Risk:** Low.

### Phase 1 — Visual system & map UI _(mostly shipped)_
- **Objective:** social-app-quality map screen; consistent tokens.
- **Tasks:** land the redesign (PR #1); polish pins/preview/nav; empty/loading/error/stale states; desktop side panels; reuse §4 tokens. Optionally pull the 2 reserved 21st components (Place Card, AvatarGroup).
- **Files:** `index.css`, `tailwind.config.ts`, `Map.tsx`, `MapPage.tsx`, `VenuePreview.tsx`, `BottomTabs.tsx`, `AppLayout.tsx`, cards. **Supabase/API:** none. **Acceptance:** functionality unchanged; verified 390/768/1440; a11y/focus/reduced-motion intact. **Postpone:** dark mode. **Branches:** `redesign/*`, `feat/map-states`. **Risk:** Low–Med.

### Phase 2 — Venue truth & geographic scalability
- **Objective:** canonical venues; city→neighborhood; de-hardcode EV (keep it featured).
- **Tasks:** define canonical venue fields (§5); `cities`/`neighborhoods` tables + `venue.neighborhood_id`; migrate enrichment from **title-keyed → place_id-keyed**; business-status + hours + freshness/confidence; **extract EV hardcoding into one config source of truth (first task, §23)**; suppression of closed/dup/stale; refresh job.
- **Files:** `data/types.ts`, `data/venues.ts`, `data/sources/*`, `data/enrichment/*`, `store/mapState.ts`, `Map.tsx`, `MapPage.tsx`, new `config/markets` + `data/neighborhoods`. **Supabase:** `cities`, `neighborhoods`, expand `venues`, `venue_external_sources`, `venue_verification`. **API:** Google refresh job (30-day ToS). **Mobile/desktop:** city/neighborhood selectors. **Privacy:** none new. **Acceptance:** EV looks identical; a second neighborhood can be added by data only; stale/closed suppressed; freshness available. **Postpone:** claim flow, multi-city UI. **Branches:** `refactor/dehardcode-market`, `feat/canonical-venues`, `feat/neighborhoods`. **Risk:** Med–High (touches data layer — stage carefully).

### Phase 3 — Dynamic happy hours & events
- **Objective:** structured, verifiable HH + basic events.
- **Tasks:** `happy_hours` schema (§6) + expiration/verification/sources/user-corrections; migrate bundled HH JSON → table; `events` schema (§7) venue/staff-submitted first; freshness labels.
- **Files:** `data/enrichment/*` (HH read path), Discover HH rail, `VenueQuickInfo`, new events surfaces. **Supabase:** `happy_hours`, `events`, `user_reports`. **API:** none required (venue/staff-submitted); external events = research. **Acceptance:** no expired/unverified deal shown as fact; HH by neighborhood/active-now/soon; events tonight where they exist. **Postpone:** promoter portal, ticketing APIs. **Branches:** `feat/happy-hours-dynamic`, `feat/events-mvp`. **Risk:** Med.

### Phase 4 — Find the Move, Tonight's Move, weekend recs
- **Objective:** trustworthy, explained, time-aware recommendations.
- **Tasks:** upgrade `vibeScore.ts` to weighted scoring with confidence/stale penalties + diversity + fallback + logging (§8); ~3 explained options; time-of-day Tonight's Move (§9); dynamic weekend categories (§10); neighborhood recs (§11).
- **Files:** `lib/vibeScore.ts`, `VibeFinder.tsx`, `Discover.tsx`, `WeekendFavorites.tsx`, new `TonightsMove`, `MapPage` filters. **Supabase:** `venue_scores`, `neighborhood_scores`, `recommendations` (log). **Acceptance:** 3 diverse options with reasons+freshness; no "live/hot" without live data; graceful sparse-data fallback. **Postpone:** ML, personalization beyond simple history. **Branches:** `feat/find-the-move-v2`, `feat/tonights-move`, `feat/weekend-dynamic`. **Risk:** Med.

### Phase 5 — Minimum-useful friends & social
- **Objective:** the social layer that makes recommendations personal.
- **Tasks:** build on `friendships`: username search, request/accept/decline/block/remove, pending; close group (5–8, reorder); going-out status; privacy-controlled check-ins (extend RLS); friends on map (AvatarGroup) + Social page; share venue / Find-the-Move result; group planning (suggest/vote/RSVP — no chat).
- **Files:** `Social.tsx` (replace stub), `store/auth`, new `store/friends`/`store/group`, `Map.tsx` (friend avatars), `lib/checkins.ts` (visibility), Profile. **Supabase:** `close_groups`, `close_group_members`, `going_out_statuses`, `privacy_settings`, `saved_venues`, `user_preferences`, later `group_plans/options/votes`; **RLS is the hard part.** **Privacy:** consensual only; ghost mode; neighborhood-only presence; content-free poke preserved. **Acceptance:** two test users can friend, form a group, set status, see permitted presence; nothing leaks beyond visibility scope; useful with 0 friends (empty states). **Postpone:** feed, DMs, stories, FoF, gamification. **Branches:** `feat/friends-core`, `feat/close-group`, `feat/going-out-status`, `feat/friends-on-map`. **Risk:** High (privacy/RLS — most sensitive work in the plan).

### Phase 6 — User testing, analytics, refinement
- **Objective:** validate usefulness + trust.
- **Tasks:** test with real users (§19); measure recommendation usefulness + data accuracy; improve onboarding/retention/friend-activation/neighborhood-discovery; fix trust/privacy issues.
- **Files:** onboarding, analytics, feedback prompts. **Supabase:** `analytics_events`, feedback tables. **Acceptance:** clear signal on the 5 core questions (§19). **Branches:** `feat/onboarding-v2`, `chore/analytics-mvp`. **Risk:** Low–Med.

---

## 18. Prioritized Backlog (P0–P3)

**P0 — broken/unsafe/misleading/blocking**
- Title-keyed enrichment join is fragile → wrong data risk. _Why:_ trust. _Fix:_ move to stable external-ID keying (Phase 2). _Area:_ `data/enrichment`, `SupabaseDataSource`. _Deps:_ canonical venues. _Effort:_ M. _Risk:_ Med.
- Any "hot/live" surface not backed by live data. _Why:_ core truthfulness principle. _Fix:_ gate on real check-ins + labels. _Area:_ pins, Tonight's Move, weekend. _Effort:_ M. _Risk:_ Med.
- No freshness surfaced despite stale risk. _Fix:_ §14 labels. _Effort:_ S–M. _Risk:_ Low.

**P1 — required before meaningful testing**
- De-hardcode EV into config (no visible change). _Effort:_ S. _Risk:_ Low. **(first task)**
- Find the Move v2 (3 explained options + confidence). _Effort:_ M. _Risk:_ Med.
- Friends core (search/request/accept) + Social page real content. _Effort:_ M–L. _Risk:_ Med–High.
- Real analytics sink (replace no-op). _Effort:_ S. _Risk:_ Low.
- Map/preview empty/loading/error/stale states. _Effort:_ S–M. _Risk:_ Low.

**P2 — after core MVP works**
- Dynamic happy hours + events (venue/staff-submitted). _Effort:_ L. _Risk:_ Med.
- Close group + going-out status + friends-on-map. _Effort:_ L. _Risk:_ High.
- Neighborhood detail pages + selectors. _Effort:_ M–L. _Risk:_ Med.
- Tonight's Move time-aware + dynamic weekend. _Effort:_ M. _Risk:_ Med.

**P3 — later/expansion**
- Venue claim flow · promoter/ticketing · multi-city UI · routing travel-time · outside-app invites · onboarding v2 age gate · dark mode · code-splitting/perf. _Effort:_ varies. _Risk:_ varies.

---

## 19. MVP Boundaries

- **Must have now (smallest testable ENDZ):** light social-app map (shipped) · EV kept + de-hardcoded · canonical venues with freshness labels · Find the Move v2 (3 explained options) · friends core (search/request/accept) · privacy-controlled check-ins · a real analytics sink.
- **Next:** dynamic happy hours + basic events · close group + going-out status + friends-on-map · Tonight's Move time-aware · dynamic weekend categories · first 2–3 expansion neighborhoods.
- **Later:** neighborhood comparison/heat · group planning/voting · venue claim flow · multi-city · outside-app invites · routing travel-time · onboarding v2 · dark mode.
- **Do not build yet:** full social feed · DMs · stories · public popularity/follower counts · friends-of-friends (until privacy proven) · gamification · ML recommendations · automated nightlife-data platform · ticketing integrations. **Do not let ENDZ become an unlimited social network or a fully automated data platform before the core loop is validated.**

---

## 20. User-Testing Plan

- **Recruit:** 6–10 people in the 18–30 EV-going crowd (mix of nightlife-frequency), plus 2–3 who go out rarely (comprehension check). Use the waitlist + real friends from launch nights.
- **Format:** short moderated sessions (mobile-first; a couple on desktop), think-aloud + task scenarios, on a real night when possible.
- **Scenarios:** (1) open app, "where's the move tonight?"; (2) find a happy hour now; (3) run Find the Move and decide; (4) judge whether a venue's info is trustworthy; (5) explore a neighborhood; (6) add a friend + set going-out status; (7) understand who can see your check-in.
- **Interview questions:** What did you think this app was for? Would you trust this to pick your night? What felt out of date or fake? Who can see you right now — and are you comfortable? What was confusing? Would you use this Friday?
- **Analytics to collect (§12, MVP):** app opened, search, filter, pin opened, venue saved, Find-the-Move started/completed, recommendation viewed/selected/dismissed, neighborhood viewed, happy-hour viewed, friend request sent/accepted, going-out set, check-in created, plan shared.
- **Success criteria:** users articulate the value in one sentence; ≥ most trust a recommendation enough to act; check-in privacy understood correctly; would return.
- **Confusion/distrust signals:** can't state what ENDZ is; hesitation/skepticism at recommendations; "is this real/current?" comments; privacy surprise ("wait, who sees this?"); ignoring Find the Move.

---

## 21. Assumptions Requiring Validation

- People will check in unprompted often enough to make "live" real (the north-star bet).
- The close-group (Top-8-style) concept resonates and doesn't feel like social pressure.
- Users trust rule-based, labeled recommendations over generic ratings.
- Venue/staff/user submissions can keep happy hours fresh without a reliable API.
- Freshness/confidence labels increase trust rather than clutter.
- 2–3 expansion neighborhoods can each clear the coverage bar before launch.
- Privacy defaults (friends-only, ghost mode) match user expectations.

---

## 22. Major Risks

- **Cold-start / empty map** (the #1 product risk) — no live data = dead app. Mitigation: seed density in EV, honest empty states, pattern/estimated labels, don't fake liveness.
- **Privacy/RLS mistakes in the social layer** (highest technical risk) — a leak of location/relationships breaks trust irreparably. Mitigation: enforce in Postgres, test with two accounts, content-free poke, staged rollout.
- **Data-layer refactor breaking the check-in loop** — Phase 2 touches shared data code. Mitigation: keep loop paths untouched, feature-flag, verify each step.
- **Google cost/ToS** — trial can't auto-charge; 30-day cache. Mitigation: scheduled compliant refresh, keep last-good, charge-averse posture respected.
- **Over-building before validation** — scope creep into a full social network. Mitigation: MVP boundaries (§18), P0–P3 discipline.
- **Truthfulness regressions** — a stray "hot now" with no data. Mitigation: labeling system + review gate on any liveness language.

---

## 23. Smallest Useful Next Coding Task

**De-hardcode East Village into a single market/neighborhood config source of truth — with zero visible behavior change.**

- **What:** create one module (e.g. `src/config/markets.ts` exporting a `DEFAULT_MARKET` with `{ id, city, neighborhood, center:[lng,lat], zoom, bounds?, copy }`) and route the currently-hardcoded values through it: `Map.tsx` recenter/fallback center + labels, `MapPage.tsx` header copy, `store/mapState.ts` initial center/zoom. Leave `EAST_VILLAGE_VENUES` as the demo dataset but reference the market config for geography/copy.
- **Why it's first:** it's the keystone for the entire expansion architecture (§11), it directly honors "keep EV featured now, expand later," and it's a **pure refactor** — same values, same pixels, fully reversible.
- **Guardrails:** no Supabase/schema/route/env changes; no new packages; EV must look and behave **identically** at 390/768/1440; typecheck + build clean; 0 console errors.
- **Acceptance:** grep shows EV coords/copy no longer duplicated across components (single import); swapping the config object would move the default market with no other code edits; visible behavior unchanged.
- **Not now:** actually adding a second neighborhood, city selector UI, or DB tables.

---

## 24. Exact Fable Handoff Prompt (fresh session, this first task)

> **Task: De-hardcode East Village into one market config, with zero visible change.**
>
> Context: ENDZ is a Vite + React + TS + Tailwind + MapLibre + Supabase nightlife app in `~/Documents/night-guide`. Read `CLAUDE.md` and `docs/plans/ENDZ_NEXT_PHASE_ROADMAP.md` first. We are keeping East Village as the featured beachhead — this task must **not** change anything the user sees; it only removes duplicated hardcoding so we can add neighborhoods later by data.
>
> Do:
> 1. Create `src/config/markets.ts` exporting a typed `DEFAULT_MARKET` = `{ id: "east-village", city: "New York", neighborhood: "East Village", center: [-73.9833, 40.7270], zoom: <current>, copy: { tagline: "Find your night in the East Village", recenterLabel: "Recenter on East Village", locationUnavailable: "Location unavailable — showing East Village center" } }`.
> 2. Replace the hardcoded center/copy in `src/components/Map.tsx` (recenter + locate fallback + aria/toast), `src/pages/MapPage.tsx` (header tagline), and `src/store/mapState.ts` (initial center/zoom) with imports from `DEFAULT_MARKET`. Use the file's exact current values — copy them, don't invent.
> 3. Leave `src/data/venues.ts` (`EAST_VILLAGE_VENUES`) and all Supabase/data-source logic untouched.
>
> Do NOT: change Supabase, schema, routes, auth, env vars; install packages; alter the check-in loop; change any visible behavior, layout, colors, or copy the user reads; touch marker geo-anchoring.
>
> Verify before finishing: `npx tsc -p tsconfig.app.json --noEmit` passes; `npm run build` succeeds; run the app and confirm the map still opens centered on the East Village and looks identical at 390×844, 768×1024, 1440×900; 0 new console errors. Work on a new branch `refactor/dehardcode-market`, commit with a clear message, and summarize the diff. Wait for approval before merging.
>
> Note on the 21st.dev Magic MCP: not needed for this task (no new UI). Save the 2 daily `get_component` retrievals — reserved later for id 7734 (Place Card → venue sheet) and id 17144 (Astryx Avatar → friends-present layer).

---

### Appendix — First five implementation priorities (sequence)
1. **De-hardcode EV into market config** (§23) — Low risk, keystone.
2. **Real analytics sink** — replace `analytics.ts` no-op so we can measure everything else.
3. **Freshness/confidence labels** on existing venue/HH data (§14) — trust, uses existing `fetchedAt`.
4. **Find the Move v2** — 3 explained options + confidence/stale penalties (§8).
5. **Friends core** — username search → request → accept, and make the Social page real (§12).
