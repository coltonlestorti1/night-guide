# "Line reported" — the first live-user signal in Find the Move

**Status:** built 2026-08-10 on Colton's instruction ("what if you just build
it"), with authority to merge and push and no contact until done. Extends §3.
Design calls were made by me under the constraints below and are listed at the
end so Colton can overturn any of them.

## The finding that shaped this

`line_outside` has been one of the five check-in vibes since the vibe enum
gained it, and `venue_activity()` returns a per-vibe tally. Nothing consumed it.
`vibeScore` used the check-in vibe for exactly one thing — `+1` when it EQUALLED
the user's chosen `chill`/`lively`/`packed` — and `line_outside` can never equal
any of those three. **Every line report reached the scorer and was dropped.**

Building this was therefore mostly plumbing, not new capture.

**Blocking question resolved first.** `useCheckIns.ts` carried a comment saying
the tally columns were "Absent until the slice-4 DDL is applied", and
`venue_activity()`'s body exists in no file in this repo. Probing production
with `rpc/venue_activity?select=<col>` settled it: `active_count`,
`latest_vibe`, `vibe_line_outside`, `vibe_packed`, `vibe_dead`, `count_15m`,
`count_45m`, `count_90m` and `rec_yes` all return 200; a control column returns
42703. **The DDL is applied and the comment was stale** — it has been corrected
in place, because it would have sent the next person hunting for schema work
that was already done.

## What the data can and cannot support

The tally counts ACTIVE check-ins, and a check-in stays active for **3 hours**.
The RPC exposes age buckets for a venue's total headcount but **not per vibe**,
so nothing can date an individual line report.

Consequences, and they are hard rules:

- The copy is **"Line reported"** — attributed, past tense, no time claim.
- Never "20 min wait", never "long line", never "there's a line right now".
  `venue_stats.wait_minutes` exists in the types and is populated by nothing.
- The upgrade that removes the limitation is age-bucketed vibe tallies, which is
  DDL. Parked in the tracker, not applied.

## Design

New module `src/lib/move/line.ts`. One shared activity type in
`src/lib/move/activity.ts`.

### Label and rank are deliberately separated

| Reports | Effect |
|---|---|
| 1 (`LINE_MIN_REPORTS`) | Says "Line reported". No rank change. |
| 2+ (`LINE_MIN_TO_SCORE`) | Also moves rank, capped at 1.5. |

**Why a floor of one for the label:** the string is attributed — "Line reported"
is literally true of a single report in a way "Long line" would not be. With ~12
users, a floor of 3 (the `TASTE_MIN_RATINGS` precedent) means the feature never
fires at all.

**Why two before it ranks:** one person, malicious or simply wrong, must not be
able to push a real business down everyone's list. Splitting label from score
handles the troll case without silencing the signal.

### A stated preference beats an inference

Colton's rule from the 2026-08-09 build governs here too. A line is only bad
relative to what the user asked for:

- `vibe === "packed"` → **penalty is zero.** They came for this; a queue is
  evidence they are in the right place. Still labelled — they want to know.
- `vibe === "chill"` → penalty.
- `groupSize === "big"` and no vibe stated → penalty. Six people and a door
  queue is the worst version of this.
- Anything else → label only.

### Character consequences

- **`easy-door` can never be assigned to a venue with a reported line.**
  "Easy door" sitting above a card that reads "Line reported" contradicts
  itself on screen.
- **`worth-it` now also qualifies on a line**, not just the packed headcount
  tier — a queue at the door IS the wait, and it is the more direct evidence of
  one. Its note leads with "People queueing" when there is a line. This is
  Colton's framing: "if you dont mind waiting in line this is the most fun."

### One shared activity type

`vibeScore.ts`, `VibeFinder.tsx` and `move/character.ts` each declared their own
`Record<string, {count, vibe?}>`, and all three silently dropped `vibeTally`.
That narrowing — not the data — is why no line report ever reached the UI. They
now share `ActivityMap` in `move/activity.ts`.

## Testing

24 new tests. The load-bearing ones:

1. No line reports anywhere → output identical to before the feature.
2. One report labels but does not change the score, even for a big group.
3. Two reports sink for chill / big-group-no-vibe, and do **not** sink for
   anyone who asked for packed.
4. A packed-seeking user is still shown the label.
5. `easy-door` is never derived for a venue with a line; it still is without one.
6. `worth-it` qualifies on a line below the packed tier, but not for a poorly
   rated venue.
7. No reason or note contains minutes, hours, or "long line".

Browser-verified against seeded tallies (production has no active check-ins in
daylight): "Line reported" rendered on two venues, "WORTH THE WAIT — People
queueing, and rated 4.4" on one, no line text on the venue without reports, and
no "Easy door" anywhere a line existed.

## Design calls I made — overturn any of these

1. **`LINE_MIN_REPORTS = 1`** for the label. The alternative is 2, which is
   safer for venues and means the feature rarely fires at this user count.
2. **`LINE_MIN_TO_SCORE = 2`** before rank moves.
3. **A line is never a penalty for someone who asked for packed.**
4. **`worth-it` qualifies on a line alone** (with a rating floor of 4.3),
   rather than requiring the packed headcount tier as well.
5. **"People queueing"** as the note wording, over "Line reported" repeated.

## Not done

- Age-bucketed vibe tallies (DDL, parked) — the only way to date a report.
- `dead` and `building` vibes are still discarded. Same shape of fix if wanted.
- No new check-in UI: reporting a line already exists as a check-in vibe.
