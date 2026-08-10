# Find the Move overhaul — §3 (dynamic) + §17 (group size)

**Status:** approved in conversation 2026-08-09 (Colton), built overnight with
explicit authority to merge and push. Supersedes nothing; extends the
personalization shipped 2026-08-07 (`90c4bdd`).

## Problem

Find the Move returns three venues ranked by `scoreVenues()`, and it does three
things badly:

1. **The three picks are undifferentiated.** They are just ranks 1–3, often
   three cocktail bars on the same block. §3 asks for picks with *meaningfully
   different characters*.
2. **It has no memory.** The same three come back every night, because nothing
   records what was already shown. §3 asks for a recent-impression cooldown.
3. **Group size does not exist anywhere in the app** (§17), even though it
   changes the answer more than any other input — six people and one person
   want opposite rooms.

It also ignores friends entirely, though `useFriendsOutTonight()` and
`useFriendSaves()` already exist and are already RLS-safe.

## Data findings that shape the design

Measured 2026-08-09 against the live Google Places API, all 56 enriched venues:

- **`goodForGroups` is unusable: 46 true, 0 false, 10 absent.** It never says
  no. Designing group size around it would be dressing a constant as a signal.
  Rejected.
- **`reservable` is real: 28 of 56 true.** It splits the map roughly in half,
  it is Google-verified at the same trust level as `outdoorSeating`, and for a
  group it is the single most useful fact available. **Adopted.**
- **No capacity data exists anywhere** — not in `Venue`, not in enrichment, and
  not inferable from editorial summaries (41 summaries: 2 say "large", 7 say
  "small"). Nothing in this feature may ever claim a capacity.
- `liveMusic` (10) and `goodForWatchingSports` (12) are also real and unused.
  Out of scope; noted for later.

Cost: `reservable` is in the Enterprise + Atmosphere SKU, which the field mask
**already triggers** via `outdoorSeating` and `editorialSummary`. Adding it
changes the bill by nothing. That SKU has 1,000 free calls/month against a
56-call monthly refresh.

## Governing rules (non-negotiable)

1. **A stated preference beats an inference.** If the user picked a vibe, group
   size may not touch the crowd dimension. Group size only speaks about crowd
   where the user was silent.
2. **Nothing claims a capacity.** Only `reservable` may appear in a reason
   string. No "room for a big group", ever, until a curated capacity field
   exists.
3. **Absent ≠ no.** A venue with no `reservable` record is never sunk — same
   rule as `hasOutdoorSeating` and enrichment expiry.
4. **A friend may only be named from a signal that user could already see.**
   Both sources are already-RLS-filtered accepted-friend queries. No new query
   may widen that, and a private save may never reach a reason string.
5. **Personal and social signals apply after exclusions**, so they reorder what
   already qualifies and can never surface a closed venue.
6. **Zero input produces byte-identical output to today**, pinned by a test —
   the same criterion the 2026-08-07 personalization was held to.

## Architecture

New directory `src/lib/move/`, three focused modules, each independently
testable, with `vibeScore.ts` staying the ranker it already is:

```
scoreVenues()          ranks everything            (existing, extended)
  └─ move/cooldown.ts  applies recent-impression decay
  └─ move/character.ts derives each venue's honest "characters"
  └─ move/select.ts    picks 3 with different characters + diversity
```

`VibeFinder.tsx` renders. It does not compute.

### 1. Group size input

`VibePrefs.groupSize?: "solo" | "two" | "small" | "big"` (§17's states: solo ·
1–2 · 3–5 · 6+). Optional, like every other chip.

**Room signals** (always applied, independent of crowd):

| Group | Effect |
|---|---|
| `big` (6+) | `reservable` +1.5 · outdoor/rooftop +1 · price ≤2 +0.5 · club +0.5 |
| `small` (3–5) | `reservable` +0.75 · outdoor/rooftop +0.5 |
| `two` / `solo` | cocktail spot or lounge +1 |

**Crowd dimension** — only when `prefs.vibe` is unset: `big` applies −1 to
venues currently at the `packed` tier. When `prefs.vibe` is set, group size
contributes nothing here (Rule 1).

Only `reservable` produces a reason: **"Takes reservations"**.

### 2. Characters (the differentiated picks)

`character.ts` derives which of these are *true* for a scored venue. Each
carries a headline and an explanation built from real data:

| Character | True when | Headline |
|---|---|---|
| `fit` | always (the top scorer) | "Best fit" |
| `easy-door` | `reservable`, or activity tier is `chill` | "Easy door" |
| `worth-it` | tier is `packed` AND rating ≥ 4.3 | "Worth the wait" |
| `value` | happy hour active/upcoming, or price ≤ 2 | "Best value" |
| `close` | user coords known and < 0.4 mi | "Closest" |
| `friends` | a friend is checked in now, or friends saved it | "Your people" |

`worth-it` is the one Colton asked for by name — the packed room you choose
*because* it is packed. Its explanation says so: "Busiest of the three, and the
highest rated." `easy-door` is its opposite and exists to answer the same
question honestly for a group that does not want a line.

### 3. Selection with diversity

`select.ts` takes the ranked list and returns 3:

1. Slot 1 = highest scorer, labelled `fit`.
2. Slots 2 and 3 = the best remaining venues that (a) carry a character not yet
   used, and (b) are not the same `category` *and* `neighborhood` as an
   already-picked venue.
3. If diversity cannot be satisfied (small filtered sets), fall back to plain
   rank order rather than returning fewer than three. **Never a dead end** —
   Colton, 2026-08-09.

### 4. Impression cooldown

`cooldown.ts`, backed by `localStorage` under `endz:move-impressions`.

- Records `{ venueId: lastShownISO }` when results render.
- A venue shown in the last 6 hours takes −1.0, decaying linearly to 0 at 24h.
- **Superiority override (§3):** if a penalised venue still outscores the next
  candidate by more than 2.0, it stays and gains the reason **"Still your best
  match tonight"** — §3 requires repetition to be allowed *and explained*.
- Capped at 100 entries, pruned by age.

**Per-device, not per-account, deliberately:** schema changes require Colton to
paste DDL in the SQL editor and he is asleep. The durable version is a
`venue_impressions` table; the SQL is written and parked in the tracker rather
than applied.

### 5. Friend signals

Two new optional fields on `PersonalSignals`, sourced from the existing hooks:

- `friendsOut: FriendOutTonight[]` → `useFriendsOutTonight()`
- `friendSaves: VenueSaveFriends` → `useFriendSaves()`

Scoring: a friend checked in now = +1.5, friends who saved = +0.75 (once, not
per friend — three friends saving is not three times the evidence).

Reason strings **name people**, approved by Colton 2026-08-09:

- One friend out: "Maya is here now"
- Two: "Maya and Dev are here now"
- Three or more: "Maya, Dev and 2 more are here now"
- Saves only: "Maya saved this"

Names come from the profile rows the two hooks already return. Signed-out and
friendless users get no friend reasons and no score change.

## Error handling

- Friend queries failing must **not** break Find the Move: both hooks are
  React Query and their `undefined` is treated as "no signal", exactly as
  `useMyRatings()` already is.
- `localStorage` unavailable (Safari private mode) → cooldown degrades to a
  no-op, wrapped in try/catch like `getDismissedSuggestions()` already is.
- Enrichment expired (>30d) → `reservable` goes quiet rather than asserting a
  stale amenity, inherited free from `getEnrichment()`.

## Testing

Unit tests (vitest, the existing suite):

1. **Byte-identical baseline** — no group size, no friends, no impressions
   produces exactly today's output. The gate on the whole change.
2. Crowd rule: `big` + explicit `packed` vibe does **not** sink packed venues;
   `big` with no vibe does.
3. `reservable` absent is never sunk.
4. No reason string ever contains a capacity claim.
5. Character derivation per table above.
6. Diversity: three same-category same-neighborhood venues cannot all be
   returned when alternatives exist; and selection still returns 3 when they
   cannot.
7. Cooldown: decay curve, superiority override fires and is explained,
   corrupt/absent localStorage is a no-op.
8. Friend naming: 1 / 2 / 3+ forms, self never counted, no friends = no reason.

Browser verification in Chrome against the dev server. **The on-device iOS test
is Colton's** — Chrome cannot see iOS.

## Out of scope (deliberately)

- **The middle-tab move and the AI chat front door.** Tabled by Colton
  2026-08-09; the chat adds App Store review surface right before submission.
- **Curated `group_capacity`.** The only path to ever saying "fits your six"
  out loud. Content work, parked.
- Crowd-age claims — still blocked on §28 (52% coverage).
- `liveMusic` / `goodForWatchingSports` scoring.
