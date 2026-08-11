# Profile reorganization — settings behind ☰, Activity/Tagged tabs

**Date:** 2026-08-10
**Tracker:** §14 (Profile buildout), and closes the open "managing existing tags
from your profile" item under Collab tags.
**Status:** approved by Colton 2026-08-10 (design discussion in-session).

## The problem

`/profile` does two unrelated jobs in one scroll: it is your identity and
activity feed, *and* it is the settings screen. The settings half sits
**underneath an unbounded feed** — today you scroll past a post to reach Ghost
mode; at twenty posts, signing out is a long scroll. Every item still queued in
§14 (notifications, blocked users, plan invites) makes it worse.

A second, quieter problem surfaced during the audit:

**Your friends can see a version of your profile that you cannot.**
`listProfilePosts` (`src/lib/night/posts.ts:192`) returns your own posts **plus
posts you are tagged in**, merged. `listMyPosts` (`posts.ts:114`) filters
`.eq("user_id", userId)` and returns only posts you authored. So `/u/:username`
shows tagged nights and `/profile` does not.

Third, and the reason this is more than a layout change:

**Being tagged in a night produces no rating.** `night_posts.score` is a
denormalized snapshot of the *author's* rating. A tagged post on your profile
therefore displays someone else's score under your name, and the night never
reaches your Been list, your taste ranking, or Find the Move. Two people go out
together and the recommendation engine learns from one of them.

## Scope

1. Settings move out of `/profile` to a new `/settings`, opened by a ☰ button.
2. Age moves out of settings into **Edit profile**.
3. `/profile` and `/u/:username` both gain **Activity | Tagged** tabs.
4. Accepting a tag prompts you to rate the venue (skippable).
5. The Tagged tab is where you manage tags you already accepted.

Not in scope: bio/photo-grid restyling, notification settings, blocked-users
list, or anything else in §14 that has no feature behind it yet.

---

## 1. `/profile` — identity and activity only

Scroll order after the change:

1. Header row — `You on the map` / **Profile**, with a **☰** button at top-right
2. `ProfileHeader` card — avatar, name, @handle, college line, member-since,
   **Edit Profile**
3. Friends / Been / Saved stats (unchanged, still linking to `/friends` and
   `/lists`)
4. **Activity | Tagged** tabs
5. The selected feed

The page now ends where the feed ends. The signed-out and loading states are
untouched.

`Profile.tsx` is 318 lines doing both jobs; the settings half lifts out roughly
intact, leaving a page short enough to read in one screen.

## 2. `/settings`, opened by ☰

A real route, not a sheet or a drawer. Reasons: it is deep-linkable, the back
button behaves, it matches how `/friends` and `/lists` already work, and Apple's
reviewer needs account deletion reachable at a stable path.

The ☰ icon is Colton's call (2026-08-10) and matches Instagram's placement. A
hamburger conventionally fronts a slide-in panel rather than a route; we are
using it to front a route deliberately, and no one will blink.

Contents, in order:

1. Back arrow + **Settings** title
2. **PRIVACY** — Ghost mode, Who sees your saves (`SaveVisibilityRow`)
3. **ACCOUNT & SUPPORT** — Report a problem, Delete account, Sign out
4. Developer settings (collapsed, as today)
5. Privacy · Terms footer links

Every row moves verbatim. Ghost mode's in-flight guard (`ghostBusy`, one request
at a time) moves with it unchanged — it exists because "older write wins" can
leave the switch reading hidden while the policies still see `false`.

**Decision recorded:** Ghost mode does **not** get a duplicate toggle on
`/profile`. It was raised that ghost mode is the one setting flipped *while you
are out*, and that Profile → ☰ → toggle is heavier than a tap. Colton chose the
clean profile. Revisit if it turns out to be friction in the field.

## 3. Age moves into Edit profile

It sits under **School**, above **Bio**, keeping both states that exist today:

- **No birthday on file** → the four band chips (21-23 / 24-26 / 27-30 / 31+)
- **Birthday on file** → a read-only line, `Your age · 21`, with the existing
  "only you can see it — it sharpens your picks and is never shown on your
  profile" note

**The trap this must avoid:** the age band is stored **on the device**
(`storeAgeBand`, `src/lib/agePref.ts`), and today it commits the instant you tap
a chip. Inside a dialog where every other field waits for **Save**, that means
tapping `24-26` and then dismissing would still have saved. The band therefore
joins the dialog's `dirty` tracking and is written in `save()`, so the dialog
behaves as one thing. The mixed storage (localStorage for the band, Supabase for
everything else) stays invisible to the user.

## 4. Activity | Tagged tabs

### What the two tabs mean

| Tab | Contents |
|---|---|
| **Activity** | Posts you authored, including `nobody`-audience ones. Unchanged from today. |
| **Tagged** | Posts *someone else* authored where you are named, in state `tag` or `collab`. |

`pending` tags do **not** appear in Tagged. They stay where they are — actionable
rows in Activity, decided before they ever become a tagged post.

### A correction worth recording

`tag` vs `collab` does **not** control profile placement. `listProfilePosts`
accepts both states equally (`posts.ts:209`). What `collab` changes is
**audience** — it widens `night_posts`' SELECT policy via
`post_has_collab_for_me` so *your* friends can see the post, not just the
author's. The distinction is:

- **tag** — you are named, it is on your profile, only the author's friends see it
- **collab** — the same, plus your friends see it too

The tracker's "combined-Instagram-post" framing under Collab nights implies
`collab` is what puts a post on your profile. It is not. This spec is the
correction.

### Both profiles get the tabs

`/u/:username` gets the same two tabs. Without that, your profile and the
profile your friends see of you are organised differently and "Tagged" stops
meaning one thing.

It is also **less** code. `listProfilePosts` currently runs its two queries then
merges, sorts, dedupes and slices them (`posts.ts:216-229`). Splitting into two
tabs deletes the merge, the dedupe, and the comment explaining why the dedupe is
there.

The resulting shape:

- `listMyPosts(userId)` — Activity on `/profile` (exists, unchanged)
- `listAuthoredPosts(userId)` — Activity on `/u/:username`; the "mine" half of
  today's `listProfilePosts`
- `listTaggedPosts(userId)` — Tagged on both; the "tagged" half of today's
  `listProfilePosts`

RLS still does the filtering on someone else's profile, exactly as it does now.
Nothing about who-can-see-what changes in this section.

### Tab presentation

Icon **with a small label**, underline on the active tab. Colton's reference is
Instagram's icon-only pair, which works there because everyone has seen it;
Activity has no equally obvious icon here, so an unlabeled one is a guess.

- **Activity** — `Moon` (already this feature's vocabulary — it is `MyActivity`'s
  empty-state icon)
- **Tagged** — `SquareUserRound`, the closest lucide match to the icon Colton
  supplied

Tabs are real buttons with `aria-selected`, not links; the selected tab is
component state and does not need to survive a reload.

### Empty states

Tagged, with nothing in it, must not read as an error. "No one's tagged you in a
night yet." Same treatment as `MyActivity`'s existing empty state, and the same
distinction it already draws: **a failed request never renders as "you have
nothing"** — that claim is one the viewer would know to be false, so it reads as
data loss.

## 5. Rate on accept

Accepting a tag opens the same `RateSheet` the recap already uses, writing
**your** `venue_ratings` row for that venue.

This is the point of the feature. Ratings are the engine behind Find the Move
and the Been list; a night where two people were out and only one produces a
rating is a hole in that loop.

**Ordering, which matters:** the tag acceptance commits **first**, then the sheet
opens. If the sheet opened first and its result gated the accept, dismissing it
would silently lose the acceptance.

**Skipping is fine.** Dismissing leaves the tag accepted and unrated, and
`PostCard` already handles a null score — no ring, and the verb falls back from
"ranked" to "went to" (`PostCard.tsx:98`).

**If you have already rated that venue,** no sheet: you have an opinion on
record and the card renders it. Re-rating stays available from the card's
overflow menu, the same way it is elsewhere.

## 6. Your score on a tagged card — the RLS problem and the column

`venue_ratings` is **owner-only** at the RLS level. A friend viewing your profile
cannot read your rating. That is precisely why `night_posts.score` exists as a
denormalized snapshot of the author's rating rather than a join.

So the same constraint applies to a tagged person's score: for it to render to
anyone but you, it must live on a row the viewer can read. That row is the tag.

**Schema change (DDL owed to Colton — clipboard → SQL editor):**

```sql
alter table public.night_post_tags
  add column if not exists score numeric;
```

Nullable, because "tagged but not rated" is a legitimate and expected state.

**Trigger.** `sync_night_post_score()` on `venue_ratings`
(`endz-schema.sql:3055`) already pushes a user's rating onto `night_posts.score`
whenever their ranking moves — which it does constantly, since a score is a
rendering of a moving ranking, not a frozen number. It is extended to do the
same for `night_post_tags.score` where `tagged_user_id` is that user and the
post's venue matches. Same function, same delete-sets-null branch, one more
`update`.

Without this extension the column refreezes exactly the way `night_posts.score`
did before 2026-08-10.

**Backfill** runs once for tags whose person already rated the venue, mirroring
the two backfill statements already in the schema file at lines 3074-3079.

**No new RLS policy.** The column rides `night_post_tags`' existing policies. It
is readable by exactly whoever can already read the tag, which is the correct
audience — and the tag row is already the thing that decides whether the post is
visible at all.

**Client cache.** A DB trigger is invisible to the client — the lesson already
written into `useMyRatings.ts:25`, where `POST_SCORE_KEYS` lists every cache
that renders a score beside a post so that rating one venue re-spreads the band
everywhere. Two concrete obligations:

1. The new query keys (`authored-posts`, `tagged-posts`) join `POST_SCORE_KEYS`,
   and `profile-posts` leaves it when `listProfilePosts` goes. Miss this and a
   tagged card keeps its old ring until a reload.
2. `useInvalidateTags` (`src/hooks/useTags.ts:50`) swaps `profile-posts` for the
   same two keys, so accepting or removing a tag repaints both tabs.

## 7. Managing tags you already accepted

The Tagged tab is the list the tracker records as missing: *"no list of tags you
have already accepted where you could change your mind between `tag` and
`collab`, or remove one later. Colton asked for this on 2026-08-09; only the
pending half was built."*

Each card in Tagged carries an overflow menu:

- **Share with my friends too** / **Keep it to their friends** — toggles
  `tag` ⇄ `collab` via the existing `useSetTagState`
- **Rate this spot** — opens `RateSheet`, for a tag accepted without rating
- **Remove me from this night** — `useRemoveTag`; removes the tag, never the post

Both mutations already exist and are already RLS-enforced: only the tagged
person may move a tag to `collab`, and the INSERT policy refuses a tag that does
not start `pending` (`src/lib/night/tags.ts:1-11`). Nothing here re-checks the
rules; it only renders the choices.

Removal is immediate, with an undo toast rather than a confirm dialog — it is
reversible by the author re-tagging, and a confirm on every row is friction on
the common case.

---

## Testing

- **`lists`/`posts` split** — `listAuthoredPosts` and `listTaggedPosts` return
  the two halves today's merged `listProfilePosts` returns; a post is never in
  both.
- **Tag states** — `pending` never appears in Tagged; `tag` and `collab` both do.
- **Age band in Edit profile** — tapping a chip and dismissing does **not**
  persist; tapping and saving does. This is the trap in §3 and is the one test
  that would have caught it.
- **Score rendering** — a tagged card with no rating renders "went to" and no
  ring; with a rating, the ring and "ranked".
- **Empty vs error** — Tagged renders its empty copy only on a successful empty
  response, never on a failed request.
- **Settings extraction** — Ghost mode's in-flight guard still serialises
  writes after the move.

DDL is proved in the SQL editor the way every schema change here is: the
trigger is verified to fire on a rating change, and the backfill is diffed
before and after. Per `supabase_editor_rollback_trap`, DDL and a trailing
rollback never go in the same paste.

## Risks

- **The DDL must land BEFORE this branch merges.** Not "should" — must. The
  Tagged query selects `score` inside the tag embed, and PostgREST rejects an
  unknown column outright with `42703` rather than returning null. Probed
  directly on 2026-08-10: the column does not exist, and the query 400s. So
  until the SQL is pasted, the Tagged tab is a hard error for every user, not a
  degraded one. Only the anon key exists locally, so this is Colton's step.

- **The schema drift guard cannot catch this.** `plainColumns`
  (`scripts/check-schema.mjs:180`) filters out every part containing `(`, which
  drops embedded joins wholesale — it validated only `night_posts`' top-level
  columns and reported `ok` for a select PostgREST refuses. Pre-existing, and
  it applies to every embed in the app (`author:profiles!…`,
  `person:profiles!…`), not just this one. Logged as follow-up work; not fixed
  here, because widening the guard will surface unrelated drift that deserves
  its own pass.
- **`sync_night_post_score()` is a live, working trigger.** Extending it means
  editing something that currently protects a shipped surface. It gets its own
  verification, not a drive-by edit.
- **`listProfilePosts` disappears.** Any other caller must be found first.
