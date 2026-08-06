# Night feed + venue ratings — design

**Date:** 2026-08-06
**Status:** design agreed with Colton 2026-08-06; **not yet approved for
implementation** — the tracker gate still applies to the build.
**Tracker:** supersedes the narrow "Night Recap" backlog line; is the feedback
half of the personalization loop with §3 (Dynamic Find the Move) and §32
(onboarding taste capture).

## Purpose

A feed of where people went the night before, what they thought of it, and —
optionally — a photo and a note. Beli's model, for bars.

Two jobs, and the second is the one that compounds:

1. **Social.** A reason to open ENDZ the morning after, not just at 11pm.
2. **Signal.** A rating plus "too loud to actually talk" is far richer input
   for recommendations than a save. This spec **writes** that signal; §3 reads
   it later.

## Why now

The blocker cleared on 2026-08-05 and the tracker was stale. Three things are
already true:

- **History is retained.** `scripts/2026-08-05-saves-and-history-ddl.sql`
  replaced the delete-on-checkout behaviour: `endActiveCheckIns()`
  (`src/lib/checkins.ts:68-79`) sets `expires_at`/`ended_at` and deletes
  nothing. Night history has been accumulating since 2026-08-05.
- **A partial ratings surface exists.** `check_ins` carries `vibe` (five
  values) and `would_recommend` (yes/maybe/no), owner-only UPDATE, `vibe_at`
  set by trigger so nobody can backdate a report.
- **Friend reads are already time-bounded.** The same DDL restricted other
  users' SELECT to `expires_at > now()` — live rows only — precisely so that
  retaining history would not "convert a live-presence feature into a permanent
  location log readable by every friend."

That last point is the constraint this whole design is built around.

## Decisions taken (2026-08-06)

| Question | Decision |
|---|---|
| What is published | **Authored posts, not the trail.** The recap is private; the user picks which venues to post. Skipping is free and silent. |
| Timestamp exposure | **Never.** A post carries `night_date` at day granularity. No client query reaches a check-in timestamp. |
| Rating mechanic | **Hybrid.** Bucket first; comparisons only from the 4th rating, and only *within* a bucket. |
| Bucket labels | **Great / Good / Not great** (Colton's wording — judgment, not emotion) |
| Notes | **Optional**, ~280 chars, no links |
| Photos | **Optional**, up to 3 per post, user's own |
| Feed placement | `/social` **becomes the feed**; friend management moves behind a header icon. No fifth tab. |
| Default post audience | **School**, not friends and not public (Colton, 2026-08-06) — friends-only starves the feed at launch; public is the wrong default for this user base. `everyone` stays available **opt-in per post**. |
| Moderation | **Ships with the feature, not after** |
| Scorer integration | **Out of scope.** This spec writes `venue_ratings`; §3 reads it. |

## Data model

Two primary tables plus a child table for photos. The split exists because a
ranked list and a dated event are different objects — the same separation Beli
makes between your list and your activity.

### `venue_ratings` — one row per (user, venue)

The durable ranked list. This is what comparisons rank against and what §3 will
eventually read. Re-rating a venue updates in place rather than appending.

- `user_id`, `venue_id` — unique together
- `bucket` — `great` | `good` | `not_great`
- `rank_position` — integer, ordering **within** the bucket
- `score` — 0–10, derived from bucket + rank position
- `rated_at` — set by trigger, never client-written (same rule as `vibe_at`)

**Score bands are fixed by bucket**, so a score never migrates across a
boundary when the list is re-ranked:

| Bucket | Band | Score with no comparisons yet |
|---|---|---|
| Great | 6.7 – 10.0 | 8.3 (midpoint) |
| Good | 3.4 – 6.6 | 5.0 |
| Not great | 0.0 – 3.3 | 1.7 |

Within a band, `rank_position` spreads entries evenly. One venue in a bucket
sits at the midpoint; adding a second splits the band between them. Scores
therefore shift as the list grows, which is expected — the **ranking** is the
truth and the score is a rendering of it. Displayed to one decimal place.

### `night_posts` — one row per published post

- `user_id`, `venue_id`
- `night_date` — **date, not timestamp.** The load-bearing privacy decision.
- `note` — nullable text, capped
- `visibility` — `everyone` | `school` | `friends` | `nobody`, **defaulting to
  `school`**. This is a **new, wider union than `CheckinVisibility`** — live
  check-in visibility is deliberately left alone and keeps its three values.
  Do not widen the shared type; a live location and a next-day post are not
  the same disclosure and must not share a default.
- `created_at`

### `night_post_photos` — child rows of a post

A separate table rather than an array column, so a single photo can be deleted
or moderated without rewriting the post, and so a report can point at one image.

- `post_id` — cascade delete with the parent post
- `storage_path`, `sort_order`
- Max 3 per post, enforced on write

**A post is new content, not a window onto the trail.** No foreign key exposes
the originating check-in to any reader other than the author.

## Night grouping

A night is check-ins falling between **18:00 and 06:00**, dated to the evening
it began — a 01:30 Tuesday check-in belongs to Monday night.

Pure function, no I/O, unit-tested. This is the single most bug-prone piece of
the feature and the cheapest to test.

## The rating flow

1. Morning after, top of the feed: **"Last night · 3 spots."** A user who did
   not check in sees no card at all.
2. Per venue: pick a bucket — **Great / Good / Not great.**
3. **Ratings 1–3 stop there.** Score comes from the bucket midpoint. There is
   nothing to compare against yet, and forcing it would produce noise.
4. **From the 4th rating on:** binary-search comparisons *within the chosen
   bucket* — "Which was better?" With 20 rated venues that is 2–4 taps, not 20.
   Comparisons never cross buckets, so a place you loved is never weighed
   against one you disliked.
5. Optional: **add a photo or a note.** Presented as a light invitation, never
   a required field, never a blocking step.
6. **Publish or skip, per venue.**

### Friction budget

Colton's standing rule is that nothing may add friction *before a check-in
commits*. This flow sits entirely the next morning, so it is outside that
guard — a larger friction budget is available here than anywhere in the live
loop, and the comparison mechanic spends it deliberately.

## Photos

User-authored photos of their own night. **None of the Google Places licensing
constraints apply** — that restriction is about Places content, not about
photographs the user took.

- **Reuse `src/lib/avatarUpload.ts`'s downscale path.** It reads the file to a
  canvas and re-encodes via `toBlob`, which rebuilds the image from raw pixels
  and **discards EXIF as a side effect**.
- **EXIF stripping is mandatory, not incidental.** Camera EXIF carries GPS
  coordinates and exact capture time. Shipping it would hand back precisely the
  data `night_date` exists to withhold, and would silently undo the 2026-08-05
  RLS fix through a side channel. Reusing the canvas path satisfies this; a
  direct-upload shortcut would not. **Verify on a real camera photo, not a
  screenshot** — screenshots often carry no EXIF and would produce a false pass.
- New Supabase Storage bucket, public-read / owner-write, mirroring `avatars`.
- Max 3 per post; client-side downscale before upload.

**Storage is the first real free-tier pressure this app has created.** Photos
are far larger than avatars. Worth a usage check before opening the feature to
a full class of users.

## Privacy

| Surface | Who can read it |
|---|---|
| Check-in history / recap | **Author only.** Current RLS already permits `auth.uid() = user_id`; no policy change. |
| Live presence | Unchanged — friends only, ghost mode, existing visibility rules |
| `night_posts` | Per-post `visibility`, **default `school`** — matched on `profiles.college_slug`. `everyone` is opt-in per post. |
| Check-in timestamps | **Nobody but the author, via any path** |

The 2026-08-05 policy is not modified by this feature. That is a hard
requirement, not a preference: it was a launch-gate fix.

## Moderation

First user-written text and imagery about **named real businesses**, visible to
other users. Two drivers: Apple requires UGC moderation and §31 is live; and a
false claim about a real bar needs a takedown path.

- Extend the report flow shipped 2026-08-05 to cover posts, notes, and photos
- Author can delete their own post
- Character cap; **no links** (link fields are a spam vector)
- Post moderation surfaces in the existing admin dashboard

The §32 spec cut free-text self-describe as "a moderation surface with no
personalization payoff." Here the payoff *is* the feature — so the surface is
justified, and the moderation path ships with it.

## Cold start — why the default is school

An empty feed is worse than no feed, and a friends-only default would leave
most early mornings blank. **Campus scope is the fix**, and it needs no new
data: `profiles.college_slug` is already captured by the onboarding picker
(145 schools, `scripts/colleges-seed.sql`).

Public-by-default was considered and rejected (Colton's question, 2026-08-06):

- A browsable record of which bars a 19-year-old visits, and when she is out,
  is legible as a **routine** after a few weeks even at day granularity. Bars at
  1am with a college user base is a materially different risk profile from
  Beli's restaurants at 7pm.
- **The change is one-way.** Narrow → wide later reads as a feature; wide →
  narrow later is a trust event, because the earlier posts were already seen.
- Apple scrutinises **public** UGC in apps with young users far harder than
  scoped UGC, and §31 is live.

Campus scope also produces *better* content than public would: HWS students in
the East Village are more relevant to each other than a stranger across town.

- The author's own recap always renders
- School posts fill the feed from day one
- `everyone` stays available opt-in, per post, for users who want reach

**Pre-build check:** campus scope is only as good as the field behind it. Before
building, measure real `college_slug` coverage on live signups. If a meaningful
share is null or junk, the tier is leaky and closer to public than it looks —
in which case tighten to friends and revisit, rather than shipping a boundary
that does not hold.

## Acceptance criteria

- A user who checked in last night sees an accurate recap; one who did not sees
  no card
- Ratings 1–3 never trigger a comparison; the 4th does, and no comparison ever
  crosses buckets
- A skipped venue writes no `night_posts` row
- A friend's feed shows venue, score, note and photos — and **no check-in
  timestamp is reachable from any client query**
- A post left at the default is visible to same-school users and **not** to a
  signed-in user at another school; a post set to `everyone` is visible to both
- A user with a null `college_slug` never sees, and is never seen in, another
  school's scoped posts
- Live check-in visibility is **unchanged** — `CheckinVisibility` keeps its
  three values and its existing default
- An uploaded photo carries **no EXIF** in storage, verified against a real
  camera photo
- Every post is reportable, and deletable by its author
- Night-window grouping, comparison insertion, and score derivation are
  unit-tested (vitest is already in the project)

## Out of scope

- §3 consuming `venue_ratings` — this spec writes, §3 reads
- Natural-language "find the vibe" input
- §32 onboarding taste capture (separately specced, merged, unbuilt)
- Promoting user photos to **venue** imagery. It is the obvious eventual answer
  to the venue-photography problem parked on 2026-08-05, and it needs its own
  gate: consent, rights, and moderation are all different when a photo
  represents a business rather than a night.
