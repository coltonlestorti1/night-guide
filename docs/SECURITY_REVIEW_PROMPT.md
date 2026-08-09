# Full security, privacy and correctness review — ENDZ

*Paste this into a fresh session. Written 2026-08-09 after a large social-feature
push. Reusable — update the "recent surface" section as things ship.*

---

You are performing a full security, privacy and correctness review of ENDZ, a
nightlife map and social app for college-age users in the East Village, NYC.
Code lives at `~/Documents/night-guide`. Product context is in
`~/Documents/endz/CLAUDE.md`; repo rules in `night-guide/CLAUDE.md`.

**Read `night-guide/CLAUDE.md` first.** It carries the multi-session git rules
(always work in a worktree, absolute paths) and the "ask for a screen recording
before diagnosing anything on a phone" rule. Both apply to you.

## What matters here, in order

1. **Can one user read another user's data they should not?** This app is
   friends-only right now, with real people's live locations, check-in history,
   private notes, photos, birthdays and school. A leak is the failure that
   matters most.
2. **Can anything reach an anonymous caller holding only the publishable key?**
3. **Can a non-admin reach the admin panel or its writes?**
4. **Are there bugs that silently produce wrong output** rather than visibly
   failing?

## Scope

**Database (19 tables, 1 view):** `profiles`, `profile_private`, `venues`,
`check_ins`, `friendships`, `plans`, `plan_rsvps`, `venue_saves`,
`venue_ratings`, `reports`, `events`, `venue_requests`, `venue_hour_stats`,
`colleges`, `night_posts`, `night_post_photos`, `night_comments`,
`night_post_likes`, `night_post_tags`. View: `active_check_ins`.

**~14 SECURITY DEFINER functions.** Each one bypasses RLS by design. Enumerate
them all and justify each: does it take a caller-supplied user id it should not
(letting someone probe another user's graph)? Is `EXECUTE` revoked from
`public`/`anon`? Does it have `set search_path`? One of them,
`post_has_collab_for_me`, was added on 2026-08-09 specifically to break an RLS
recursion — check its blast radius.

**Storage buckets:** `avatars`, `night-photos` (MUST stay private, signed URLs
only), `venue-photos`. For each: is it public or private, and does that match
what the code assumes?

**Edge functions:** `places-search`, `plan-guest`.

**Admin panel:** `src/admin/` — `AdminOverview`, `AdminVenues`, `AdminQuality`,
plus `src/admin/data/*`. Who is allowed in, and is that enforced by the
DATABASE or only by the client route guard? Assume an attacker calls the API
directly with a normal user's token.

**Client-exposed secrets:** anything in the bundle that should not be. Note
that `VITE_SUPABASE_PUBLISHABLE_KEY` is public BY DESIGN — do not report it as
a finding. Look for anything else: service-role keys, API keys, tokens.

## This project's actual history — the bodies are buried here

These are real incidents. Check each class again; do not assume a past fix
covers today's code.

- **A view bypassed RLS.** `active_check_ins` was created without
  `security_invoker`, so it ran with its OWNER's privileges. An anonymous
  caller with only the publishable key read a live, friends-only check-in.
  **The audit that cleared the launch gate missed it because it probed base
  TABLES, not views.** Probe the view by name.
- **A `select *` view froze its column list** at creation, so later
  `ADD COLUMN`s were invisible and a feature silently broke.
- **A storage bucket shipped PUBLIC** with a confident code comment claiming
  "the row is the gate" — false. A public bucket serves the file to anyone with
  the URL regardless of any table policy.
- **Two RLS policies referenced each other** and caused `42P17` infinite
  recursion, taking the live feed down (2026-08-09).
- **A write that matched zero rows returned success.** `setVibe()` was silently
  broken for weeks because RLS refused the UPDATE and nothing threw. Look for
  any write that does not check rows affected.
- **A report flow claimed success for a row it discarded** (fixed 2026-08-09) —
  look for other places a swallowed error code becomes a false success.
- **An RLS test harness ran as `admin` instead of `authenticated` and reported
  a false result.** A test running as the table owner bypasses RLS entirely.

## Method — proof, not assertion

- **Prove RLS by role-impersonation, in a rolled-back transaction.**
  `set local role authenticated` + `set_config('request.jwt.claims', ...)`.
  Working examples: `scripts/2026-08-07-night-posts-rls-test.sql`,
  `scripts/2026-08-09-collab-tags-rls-test.sql`. **Copy their `role_at_op`
  column**, which surfaces `BAD HARNESS: ran as <role>` so a wrong-role run can
  never be mistaken for a policy verdict.
- **You cannot run SQL yourself** — only the anon key exists locally. Write
  scripts, `pbcopy` them, and have Colton paste them. The Supabase editor
  **does not display `raise notice`** and **shows only the LAST result set**,
  so return answers as one result set placed immediately before the `rollback`,
  with nothing after it.
- **Probe as an ANONYMOUS caller too**, not just as a signed-in user. That is
  how the check-in leak was found.
- **An empty result is not proof.** Zero rows can mean "correctly denied" or
  "my query was broken." Prove the query works by running it in a case where it
  SHOULD return rows, then assert the denial case.
- **Verify in a browser for anything user-facing.** This suite is structurally
  blind to this app's real failures: a component that rendered nothing, a
  frozen view, and a native file dialog all passed 300+ green tests.

## Also report

- **Correctness bugs** that produce silently wrong output — wrong counts, stale
  caches, an error state that renders the same copy as an empty state (this has
  been a real Critical here twice).
- **Privacy-by-design gaps**, not just access-control holes: does anything
  expose a timestamp, precise location, age, or school that the product
  deliberately withholds? `night_posts` stores a DATE, never a time, on
  purpose. Photos are canvas re-encoded to strip EXIF GPS — verify that still
  happens on every upload path.
- **Anything that widens an audience the author chose.** Narrow→wide is the
  trust event this app is built to avoid.

## Output

Findings classified **Critical / Important / Minor**, each with the file and
line, and a **concrete exploit or failure scenario** — specific inputs or
state producing the wrong outcome. Rank most severe first.

State plainly what you could NOT verify and why. A clean review that quietly
skipped the storage buckets is worse than one that says "buckets unverified."

**Do not fix anything.** Report first; fixes get their own pass with their own
review.
