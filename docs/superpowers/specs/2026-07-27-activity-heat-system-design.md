# Activity & Heat System — Design

Status: approved for planning · 2026-07-27

Replaces the map's live-check-in-count activity tiers with a blended heat model:
a researched and archetype-derived baseline that user check-ins and feedback
progressively override. The map keeps its simple three-tier legend; the venue
card gains an Activity section explaining *why* a place is active, when it peaks,
and when a line is likely.

## Scope

**In:** East Village only — the 56 live venues. The scoring engine, the baseline
data layer, the extended check-in feedback prompt, the map wiring, and the
Activity section on the venue card.

**Out:** Greenwich Village, West Village, Meatpacking, and Lower East Side
expansion. Candidates for those are verified and staged in
`docs/venue-candidates.md`; adding them is a data change, not a code change.

## Background: what the research established

Two research rounds ran before this design (`docs/research/`). Their results
shaped it more than the original proposal did.

1. **Busy and peak windows are not published for ordinary bars.** Round 1 asked
   for them directly across 59 venues and 43 of 46 live venues came back empty.
   This is a property of the world, not a prompt failure. Only 10 of 56 live
   venues have researched windows.
2. **Line behavior has at least three distinct mechanics**, which a single
   time-of-night curve models backwards for one of them. Evidence: Death & Co
   queues 2 hours *from opening* and eases late; PDT is easier at midnight; The
   Cock queues midnight–3 AM; McSorley's and The Grafton queue on an external
   calendar (St. Patrick's, playoff games).
3. **Confident negative evidence exists and has nowhere to live.** Amor y Amargo
   "always easy to get in" (2026), Superbueno "super easy" (2025). Without a way
   to record a known *absence* of line risk, the model will invent it.
4. **Posted event times beat derived curves**, and sometimes invert them. Nowhere
   runs Macho Monday at 10 PM; a weekend-weighted curve rates it dead.
5. **Review count is not a popularity proxy for line risk.** Of the top 5 East
   Village venues by Google review count, 4 are counter-examples with direct
   contradicting evidence. Type plus crowd predicts lines; fame does not.

## Architecture

Scoring runs **client-side**, in pure functions, with live signals fetched from
Postgres.

The decisive reason is a product requirement: friend check-ins weigh more than
strangers', which makes the score **per-viewer** — a shared server-computed
number cannot express it. Supporting reasons: schema changes require manual
paste into the SQL editor (only the anon key exists locally), and a scoring
algorithm needs many tuning passes; and static-editorial-data-plus-client-compute
is already the house pattern (`enrichment.json`, `computeOpenState`).

| Layer | Location | Rationale |
|---|---|---|
| Baseline curves | Static, client | Same pattern as enrichment; no DDL to tune |
| Live signals | Postgres RPC | Extends existing `venue_activity()` |
| Friend weighting | Client | Per-viewer; RLS already scopes friend data client-side |
| Scoring math | Client, `src/lib/heat/` | Instant iteration, trivially testable |

The engine takes signals in and returns a score out — no React, no network, no
clock reads (time is an argument). This keeps the anonymous half portable to
Postgres later, if server-side heat is ever needed for push notifications.

**Accepted tradeoff:** the algorithm ships in the JS bundle and is readable. The
requirement is that users never *see* a score or uncertainty in the UI, not that
the method be secret.

## Data model

### Static — `src/data/activity/`

Keyed by venue **title**, matching `src/data/enrichment`.

Corrected 2026-07-27 after implementation: this originally specified keying on
`id` to avoid the `Niagara`/`Niagara Bar` name mismatch. That was wrong. Live
venues come from Supabase where `venues.id` is a **uuid**, while the demo
dataset in `src/data/venues.ts` uses slugs — different id spaces, so an `id`
join misses every venue in production and the whole map renders Quiet. The
observed name mismatches are between the research seed table and the app, not
between Supabase and the app; all 35 live venues match the app by name. Title
is the only key both sources share. `getBaseline()` warns in dev on a miss so a
future rename cannot break this silently.

| File | Contents |
|---|---|
| `curves.ts` | Archetype curves: hourly 0–100 shape per day-shape, per archetype |
| `baseline.json` | Per-venue activity record |
| `events.json` | ~30 researched weekly events: venue, day, name, start time, source URL |

Archetypes: dive, party bar, dance club, cocktail room, rooftop, pub, music
venue, karaoke, activity bar. Day-shapes: Mon–Wed, Thu, Fri–Sat, Sun — four
rather than seven, because that is how nightlife clusters.

Per-venue record:

```
archetype        which curve to use
line_pattern     door_pick | capacity_wait | occasion | none
busy_start/end   researched — optional, overrides curve
peak_start/end   researched — optional
best_nights      researched — optional
capacity         relative size proxy — optional
confidence_base  high | medium | low — editorial, how well this venue is known
source_type      first_hand | research_estimate | archetype_default
last_reviewed    date
evidence_url     source for a researched claim
```

`archetype` and `line_pattern` are required for every venue. Everything else is
optional, and its absence is what drives `confidence` down.

**`line_pattern` defaults to `none`.** It is set to `door_pick` where the venue
is a party bar, dance bar, club, or college-scene sports bar **and** closes at
2 AM or later; to `capacity_wait` for small or no-standing cocktail rooms; to
`occasion` for sports and holiday venues. Research evidence always overrides the
derived default.

### Live — Postgres, one additive DDL paste

1. Extend the `vibe_level` enum with `dead` and `line_outside`. Keep `building`
   as a stored value, **displayed as "Good crowd"** — all five options, zero
   data migration.
2. Add `check_ins.vibe_at timestamptz`, **set by trigger, never by the client.**
   Freshness is the highest-weighted input in the system; a client-writable
   timestamp would let anyone backdate a report to look fresh.
3. Add `check_ins.would_recommend` (`yes | maybe | no`, nullable).
4. Replace `venue_activity()` to return age-bucketed aggregates:

```
venue_id, count_15m, count_45m, count_90m,
vibe_tally, recommend_tally, minutes_since_last_report
```

Buckets, not per-row timestamps: decay needs check-in age, but returning
timestamps would leak "someone arrived at 11:42" and break the identity
properties verified in the 2026-07-14 audit. Aggregates preserve them.

Bucket boundaries are 15/45/90 minutes to match the decay curve — a check-in
stops counting at 90 minutes, while the row itself lives to the 3-hour expiry.

**Feedback requires an active check-in.** One check-in at a time yields one
report per person per venue for free, reports come from people actually present,
and it inherits already-audited RLS. Cost: lower report volume. Accepted.

### Computed, never stored

`current_heat_score`, `baseline_heat_score`, `line_risk_score`,
`confidence_score`, `report_count_last_60_min`, `check_in_count_last_60_min`,
`friend_check_in_count`.

Storing these would require a write on every check-in and would go stale when
nobody writes. `friend_check_in_count` cannot be stored at all — it differs per
viewer. `source_type` and `last_reviewed` remain stored static fields.

## Scoring engine

### Baseline

1. **Closed check runs first.** Google hours say closed → score 0, label
   "Closed", stop.
2. **Archetype curve** for the venue's type and day-shape.
3. **Researched overrides** reshape the curve where real windows exist.
4. **Event bumps**: a posted event at time T adds ~+30 from ~30 minutes prior.

Event bumps must be large enough to **invert a day-shape**, not nudge it.
Nowhere's Monday 10 PM programming is the acceptance case.

### Live signals

Check-in decay from the buckets — roughly a 35-minute half-life, zero by 90:

```
effective = c15×1.0 + (c45−c15)×0.45 + (c90−c45)×0.12
```

Friends weigh ~3× strangers (tunable constant). Crowd conversion saturates at
~6 effective check-ins, preserving continuity with the current map's 3=trending,
6=hot thresholds.

Feedback → crowd reading: `dead` 5, `chill` 30, `good crowd` 60, `packed` 85,
`line outside` 95. Averaged over 60 minutes, recency-weighted.

### Blend

```
liveWeight = min(0.75, signals / (signals + 4))
```

This reproduces the proposed 80/20 → 60/40 → 30/70 phases automatically, and
**per venue** rather than globally. A venue with eight people checked in tonight
should be user-driven today; a dead venue should stay baseline-driven
indefinitely. A global phase constant gets both wrong. The cap keeps a 25%
baseline floor. One tunable constant if it needs to be more aggressive.

### Labels

| Score | Label |
|---|---|
| 0–29 | Quiet |
| 30–54 | Building |
| 55–74 | Busy |
| 75–100 | Hot Now |

**"Line Likely" is an overlay, not a band** — it fires from the line model, so it
can appear at 78 with real evidence and stay off at 92 without. **"Past Peak"**
fires when the score is falling, past the peak window, and still ≥30.

### Line risk

| Pattern | Fires when |
|---|---|
| `none` | Never, at any heat |
| `door_pick` | Heat ≥ 70 **and** late hours; scales with heat above threshold. Boosted for small capacity where known — only 9 venues have a figure, so absence means no boost, never a penalty |
| `capacity_wait` | Heat ≥ 60 **and** early in the venue's window; decays after midnight |
| `occasion` | An event is active — independent of hour |

**Short-circuit:** any `line_outside` report within 60 minutes forces line risk
high regardless of pattern or score.

### Recommendation quality — separate axis

Starts from the Google rating, moves with `would_recommend` tallies, and **never
rises because a venue is crowded**. Heat answers "is it busy"; quality answers
"is it worth it"; they are allowed to disagree. Marquee — 2.9 stars, packed — is
the case in point.

### Confidence

Two distinct things, deliberately named apart:

- **`confidence_base`** — a stored editorial field. How well we know this venue:
  `first_hand` and researched windows earn `high`, an archetype default earns
  `low`. Changes only when someone reviews the venue.
- **`confidence_score`** — computed per read. Starts from `confidence_base` and
  rises with live signal volume and recency: a venue on an archetype default can
  still speak confidently right now if six people are checked in and reporting.

`confidence_score` is what gates copy specificity, and it is what makes
archetype-defaulted venues safe to ship.

## Public surface

### Map

| Score label | Ring |
|---|---|
| Quiet | Gray |
| Building | Trending |
| Busy | Trending |
| Hot Now | Hot |

Line Likely renders as Hot — no fourth color. The legend at `Map.tsx:584` is
unchanged. The only change is what feeds the ring: heat instead of a raw
check-in count, which brings the 46 permanently-gray venues to life.

### Venue card — Activity section

In `VenuePreview.tsx`, above the friends/plans rows:

```
ACTIVITY
Hot Now · Line likely
Usually peaks 11:30 PM – 2:00 AM
Best nights: Thu, Fri, Sat
Multiple people reported it packed
Best for a dressed-up but still fun East Village night.
```

Every line below the first is optional and **omitted entirely** when the data is
absent — no "Unknown", no empty labels. A low-confidence venue shows one line and
looks deliberate rather than broken.

### Copy states

| Condition | Copy |
|---|---|
| Closed | "Closed" — nothing else renders |
| Quiet | "Quiet right now" |
| Building, rising | "Starting to pick up" |
| Building, known peak later | "Good time to go before it fills up" |
| Busy, mostly baseline | "Usually busy around this time" |
| Busy, mostly live | "Likely busy now" |
| Hot Now | "Hot Now" |
| Hot + line, high confidence | "Line likely after 11 PM" |
| Hot + line, lower confidence | "Line likely" |
| Falling, past peak, ≥30 | "Still active, but past peak" |
| `capacity_wait`, line now, eases later | "Better later tonight" |
| 1 recent report | "Recently reported busy" |
| 2+ recent reports | "Multiple people reported it packed" |

"Usually busy around this time" and "Likely busy now" are the same score band
worded by provenance — the one place a user feels the difference between
prediction and observation, without being shown a confidence value.

### Confidence gates

| Confidence | May say |
|---|---|
| High | Exact times |
| Medium | Soft ranges |
| Low | Status only — no windows, no line claims |

### Never rendered

Raw scores, confidence values, percentages, "we estimate", "approximately",
source types, or hedging language. Uncertainty is expressed by **saying less**,
never by qualifying.

**Existing violations to fix:** `BarCard.tsx:100` renders `⚡ {venue.buzz_score}`
and `VenueStatTiles.tsx:17` renders a "Buzz" tile — both expose a raw 0–100
score. Both are replaced by the label.

### PopularTimesChart

The component has shipped with zero data since it was built (0 of 56 venues have
`popularTimes`). The archetype curve plus researched windows produce the hourly
shape it expects, so it can finally render on `VenueDetail`, subject to two
conditions: retitle **"Popular times" → "Typical night"**, because the original
implies observed Google data and this is a model; and render only at
medium-or-better confidence, since at low confidence it draws the archetype curve
back at the user, which is circular.

## Feedback loop

### Prompt

- ~10 minutes after check-in: "How is it right now?" → Dead · Chill · Good crowd
  · Packed · Line outside
- Only after an answer: "Would you send friends here right now?" → Yes · Maybe · No
- Once more at ~45 minutes, then stop. Hard cap of two prompts per check-in.

`Packed` and `Line outside` are separate on purpose: packed is a room state, a
line is a door state, and the line model treats them very differently.

### Abuse resistance

- `vibe_at` set by trigger, not client (see Data model).
- One check-in at a time caps a user to one venue.
- Vibe changes rate-limited to ~one per 10 minutes, enforced off `vibe_at`.
- Single-user contribution capped; **≥2 independent reports** required before
  "Multiple people reported it packed" renders.
- The restrictive `check_ins` update policy from the 2026-07-14 audit pins
  `venue_id`, `user_id`, `created_at`, `visibility` and blocks expiry extension.
  New columns fall outside that list and stay writable — **verify against the
  live policy rather than assuming.**

### Getting smarter

1. **Automatic, per venue:** `liveWeight` shifts as signals arrive. No switch.
2. **Anonymous hourly rollups:** a nightly job aggregates observed crowd readings
   into `venue_hour_stats` (venue, day of week, hour, sample count, average
   crowd — no identities). Once a venue-hour has enough samples, observed data
   replaces the archetype curve for that hour. This is how research estimates get
   retired.
3. **Manual promotion:** `last_reviewed` and `source_type` move a venue from
   `archetype_default` → `research_estimate` → `first_hand`.

**Build the rollup write-only in v1.** Collect from day one, read later. History
cannot be backfilled: deferring collection means the "gets smarter over time"
story starts from zero on the day it is finally built.

Implemented 2026-07-27 as `scripts/2026-07-27-venue-hour-stats.sql`.

**Caveat for whoever builds the read side.** Until the app has users, every
sample records zero people, and "nobody was here at 11 PM Tuesday" is
indistinguishable from "nobody uses the app yet". Both are honest observations;
only one is evidence about the venue. So the read side needs two gates, not one:

1. A minimum `sample_count` for that venue-hour, and
2. Proof there was app traffic in that window at all — otherwise a venue-hour
   with fifty zero-samples looks like fifty confirmations that a bar is dead.

`crowd_samples` is the useful signal here: it only increments when somebody
actually reported a vibe, so a venue-hour with `crowd_samples = 0` carries no
information regardless of how many times it was sampled. Prefer it over
`sample_count` when deciding whether observed data may replace the archetype
curve.

## Testing

Pure functions, time injected — no network, no database, no clock.

### Golden cases, drawn from sourced evidence

- Death & Co, 8 PM Friday → line risk high
- Death & Co, 1 AM → line risk low, copy reads "Better later tonight"
- PDT, midnight → no line claim
- Nowhere, Monday 10 PM → Busy or better
- Amor y Amargo, peak Saturday → never a line claim
- The Grafton, no game → Quiet; playoff night → `occasion` line risk
- Any venue outside Google hours → score 0, "Closed"

### Properties

- Score always within 0–100
- Closed venue always scores 0
- `line_pattern: none` never produces line risk at any heat
- Low confidence never emits a specific time string
- A `line_outside` report always forces line risk high

Copy state machine gets snapshot tests so wording changes are deliberate.

## Known risks

1. **Archetype curves are the largest invented structure in the system.**
   Everything else traces to evidence. They are also what makes 46 venues
   shippable, and confidence gating limits what they are allowed to claim.
2. **The ~6-check-in saturation point is a guess** that only real usage can
   calibrate.
3. **Coverage is thin:** 13 of 59 venues have event data, 8 have crowd reports,
   9 have capacity. The remainder run on archetype defaults at low confidence.
4. **One stale source:** The Cock's crowd claim is from 2018 and should carry low
   confidence.

## Open questions deferred to planning

1. Do Village Underground and Fat Black Pussycat (same address) model as one
   venue or two? Same question for Berlin and 2A, and Deluxx Fluxx and Webster
   Hall.
2. Do `occasion` venues need a sports/holiday calendar source in v1, or does the
   pattern ship inert until one exists?
