# Host guest-list editing — design

**Date:** 2026-07-21
**Feature:** §21 follow-up — let a plan host manage the guest list after creation
(remove a guest, add more invitees). Relates to §21 Group Plans.
**Status:** APPROVED (Colton, 2026-07-21 gate). Build on branch `feat/plan-guest-editing`.

## Problem

Today a §21 plan's guest list is fixed at creation. Invites are chosen once in
`CreatePlanSheet`; the Edit sheet hides the friend picker ("invite changes out of
MVP scope"). `PlanDetailSheet`'s "Who's in" list only renders people who have
**responded** (`rsvp !== null`), so invited-but-unanswered guests are invisible,
and there is no way to remove anyone. Hosts need to fix a wrong invite and pull in
someone they forgot — without cancelling and remaking the plan.

## Scope (approved)

Two host-only capabilities, both surfaced in `PlanDetailSheet`:

1. **Remove a guest** — an × on each guest row.
2. **Add more invitees** — an inline `+ Invite friends` control under the roster.

Non-host viewers see no change. No new DDL — the backend already permits both.

Explicitly **out of scope:** push/notification to the removed or added person
(§21's no-push deferral holds); editing a guest's RSVP on their behalf; removing
the host (that is "cancel plan", which exists); changing the Edit sheet.

## Decisions locked (gate)

1. **Host sees the full roster.** The host view gains a second group,
   **"Invited · no answer yet"**, listing invited members with `rsvp === null`.
   Combined with the existing responded list, the host sees everyone and can remove
   anyone. Non-hosts still see only responded names (or counts when the list is
   hidden) — the pending group and the × are **host-only**, so we never leak who
   was invited but did not answer.
2. **Remove is instant with deferred-delete undo.** Tapping × hides the row
   immediately and shows a `Removed [name] · Undo` toast (~5s). The DELETE fires
   only when the undo window closes; Undo cancels the pending delete so no write
   happens. This gives true undo for every case — including guests who already
   answered and link-only guests the host cannot re-create under RLS. Closing the
   sheet commits any still-pending removals.
3. **Add is co-located and add-on-tap.** `+ Invite friends` expands an inline
   checklist of accepted friends **not already on the roster**; tapping one invites
   them immediately (insert `rsvp=null`). No Save step. The Edit sheet is untouched.
4. **The host's own row has no ×** (removing self = cancel plan).

## Architecture

No schema or RLS changes. The relevant policies + grants are already live:

- **Remove:** RLS `"own row or host deletes rsvp"` (`using (user_id = auth.uid()
  or public.is_plan_host(plan_id))`) + table DELETE grant. Works on any row on the
  host's plan — member invites, responded members, and link-guests (`guest_name`).
- **Add:** RLS `"host invites accepted friends"` (host may INSERT rows for accepted
  friends, `rsvp is null`, no guest columns) + table INSERT grant.

Both are plain PostgREST DELETE/INSERT — neither reads `guest_secret`, so neither
hits the table-SELECT wall that forced the RSVP/approve writes onto RPCs. No RPC
needed here.

### Data layer — `src/lib/plans.ts`

- `removeGuest(rsvpId: string): Promise<void>` — `delete from plan_rsvps where id =
  rsvpId`, `.select("id")` count-check; throw `"Couldn't remove that guest"` on 0
  rows (RLS blocked / already gone). Functionally the same shape as `denyRequest`;
  kept as its own named function for call-site clarity.
- `addInvitees(planId: string, friendIds: string[]): Promise<void>` — insert
  `friendIds.map(id => ({ plan_id: planId, user_id: id }))` (rsvp defaults null).
  Empty `friendIds` is a no-op. The picker pre-filters roster members, so a unique
  `(plan_id, user_id)` conflict is only a rare race (a concurrent request-to-join);
  it surfaces as a thrown error the hook turns into a toast. Plain INSERT (not
  upsert) to avoid the ON-CONFLICT table-SELECT requirement.

### Hooks — `src/hooks/usePlans.ts`

- `useRemoveGuest()` — mutation over `removeGuest`, invalidates the plan feed query
  on success.
- `useAddInvitees()` — mutation over `addInvitees(planId, friendIds)`, invalidates
  the plan feed on success.

### UI — `src/components/social/PlanDetailSheet.tsx`

The bulk of the work. Host view only (`isHost`):

**Roster grouping.** Keep the existing `responded`/`ordered` (going→maybe→can't)
as "Who's in". Add `pendingInvites = rsvps.filter(r => r.rsvp === null)` rendered
under an "Invited · no answer yet" subheading. Non-host render path is unchanged.

**× remove + deferred delete.** Local state in the component:
- `pendingRemovals: Set<string>` — rsvpIds hidden optimistically.
- A per-removal timer (`Map<rsvpId, timeoutId>`), tracked in a ref.
- Render filters both groups by `!pendingRemovals.has(r.id)`, so a react-query
  refetch (focus refetch) can't resurrect a row mid-window.
- On ×: add id to `pendingRemovals`, start a ~5s timer, show a sonner toast with an
  `Undo` action. Timer fire → `useRemoveGuest().mutate(id)` then clear the id/timer.
  Undo → clear the timer + remove the id from `pendingRemovals` (row reappears); no
  DB write occurred.
- On sheet close / unmount with pending removals: flush — fire the deletes
  immediately (a `useEffect` cleanup over the timer ref). Committing on close is the
  documented behavior; Undo is only available while the sheet is open.
- The × is omitted on the host's own row (`r.user_id === plan.creator_id`).

**+ Invite friends.** A control under the roster that toggles an inline checklist
(same visual pattern as `CreatePlanSheet`'s invite list, kept local — the two
pickers differ enough, create = select-then-submit vs detail = add-on-tap, that a
shared abstraction is not worth it for MVP). The list is
`friends.filter(f => !rosterUserIds.has(f.profile.id))` where `rosterUserIds` is the
set of `user_id`s currently on the plan (minus pending removals). Tapping a friend
calls `useAddInvitees().mutate({ planId, friendIds: [f.id] })`; on success the feed
invalidates and the new row appears in "Invited · no answer yet" (and the friend
drops out of the picker). Friends come from `useMyFriendships` + `deriveFriends`,
as in `CreatePlanSheet`.

## Error handling

- Remove: DELETE 0-rows → the mutation throws → toast `"Couldn't remove that
  guest"`, and the optimistic hide is rolled back (id removed from
  `pendingRemovals`).
- Add: INSERT error (including a race `23505`) → toast `"Couldn't add — try
  again"`; roster is unchanged.
- Backend-not-configured / offline → existing `getSupabase()` guard + generic toast.

## Testing / verification

Branch `feat/plan-guest-editing`. `npx tsc --noEmit -p tsconfig.app.json` +
production build green. Live-verify against Colton's signed-in session:

Host-side (single account, fully drivable):
- Create a plan, invite the second account via `+ Invite friends` → appears under
  "Invited · no answer yet"; the friend drops out of the picker.
- × a pending invite → row hides, `Undo` toast → Undo restores it (verify no row
  was actually deleted); × again and let the window close → row is gone after
  refetch.
- × on a responded guest and on the host's own row is absent for the host row.

Cross-account (needs the 2nd account — Colton confirms):
- Removed guest loses access to the plan; re-added guest sees it again.
- A guest who already answered can be removed and their answer disappears from the
  count.

## Files touched

- `src/lib/plans.ts` — `removeGuest`, `addInvitees`.
- `src/hooks/usePlans.ts` — `useRemoveGuest`, `useAddInvitees`.
- `src/components/social/PlanDetailSheet.tsx` — roster grouping, × + deferred
  delete, inline add picker.
