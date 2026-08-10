# Been & Want to Try — ranked lists surface + profile header

**Date:** 2026-08-09
**Status:** design approved by Colton, not yet planned
**Branch:** `feat/been-lists`
**Builds on:** `docs/superpowers/specs/2026-08-06-night-feed-design.md` (slice 1 shipped the rating engine this spec gives a surface to)

## Problem

The rating engine already exists and is close to Beli's: three buckets, binary-search
head-to-head comparisons, a 0–10 score derived from rank position
(`src/lib/night/ranking.ts`, `src/lib/night/ratings.ts`, `venue_ratings` with
owner-only RLS). Ratings already feed Find the Move through `src/lib/taste.ts`.

What does not exist is any surface for it:

- There is **no page in the app where you can see your own ranked list.** A score
  is shown back to you only on the night post you just made.
- Rating is reachable **only** from the night recap / publish flow. A venue that
  never appeared in a recap cannot be rated at all.
- A rating, once made, **cannot be changed or removed.**
- Saves live in a separate `SavedSpotsList` section on Profile with no relationship
  to ratings, so a place you have been to sits in "Saved spots" forever.

The engine is finished and the surface is zero. This spec covers the surface.

## Scope

Two requests, one slice:

1. **A Beli-style lists surface** — `Been` (venues you have ranked, best first,
   with score) and `Want to Try` (your saves).
2. **A profile header** in the shape of Beli's — avatar, `@handle`, member-since,
   college line, and a stat row of **Friends · Been · Want to Try**.

Decisions made during the design conversation (2026-08-09), all Colton's calls:

| # | Decision |
|---|----------|
| 1 | Entry point on Profile; the list itself is a full-screen `/lists` page, not a 5th bottom tab and not inline on Profile |
| 2 | Been is one flat list, best first, numbered 1…N — no per-bucket headers |
| 3 | `Not great` entries stay in the list, rendered muted rather than red |
| 4 | No filter chips in this slice — search + the tab toggle only |
| 5 | No "View Map" button |
| 6 | Rating a saved venue moves it out of Want to Try into Been |
| 7 | Re-rank and remove both ship in this slice |
| 8 | Venue detail shows `Your rating · 8.4 · #3 on your list` |
| 9 | Ratings stay **private** in this slice; friend visibility is a later slice behind a SECURITY DEFINER function |
| 10 | Stat row is Friends · Been · Want to Try — no leaderboard, no locked teasers |
| 11 | "Member since June 2025" under the handle |
| 12 | Keep ENDZ's gradient cover band and left-aligned avatar, not Beli's centered white header |
| 13 | `/u/:username` gets the same header, but Been / Want to Try counts wait for slice 2 |
| 14 | No "Share profile" button — `/qr` already covers it |

## Non-goals

Explicitly **not** in this slice, and each needs its own gate:

- Friend-visible ranked lists (needs `friend_ranked_list()` SECURITY DEFINER +
  its own security review).
- Filter chips on the list (city / open now / price / category).
- A map view of a list.
- Any gamification: leaderboard, streaks, yearly goals, rank badges.
- Other users' Been / Want to Try counts on `/u/:username`.

## Architecture

### Data layer — no new tables, no RLS changes

`venue_ratings` keeps its owner-only policies. `venue_saves` is untouched. Two
additions to `src/lib/night/ratings.ts`:

**`deleteRating(userId, venueId, bucket, currentOrder)`**
Deletes the row, then reindexes the survivors in that bucket via the same
full-bucket upsert the rest of the module uses. Delete happens **first**: if the
reindex then fails, the remaining scores are stale but their *order* is still
correct, and the next write to that bucket self-heals them. The reverse order
could leave the deleted venue holding a live rank. There is no delete path today
— `removeFromBucket` reindexes without removing anything, because its only caller
relies on the upsert's `onConflict` to move the row to another bucket.

Like every other write in this module, it must read rows back and throw on a
zero-row result: an RLS-blocked write returns no error, so a dropped delete is
otherwise indistinguishable from a successful one. See `saveRating`'s comment.

**Want to Try → Been on rating.** Handled in `useSaveRating`'s `onSuccess`
(`src/hooks/useMyRatings.ts`), not in the rating UI, so it fires from every entry
point — `RecapCard`, `PublishForm`, and the new venue-detail button — rather than
only the one it was written into. If the venue is currently saved, remove the save
and invalidate `["my-saves", userId]`. A failed unsave must not fail the rating:
the rating is the user's intent, the unsave is bookkeeping.

### One shared list model

New pure module `src/lib/night/lists.ts`:

```ts
export type ListEntry = {
  venue: Venue;
  bucket: Bucket;
  score: number;
  /** 1-based rank across the whole Been list, not within the bucket. */
  position: number;
};

export function beenList(ratings: RatingRow[] | undefined, venues: Venue[]): ListEntry[];
```

Sorted by score descending. The fixed bands guarantee every `great` outranks every
`good`, so a flat sort by score *is* the bucket order — decision #2 needs no
special casing. Ratings whose venue no longer resolves are dropped, the same way
`inferTaste` drops them, so a deactivated venue cannot occupy a rank.

Both `/lists` and venue detail read this one function, so "#3 on your list" can
never disagree with what row 3 actually shows. Pure and dependency-free, so it is
unit-tested without a database — same shape as `src/lib/taste.ts`.

### Components

```
src/pages/Lists.tsx                      route /lists — tabs, search, back
src/components/lists/VenueListRow.tsx    shared row (photo, title, hood, chevron)
src/components/lists/ScoreBadge.tsx      the score circle
src/components/ProfileHeader.tsx         extracted from Profile.tsx
```

**`VenueListRow`** is lifted out of `SavedSpotsList.tsx:60-115` — that row markup
(photo button + lightbox, title, neighborhood, chevron, focus rings) already exists
and would otherwise be copied. It gains two optional props: a rank number and a
score badge. `SavedSpotsList` is refactored onto it in the same change, so there is
one row component rather than two that drift.

**`Lists.tsx`** renders `Been | Want to Try` tabs with the tab in the URL
(`/lists?tab=been`), so the profile stat row can deep-link to either and the back
button behaves. A search box filters the visible tab by venue title using the
existing `searchMatch` / `normalize` helpers. Been rows carry an overflow menu with
**Rank again** (reopens `RateSheet` for that venue) and **Remove from Been**
(`deleteRating`, with a confirm, since it is destructive and the ranking effort is
what is being thrown away).

Signed out: Want to Try still works from the local saved store, which is its
existing offline fallback; Been shows a sign-in prompt, because `venue_ratings` is
server-only.

Empty states matter here — a new user opens Been to nothing. Been empty points at
Discover ("rate somewhere you've been"), Want to Try empty keeps the existing
bookmark copy.

### Profile header

`ProfileHeader.tsx` is extracted from `Profile.tsx`, which is already 300+ lines of
header plus six sections. It keeps the existing gradient cover band, left-aligned
avatar, display name, `@handle`, and college line, and adds:

- `Member since June 2025` under the handle. `profiles.created_at` already exists
  (`endz-schema.sql:26`); `PROFILE_COLS` in `src/lib/friends.ts:54` gains it, and
  the auth store's profile select gains it.
- A three-stat row: **Friends · Been · Want to Try**. Friends navigates to
  `/social`, the other two to `/lists?tab=…`. Counts come from
  `useMyFriendships` (accepted only), `useMyRatings`, and `useSaves` — all three
  hooks already exist and are already loaded elsewhere on the page.

The inline **Saved spots** section comes off Profile; that list is now the Want to
Try tab. `MyActivity`, Preferences, Privacy and Account sections are untouched.

`/u/:username` uses the same header component with the relationship button instead
of Edit Profile, and **without** the Been / Want to Try stats. Their friend count
is also omitted: `friendships` RLS scopes rows to the pair involved
(`listMyFriendships`, `src/lib/friends.ts:59`), so counting a third party's friends
requires a SECURITY DEFINER function, and that belongs with the slice-2 visibility
work where it can be security-reviewed as one piece.

### Venue detail

Below the venue name in `VenueDetail`:

- Rated: `Your rating · 8.4 · #3 on your list` plus a **Rank again** button.
- Unrated: a **Rate it** button opening `RateSheet`.

`Rate it` is the quiet unlock in this slice. Today a venue can only be rated if it
surfaces in a night recap, which is why lists are empty in the first place. Making
every venue rateable from its own page is what fills the Been list fast enough for
it to be worth opening.

## Error handling

- Rating writes already surface a toast on failure (`RateSteps.commit`); the
  delete path gets the same treatment and rolls the row back into the list.
- `useSaves` already does optimistic update with rollback; the auto-unsave rides
  on that mutation, so a failure there restores the save without touching the
  rating.
- Venues that fail to load leave the list in its existing `isError` state — the
  copy in `SavedSpotsList` moves to `VenueListRow`'s consumers unchanged.
- A rating pointing at a venue that no longer resolves is dropped from the list
  rather than rendered as a blank row.

## Testing

New unit tests (Vitest, alongside `src/lib/taste.test.ts`):

- `lists.test.ts` — ordering across all three buckets; 1-based positions;
  ties within a bucket resolved by `rank_position`; empty ratings; ratings whose
  venue is missing; a single rating landing at the band midpoint.
- `ratings.test.ts` additions — `deleteRating` removes the row and reindexes the
  survivors' scores for the new bucket size; deleting the last member of a bucket
  leaves nothing behind.

The existing 417 tests (42 files, verified green on `main` at `d789d49`) stay green. `npm run check:schema` must pass — it verifies
the selects against the live schema, and `created_at` is a new column in two
selects.

Manual verification, signed in on a real device:

1. Rate a venue from its detail page → appears in Been at the expected position
   with the expected score.
2. Save a venue → appears in Want to Try.
3. Rate a venue that was saved → it leaves Want to Try and appears in Been.
4. Rank again on a venue → its position changes and the score row updates.
5. Remove from Been → gone from the list; siblings' scores re-spread.
6. Profile stat counts match the two list lengths and the friends list.
7. `/u/:username` shows member-since and no Been / Want to Try stats.

## Changed during implementation

Recorded here so the spec matches what shipped:

1. **`deleteRating` re-reads the bucket** instead of trusting a caller-supplied
   order. Every write in this module is an upsert keyed on `(user_id, venue_id)`,
   so a venue in the caller's stale list but no longer in the table was
   *inserted*, not updated — removing two venues inside one refetch window
   resurrected the first. Found by both the security and bug review agents,
   independently.
2. **Both rating mutations invalidate on `onSettled`**, not `onSuccess`. Each is
   a two-step write, and a half-landed one left the cache showing the pre-write
   state; the delete retry then failed permanently against zero rows.
3. **The list rows do not open a lightbox.** The whole row navigates, thumbnail
   included. The old saved-spots row opened a lightbox from the photo, which
   meant two visually identical rows behaved differently depending on whether
   the venue had a real photo.
4. **Want to try rows got the same overflow menu** — "Rate it" and "Remove".
   Rating from the saved list is the action that moves a venue between the two
   tabs, and it was missing. `BeenRowMenu` became `ListRowMenu`.
5. **Profile counts are taken from the resolved lists**, so a deactivated venue
   cannot make "Been 12" link to a list of 11.
6. **`SavedSpotsList` was deleted**, not kept — nothing imported it once the
   Saved spots section came off Profile.

Still true to the spec: no schema changes, no RLS edits, ratings private.

## Open questions

None blocking. The one judgment call worth revisiting before slice 2: decision #3
keeps `Not great` entries visible. That is right for a private list, but the moment
friends can see it, "#12 Ray's — 2.1" becomes a public callout of a real business,
and the slice-2 gate should decide whether the shared view truncates the tail.
