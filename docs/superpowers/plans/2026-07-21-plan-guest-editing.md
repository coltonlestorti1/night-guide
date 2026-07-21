# Host guest-list editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a §21 plan host remove guests and add invitees after creation, entirely from `PlanDetailSheet`.

**Architecture:** No schema/RLS/DDL changes — the `"own row or host deletes rsvp"` (DELETE) and `"host invites accepted friends"` (INSERT) policies plus their table grants already permit both. Add two thin `plans.ts` functions + two React Query hooks, then extend `PlanDetailSheet` (host view) with a full roster (responded + an "Invited · no answer yet" group), an × per guest that removes with a deferred-delete undo, and an inline "+ Invite friends" add-on-tap picker.

**Tech Stack:** React + TypeScript, @tanstack/react-query, supabase-js (PostgREST), sonner (toasts), lucide-react (icons), Tailwind + shadcn/ui.

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- Production build check: `npm run build`. This repo has **no unit-test runner** — verification is typecheck + build + live browser check (the established ENDZ pattern).
- **No new dependencies.**
- **No DDL / Supabase changes** — the backend already permits these writes.
- Never `select`/`insert`/`update` `guest_secret` from the client (it's excluded from the authenticated column grant).
- Host-only surfaces; non-host viewers must see no change.
- Follow existing file patterns (mutation hooks reuse `useInvalidatePlanViews`).
- Branch: `feat/plan-guest-editing` (already created; spec committed there).

---

### Task 1: Data + hooks layer

**Files:**
- Modify: `src/lib/plans.ts` (add `removeGuest`, `addInvitees` near the other write functions, after `denyRequest` ~line 445)
- Modify: `src/hooks/usePlans.ts` (add `useRemoveGuest`, `useAddInvitees`; extend the import from `@/lib/plans`)

**Interfaces:**
- Consumes: existing `getSupabase()` helper in `plans.ts`; existing `useInvalidatePlanViews()` in `usePlans.ts`.
- Produces:
  - `removeGuest(rsvpId: string): Promise<void>`
  - `addInvitees(planId: string, friendIds: string[]): Promise<void>`
  - `useRemoveGuest()` → mutation with `mutate(rsvpId: string)`
  - `useAddInvitees()` → mutation with `mutate({ planId: string; friendIds: string[] })`

- [ ] **Step 1: Add `removeGuest` + `addInvitees` to `src/lib/plans.ts`**

Insert after `denyRequest` (the last write function, ~line 445):

```ts
/** Host removes a guest — a member invite, a responded member, or a link-guest
 *  (guest_name) — from their plan. RLS "own row or host deletes rsvp" gates it;
 *  the count-check turns an RLS block or already-gone row into a toastable error. */
export async function removeGuest(rsvpId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plan_rsvps")
    .delete()
    .eq("id", rsvpId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't remove that guest");
}

/** Host invites more accepted friends after creation — inserts null-rsvp rows
 *  (RLS "host invites accepted friends" gates each). The caller pre-filters
 *  friends already on the roster, so a unique(plan_id,user_id) conflict is only a
 *  rare race (a concurrent request-to-join) and surfaces as a thrown error.
 *  Plain INSERT (not upsert) to avoid the ON-CONFLICT table-SELECT requirement. */
export async function addInvitees(planId: string, friendIds: string[]): Promise<void> {
  if (friendIds.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("plan_rsvps")
    .insert(friendIds.map((friendId) => ({ plan_id: planId, user_id: friendId })));
  if (error) throw error;
}
```

- [ ] **Step 2: Add the two hooks to `src/hooks/usePlans.ts`**

Extend the `@/lib/plans` import list (add `addInvitees` and `removeGuest`, alphabetically among the existing imports):

```ts
  addInvitees,
  approveRequest,
  cancelPlan,
  createPlan,
  denyRequest,
  listHostPendingRequests,
  listMyPlanFeed,
  plansOnMap,
  removeGuest,
  requestToJoin,
  setMyRsvp,
  updatePlan,
  withdrawRequest,
```

Append after `useDenyRequest` (end of file):

```ts
export function useRemoveGuest() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (rsvpId: string) => removeGuest(rsvpId),
    onSuccess: invalidate,
  });
}

export function useAddInvitees() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: ({ planId, friendIds }: { planId: string; friendIds: string[] }) =>
      addInvitees(planId, friendIds),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/plans.ts src/hooks/usePlans.ts
git commit -m "feat(plans): removeGuest + addInvitees lib fns and hooks"
```

---

### Task 2: Host roster + × remove with deferred-delete undo

**Files:**
- Modify: `src/components/social/PlanDetailSheet.tsx`

**Interfaces:**
- Consumes: `useRemoveGuest()` (Task 1); existing `PlanRsvpRow`, `rsvpDisplayName`, `ProfileAvatar`, `cn`, sonner `toast`.
- Produces: host-only "Invited · no answer yet" group + per-guest × that hides the row immediately and commits the DELETE after a 5s undo window (or on sheet close).

- [ ] **Step 1: Add the React + icon + hook imports**

At the top of the file, add a React import (the component currently imports no React hooks) and the `X` icon, and the `useRemoveGuest` hook.

Add as the first import line:
```ts
import { useEffect, useMemo, useRef, useState } from "react";
```
Change the lucide import to include `X`:
```ts
import { CalendarClock, Forward, MapPin, MoreHorizontal, X } from "lucide-react";
```
Add `useRemoveGuest` to the `@/hooks/usePlans` import:
```ts
import {
  useApproveRequest,
  useCancelPlan,
  useDenyRequest,
  usePendingRequests,
  useRemoveGuest,
  useSetRsvp,
} from "@/hooks/usePlans";
```

- [ ] **Step 2: Add deferred-delete state + handlers**

Inside the component, after the existing `const setRsvp = useSetRsvp();` block and the `const { plan, venueName, host, isHost, rsvps, counts, myRsvp } = item;` destructure, add:

```ts
  const removeGuest = useRemoveGuest();
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fire every still-pending DELETE now (bare mutate — no component state touched,
  // so it's safe during unmount). Reads only refs + the stable mutate; kept in a
  // ref so the close/unmount effects always call the latest version.
  const flushPendingRef = useRef(() => {});
  flushPendingRef.current = () => {
    timersRef.current.forEach((timer, rsvpId) => {
      clearTimeout(timer);
      removeGuest.mutate(rsvpId);
    });
    timersRef.current.clear();
  };

  // Closing the sheet commits any pending removals (Undo is only offered while open).
  useEffect(() => {
    if (!open) {
      flushPendingRef.current();
      setPendingRemovals(new Set());
    }
  }, [open]);
  // Unmount safety net.
  useEffect(() => () => flushPendingRef.current(), []);

  const commitRemoval = (rsvpId: string) => {
    timersRef.current.delete(rsvpId);
    removeGuest.mutate(rsvpId, {
      onError: () => {
        toast.error("Couldn't remove that guest");
        setPendingRemovals((prev) => {
          const next = new Set(prev);
          next.delete(rsvpId);
          return next;
        });
      },
    });
  };

  const startRemoval = (r: PlanRsvpRow) => {
    const name = rsvpDisplayName(r);
    setPendingRemovals((prev) => new Set(prev).add(r.id));
    const timer = setTimeout(() => commitRemoval(r.id), 5000);
    timersRef.current.set(r.id, timer);
    toast(`Removed ${name}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const t = timersRef.current.get(r.id);
          if (t) clearTimeout(t);
          timersRef.current.delete(r.id);
          setPendingRemovals((prev) => {
            const next = new Set(prev);
            next.delete(r.id);
            return next;
          });
        },
      },
    });
  };
```

- [ ] **Step 3: Filter the roster by pending removals + split out pending invites**

Replace the existing `responded` line:
```ts
  const responded = rsvps.filter((r) => r.rsvp !== null);
```
with:
```ts
  const responded = rsvps.filter((r) => r.rsvp !== null && !pendingRemovals.has(r.id));
  // Host-only: invited members who haven't answered yet (rsvp null).
  const pendingInvites = rsvps.filter((r) => r.rsvp === null && !pendingRemovals.has(r.id));
```

(The existing `ordered` sort below it stays as-is — it sorts `responded`.)

- [ ] **Step 4: Give `guestRow` an × for removable rows**

Replace the whole `guestRow` definition with:

```ts
  const guestRow = (r: PlanRsvpRow) => {
    const removable = isHost && r.user_id !== plan.creator_id;
    return (
      <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 min-w-0">
          {r.profile ? (
            <ProfileAvatar profile={r.profile} className="h-6 w-6" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
              {rsvpDisplayName(r).slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate">{rsvpDisplayName(r)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {r.rsvp && (
            <span className={cn("text-xs font-medium", STATUS_COLOR[r.rsvp])}>
              {STATUS_LABEL[r.rsvp]}
            </span>
          )}
          {removable && (
            <button
              type="button"
              onClick={() => startRemoval(r)}
              aria-label={`Remove ${rsvpDisplayName(r)}`}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      </li>
    );
  };
```

- [ ] **Step 5: Render the "Invited · no answer yet" group**

In the "Guest list" block, replace the `showNames ? (...) : (...)` body's `showNames` branch (the responded list) so it also renders the pending group. Replace:

```tsx
            {showNames ? (
              ordered.length > 0 ? (
                <ul className="space-y-2">{ordered.map(guestRow)}</ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No RSVPs yet — share the link to get people in.
                </p>
              )
            ) : (
```

with:

```tsx
            {showNames ? (
              <>
                {ordered.length > 0 ? (
                  <ul className="space-y-2">{ordered.map(guestRow)}</ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No RSVPs yet — share the link to get people in.
                  </p>
                )}
                {isHost && pendingInvites.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Invited · no answer yet
                    </p>
                    <ul className="space-y-2">{pendingInvites.map(guestRow)}</ul>
                  </div>
                )}
              </>
            ) : (
```

(The `: ( ...counts... )` else branch stays unchanged.)

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/social/PlanDetailSheet.tsx
git commit -m "feat(plans): host roster with pending-invite group + guest remove (deferred-delete undo)"
```

---

### Task 3: Inline "+ Invite friends" add-on-tap picker

**Files:**
- Modify: `src/components/social/PlanDetailSheet.tsx`

**Interfaces:**
- Consumes: `useAddInvitees()` (Task 1); existing `useMyFriendships`, `deriveFriends`, `useAuthStore`, `ProfileAvatar`; `pendingRemovals` + `rsvps` (Task 2).
- Produces: host-only `+ Invite friends` control that lists accepted friends not on the roster and invites one per tap.

- [ ] **Step 1: Add imports**

Add `Plus` to the lucide import (now `CalendarClock, Forward, MapPin, MoreHorizontal, Plus, X`).
Add `useAddInvitees` to the `@/hooks/usePlans` import.
Add these module imports (match `CreatePlanSheet`'s usage):
```ts
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
```

- [ ] **Step 2: Derive the invitable-friends list**

After the deferred-delete handlers from Task 2, add:

```ts
  const addInvitees = useAddInvitees();
  const [showInvite, setShowInvite] = useState(false);
  const myId = useAuthStore((s) => s.session?.user.id);
  const { data: friendRows } = useMyFriendships();
  const friends = useMemo(
    () => (friendRows && myId ? deriveFriends(friendRows, myId) : []),
    [friendRows, myId]
  );
  // Everyone already on the plan (minus rows mid-removal), so we don't re-offer them.
  const rosterUserIds = useMemo(
    () =>
      new Set(
        rsvps
          .filter((r) => !pendingRemovals.has(r.id))
          .map((r) => r.user_id)
          .filter((id): id is string => !!id)
      ),
    [rsvps, pendingRemovals]
  );
  const invitableFriends = friends.filter((f) => !rosterUserIds.has(f.profile.id));

  const inviteFriend = (friendId: string, name: string) =>
    addInvitees.mutate(
      { planId: plan.id, friendIds: [friendId] },
      {
        onSuccess: () => toast.success(`Invited ${name}`),
        onError: () => toast.error("Couldn't add — try again"),
      }
    );
```

- [ ] **Step 3: Render the picker under the guest list**

Immediately after the closing `</div>` of the "Guest list" block (before the final `</div>` that closes the scroll container), add:

```tsx
          {/* Add invitees (host only) — add-on-tap, filtered to friends not yet
              on the roster. Removal is the × above; this only adds. */}
          {isHost && (
            <div>
              {!showInvite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-lg px-2 text-sm text-primary"
                  onClick={() => setShowInvite(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Invite friends
                </Button>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Invite friends
                  </p>
                  {invitableFriends.length > 0 ? (
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {invitableFriends.map((f) => {
                        const name = f.profile.display_name || `@${f.profile.username}`;
                        return (
                          <button
                            key={f.profile.id}
                            type="button"
                            disabled={addInvitees.isPending}
                            onClick={() => inviteFriend(f.profile.id, name)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-50"
                          >
                            <ProfileAvatar profile={f.profile} className="h-8 w-8" />
                            <span className="truncate text-sm font-medium">{name}</span>
                            <Plus className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Everyone you know is already on it.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/social/PlanDetailSheet.tsx
git commit -m "feat(plans): inline + Invite friends add-on-tap picker in PlanDetailSheet"
```

---

### Task 4: Live verification (host-side) + close-out

**Files:** none (verification task). Dev server runs at `http://localhost:8080` (`npm run dev` if not up).

**Interfaces:** Consumes the full feature from Tasks 1–3.

- [ ] **Step 1: Host-side flow (single account, drivable in the signed-in browser)**

1. Social → Make a plan (any venue, tonight). Open it (tap the card) → host detail sheet.
2. Tap **+ Invite friends** → the friend list shows accepted friends not already on. Tap one → toast "Invited …", and they appear under **Invited · no answer yet**; the friend drops out of the picker.
3. Tap the **×** on that pending invite → row disappears, toast **Removed … · Undo**. Tap **Undo** → the row returns (confirm via a refetch/reopen that it was never actually deleted).
4. Tap **×** again and let the ~5s window elapse → the row stays gone after a refocus/reopen (the DELETE committed).
5. Confirm the **host's own row has no ×**.
6. Confirm a non-host viewer (2nd account) still sees no × and no "Invited · no answer yet" group.

- [ ] **Step 2: Cross-account checks (needs the 2nd account — Colton confirms)**

- Remove a guest who is a friend member → they lose the plan from their feed.
- Re-add them via + Invite friends → it reappears for them.
- A guest who already answered can be removed and their answer drops from the counts.

- [ ] **Step 3: Final gate**

Run: `npx tsc --noEmit -p tsconfig.app.json` → no errors.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Clean up any test plans created during verification (cancel them), then report status for the merge/push decision.**

---

## Self-Review notes

- **Spec coverage:** remove (× + deferred undo) → Task 2; pending-invite group → Task 2; add-on-tap picker → Task 3; lib/hooks → Task 1; no-DDL → honored (no schema steps); host-only + non-host-unchanged → guarded by `isHost` in Tasks 2–3; verification → Task 4. All spec sections mapped.
- **No placeholders:** every code step is complete and copy-paste ready.
- **Type consistency:** `removeGuest(rsvpId)`, `addInvitees(planId, friendIds)`, `useRemoveGuest().mutate(rsvpId)`, `useAddInvitees().mutate({ planId, friendIds })` are used identically across tasks. `PlanRsvpRow.user_id` is `string | null` — handled by the `filter((id): id is string => !!id)` narrowing and the `r.user_id !== plan.creator_id` host-row guard.
