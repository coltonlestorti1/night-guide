# Logging a night — one sheet, Beli-shaped

**Date:** 2026-08-12
**Tracker:** §34 (new).
**Status:** approved by Colton 2026-08-12 (design discussion in-session).

## The problem

There are two ways to record that you went somewhere, and they record different
things.

**Path A — from the map.** Venue sheet → `VenueRatingRow` "Rate it" →
`RateSheet` → `RateSteps`. It asks one question ("how was it?"), runs the
head-to-head comparisons, and writes **one row to `venue_ratings`**. That is
all. There is no night date, no note, no photos, no tagging, and no post.
`venue_ratings.rated_at` defaults to `now()`, so **the night you actually went
is never captured** — a Tuesday spent logging three weekend spots records all
three as Tuesday. Nothing from this path ever reaches your Activity tab, the
feed, or anyone else's screen.

**Path B — from Social.** `AddNightSheet` asks *Which night?* (Tonight / Last
night / weekday chips, plus a date field), then which spot, then hands to
`PublishForm` for note / photos / audience / tagging, publishes a `night_posts`
row, and **only then** offers the rating.

So the richer flow is the one buried behind a tab, and the flow you reach from
the venue you are actually looking at is the impoverished one. The missing
"which night" question on path A is the reported bug; the split itself is the
cause.

A third problem, visible once the two are compared: **the rating interrogates.**
`RateSteps` fires the first head-to-head the instant you tap a bucket. Logging a
spot from the map is therefore never fewer than three taps and can be six,
before you have been offered a single optional field.

## Scope

1. One `LogNightSheet`, rendered by every entry point that logs a night.
2. The **night date** moves into that sheet, so path A finally asks it.
3. The sheet is restyled to the Beli layout: three big how-was-it circles, then
   a stack of optional rows, then one primary action.
4. Head-to-head comparisons move to **after** the post, not after the bucket tap.
5. `VenueRatingRow` distinguishes *log another night* from *re-rank*.

**Not in scope:** the data model (unchanged), the scoring bands, the comparison
algorithm itself, check-ins, or Beli's "labels" and "favorite dishes" rows.

---

## 1. The sheet

One drawer, one screen. Everything below the three circles is optional and
collapsed by default.

```
┌─────────────────────────────────────────┐
│  The Grafton                      ✕     │
│  BAR · St Marks                         │
├─────────────────────────────────────────┤
│              How was it?                │
│      ●          ●          ●            │
│    Loved it   It was ok  Not for me     │
├─────────────────────────────────────────┤
│  👥  Who were you with?            ›    │
│      [Tru] [Lauren] [Cooper] …          │
├─────────────────────────────────────────┤
│  ✏️  Add a note                     ›    │
├─────────────────────────────────────────┤
│  📷  Add photos                     ›    │
├─────────────────────────────────────────┤
│  📅  Which night?                   ›    │
│      [Tonight] [Last night] [Fri]       │
├─────────────────────────────────────────┤
│  👁  Who can see this?              ›    │
│      [Everyone][My school][Friends][Just me]│
├─────────────────────────────────────────┤
│                 Post                     │
└─────────────────────────────────────────┘
```

**Header** — venue title, then `CATEGORY · neighborhood` in the existing pill
styling from `VenuePreview`. Close button top-right.

**Rows** — each row is a label with a chevron and, where it has one, a live
inline summary underneath (the selected friends, the chosen night, the audience).
Tapping a row expands it in place. A row that already has a value shows that
value rather than the prompt, so the sheet doubles as a summary of what you are
about to post.

**Deliberate departures from Beli**, all four settled in discussion:

1. **No "Add to my list of ___" dropdown.** ENDZ has one list of spots, not
   per-cuisine lists. The control would be a no-op.
2. **No "Add labels" and no "favorite dishes."** Labels are venue enrichment
   data the app already owns per venue; there is no nightlife analogue of a dish
   that earns a row.
3. **No "Stealth mode" toggle.** The four-way audience picker already covers it
   and is more honest: `Just me` *is* stealth, and `My school` / `Friends` /
   `Everyone` are distinctions a binary cannot make. See `lib/night/audience.ts`.
4. **Comparisons after Post, not after the bucket tap.** Matches Beli, and it
   means one tap on a circle plus one tap on Post is a complete log.

## 2. The three circles

Beli's are pastel green / yellow / red on white. ENDZ is a dark app, and
`ScoreBadge` already carries a deliberate decision that must not be broken
silently: `not_great` is **muted with a dashed border, never red**, because a red
badge editorialises about a real business on what is a private list.

Keep Beli's *form*, use the existing bucket tones:

| Bucket | Picker copy | Treatment |
|---|---|---|
| `great` | Loved it | filled primary, check mark when selected |
| `good` | It was ok | neutral/amber tint, solid border |
| `not_great` | Not for me | muted fill, dashed border |

Circles are at least 44px and are real buttons with `aria-pressed`. The stored
bucket names and `BUCKET_LABELS` are **unchanged** — the friendly copy lives in
the picker only, so lists, badges, scores and every existing test keep working.

Selecting a circle does **not** advance a step. It selects, and stays selected
and re-tappable until Post.

## 3. Flow and entry points

`LogNightSheet` is rendered by all four:

| Entry point | Venue | Night | Notes |
|---|---|---|---|
| Map / venue sheet → "Log it" | pre-filled | last completed night | the path that was broken |
| Social → + → Add a night | chosen in step 1 | editable in the sheet | step 1 shrinks to spot search |
| Recap card → Post | pre-filled | from the check-in | unchanged behaviour |
| Post card → Edit | pre-filled | **locked** | bucket row shows the existing rating |

`AddNightSheet` keeps its venue-search step and its single-drawer construction —
two vaul drawers alive for one flow interrupt each other's transitions, which is
documented at the top of that file and must stay true. The "Which night?" chips
and `NightDateField` **move out of it** and into the sheet's night row; they are
the same components, relocated.

`PublishForm` becomes `LogNightSheet`'s body after the rewrite. `RateSteps`
keeps **only** the head-to-head comparison UI; its bucket picker moves into the
sheet.

**On Post:**

1. `night_posts` row is written, exactly as `publishPost` does today, carrying
   the score if one exists.
2. Photos attach, tags are written — unchanged, including the orphan-cleanup
   behaviour documented in `PublishForm`.
3. If a bucket was selected **and** the venue has no rating yet, the comparison
   step runs, then saves to `venue_ratings`.
4. If a bucket was selected and the venue is already rated at that bucket,
   nothing re-ranks — the existing position stands.
5. If no bucket was selected, the post is published with no score. This stays
   legal; "went to" and "ranked" are different claims.

The comparison step is skippable, and skipping it still leaves the post.

## 4. Audience default and the privacy copy

Today `VenueRatingRow` reads *"Rate it — only you can see this"*, and that is
true of a rating: `venue_ratings` is owner-only at the RLS level.

Under this design the same tap can produce a **post**, and the audience picker
defaults to `defaultAudience()` — My school, or Friends when no college is set.
**Colton's call (2026-08-12): keep that default and fix the copy.** The row
becomes:

- Unrated: **"Been here?"** / "Log the night — you choose who sees it."
- Rated: score badge + "#N on your list", primary **"Log another night"**.

The audience chips are visible on the sheet above the Post button before
anything is written, so the disclosure is on screen at the moment of the
decision. No entry point gets its own private default — a per-surface default is
the kind of thing nobody remembers.

## 5. `VenueRatingRow` — two intentions, two controls

A second visit is not a re-rank, and the current single "Rank again" button
conflates them.

- **"Log another night"** (primary) → the full sheet, fresh night, the bucket
  row pre-selected at your current bucket.
- **"Rank again"** (row menu, alongside the existing remove) → straight to
  comparisons, no post, as `RateSheet` does today.

`ListRowMenu` already offers "Rank again"; it keeps that meaning, which is now
the only meaning it has.

## 6. Data model

**Unchanged.** A night entry is a `night_posts` row plus an optional
`venue_ratings` row, as it is today. No DDL, no new columns, no policy changes.

The night date lands in `night_posts.night_date`, which already exists and is
already what `AddNightSheet` writes. Path A begins writing it because path A
begins creating posts — that is the entire fix for the reported bug.

`venue_ratings.rated_at` stays `now()` and stays meaningless as a visit date. It
is not the night you went and was never claimed to be; the post carries that.

**One post per venue per night, enforced in the database.** `night_posts` has
`unique (user_id, venue_id, night_date)` and `publishPost` upserts on exactly
that key (`lib/night/posts.ts:196`). So "Log another night" on a venue you
already logged *for the same night* **edits that post rather than creating a
second one** — which is right, and is already how the recap behaves. Only a
different night produces a second entry. The sheet must therefore seed its note,
audience and photos from any existing post for the chosen venue+night, exactly
as `PublishForm` does today via `useMyPostsForNight`, and it must re-seed when
the night row changes — otherwise picking a different night would carry the
previous night's note into a new post.

## 7. Testing

- `LogNightSheet` renders every row, and each row expands in place.
- Selecting a circle does not advance; it can be changed before Post.
- Night defaults to the last completed night, and "Tonight" is only offered
  between 18:00 and 06:00 (existing `nightChoices` behaviour, relocated).
- Post with no bucket → post exists, no rating written.
- Post with a bucket on an unrated venue → comparisons run, rating written.
- Post with a bucket on a rated venue → no re-rank.
- Skipping comparisons leaves the post intact.
- Edit mode locks the night and pre-selects the existing bucket.
- Changing the night row re-seeds note/audience/photos from that night's post,
  and clears them when that night has no post.
- The map entry writes a `night_posts` row with the chosen `night_date` — the
  regression test for the reported bug.
- Existing `RateSteps` comparison tests keep passing against the trimmed
  component.

## 8. Acceptance criteria

1. Ranking a spot from the map asks which night, and the answer is stored on the
   resulting post.
2. A spot logged from the map appears in your Activity tab.
3. The sheet matches the layout in §1 on a 390px-wide viewport with no
   horizontal scroll.
4. One tap on a circle plus one tap on Post is a complete log.
5. Nothing about scores, bands, buckets or existing lists changes.
