# Dynamic Weekend Favorites — Discussion Prep (2026-07-14)

Prep doc for tracker item 4. **Nothing here is approved or built.**

---

## How it works today

`src/components/WeekendFavorites.tsx` (71 lines):

- Thu/Fri/Sat tabs (defaults to today if it's one of those, else Fri).
- Ranking = venues with a Google rating, filtered to open-that-night (unknown
  hours are kept), sorted by rating with review-count tiebreak, top 12.
- **Same order every weekend by construction** — the only inputs are static
  Google ratings and weekly hours. Thu/Fri/Sat only differ where a venue is
  closed one of those nights. No categories, no reasons, no rotation, no
  freshness display, no personalization, no social signals.

Honest foundation though: it's real Google data, nothing fabricated, and the
header comment is explicit that rating is a placeholder signal until our own
check-in history exists.

## What data actually exists to build on

| Signal | Status |
|---|---|
| Google rating + review count | 43/47 venues |
| Weekly hours | 42/47 |
| Happy-hour windows | **14/47** |
| `popularTimes` (Fri vs Sat busyness patterns) | **0/47 — the type exists, the serpapi source never ran** |
| Vibe/music/price/category/age-range | in `venues.ts`, most venues |
| `venueTraits` / vibeScore inputs | already powers Find the Move |
| Live check-ins (social proof) | real-time, but near-zero pre-launch |
| Impression history (what user recently saw) | nothing — tracker item 5, PARKED |
| Weather, lines/covers, saves/shares | nothing |

## The realistic approaches

**A. Category-slotted picks from existing data. (Recommended MVP)**
Replace one monolithic top-12 with a handful of category slots, each with its
own scoring over data we already have: e.g. *Best first stop* (happy hour
tonight + opens early), *Best for dancing* (club/music type), *Best late-night*
(closes latest), *Best value* (price level + rating), *Best overall* (today's
rating sort, demoted to one slot). Each slot shows a one-line reason ("Happy
hour til 8", "Open til 4 AM"). Different categories → different venues surface,
Thu/Fri/Sat genuinely differ via hours/happy-hour windows, and every inclusion
is explainable. No new schema, no new data source, no randomness.

**B. A + Fri/Sat busyness patterns.** Same, plus run the serpapi popularTimes
fetch (source support already exists in the enrichment types) so "historical
Friday/Saturday patterns" become a real input. Adds a data-source dependency +
freshness question — needs its own mini-discussion (price/ToS).

**C. Full dynamic system with impression cooldowns + stored rankings.**
What the tracker ultimately describes. Blocked on item 5 (impression tracking),
which is deliberately PARKED until post-launch — and cooldowns matter little
until there are repeat users. Not now.

**Recommendation: A now, B as a fast follow if popularTimes data checks out,
C post-launch when item 5 unparks.** A is also where the naming decision lands
(Weekend Favorites vs This Weekend vs Weekend Moves — user-testing candidate list
is in the tracker).

## Open product questions

1. Which 4–6 category slots for v1? (My starter set: First stop / Dancing /
   Late-night / Value / Overall.)
2. One list with labeled picks, or visually distinct category rows?
3. Does the check-in signal belong here pre-launch (it'll be empty most nights —
   fallback messaging needed) or post-launch only?
4. Name decision — keep "Weekend Favorites" for now and test later?

## Files & risks

- Touch: `WeekendFavorites.tsx`, likely a new `weekendPicks.ts` scoring module
  (parallel to `vibeScore.ts`); no schema changes for approach A.
- Risks: with 47 venues and sparse attributes, some categories may be thin
  (only 14 have happy-hour data) — categories must degrade gracefully; avoid
  the same venue winning every slot (per-venue slot cap).
