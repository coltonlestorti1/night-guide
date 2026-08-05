# Neighborhood rule — proposal (2026-08-05)

> **DECIDED 2026-08-05.** Colton approved: street-only rule, `3rd Avenue` added,
> Coyote Ugly's address `233 E 14th St` is correct (so its *coordinates* were
> wrong — fixed), Club Cumming's deactivation is deliberate, area names become
> searchable. Implemented in `scripts/2026-08-05-neighborhood-rule.sql`
> (**awaiting Colton's paste**), `src/lib/neighborhoodAreas.ts`,
> `src/lib/searchMatch.ts`, `src/data/venues.ts`.
>
> Two corrections found after this doc was first written:
> - **Otto's Shrunken Head** (538 E 14th) was a third `E 14th Street` venue,
>   missed in §C5 → `Avenue B`.
> - **Accidental Bar** and **Two Perrys** are ON Loisaida Ave, so they are plain
>   gap-fills (`Avenue C`), not the cross-street cases §B filed them as.
>   Both caught by dry-running the SQL against live data.
>
> The record below is the original proposal, kept as written.

---

## What the field actually does

`venues.neighborhood` is a **display label only** — the small `📍 Avenue A` line
under the venue name. Four consumer surfaces render it:

- `src/components/BarCard.tsx:71`
- `src/components/VenuePreview.tsx:123`
- `src/components/SavedSpotsList.tsx:71`
- `src/components/social/CreatePlanSheet.tsx:290` (and `src/pages/Join.tsx:76`)

It is also in the search haystack: `src/lib/searchMatch.ts:23`.

No filtering, no grouping, no logic depends on it. So the only question is *what
is most useful to read on a card*, plus *what should be searchable*.

## The problem

The column mixes two incompatible kinds of answer:

| Kind | Values in use |
|---|---|
| The street it's on | `Avenue A`, `1st Avenue`, `2nd Avenue`, `E 14th Street`, `St. Marks Place`, `Bowery` |
| The area it's in | `Upper East Village` |
| Both at once | `Avenue B / Alphabet City`, `Avenue C / Alphabet City` |

`Avenue A` and `Alphabet City` are not siblings — Avenue A is *inside* Alphabet
City. 26 of 55 active venues are blank.

## Recommendation

**Street-only labels, nearest avenue when the address is a cross street, area
names dropped from the display and moved into search.**

Rationale: every venue in the app is in the East Village, so area labels
(`Upper East Village`, `Alphabet City`) carry almost no information on a card —
they'd all say roughly the same thing. `Avenue A` vs `St. Marks Place` actually
tells someone which way to walk. That is the job this line does.

Final vocabulary (7 values):

    Avenue A · Avenue B · Avenue C · 1st Avenue · 2nd Avenue · 3rd Avenue ·
    Bowery · St. Marks Place

**`St. Marks Place` stays** as an exception. It is the one cross street here that
is a destination in its own right — more useful on a card than "2nd Avenue".
`3rd Avenue` is new (see §D).

**Search is preserved separately.** Dropping the `/ Alphabet City` suffix would
break the "alphabet city" search that currently matches 5 venues. Fix: add area
terms to the haystack in `searchMatch.ts` without putting them on the card. Costs
a few lines; keeps both behaviors.

---

## THE CHANGE SET

### A. Gap-fills — 20 venues, no existing value overwritten

Already staged in `scripts/2026-07-31-neighborhood-backfill.sql`, every statement
guarded `where neighborhood is null`. Each venue is *literally on* the street it
gets labelled with, per the verified Google address in `src/data/places/places.json`.

| Label | Venues |
|---|---|
| `Avenue A` | Berlin (25), Motel No Tell (210), The Spotted Owl Tavern (211) |
| `1st Avenue` | Goodnight Sonny (134), Superbueno (13), The Headless Widow (99), d.b.a. (41) |
| `2nd Avenue` | Juke Bar (196), Little Rebel (219), Paradise Lost (100), Sweet Linda (29), Wonderland Bar (96) |
| `Avenue B` | Lucky (168), Mona's (224), The York (186) |
| `St. Marks Place` | Bua (122), Holiday Cocktail Lounge (75), Please Don't Tell (113), Romeos (118), Ten Degrees (121) |

⚠️ The staged script writes `Avenue B / Alphabet City` for the three Avenue B
venues. Under this proposal that becomes plain `Avenue B` — **the script needs a
3-line edit before it runs.** It has not been edited yet.

### B. Cross-street venues — 5 still blank, assigned by nearest avenue

Computed, not guessed: I fitted each avenue's line from the venues verifiably on
it, then took perpendicular distance. Runner-up distance shown as the margin.

| Venue | Address | → Label | Margin | Confidence |
|---|---|---|---|---|
| Big Bar | 75 E 7th St | `1st Avenue` | 60m vs 154m | high |
| Club Cumming | 505 E 6th St | `Avenue A` | 10m vs 153m | high |
| Solas | 232 E 9th St | `2nd Avenue` | 71m vs 287m | high |
| The Wayland | 700 E 9th St | `Avenue C` | 15m vs 265m | high |
| Deluxx Fluxx | 125 E 11th St | `3rd Avenue` | see §D | needs new label |

Club Cumming is currently `is_active = false` — see §F.

### C. Relabels — these OVERWRITE values Colton set. His call, itemised.

**C1 — Loisaida is Avenue C, not Avenue B (factual error, 2 venues):**

| Venue | Address | Current | → |
|---|---|---|---|
| Alphabet City Beer Co | 96 Loisaida Ave | `Avenue B / Alphabet City` | `Avenue C` |
| The Summit Bar | 133 Loisaida Ave | `Avenue B / Alphabet City` | `Avenue C` |

Loisaida Avenue *is* Avenue C. These two are on the wrong avenue entirely, while
Joyface (104 Loisaida) and Nublu 151 (151 Loisaida) are correctly on Avenue C.

**C2 — suffix drop (4 venues, cosmetic):**
`Avenue C / Alphabet City` → `Avenue C` for Joyface, Nublu 151.
`Avenue B / Alphabet City` → `Avenue B` for Death & Co (433 E 6th, nearest-avenue
confirms Avenue B at 57m vs 206m).

**C3 — `St. Marks Place` used as a corridor for venues not on it (3 venues):**

| Venue | Address | Current | → |
|---|---|---|---|
| McSorley's Old Ale House | 15 E 7th St | `St. Marks Place` | `2nd Avenue` (18m vs 229m) |
| Blue & Gold Tavern | 79 E 7th St | `St. Marks Place` | `1st Avenue` (42m vs 172m) |
| KGB Bar | 85 E 4th St | `St. Marks Place` | `1st Avenue` (81m vs 128m — thin margin) |

Only Barcade (6 St Marks Pl) is actually on St. Marks Place today.

**C4 — `Upper East Village` retired (2 venues):**
Sake Bar Decibel (240 E 9th) → `2nd Avenue` (42m vs 258m, high confidence).
The Ready Rooftop (112 E 11th) → `3rd Avenue`, see §D.

**C5 — `E 14th Street` (2 venues) — BLOCKED, see §E.**

### D. New label needed: `3rd Avenue`

Deluxx Fluxx (125 E 11th) and The Ready Rooftop (112 E 11th) are both ~275m west
of 2nd Avenue — i.e. on the far side of it, in the 2nd–3rd Ave block. No venue in
the dataset sits on 3rd Avenue, so there was no line to fit; the assignment is by
elimination and is the least certain in this document.

**Decision needed:** add `3rd Avenue` to the vocabulary for these two, or leave
them blank. Adding it is my recommendation — a blank line on a card is worse than
an approximate one, and both venues really are closest to 3rd.

### E. BLOCKER — Beauty Bar / Coyote Ugly is a data conflict, not a label problem

`places.json` gives adjacent addresses — Beauty Bar **231 E 14th St**, Coyote
Ugly **233 E 14th St**. Their stored coordinates are **561 metres apart**.
Adjacent street numbers should be ~10m apart. One record is wrong.

The coordinates put Coyote Ugly on 1st Avenue, which matches its existing
`1st Avenue` label and matches the well-known Coyote Ugly at 153 1st Ave. So the
suspect value is the **address in `places.json`**, not the label.

I did not touch either record. Relabelling on top of a coordinate that may be
wrong would bake the error in. **This needs your eyes: which address is right?**
Until then Beauty Bar and Coyote Ugly keep their current labels.

### F. Also unresolved (carried from earlier)

- **Club Cumming is `is_active = false`** with a null neighborhood. It is not a
  closed bar. Deliberate or accidental? Unanswered. Not touched.
- **Coordinate precision is shaky across the dataset.** Checking every on-avenue
  venue against its own avenue's line, 7 are >40m off — The Library (7 Avenue A)
  is **160m** off, Niagara Bar **90m**. Stored coords are 4 decimal places (~11m),
  so precision alone doesn't explain it. This does not block the neighborhood
  work — every high-confidence call above has a margin far wider than the noise —
  but map-pin accuracy is a separate issue worth its own pass.

---

## Net effect if all of A–D run

- 25 of 26 blanks filled (Deluxx Fluxx pending the §D call).
- 11 existing labels rewritten (C1–C4).
- 2 venues untouched pending §E.
- Vocabulary goes from 9 inconsistent values to 8 consistent ones.

## What I need from you

1. Approve the street-only rule, or say you'd rather go area-only.
2. §D — add `3rd Avenue`, or leave those two blank?
3. §E — which Coyote Ugly address is right?
4. §F — was Club Cumming deactivated on purpose?
5. Confirm you want the `searchMatch.ts` change so "alphabet city" keeps working.

On approval I'll rewrite the backfill script as a single file covering A–D, put
it on your clipboard, and you paste it. Nothing runs before that.
