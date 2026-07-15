# Weekend Picks Build — Approach A (2026-07-15)

Implements the recommended MVP from `2026-07-14-weekend-favorites-prep.md`:
category-slotted picks over existing data only. Branch `feat/weekend-picks`,
not merged. No schema changes, no new packages, no new data sources, no
randomness anywhere.

## What was built

- **`src/lib/weekendPicks.ts`** (new) — scoring module parallel to
  `vibeScore.ts`. `pickWeekendSlots(venues, day)` returns up to 5 slot winners
  (each with a one-line reason) plus a rating-sorted "Overall favorites" tail.
- **`src/components/WeekendFavorites.tsx`** (reworked) — keeps the Thu/Fri/Sat
  tabs and BarCard rows; each slot renders a small uppercase label on the left
  and its reason on the right, above the card. Below the slots, an
  "Overall favorites" heading with up to 6 more cards.

## Slot scoring rules (exact)

All slots share one deterministic tiebreak: **rating desc → review count desc →
venue name A–Z**. "Open that night" keeps venues with unknown hours (missing
data is never punished — same convention as before).

| Slot | Qualifies | Ranked by | Reason line |
|---|---|---|---|
| **Best first stop** | Has a happy-hour window that day ending 5 PM or later; open that night | Latest happy-hour end (most runway), then earliest opening time that day, then tiebreak | "Happy hour til 9 PM" |
| **Best for dancing** | `category === "club"`, OR seeded `music_type` matches dance/edm/house/hip hop/disco/latin/top 40/dj; open that night | Clubs before music-type matches, then tiebreak | "Proper club, goes til 4 AM" / "Plays Latin / Jazz" |
| **Best late-night** | Hours known for that night AND closes at 2 AM or later | Latest close that night, then tiebreak | "Open til 4 AM" |
| **Best value** | `avg_price_level` 1–2 AND has a rating; open that night | Score = rating + (3 − price) × 0.25 (so $ gets +0.25 over $$ — a $ 3.8 dive can't beat a $$ 4.6 on price alone), then tiebreak | "Cheap drinks, still ★ 4.7" ($) / "Fair prices, ★ 4.4" ($$) |
| **Best overall** | Has a rating; open that night | Rating sort (the old whole-list ranking, demoted to one slot) | "★ 4.9 · 177 reviews" |

**Per-venue cap:** slots are assigned in the order above; a venue that already
won a slot is skipped, so no venue wins twice. A slot with no qualified venue
is dropped — never faked, never backfilled with a weaker rule.

**Overall favorites tail:** rated + open that night, excluding all slot
winners, rating-sorted, top 6.

## Product decisions made (veto anything here)

1. **Slot priority order = First stop → Dancing → Late-night → Value →
   Overall** (the prep doc's listing order). Consequence: if one venue would
   win two slots, the earlier slot keeps it. "Best overall" being last means it
   can show the 2nd-highest-rated venue when the top one already won another
   slot — I think that's the right behavior (more variety, and the slot label
   is still honest since the true #1 is visible above it).
2. **"Late-night" threshold = closes at 2 AM or later.** Anything earlier
   doesn't credibly earn the label. With current data every night has multiple
   4 AM closers, so the slot always fills; the threshold only matters if data
   thins out.
3. **"First stop" requires the happy hour to end 5 PM or later** — a deal that's
   over by mid-afternoon isn't a first stop for a night out.
4. **Danceable music keywords:** dance, edm, house, hip hop, disco, latin,
   top 40, dj. Current seed data has no pure dance genres — only "Latin / Jazz"
   (Cienfuegos) matches — so in practice clubs win this slot; the keyword path
   is the fallback if all clubs are closed/taken.
5. **Value formula** rating + (3 − price) × 0.25 rather than sorting by price
   first: keeps "value" meaning cheap *and good*, not just cheap.
6. **Dropped the 1–12 number rail.** Slot rows are labeled, not ranked; and
   numbering the tail 1–6 would falsely imply its #1 is the best overall.
   Easy to restore if you want the numbers back.
7. **Tail heading text = "Overall favorites"**, kept the section name
   "Weekend Favorites" (naming test is a separate tracker question).
8. **Unrated venues can still win data-backed slots** (first stop, dancing,
   late-night) since those reasons don't depend on rating — consistent with
   "missing data isn't punished." Value and Overall require a rating by
   definition.
9. **Reason copy** (tone rules — plain, human, no AI-speak): "Happy hour til
   9 PM", "Proper club, goes til 4 AM", "Plays Latin / Jazz", "Open til 4 AM",
   "Cheap drinks, still ★ 4.7", "Fair prices, ★ 4.4", "★ 4.9 · 177 reviews".

## What the data actually produces (verified by running the module)

| Slot | Thu | Fri | Sat |
|---|---|---|---|
| First stop | d.b.a. — HH til 9 PM | d.b.a. — HH til 9 PM | **Solas** (d.b.a. has no Sat HH) |
| Dancing | **Holiday Cocktail Lounge** (Deluxx closed Thu) | Deluxx Fluxx | Deluxx Fluxx |
| Late-night | **Juke Bar** (top-rated Thu 4 AM closer) | The Wayland | The Wayland |
| Value | McSorley's | McSorley's | McSorley's |
| Overall | The York | The York | The York |

Every Thu/Fri/Sat difference above comes from real hours/happy-hour data.
Value and Overall are static across days by construction (their inputs don't
vary by day) — that's honest, not a bug.

## Data limits to know about

- Happy hour coverage: 14 venues Thu, 13 Fri, only **5 on Sat** — the Saturday
  first-stop pool is thin but real.
- No dance-genre `music_type` values exist yet; the dancing slot is effectively
  clubs-only (5 clubs, all rated with hours) until seed data improves.
- 4 venues have no enrichment at all (Paul's Cocktail Lounge, Manitoba's,
  The Bourgeois Pig, Angel's Share) — they can never win Value/Overall.
- No popularTimes data (approach B is the fast follow if serpapi checks out).

## Acceptance criteria

- [x] 5 slots render with label + one-line reason; same venue never wins twice.
- [x] Slots with no qualified venue are dropped (never faked).
- [x] Thu/Fri/Sat outputs differ only via real hours/happy-hour data — zero
      randomness (no `Math.random` anywhere in the module or component).
- [x] "Overall favorites" tail: rating-sorted, excludes slot winners, max 6.
- [x] Thu/Fri/Sat tabs and BarCard row look preserved.
- [x] `npx tsc --noEmit -p tsconfig.app.json` passes; `npm run build` passes.
- [x] Module output verified against raw enrichment JSON for all three nights.
