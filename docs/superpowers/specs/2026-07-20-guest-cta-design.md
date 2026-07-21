# Guest-page "Welcome to ENDZ" CTA — design

**Date:** 2026-07-20
**Feature:** §21 Group Plans follow-up — signup CTA on the public `/p/:token` guest page.
**Status:** Approved (Colton, 2026-07-20). Build directly (small slice), iterate together.

## Problem

The public plan page (`/p/:token`) is fully functional for signed-out guests, but
dead-ends after RSVP — there's no invitation for a guest to become an ENDZ user.
Real signup is gated on Google OAuth publish (still in testing mode: only
whitelisted users can complete sign-in), so the CTA must be **honest today**
(waitlist capture) and **graduate to real sign-in** once OAuth publishes.

## Decision

Add a compact "Welcome to ENDZ" CTA card to `PlanPage.tsx`.

- **Visibility:** signed-out visitors only (`!session`). Signed-in ENDZ users never see it.
- **Placement:** directly below the primary action block — after the RSVP card on
  active plans, after the "This one's a wrap" card on over/cancelled plans — above
  the "Who's in" guest list.
- **Action today (`SIGNUP_LIVE === false`):** navigate to the existing
  `/join?source=plan` waitlist page. Reuses the polished waitlist funnel + RLS
  anon-insert; `source=plan` tags plan-sourced signups.
- **Graduation later (`SIGNUP_LIVE === true`):** the same button calls
  `signInWithGoogle()` from the auth store instead. Flipping one flag is the only change.
- **Analytics:** `logEvent("plan_cta_click", { surface: "link" })` on tap, so
  plan-sourced signup intent is measurable independent of the waitlist submit.

## Copy (draft — iterate together)

> **Welcome to ENDZ**
> The live map for where the night's actually happening in the East Village.
> `[ Get early access → ]`

Invitation framing ("you just RSVP'd with ENDZ — here's what it is"), not a signup wall.

## Scope

- `src/pages/PlanPage.tsx` — CTA card + signed-out gate + placement.
- `src/lib/constants.ts` — add `SIGNUP_LIVE` flag (default `false`).
- Reuse (no changes): `/join?source=plan`, `waitlist.ts`, `signInWithGoogle` (future branch).

**Not in scope:** inline form, waitlist table changes, `/join` changes, OAuth publish work.

## Acceptance

1. Signed-out visitor on a plan link sees the "Welcome to ENDZ" card below the RSVP block.
2. Tap → lands on `/join?source=plan`.
3. Signed-in ENDZ user sees no card.
4. Over/cancelled plan still shows the card (below the wrap card) for signed-out visitors.
5. Flipping `SIGNUP_LIVE` to `true` routes the button to `signInWithGoogle()` instead
   (verified by reading the branch; not exercised until OAuth publishes).
