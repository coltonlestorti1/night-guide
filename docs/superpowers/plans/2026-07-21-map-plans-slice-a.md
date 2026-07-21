# Map Plans — Slice A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opted-in group plans appear as a distinct "planning" badge on the map's venue pins; accepted friends can request to join, and hosts approve/deny.

**Architecture:** Additive on top of §21 Group Plans. One new `plans.show_on_map` flag + a `'requested'` rsvp state (the request row *is* the future membership row). All cross-membership reads go through a security-definer `plans_on_map()` function (curated columns — no note, no attendee names) so the consent decision is enforced at the data layer. Writes are tightly-scoped RLS policies reusing §21's security-definer helper pattern.

**Tech Stack:** React + TypeScript (Vite), TanStack Query, Supabase (Postgres RLS + rpc), MapLibre GL, shadcn/ui, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-21-map-plans-slice-a-design.md`

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op). Production build: `npm run build`.
- **No unit-test harness exists for these layers** (RLS, maplibre DOM markers, Supabase rpc). Per-task gate = **tsc + build green + code-review clean**; behavioral acceptance is the **live-verification** task at the end (Colton, signed in). This matches the §21 SDD pattern — do NOT scaffold a new test runner.
- **DDL never runs from here.** DDL goes to the clipboard + is appended to `~/Documents/endz/endz-schema.sql`; **Colton pastes it into the Supabase SQL editor** (only the anon key exists locally). Task 1 ends at a Colton checkpoint.
- Follow §21's established security-definer helper pattern for RLS; do not add a broad "plans visible to friends" SELECT policy (would leak `note` — map reads go through the function).
- Opt-in default is **off**. Attendee names never surface to non-members. Ghost mode suppresses the host's opted-in plan from friends.
- Branch: `feat/map-plans` (already created off `b468418`). Never merge/push without Colton's OK.

---

### Task 1: Database DDL (Colton checkpoint)

**Files:**
- Modify: `~/Documents/endz/endz-schema.sql` (append the §Slice-A block after the §21 plans block)

**Interfaces:**
- Produces (for later tasks): column `plans.show_on_map boolean`; rsvp value `'requested'`; functions `public.can_request_join(uuid) → boolean`, `public.plans_on_map() → table(...)` (see columns below); policies `"friend requests to join opted-in plan"`, `"host approves join request"`; modified `public.is_plan_member`, policy `"users update own rsvp"`.

- [ ] **Step 1: Confirm the live rsvp check-constraint name**

The `plan_rsvps.rsvp` check may be auto-named. Before writing the DROP, note that the exact name must be verified against the live DB. In `~/Documents/endz/endz-schema.sql` the §21 block defines it inline on the column (`rsvp text check (rsvp in ('going','maybe','no'))`) — Postgres auto-names such a constraint `plan_rsvps_rsvp_check`. Use that name; if the paste errors on an unknown constraint, Colton reports the real name from the error and we adjust.

- [ ] **Step 2: Append the Slice-A DDL block to `endz-schema.sql`**

```sql
-- ---------- map-plans Slice A (§ map-plans, approved 2026-07-21) ----------
-- Opt-in: broadcast this plan to the host's accepted friends on the map.
alter table plans
  add column show_on_map boolean not null default false;

-- 'requested' = a friend asked to join an opted-in plan; pending host approval.
-- The request row IS the future membership row (unique(plan_id,user_id) holds):
-- approve = UPDATE rsvp->'going', deny/withdraw = DELETE (existing delete policy).
alter table plan_rsvps
  drop constraint plan_rsvps_rsvp_check,
  add constraint plan_rsvps_rsvp_check
    check (rsvp in ('going','maybe','no','requested'));

-- is_plan_member must EXCLUDE pending requesters (else a requester would see the
-- guest list + counts before approval). Invited(null)/going/maybe/no stay members.
create or replace function public.is_plan_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plan_rsvps
    where plan_id = pid and user_id = auth.uid()
      and rsvp is distinct from 'requested'
  );
$$;

-- Close the self-approval hole: a user may no longer UPDATE their own row when its
-- previous rsvp is 'requested' (only the host approve policy moves it to 'going').
-- Withdraw still works via DELETE. Recreate the whole policy with the added guard.
drop policy "users update own rsvp" on plan_rsvps;
create policy "users update own rsvp"
  on plan_rsvps for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from plan_rsvps prev
      where prev.id = plan_rsvps.id
        and prev.plan_id = plan_rsvps.plan_id
        and prev.user_id = plan_rsvps.user_id
        and prev.rsvp is distinct from 'requested'
        and prev.guest_name is not distinct from plan_rsvps.guest_name
        and prev.guest_secret is not distinct from plan_rsvps.guest_secret
        and prev.created_at = plan_rsvps.created_at
    )
  );

-- Helper: caller may request to join plan pid — an accepted friend of an active,
-- opted-in, non-ghosted host (and not the host themselves).
create or replace function public.can_request_join(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p
    join profiles h on h.id = p.creator_id
    where p.id = pid
      and p.show_on_map = true
      and p.status = 'active'
      and h.ghost_mode = false
      and p.creator_id <> auth.uid()
      and exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and ( (f.user_id = auth.uid() and f.friend_id = p.creator_id)
             or (f.friend_id = auth.uid() and f.user_id = p.creator_id) )
      )
  );
$$;

-- INSERT: friend requests to join (rsvp='requested', never a guest row/secret).
create policy "friend requests to join opted-in plan"
  on plan_rsvps for insert
  with check (
    user_id = auth.uid()
    and rsvp = 'requested'
    and guest_name is null
    and guest_secret is null
    and public.can_request_join(plan_id)
  );

-- UPDATE: host approves a request -> host may transition ONLY 'requested'->'going'.
create policy "host approves join request"
  on plan_rsvps for update
  using (public.is_plan_host(plan_id))
  with check (
    public.is_plan_host(plan_id)
    and rsvp = 'going'
    and guest_secret is null
    and exists (
      select 1 from plan_rsvps prev
      where prev.id = plan_rsvps.id
        and prev.plan_id = plan_rsvps.plan_id
        and prev.user_id = plan_rsvps.user_id
        and prev.rsvp = 'requested'
        and prev.guest_name is not distinct from plan_rsvps.guest_name
        and prev.guest_secret is not distinct from plan_rsvps.guest_secret
        and prev.created_at = plan_rsvps.created_at
    )
  );

-- Read path for the map: my plans (host/member) + friends' opted-in plans, with
-- going-counts (a non-member friend can't row-read plan_rsvps to count). Returns
-- ONLY curated columns: never note, never attendee names, never tokens.
create or replace function public.plans_on_map()
returns table (
  plan_id          uuid,
  venue_id         uuid,
  planned_at       timestamptz,
  host_id          uuid,
  host_name        text,
  host_username    text,
  going_count      bigint,
  viewer_is_host   boolean,
  viewer_is_member boolean,
  viewer_request   text
)
language sql stable security definer set search_path = public as $$
  with visible as (
    select p.*
    from plans p
    where p.status = 'active'
      and p.planned_at > now() - interval '6 hours'
      and (
        p.creator_id = auth.uid()
        or public.is_plan_member(p.id)
        or (
          p.show_on_map = true
          and not exists (select 1 from profiles h
                          where h.id = p.creator_id and h.ghost_mode = true)
          and exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and ( (f.user_id = auth.uid() and f.friend_id = p.creator_id)
                 or (f.friend_id = auth.uid() and f.user_id = p.creator_id) )
          )
        )
      )
  )
  select
    v.id, v.venue_id, v.planned_at, v.creator_id,
    hp.display_name, hp.username,
    (select count(*) from plan_rsvps r where r.plan_id = v.id and r.rsvp = 'going'),
    v.creator_id = auth.uid(),
    public.is_plan_member(v.id),
    (select r.rsvp from plan_rsvps r
       where r.plan_id = v.id and r.user_id = auth.uid() and r.rsvp = 'requested'
       limit 1)
  from visible v
  join profiles hp on hp.id = v.creator_id;
$$;

grant execute on function public.plans_on_map() to authenticated;
```

- [ ] **Step 3: Copy the block to the clipboard for Colton**

Run (copies just the appended Slice-A block):

```bash
pbcopy < /dev/stdin <<'SQL'
<paste the exact block from Step 2 here>
SQL
```

- [ ] **Step 4: Colton checkpoint — paste + confirm**

Colton pastes into the Supabase SQL editor and runs it. Confirm: no errors; if the `drop constraint` errors on an unknown name, Colton pastes the real constraint name from the error → fix the DDL, re-copy, re-paste. Verify quickly in the SQL editor: `select show_on_map from plans limit 1;` returns (column exists) and `select public.plans_on_map();` runs (empty or rows, no error). **Do not proceed to Task 2 until Colton confirms the DDL applied.**

- [ ] **Step 5: Commit the schema-file change**

```bash
git add ~/Documents/endz/endz-schema.sql
# note: endz-schema.sql lives outside the repo; if it is not tracked here, skip the
# add and record the DDL in the commit message of Task 2 instead.
git commit -m "chore(map-plans): Slice A DDL — show_on_map, requested state, request/approve policies, plans_on_map()" || true
```

---

### Task 2: `lib/plans.ts` — map read + request/approve write functions

**Files:**
- Modify: `src/lib/plans.ts`

**Interfaces:**
- Consumes: `supabase` client (existing import), `PlanRsvpValue` (extend), `createPlan`/`updatePlan` inputs (extend with `showOnMap`).
- Produces:
  - `type PlanOnMap = { planId: string; venueId: string; plannedAt: string; hostId: string; hostName: string | null; hostUsername: string | null; goingCount: number; viewerIsHost: boolean; viewerIsMember: boolean; viewerRequest: "requested" | null; }`
  - `type HostPendingRequest = { rsvpId: string; planId: string; userId: string; name: string | null; username: string | null; }`
  - `async function plansOnMap(): Promise<PlanOnMap[]>`
  - `async function requestToJoin(planId: string, myId: string): Promise<void>`
  - `async function withdrawRequest(planId: string, myId: string): Promise<void>`
  - `async function approveRequest(rsvpId: string): Promise<void>`
  - `async function denyRequest(rsvpId: string): Promise<void>`
  - `async function listHostPendingRequests(myId: string): Promise<HostPendingRequest[]>`
  - `createPlan`/`updatePlan` accept `showOnMap?: boolean`.

- [ ] **Step 1: Add the `PlanOnMap` + `HostPendingRequest` types and `plansOnMap()`**

After the existing types near the top of `src/lib/plans.ts`:

```ts
export type PlanOnMap = {
  planId: string;
  venueId: string;
  plannedAt: string;
  hostId: string;
  hostName: string | null;
  hostUsername: string | null;
  goingCount: number;
  viewerIsHost: boolean;
  viewerIsMember: boolean;
  viewerRequest: "requested" | null;
};

export type HostPendingRequest = {
  rsvpId: string;
  planId: string;
  userId: string;
  name: string | null;
  username: string | null;
};

type PlansOnMapRow = {
  plan_id: string;
  venue_id: string;
  planned_at: string;
  host_id: string;
  host_name: string | null;
  host_username: string | null;
  going_count: number;
  viewer_is_host: boolean;
  viewer_is_member: boolean;
  viewer_request: string | null;
};

export async function plansOnMap(): Promise<PlanOnMap[]> {
  const { data, error } = await supabase.rpc("plans_on_map");
  if (error) throw error;
  return ((data ?? []) as PlansOnMapRow[]).map((r) => ({
    planId: r.plan_id,
    venueId: r.venue_id,
    plannedAt: r.planned_at,
    hostId: r.host_id,
    hostName: r.host_name,
    hostUsername: r.host_username,
    goingCount: Number(r.going_count) || 0,
    viewerIsHost: r.viewer_is_host,
    viewerIsMember: r.viewer_is_member,
    viewerRequest: r.viewer_request === "requested" ? "requested" : null,
  }));
}
```

- [ ] **Step 2: Add the request/approve/deny/withdraw writes**

```ts
export async function requestToJoin(planId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from("plan_rsvps")
    .insert({ plan_id: planId, user_id: myId, rsvp: "requested" });
  if (error) throw error;
}

export async function withdrawRequest(planId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from("plan_rsvps")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", myId)
    .eq("rsvp", "requested");
  if (error) throw error;
}

export async function approveRequest(rsvpId: string): Promise<void> {
  const { error } = await supabase
    .from("plan_rsvps")
    .update({ rsvp: "going" })
    .eq("id", rsvpId);
  if (error) throw error;
}

export async function denyRequest(rsvpId: string): Promise<void> {
  const { error } = await supabase.from("plan_rsvps").delete().eq("id", rsvpId);
  if (error) throw error;
}
```

- [ ] **Step 3: Add `listHostPendingRequests()`**

The host can read `requested` rows on their own plans (§21 `"rsvps visible per plan rules"` allows it via `is_plan_host`). Join to `plans` (creator = host) + `profiles` (requester identity).

```ts
export async function listHostPendingRequests(myId: string): Promise<HostPendingRequest[]> {
  const { data, error } = await supabase
    .from("plan_rsvps")
    .select("id, plan_id, user_id, plans!inner(creator_id, status), profiles!plan_rsvps_user_id_fkey(name, username)")
    .eq("rsvp", "requested")
    .eq("plans.creator_id", myId)
    .eq("plans.status", "active");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    rsvpId: r.id,
    planId: r.plan_id,
    userId: r.user_id,
    name: r.profiles?.name ?? null,
    username: r.profiles?.username ?? null,
  }));
}
```

(Verify the FK constraint name `plan_rsvps_user_id_fkey` against the live embed at review; if the embed errors, use the disambiguated relationship name Supabase reports.)

- [ ] **Step 4: Extend `createPlan` / `updatePlan` with `showOnMap`**

In `createPlan(input: {...})` add `showOnMap?: boolean` to the input type and include `show_on_map: input.showOnMap ?? false` in the inserted plan row. In `updatePlan(planId, patch)` add `showOnMap?: boolean` to the patch type and map it to `show_on_map` in the update object when defined. (Read the exact current bodies before editing.)

- [ ] **Step 5: Extend `PlanRsvpValue`? No — keep it user-facing.**

Do NOT add `'requested'` to the exported `PlanRsvpValue` union (it's a UI RSVP type for going/maybe/no). The request state is represented separately (`viewerRequest`, `HostPendingRequest`). Leave `PlanRsvpValue` unchanged.

- [ ] **Step 6: Typecheck + build**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat(map-plans): plansOnMap + request/approve/deny/withdraw + host pending requests + show_on_map on create/update"
```

---

### Task 3: `usePlans.ts` — query + mutation hooks

**Files:**
- Modify: `src/hooks/usePlans.ts`

**Interfaces:**
- Consumes: `plansOnMap`, `requestToJoin`, `withdrawRequest`, `approveRequest`, `denyRequest`, `listHostPendingRequests` (Task 2); `useAuthStore` (existing).
- Produces:
  - `usePlansOnMap()` → `UseQueryResult<PlanOnMap[]>`
  - `usePendingRequests()` → `UseQueryResult<HostPendingRequest[]>`
  - `useRequestToJoin()`, `useWithdrawRequest()`, `useApproveRequest()`, `useDenyRequest()` mutations.

- [ ] **Step 1: `usePlansOnMap` + `usePendingRequests`**

Mirror `useFriendsOutTonight`'s cadence (see `src/hooks/useFriends.ts`): `staleTime: 15_000`, `refetchInterval: 60_000`, `refetchOnWindowFocus: true`, `enabled: !!userId`.

```ts
export function usePlansOnMap() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<PlanOnMap[]>({
    queryKey: ["plans-on-map", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => plansOnMap(),
  });
}

export function usePendingRequests() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<HostPendingRequest[]>({
    queryKey: ["plan-pending-requests", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => listHostPendingRequests(userId!),
  });
}
```

- [ ] **Step 2: The four mutations with invalidation**

Each mutation invalidates the affected caches: map layer, pending requests, and the plan feed (§21's `usePlans` feed key — read the file for the exact key, e.g. `["plan-feed", userId]`).

```ts
function useInvalidatePlanViews() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return () => {
    qc.invalidateQueries({ queryKey: ["plans-on-map", userId] });
    qc.invalidateQueries({ queryKey: ["plan-pending-requests", userId] });
    qc.invalidateQueries({ queryKey: ["plan-feed", userId] }); // match §21's actual key
  };
}

export function useRequestToJoin() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (planId: string) => requestToJoin(planId, userId!),
    onSuccess: invalidate,
  });
}
export function useWithdrawRequest() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (planId: string) => withdrawRequest(planId, userId!),
    onSuccess: invalidate,
  });
}
export function useApproveRequest() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (rsvpId: string) => approveRequest(rsvpId),
    onSuccess: invalidate,
  });
}
export function useDenyRequest() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (rsvpId: string) => denyRequest(rsvpId),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 3: Typecheck + build + commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
git add src/hooks/usePlans.ts
git commit -m "feat(map-plans): usePlansOnMap + usePendingRequests + request/approve/deny/withdraw mutations"
```

---

### Task 4: `CreatePlanSheet` — "Show on map" toggle

**Files:**
- Modify: `src/components/social/CreatePlanSheet.tsx`

**Interfaces:**
- Consumes: `createPlan`/`updatePlan` `showOnMap` param (Task 2), shadcn `Switch` (check it's already imported elsewhere: `src/components/ui/switch.tsx`).

- [ ] **Step 1: Add `showOnMap` form state**

Read the component. Add a `showOnMap` boolean state, default `false`; when editing an existing plan, seed it from the plan's `show_on_map` (extend the edit-seed effect that already seeds venue/time/note — same closed→open ref pattern §21 uses).

- [ ] **Step 2: Render the toggle row**

Below the note field, add a labeled switch row:

```tsx
<div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
  <div className="min-w-0">
    <p className="text-sm font-medium">Show this plan on the map</p>
    <p className="text-xs text-muted-foreground">Your friends can see it and ask to join.</p>
  </div>
  <Switch checked={showOnMap} onCheckedChange={setShowOnMap} aria-label="Show this plan on the map for friends" />
</div>
```

- [ ] **Step 3: Pass `showOnMap` through submit**

In the create + edit submit handlers, pass `showOnMap` to `createPlan({ ..., showOnMap })` / `updatePlan(id, { ..., showOnMap })`.

- [ ] **Step 4: Typecheck + build + commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
git add src/components/social/CreatePlanSheet.tsx
git commit -m "feat(map-plans): show-on-map toggle in create/edit plan sheet"
```

---

### Task 5: Map planning badge + `MapPage` wiring

**Files:**
- Modify: `src/components/Map.tsx`, `src/pages/MapPage.tsx`

**Interfaces:**
- Consumes: `usePlansOnMap` (Task 3), `PlanOnMap` (Task 2).
- Produces: `MapProps.plansByVenue?: Record<string, { count: number; goingCount: number }>` (venueId → planning summary); a distinct planning badge element on the pin.

- [ ] **Step 1: Extend `MapProps` + destructure**

Add to `MapProps` (`src/components/Map.tsx:22`): `plansByVenue?: Record<string, { count: number; goingCount: number }>;`. Destructure it in the component signature (line 134) and add a stable `plansKey` (same pattern as `friendsKey`, lines 145–146) built from its entries, added to the `addMarkers` effect deps (line 272).

- [ ] **Step 2: Render the planning badge on the pin**

In the marker loop (after the friend-faces block, ~line 252), append a distinct badge when `plansByVenue?.[v.id]` exists — a clock/calendar glyph + the plan count, visually separate from the friend faces and the top-right check-in count. Position it top-left so it never collides with the top-right count badge or the bottom avatar cluster:

```ts
const plans = plansByVenue?.[v.id];
if (plans && plans.count > 0) {
  const pb = document.createElement("div");
  pb.className = "endz-plan-badge";
  pb.style.cssText =
    "position:absolute;top:-6px;left:-6px;display:flex;align-items:center;gap:2px;" +
    "height:18px;padding:0 5px;border-radius:9px;background:#7c3aed;color:#fff;" +
    "font-size:10px;font-weight:700;line-height:1;border:2px solid #fff;z-index:3;" +
    "box-shadow:0 1px 3px rgba(0,0,0,.3);";
  pb.textContent = `◔ ${plans.goingCount}`; // headcount ("planning"), not plan-count; replace ◔ with an inline clock SVG in impl
  wrapper.appendChild(pb);
  if (!isSelected) wrapper.style.zIndex = "5";
}
```

Use an inline clock SVG (not the emoji glyph) for crispness — mirror how the existing count badge builds its DOM. Keep the purple (`#7c3aed`) distinct from the friend-face treatment so "here now" vs "planning" never read the same.

- [ ] **Step 3: Wire `MapPage`**

In `src/pages/MapPage.tsx` next to `friendsByVenue` (line ~313): call `usePlansOnMap()`, build `plansByVenue` = group `data` by `venueId` → `{ count, goingCount }` (count = number of plans at the venue; goingCount = sum). Pass `plansByVenue={plansByVenue}` to `<Map />` (line ~386).

- [ ] **Step 4: Typecheck + build + live-eyeball**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```
Visual check deferred to Task 8 (needs a real opted-in plan + signed-in session). Commit.

```bash
git add src/components/Map.tsx src/pages/MapPage.tsx
git commit -m "feat(map-plans): distinct planning badge on venue pins + MapPage wiring"
```

---

### Task 6: Event detail — request-to-join surface

**Files:**
- Modify: `src/components/social/PlanDetailSheet.tsx` (or a new `src/components/social/PlanRequestCard.tsx` for the non-member light view — decide by reading PlanDetailSheet's member assumptions)
- Modify: whichever surface opens when a pin/venue is tapped (`VenueDetail` — §21 already added a plans entry there; read it first)

**Interfaces:**
- Consumes: `PlanOnMap` (Task 2), `useRequestToJoin`/`useWithdrawRequest` (Task 3).
- Produces: a non-member friend view for a plan on the map.

- [ ] **Step 1: Locate the tap→detail path**

Read `src/pages/MapPage.tsx` + the VenueDetail component §21 wired plans into. Determine where a plan for the selected venue is shown. The planning badge signals; the detail surface (VenueDetail's plans section) is where request-to-join lives.

- [ ] **Step 2: Member vs non-member branch**

For a `PlanOnMap` where `viewerIsMember || viewerIsHost` → route to the existing `PlanDetailSheet` (full §21 experience). Otherwise render the light non-member card:

```tsx
// venue · time · "Hosted by @{hostUsername}" · "{goingCount} going"
// + Request-to-join button OR "Requested" (disabled) with a small withdraw link
```

- [ ] **Step 3: Wire request / withdraw**

Button calls `useRequestToJoin().mutate(planId)`; when `viewerRequest === "requested"` show the Requested state + a "Cancel request" affordance calling `useWithdrawRequest().mutate(planId)`. Toast on success/error (match §21's toast usage). No attendee names, no note render in this branch.

- [ ] **Step 4: Typecheck + build + commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
git add -A
git commit -m "feat(map-plans): non-member request-to-join event detail + member routing"
```

---

### Task 7: Host approval UI — Requests(N) + Plans pending badge

**Files:**
- Modify: `src/components/social/PlanDetailSheet.tsx` (host Requests section)
- Modify: the Social **Plans** section header (`src/pages/Social.tsx` or the plans section component — read to find it)

**Interfaces:**
- Consumes: `usePendingRequests` (Task 3), `useApproveRequest`/`useDenyRequest` (Task 3), `listHostPendingRequests` shape (Task 2).

- [ ] **Step 1: Requests(N) section in the host's PlanDetailSheet**

When the viewer is the host, render a section at the top listing that plan's pending requests (filter `usePendingRequests()` data by `planId`, or fetch per-plan). Each row: requester name/@username + **Approve** (`useApproveRequest().mutate(rsvpId)`) + **Deny** (`useDenyRequest().mutate(rsvpId)`). Optimistic-friendly via the mutations' invalidation.

- [ ] **Step 2: Pending-count badge on the Social Plans header**

In the Social page's Plans section header, render a small `● N` badge when `usePendingRequests().data?.length` > 0. Match the app's existing count-badge styling.

- [ ] **Step 3: Typecheck + build + commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
git add -A
git commit -m "feat(map-plans): host Requests(N) approve/deny + Social Plans pending-count badge"
```

---

### Task 8: Live verification (Colton checkpoint)

**Files:** none (verification only).

Run against Colton's signed-in session on the dev server (`localhost:8080`), using his second account (@colton_lestorti) as the friend where needed. Work the acceptance criteria from the spec:

- [ ] Create a plan with the toggle **off** → no badge on the friend account's map.
- [ ] Edit → toggle **on** → planning badge appears on the friend's map at the venue; not on a non-friend's.
- [ ] Host ghost mode on → badge disappears from the friend's map; the plan still shows in the host's Social Plans.
- [ ] Friend taps badge → sees venue · time · "Hosted by @host" · N going, **no names/note** → taps **Request to join** → **Requested** state.
- [ ] Host sees Social Plans **● N** badge + **Requests (N)** in plan detail → **Approve** → friend's going count +1, friend now sees full plan (member). Re-test **Deny** with a second request → gone, friend can re-request.
- [ ] Attempt self-approval (friend tries to flip their own requested row) → blocked by RLS.
- [ ] Cancelled + >6h-past plans absent from the map.
- [ ] §21 regressions: create/invite/RSVP/hide-list/cancel/guest-link all still work; `tsc + build` green.

- [ ] **On green:** invoke `superpowers:requesting-code-review` for a whole-branch review, fix findings, then present merge decision to Colton (do NOT merge without his OK).

---

## Notes for the executor

- Read each file before editing; match its existing import style, toast usage, and class conventions.
- The DDL (Task 1) is the only Colton-blocking step besides final verification. Tasks 2–7 can proceed once the DDL is confirmed applied (Task 2+ call the new function/columns at runtime, but tsc/build don't need the live DB).
- Keep the planning badge visually distinct from here-now avatars — this was an explicit product decision.
- No push, no merge without Colton's OK.
