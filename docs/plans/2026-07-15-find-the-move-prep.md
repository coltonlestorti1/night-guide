# Dynamic Find the Move — Discussion Prep (2026-07-15)

Prep doc for tracker item 3. **Nothing here is approved or built.**

---

## How it works today

`src/components/VibeFinder.tsx` (drawer UI) + `src/lib/vibeScore.ts`
(scoring) — already a real preference-scored recommender, not a static list:

- Reached from: **the first filter chip on the map** ("Find the move",
  `MapPage.tsx`). It scores the **full venue set** (`useVenues({})`), never
  the search/bbox-filtered subset.
- Six quick questions: vibe (chill/lively/packed) · drinks (beer/cocktails/
  whatever) · when (now/later) · distance ("Around me" triggers the opt-in
  location prompt, gracefully falls back if declined) · happy hour · age.
- `scoreVenues()` is additive over real data, and **missing data scores
  neutral and produces no reason** (deliberate honesty rule in the header):
  - "Right now" hard-filters known-closed venues; unknown hours pass.
  - Open +1 ("Open til 2 AM"), rating weighted by log-review-count,
  - **live check-in activity** (`useVenueActivity`, Supabase RPC on the
    `active_check_ins` view, 60 s poll): crowd tier match +2, opposite −1,
    reported-vibe match +1 ("4 here now"),
  - drinks/price/category heuristics incl. `isCocktailSpot` from
    `venueTraits.ts`, happy-hour active +1.5 / upcoming +1 / −2 when the user
    asked for HH and there is none,
  - age nudges venue *traits* only — explicitly never asserts crowd age,
  - "Around me": +1.5 fading to 0 by 0.75 mi, distance reason shown first.
- Results: top 3 with up to 3 reason strings each; "Not these — 3 more"
  pages down the ranked list (wraps to the top). Empty state suggests
  loosening picks.

So per-user preference scoring, live-activity input, and reason strings all
exist. The genuine gaps vs tracker item 3:

1. **No differentiated reason slots** — the 3 results are just ranks 1–3 of
   one score, so they're often near-clones (three ★4.5 cocktail bars), and
   nothing frames *why this one over that one*.
2. **No diversity rules** — nothing prevents identical category/price/
   neighborhood triples when alternatives exist a fraction of a point down.
3. **No cooldowns / impression memory** — reopening the drawer with the same
   answers gives the identical 3, forever. (Blocked on item 5 — see below.)
4. **No freshness/confidence signals** — enrichment >30 days old silently
   vanishes rather than being labeled, and a venue with no hours data can
   rank on "later" with nothing telling the user its info is thin.
5. **No impression logging** — that is tracker item 5, explicitly **PARKED**
   with a do-not-create-schema gate. This doc respects that parking.

## What data actually exists to build on

| Signal | Status |
|---|---|
| Enrichment (rating/hours/price range) | 43/47 venues, single batch fetched 2026-07-07 — **expires ~Aug 6** without a script rerun |
| Happy-hour windows | 14/47 |
| Live check-ins | Real-time and wired in — but near-zero pre-launch, so the +2 activity term is usually silent |
| Venue seed fields | 47 venues (40 bar / 5 club / 2 lounge); price 37/47, music 15/47, neighborhood/description/age-range 19/47, cover_charge 0/47 |
| Outdoor/rooftop, lines/covers, weather | Nothing |
| Saved venues | `src/store/saved.ts` exists — unused by scoring |
| Friends/group activity | Friends layer shipped 2026-07-14; per-venue friend presence not fed into scoring |
| Impression history | Nothing — item 5, PARKED |

## The realistic approaches

**A. Differentiated slots + diversity guard on the existing score.
(Recommended MVP)** Keep `scoreVenues()` untouched as the ranking engine;
change only how the top 3 are *selected and framed*:
- Slot 1 — **Best overall fit** (top score).
- Slot 2 — **Best nearby** when location is on (best score among genuinely
  close venues); otherwise **Best value** (price ≤ 2 among high scorers) or
  another data-backed frame.
- Slot 3 — **A different lane**: best-scoring venue that differs from slot 1
  in category or price tier (within a bounded score window, e.g. top decile
  — never a bad pick promoted for variety's sake).
Each slot label becomes the headline reason, keeping the existing detail
reasons under it. Diversity guard: when near-tied alternatives exist, don't
show three venues identical in category+price. "3 more" pages within slots,
excluding already-shown venues. Thin data degrades to today's plain top-3.
Deterministic, no schema, and it directly delivers the tracker's "three
options with meaningful differences."

**B. A + freshness/confidence labels and session-scoped variety.** Two cheap
adds: (1) a confidence label per result from data completeness — "Hours
verified Jul 7" vs "Hours unknown — may be closed" — plus a small penalty for
missing-hours venues on "later" (a scoring change, so it needs explicit
approval); (2) an **in-memory, session-only** "already shown" set so
reopening the drawer surfaces qualified alternatives. That is *not* item 5 —
no schema, no persistence, nothing tracked — but it's cooldown-adjacent, so
flagging it for an explicit call rather than sliding it in.

**C. The full tracker system** — persistent impression cooldowns, dismissal
memory, saved/friends signals, group size, learned feedback. All of it needs
item 5's tables, which are **parked until post-launch by design** — and
cooldowns are pointless before there are repeat users. Post-launch.

**Recommendation: A now; B's confidence labels with it if we're touching the
result UI anyway; B's session memory only if Colton explicitly wants
pre-item-5 variety; C when item 5 unparks.** The insight from the audit: the
scoring is not the problem — *selection and framing* are, and those are
UI-layer changes.

## Hard constraints (from the tracker — apply to any approach)

- **No randomness without product reasoning** — slot 3's "different lane"
  must be the *best-scoring* different option inside a bounded window, never
  a shuffle.
- Impression cooldowns and logging require item 5, **parked until
  post-launch** — do not create schema; design slot selection so a cooldown
  term can be added later.
- Every recommendation carries an explanation label (slot headline + reasons).
- Never show expired deals — the HH reasons already come from live
  `getHappyHourState` math; keep it that way.
- Allow justified repetition: if one venue is genuinely best, it may stay in
  slot 1 across sessions — the label explains why.

## Open product questions

1. What are the three slots? Fixed (Overall / Nearby / Different-lane) vs
   adaptive to the user's answers (e.g. HH-asked → a "Best deal" slot) — and
   how far down the ranking may slot 3 reach for the sake of difference?
2. Is session-only "already shown" memory acceptable before item 5, or does
   any cooldown-like behavior wait for the real system?
3. Confidence labels: show "Hours unknown" style caveats (honest but
   negative-sounding), or just suppress low-confidence venues from "later"?
4. Should friend presence at a venue (friends layer is live) become a scoring
   input now, or is that its own gated discussion (privacy: it surfaces
   friend location inside a recommender)?
5. The age question currently only nudges traits — keep it, or drop it until
   there's real crowd data? It's the least honest-feeling question of the six.

## Files & risks

- Touch: `VibeFinder.tsx` (slot rendering, paging), a new
  `src/lib/moveSlots.ts` selection layer over `vibeScore.ts` (engine
  unchanged unless B's missing-hours penalty is approved); no Supabase
  changes for A or B.
- Risks: 47 venues heavily skewed to bars (40/47) makes "different lane"
  thin — slots must collapse gracefully instead of forcing weak picks; the
  2026-07-07 enrichment batch **expires ~Aug 6**, which would gut rating/HH/
  hours reasons overnight (refresh cadence is a prerequisite); live-activity
  reasons will be silent pre-launch — don't design slots that depend on
  check-in volume; scoring-logic changes are explicitly gated — anything
  beyond selection/framing needs its own approval.
