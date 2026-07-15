# Night Recap — Feasibility Prep (2026-07-14)

Prep doc for the backlog item "Night Recap" (morning-after bars-visited +
ranking). **Nothing here is approved or built.** This one touches the protected
core check-in loop, so it gets extra care.

---

## Why it's blocked today

`src/lib/checkins.ts`: both `checkIn()` (lines 49–53) and `checkOut()` **DELETE**
the user's active check-in rows. Moving to a second bar erases the first — by
morning there is at most one row left, so there's no trail to recap.

## The delete→expire change

Replace both DELETEs with `update check_ins set expires_at = now() where
user_id = ? and expires_at > now()`. Everything downstream is already built for
this:

- The schema keeps `created_at` + `expires_at` per row, and **all reads go
  through the `active_check_ins` view**, which filters expired rows — expired
  history rows are invisible to the live map/friends surfaces by construction.
- "One place at a time" still holds: expiring actives before inserting the new
  row is equivalent to deleting them.
- RLS SELECT policy's first arm is `auth.uid() = user_id` with no expiry
  condition — you can already read your own full history, so the recap query
  needs **no RLS change**. Others can theoretically read your expired
  `everyone`/`friends` rows too (the policy doesn't check expiry), which is fine
  only because every surface queries the view — worth tightening the policy
  anyway when we're in there (privacy principle: no individual trails visible
  to others).

**⚠ Bug found during this audit, exists today regardless of recap:**
`check_ins` has RLS enabled but **no UPDATE policy** — and `setVibe()`
(`checkins.ts:72`) UPDATEs `check_ins.vibe`. Under Postgres RLS that update
silently affects 0 rows: **setting a vibe after check-in almost certainly
no-ops in production.** (Caveat: verified against `endz-schema.sql`, which is
the DDL record; a live test on two accounts confirms it in one minute.) The
delete→expire change needs an UPDATE policy anyway, so one patch fixes both —
but the setVibe fix shouldn't wait for recap.

## What recap needs beyond that

1. **DDL (clipboard → SQL editor, needs approval):** UPDATE policy on
   `check_ins` (fixes setVibe too; scope it so users can't forge history —
   e.g. can set `vibe`, can only move `expires_at` earlier, never touch
   `venue_id`/`created_at`). Optionally tighten the SELECT policy to
   own-rows-only for expired check-ins.
2. **Ratings table (new, needs approval):** `night_ratings` — user_id,
   venue_id, check_in_id?, rating, night-of date, created_at; RLS
   **private-to-self on every verb** (recap trail is never visible to others,
   per the locked privacy principles).
3. **"Night" boundary logic:** a night spans midnight — define e.g.
   6 PM → 6 AM local as one night and group check-ins accordingly.
4. **Recap UI:** morning-after view listing last night's venues in order +
   tap-to-rank. Where it lives (Social page? notification-less PWA = shown on
   next open?) is a product question.
5. **Retention decision:** history now accumulates forever — keep (it's the
   future ranking signal the WeekendFavorites comment explicitly waits for) or
   cap (e.g. 90 days)?

## Suggested sequencing

The setVibe RLS bug fix is small, urgent, and independent — patch candidate now.
Delete→expire + UPDATE policy is a compact, reversible step that starts
*accruing* history immediately even before any recap UI exists — the recap gets
more valuable the earlier the trail starts. Ratings table + recap UI is the real
feature discussion (privacy, night boundary, UX) and can come later without
losing data.

## Files & risks

- Touch: `src/lib/checkins.ts` (two DELETEs → expiring UPDATEs),
  `endz-schema.sql` + clipboard DDL (policies, ratings table), new recap
  page/component, `useCheckIns` read hooks for history.
- Risks: this is the **protected core loop** — regression here is worst-case;
  needs the two-account matrix re-test (check in, move venues, check out, vibe
  set, map visibility). Any code querying raw `check_ins` instead of the view
  would suddenly see history rows — audit found reads go through hooks/view,
  re-verify at implementation time.
