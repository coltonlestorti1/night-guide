# ENDZ Admin Dashboard — v1 Design

**Date:** 2026-07-28
**Status:** Approved (Colton, 2026-07-28) — build overnight on `feat/admin-dashboard`
**Scope:** Operator tool, not the 17-section command center

---

## Problem

Colton runs ENDZ's 56 East Village venues by hand. Editing a venue means either a
SQL statement pasted into Supabase or a code change to bundled JSON. There is no
view of which venue facts are real versus guessed, and no way to see what the
`events` analytics table has actually recorded — the table has no client SELECT
policy at all, so nothing can read it outside the Supabase console.

The dashboard is an operator tool for one person. It is not an analytics product
and not a moderation console, because neither has data or users yet.

---

## Reality check: what the data can support today

Backed by real tables: `profiles`, `venues` (56 live), `events`, `check_ins`,
`plans`, `plan_rsvps`, `friendships`, `colleges`, `waitlist`.

Not backed by anything: admin roles (`profiles` has no `role` column), reports and
moderation, venue verification and per-field sourcing, saved bars, happy hours as
records, bar events (`events` is the analytics sink, not bar listings), feature
flags, custom venue requests.

The constraint that shapes everything: **sign-in is not open to strangers yet.**
Google OAuth is still in testing mode pending Colton's publish click, so real-user
counts are approximately zero. Any DAU/WAU/retention/growth chart built now renders
an empty axis and teaches nothing. Those are deferred, not designed-then-hidden.

Two facts discovered during the audit that changed the design:

1. **`events` has no SELECT policy.** The table is INSERT-only from the client by
   deliberate design (same as `waitlist`). Reading it from an admin page requires
   new SQL — either an admin-gated SELECT policy or a security-definer RPC. This
   spec uses an admin-gated SELECT policy plus a small aggregate RPC, so the client
   never pulls raw event rows just to count them.

2. **Heat baselines and Google enrichment are bundled JSON, not DB rows.**
   `src/data/activity/baseline.json` and `src/data/enrichment/enrichment.json` are
   both keyed by venue title. Of 56 baselines, **41 are `archetype_default`** —
   i.e. an educated guess from the venue's archetype, not researched — and only
   **11 have a real busy window**. That is the single most valuable thing an
   operator dashboard can show, and it needs zero new schema.

---

## v1 scope

Five pieces, in build order.

### 1. Auth + role gate

`profiles` gains a `role` column (`user` | `admin` | `super_admin`, default `user`).
A `public.is_admin()` security-definer helper answers "is the caller an admin" for
use inside RLS policies without recursive `profiles` reads.

Client side: a `useAdmin()` hook reads `profiles.role`. It **degrades to
non-admin** when the column doesn't exist yet (Postgres `42703`), matching the
existing pattern in `store/auth.ts` for `bio` / `college_slug`. This is what lets
the whole dashboard ship before the DDL is pasted without white-screening the app.

`/admin/*` routes sit behind an `AdminRoute` guard: signed out → redirect to the
map; signed in but not admin → a plain "not authorized" screen, not a 404, so
Colton can tell "the DDL isn't applied" apart from "the route is broken."

Only `colton.lestorti@gmail.com` is seeded as `super_admin`. Adding anyone later is
a one-row `update`, not a refactor.

### 2. Venue management

A sortable, filterable table of all 56 venues with an edit drawer covering every
editable `venues` column: `name`, `type`, `price`, `description`, `music`,
`age_range`, `lat`, `lng`, `neighborhood`, `is_college_scene`, `has_rooftop`,
`has_outdoor`, `is_active`.

Writes need a new admin-gated UPDATE policy on `venues` — today the table is
SELECT-only for authenticated users and every write goes through the service role.

Because no schema is applied overnight, the editor is built against a mock adapter
and the live path is unverified until Colton pastes the SQL. That is called out in
the morning summary as his first smoke test, not hidden.

### 3. Data quality + verification

The piece with the most immediate value and no schema cost. Per venue it scores:

- **DB completeness** — which of the `venues` columns are actually populated.
- **Enrichment** — present or missing, and how stale `fetchedAt` is. Google's terms
  cap the cache at 30 days, so anything past ~25 days is flagged for a
  `scripts/enrich-venues.mjs refresh` run.
- **Heat baseline quality** — `source_type`, `confidence_base`, whether a real busy
  window exists, and `last_reviewed` age. The 41 `archetype_default` venues surface
  as a worklist, sorted worst-first.

This view answers "what do I actually know about my own venues," which is the
question Colton hits every time he does venue copy.

### 4. Thin dashboard shell

Overview cards and charts fed **only** by data that exists today: event counts by
name over a date range, check-ins, venue and plan totals, waitlist signups. Where a
number would be zero because nobody can sign in yet, the card says so in words
rather than drawing a flat line. No fabricated metrics — the same project rule that
governs venue stats governs this dashboard.

### 5. Reusable admin component kit

A small set of admin-only primitives (stat card, data table wrapper, section
header, empty state, field row) built on the existing shadcn components and brand
tokens. Consumer pages are not touched.

---

## Deferred, with stub nav slots

Reports/moderation, bar events, happy hours as records, feature flags, social
graph admin, custom venue requests, and the full 5-role RBAC. Each gets a disabled
nav entry explaining what it's waiting on, so the information architecture is
visible without pretending the features exist.

---

## Constraints honored

- **No live Supabase writes.** All DDL is staged in one file for Colton to paste.
- **Desktop-first.** This is an operator tool used at a desk, unlike the consumer
  app, which is one-handed-in-a-dark-bar.
- **Zero changes to consumer pages.** Additive routes and new files only.
- **Branch only.** Commit to `feat/admin-dashboard`; do not push, do not merge.
- **No fabricated data**, in charts or in venue fields.

---

## Acceptance criteria

1. `/admin` is unreachable for signed-out users and for signed-in non-admins.
2. With `role` absent from `profiles`, the app behaves exactly as it does today —
   no console errors, no broken consumer route.
3. The venue table lists all 56 venues from the live source and the edit drawer
   round-trips every editable field through the mock adapter.
4. The data-quality view correctly reports 41 `archetype_default` and 11 venues
   with busy windows against the current bundled JSON.
5. Every dashboard number traces to a real query; empty states are worded, not
   drawn as empty charts.
6. `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build` all pass.
7. All schema changes live in exactly one `.sql` file with no live-DB writes made.
