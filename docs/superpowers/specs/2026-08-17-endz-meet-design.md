# ENDZ Meet — design

**Date:** 2026-08-17
**Status:** SCOPED, NOT APPROVED, NOT SCHEDULED. Colton, 2026-08-13: *"this is not
for right now but for much later."* Nothing in this document is cleared for build.
The Product-Discussion Gate still applies when it is picked up.
**Relates to:** §11 (demographics), §14 (profile), §15 (social), §21 (plans),
§22 (DMs), §28 (crowd-sourced data), §31 (iOS App Store), §32 (onboarding taste
capture), §34 (log-night sheet).
**Tracker:** §35.

---

## 1. The thesis

Hinge asks people to *describe* themselves. ENDZ already *watches* — with consent —
where they actually go, which bars they rank highest, which nights they're out, and
which neighborhood they live their weekends in.

> Every dating app is guessing at compatibility from self-report.
> ENDZ has the receipts.

That is the whole pitch, and it is real. But it is only real if the design keeps two
promises at once: the matching has to *use* the behavioral data, and the product has
to never once become a way to find out where a specific person is.

Section 6 is the most important section in this document.

---

## 2. What the data actually supports (audited 2026-08-17)

| Table | Columns that matter | Meet uses it for |
|---|---|---|
| `venue_ratings` | `bucket` (great/good/not_great), `score`, `rank_position` | **Taste signal.** Already a *ranked* list per user. Owner-only RLS today. |
| `check_ins` | `user_id`, `venue_id`, `created_at`, `expires_at`, `visibility` | **Scene + Rhythm signals.** Retained forever. Aggregated only — never exposed row-wise. |
| `venue_saves` | `user_id`, `venue_id` | **Scene signal** (intent without a visit). |
| `venues` | `neighborhood` (8-value vocabulary) | **Area signal.** |
| `plans` / `plan_rsvps` | `planned_at`, `venue_id` | **Forward-intent signal**, for free. |
| `profile_private` | `birthday`, `gender` | Age + gender preference. Owner-only RLS today — **this is the one that has to change shape.** |
| `profiles` | `username`, `avatar_url`, `ghost_mode` | Identity, and the ghost-mode exclusion. |
| `night_posts` + photos | user content | *Not used by Meet.* See §9 out-of-scope. |
| `reports` | existing report pipeline | Reused wholesale for Meet safety. |

**Everything the matching engine needs except forward intent already exists.**
No new collection is required to compute a compatibility score.

---

## 3. Product shape

One surface, two temperatures.

### 3.1 The feed (the product)

A Hinge-shaped card stack. Each card is one person: first name, photos, and — the
part nobody else can render — **their spots**. A card carries a compatibility
readout stated in plain language, never as a number:

> *"You both rank Amor y Amargo top 3."*
> *"You're both East Village on Thursdays."*
> *"They're out this weekend too."*

The feed is always populated. It works today, at any user count, off ratings alone.

### 3.2 The promoted card (the magic)

When two Meet members were **actually in the same venue on the same night**, that
card is promoted to the top of the stack for 72 hours and badged:

> *"You were both at Amor y Amargo on Friday."*

This is Colton's original image — the girl at the bar you never see again. It is
deliberately **not** the foundation of the product, for two reasons:

1. **It requires both people to have checked in.** The person you never see again is
   exactly the person least likely to have opened the app and tapped "I'm here." Until
   auto check-in exists (native app, §31), this fires rarely and honestly.
2. **Density.** Co-presence is quadratic in user count. At ~12 users the co-presence
   graph is empty; at 300 it is thin; the soft signals in §4 work at all three.

Design so the badge slots in the day auto check-in lands, and be honest in the interim
that it is rare. Rare is fine — rare is what makes it worth screenshotting.

---

## 4. The matching engine

A blended score, not one overlap test. Five signals, each independently degradable, so
a brand-new user with zero ratings still gets a populated feed.

| # | Signal | Weight | Computed from | Method |
|---|---|---|---|---|
| 1 | **Taste** | 40 | `venue_ratings` | Rank-weighted overlap of the two ranked lists, **positive signal only**. A shared `great` at rank 1 counts far more than a shared `good` at rank 20. `not_great` is ignored entirely — a disagreement never subtracts, and a shared dislike never adds. |
| 2 | **Scene** | 20 | `check_ins` ∪ `venue_saves`, as a *set* | Jaccard over distinct venue sets. "We go to the same bars at all," independent of when. |
| 3 | **Area** | 15 | `venues.neighborhood` via 1+2 | Cosine over normalized neighborhood weight vectors. |
| 4 | **Rhythm** | 15 | `check_ins.created_at` | Cosine over a day-of-week × hour-band histogram (bands: pre-9, 9–11, 11–1, after-1). "You're both out Thursday late" vs "she's Saturday brunch." |
| 5 | **Forward intent** | 10 | `meet_intent` + `plans` | Same weekend, and/or same declared area. Carries the **visiting** case: *"in the East Village this weekend"* surfaces locals to a visitor and vice-versa. |

Base score is 0–100. **Co-presence is not part of the 100** — it is a separate promotion
tier (§3.2), so it can never quietly dominate the ranking.

### 4.1 Signal 5 is the only new collection

A lightweight toggle in Meet: *"Out this weekend"* / *"Visiting"* + optional
neighborhood, expiring automatically at the end of that weekend. If the user already
has a `plans` row for that window, it prefills — never ask twice for something the
app knows.

This is small, and it earns its keep by being the entire travel use case.

### 4.2 Cold start

Weights renormalize over whatever signals exist. Zero ratings and zero check-ins still
leaves Area (from onboarding's favorite-spots capture, §32) and Forward intent. Nobody
is ever shown an empty feed because they haven't rated anything.

### 4.3 ⚠️ The scoring function must never be a pairwise oracle

A compatibility score between two people is *exactly* the shape of the
`are_friends(a, b)` trap ([[endz_friend_lists]]): a SECURITY DEFINER function taking two
arbitrary person ids, callable in a loop to reconstruct private data about strangers.
A `meet_compatibility(a, b)` function would let any signed-in user learn any two
people's venue ratings by differencing scores.

**House pattern, non-negotiable here:**

- `meet_candidates(limit, cursor)` takes **no person argument**. It resolves the
  caller via `auth.uid()` internally, applies eligibility, and returns a ranked page.
- The score is computed server-side and returned only for candidates the caller is
  already eligible to see.
- No function anywhere exposes a score, a signal, or a boolean about a pair the caller
  is not a member of.
- Every definer function: `security definer`, `set search_path = public, pg_temp`,
  `revoke execute from public` **and** from `anon` (Supabase grants `anon` EXECUTE
  explicitly — [[endz_revoke_public_misses_anon]]).

---

## 5. Profile model

**One profile underneath, a different face on it.** (Colton's call, 2026-08-13.)

The Meet-facing view is *not* the social profile:

| | Social profile (`/profile`) | Meet card |
|---|---|---|
| Name | Display name + `@username` | **First name only** |
| Photo | Avatar | Dedicated Meet photos (private bucket) |
| Spots | Been / Saved / ranked lists | **Favorite spots** — curated, capped |
| Activity | Night posts, tags, friends | **None** |
| Link between the two | — | **None** — not even after a match, until both sides unmask (see below) |

A Meet card must not be resolvable to a `@username`, a friends list, or a night-post
history. Unmasking to the full social profile is a **separate mutual action after a
match**, not an automatic consequence of matching.

Photos live in a **private** bucket with signed URLs, same posture as night-feed photos
([[endz_night_feed]]). Not the public avatars bucket.

---

## 6. Privacy and safety model — the load-bearing section

ENDZ today is privacy-forward by construction: `ghost_mode`, check-ins default to
`friends`, `venue_ratings` / `profile_private` are owner-only. Meet inverts that posture
for the people who opt into it. These rules are what make that inversion survivable.

### 6.1 The brightest line

> **Meet never reveals where anyone is now, or is going to be.**

No "here now." No live presence. No "she's at this bar tonight." Not as a feature, not
as a badge, not as a side effect of anything. The moment ENDZ Meet can answer *where
is this specific person right now*, it is a stalking tool, and every other safeguard in
this document is decoration. Real-time presence stays on the friends layer, where it is
mutual by construction.

### 6.2 Aggregates out, rows in

Signals 2, 3 and 4 read `check_ins` **row-wise on the server** and emit only
aggregates. What a Meet client can ever receive:

- ✅ "goes out Thursdays in the East Village"
- ✅ "you overlap on 4 of the same spots"
- ❌ a venue list with dates
- ❌ a timestamp of any kind
- ❌ a count of visits to a named venue

The precomputed aggregate tables (§7) exist partly for performance and mostly so that
there is no code path where a Meet query touches raw `check_ins` rows for another user.

### 6.3 The co-presence badge is the one exception, and it is fenced

The badge in §3.2 does name a venue and a night. It fires only when **all** hold:

1. Both users have joined Meet **and** enabled the co-presence sub-toggle (separate
   from joining — joining Meet does not consent to this).
2. Neither had `ghost_mode` on at the time.
3. Neither check-in was `visibility = 'private'`.
4. The overlap is ≥ 20 minutes and within the last 72 hours.
5. It states **venue + day** ("Friday"), never a time, never a duration, never a count.

If any condition fails, the pair still matches on soft signals — it just isn't badged.

### 6.4 Membership is opt-in and invisible

Joining is an explicit action inside the app (Colton's call). A non-member is not in the
candidate pool, is not scored, and does not appear in any Meet index — not "hidden," not
present at all. Leaving Meet purges the derived aggregates, not just a flag.

Whether *friends* can see that you're on Meet is an open question — see
"Open questions" at the end of this document.

### 6.5 Demographics

Meet requires reading other people's `gender` and age, which `profile_private` forbids
today. This is a **deliberate, narrow widening**, not a policy loosen:

- A definer function exposes **age as an integer and gender as a label**, for
  Meet-joined candidates only, to Meet-joined callers only. Never `birthday` itself —
  a date of birth is an identity document field, not a profile field.
- Preference model: *show me women / men / everyone*, plus an age range. Colton's
  "leaning opposite gender" is the **default value**, not a restriction — same-gender
  and everyone are first-class.
- Hard 18+ floor, matching the onboarding floor ([[endz_onboarding_taste_capture]]).
  No birthday on file ⇒ cannot join Meet.

### 6.6 Blocking, reporting, unmatching

- **Blocks are global and symmetric.** A Meet block is a social block and vice-versa.
  There is no world where someone you blocked reaches you through the other surface.
- A blocked pair is removed from each other's candidate pool *before* scoring, the way
  the collab branch sits inside the not-blocked guard ([[endz_collab_tags]]).
- **Report from every Meet surface** — card, match, conversation — through the existing
  `reports` table. §31 blocker 4 already built the flow.
- **Unmatch is one-sided, immediate, and silent.** No notification to the other party.
  Conversation disappears for both.

### 6.7 What review will ask

Apple treats dating as its own category with extra scrutiny, on top of §31 which is
already mid-flight. Expected asks: 18+ age gate, in-app reporting **and** blocking,
a moderation response commitment, and a privacy nutrition label that now declares
precise-ish location history *used for matching*. Budget for this; do not discover it
at submission.

---

## 7. Schema sketch

Not DDL. Nothing here gets created until the gate passes.

**Membership + profile**
- `meet_profiles` — `id` (FK `profiles`), `joined_at`, `status` (`active` / `paused` /
  `left`), `first_name`, `seeking` (`women`/`men`/`everyone`), `age_min`, `age_max`,
  `copresence_enabled` (default **false**), `left_at`
- `meet_photos` — `profile_id`, `storage_path` (private bucket), `position`
- `meet_prompts` — `profile_id`, `prompt_key`, `answer`
- `meet_favorite_spots` — `profile_id`, `venue_id`, `position` (curated, capped ~5;
  seeded from `venue_ratings` but user-editable, because your top-rated bar and the bar
  you want a stranger to know about are not always the same)

**Derived signal aggregates** (server-written, never client-written)
- `meet_taste_vector` — `profile_id`, `venue_id`, `weight`
- `meet_area_vector` — `profile_id`, `neighborhood`, `weight`
- `meet_rhythm` — `profile_id`, `dow`, `hour_band`, `weight`
- `meet_scene` — `profile_id`, `venue_id` (set membership)

**Intent**
- `meet_intent` — `profile_id`, `weekend_of` (date), `neighborhood`, `kind`
  (`local` / `visiting`), `expires_at`

**Interaction**
- `meet_likes` — `liker_id`, `likee_id`, `target_kind` (`profile`/`photo`/`prompt`/
  `spot`), `target_ref`, `note`, `created_at`
- `meet_passes` — `passer_id`, `passed_id`, `created_at` (so you don't re-see)
- `meet_matches` — pair (ordered, `least/greatest` to make it canonical), `matched_at`
- `meet_conversations` / `meet_messages` — see §8
- `meet_copresence` — materialized overlap events, `venue_id`, `night`, both ids,
  written only when §6.3 conditions hold

**RLS posture:** every table `enable row level security`, every policy explicitly
`to authenticated` ([[endz_anon_everyone_leak]]). Reads of *other people's* rows go
exclusively through definer functions per §4.3 — no policy on `meet_profiles` ever
widens to "any Meet member can select any Meet member," because that is a scrape.

**Any view added here gets named columns, never `select *`** — and note that
`create or replace view` drops the security lines ([[endz_star_view_trap]]).

---

## 8. Messaging

Colton's call: *"there should be a meet part of DMs where there's DM requests like
Instagram."*

- Meet DMs live **inside the same DM surface** as the eventual §22 messaging, in a
  separate **Requests** tab.
- A match does **not** open a thread. Either party may send; the first message lands in
  the other's **Requests**, not their inbox. Accepting promotes it to the inbox.
- **Text only in a request.** No photos, no links until accepted. This kills the single
  most common harassment vector on day one, for free.
- Rate-limited outbound requests per user per day.
- No read receipts, no typing indicators. Deliberate — they create pressure and leak
  behavior.
- Declining a request is silent to the sender.

This resolves §22 for the narrow, high-value case without opening general messaging
between arbitrary users — which remains NOT DISCUSSED.

---

## 9. Explicitly out of scope (YAGNI)

Cut on purpose, listed so they don't get re-litigated: video profiles, voice notes,
in-app calling, boosts / super-likes / any paid tier, "see who liked you" paywall,
distance-radius sliders (neighborhood granularity is the product), group meetups,
events integration, algorithmic re-ranking sold as a feature, and any use of
`night_posts` content in a Meet card.

---

## 10. Prerequisites and sequencing

Meet does not start until all four hold.

| # | Prerequisite | Why | Status |
|---|---|---|---|
| A | **§31 native app shipped** | Dating is not a PWA-first product; App Review scrutiny is easier to absorb once, not twice. | In progress |
| B | **Density floor** | Recommend **~300 opted-in Meet members in the beachhead** before launch. Below that the feed is visibly empty and it burns the one launch you get. | Not met (~12 users total) |
| C | **§22 messaging decision** | §8 resolves the narrow case, but it needs the gate. | Not discussed |
| D | **Moderation capacity** | A solo founder plus a dating product is a real, recurring ops load. Report volume is not optional work. | Not planned |

Auto check-in (native, §31) is **not** a prerequisite — the §4 signals work without it.
It is what upgrades the co-presence badge from rare to frequent.

**Recommended build order when it starts:** signals + `meet_candidates` (headless,
testable) → membership & profile → feed & like/match → DM requests → co-presence badge
last, since it is the piece most dependent on volume.

---

## 11. Open questions

1. Can friends see that you're on Meet? (Leaning **no** — discoverable membership makes
   people not join.)
2. Photo verification — needed at launch, or when abuse appears?
3. Does unmatching delete message history or just hide it?
4. Do "favorite spots" on a card link to the venue page pre-match? (Leaning **yes** —
   it's the ENDZ-native thing to do, and it costs no privacy.)
5. Monetization — ignored on purpose here; revisit only after retention exists.

---

## 12. Decision log for this document

- **2026-08-13** — Concept raised. Colton: much later, spec only.
- **2026-08-13** — Locked: like → mutual match (Hinge-style); opt-in from inside the
  app; one profile underneath with a first-name/photos/spots Meet face; Meet DMs with
  an Instagram-style request inbox.
- **2026-08-13** — Colton pulled matching back from exact same-venue-same-hour
  co-presence to **soft signals** — same favorite bars, same nights out, same area,
  plus a forward-looking *visiting this weekend* case. Exact co-presence demoted to a
  promoted badge. This removed the auto-check-in dependency from the core product.
- **2026-08-17** — Spec written.
- **2026-08-17** — Colton: **likes only.** `not_great` is out of the matching engine
  entirely — no shared-dislike bonus, no disagreement penalty. Scoring stays a simple
  positive-overlap sum for now; a real algorithm is later work.
