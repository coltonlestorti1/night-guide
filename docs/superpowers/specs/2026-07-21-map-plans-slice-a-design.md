# Map Plans — Slice A design (2026-07-21)

Slice A of the map-plans vision (gate-prep: `docs/plans/2026-07-20-map-plans-gate-prep.md`).
Builds on §21 Group Plans (shipped, deployed). **Approved by Colton 2026-07-21**
after the full gate discussion; nine decisions locked (below). Slices B/C/D
(personal "planning to go" signal, approved-list primitive, friends-of-friends
tier) are deferred to their own gates.

## Goal

Opted-in group plans appear as a distinct **"planning" badge** on the venue
pin. Accepted friends of the host can **request to join**; the host
**gatekeeps** (approve/deny). Purely additive to §21 and to the live check-in
map layer.

## Locked decisions (gate, 2026-07-21)

1. **Scope** = plan event badge on the pin + event-detail surface + request-to-join.
2. **Join model** = host must **approve** (request → accept), not auto-join.
3. **Request surface** = a pending-count badge on the Social **Plans** section +
   a **Requests (N)** list at the top of the host's plan-detail sheet with
   Approve/Deny. Fully in-app — **no push** (consistent with §21's deferral).
4. **On approve** → requester becomes `going` immediately.
5. **On deny** → request row removed; requester **may re-request** (no tombstone).
6. **Attendee consent** = badge/detail shows **host name + "N going" count only**.
   Individual attendee **names stay member-only**. The host's opt-in never
   exposes an attendee's name to the host's friends.
7. **Opt-in default** = **off**; a "Show this plan on the map for friends" toggle
   in create/edit.
8. **Ghost mode** = suppresses the host's opted-in plan from the friend map layer
   (consistent with check-in ghost behavior).
9. **Friends-of-friends** (>5 mutuals) = **deferred to Slice D**. Slice A audience
   = invitees (always, via §21) + host-opt-in → accepted friends.

## Current model (audited)

- `useFriendsOutTonight()` → accepted friends with an active check-in, RLS-
  filtered (ghost/visibility) → `friendsByVenue` in `MapPage.tsx` → avatar faces
  on the venue pin (`PinFriend`). Answers "who is here **now**." No plan/intent
  layer on the map today.
- §21 `plans` / `plan_rsvps` with security-definer helpers
  (`is_plan_member`, `is_plan_host`, `plan_guest_list_open`, `plan_rsvp_counts`)
  that break the plans↔plan_rsvps policy recursion. `plans` SELECT is scoped to
  host + members (anyone with an rsvp row). `plan_rsvps.rsvp ∈ {going,maybe,no}`
  or null (invited). `guest_secret` is column-revoked from clients. DELETE policy
  `"own row or host deletes rsvp"` = `user_id = auth.uid() OR is_plan_host`.
  UPDATE `"users update own rsvp"` allows a user to change their own row's `rsvp`
  with no value restriction (the snapshot pattern only freezes the guest cols).

## Data model changes (additive)

```sql
-- opt-in flag: plan is broadcast to the host's accepted friends on the map.
alter table plans
  add column show_on_map boolean not null default false;

-- 'requested' = a friend has asked to join an opted-in plan; pending host
-- approval. The request row IS the future membership row (unique(plan_id,user_id)
-- already holds): approve = UPDATE rsvp→'going', deny/withdraw = DELETE.
alter table plan_rsvps
  drop constraint plan_rsvps_rsvp_check,           -- name verified at DDL time
  add constraint plan_rsvps_rsvp_check
    check (rsvp in ('going','maybe','no','requested'));
```

(Exact constraint name to be confirmed against the live schema at DDL time; if
Postgres auto-named it differently, the drop targets the actual name.)

## RLS / function changes

All follow §21's established **security-definer helper** pattern (helpers run as
definer to avoid RLS recursion and to read across membership boundaries).

### 1. Modify `is_plan_member` — exclude pending requesters

A `requested` row must **not** make someone a member (else they'd see the guest
list + counts before approval).

```sql
create or replace function public.is_plan_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plan_rsvps
    where plan_id = pid and user_id = auth.uid()
      and rsvp is distinct from 'requested'
  );
$$;
```

Regression check: invited (`rsvp` null), `going`, `maybe`, `no` all remain
`distinct from 'requested'` → still members. Only `requested` is excluded. Safe
for every existing §21 policy that calls `is_plan_member`.

### 2. Modify `"users update own rsvp"` — close the self-approval hole

Today a requester could UPDATE their own `requested` row straight to `going`,
bypassing the host. Forbid updating a row whose previous `rsvp` is `requested`
(only the host's approve policy may move it).

```sql
-- add to the existing exists(prev) subquery's WHERE:
        and prev.rsvp is distinct from 'requested'
```

Effect: a user can still change `going`↔`maybe`↔`no` on their own row, but can
never self-transition **out of** `requested`. Requesters can still DELETE their
own `requested` row (withdraw) via the existing delete policy.

### 3. New helper `can_request_join(pid)`

```sql
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
```

### 4. New INSERT policy — friend requests to join

```sql
create policy "friend requests to join opted-in plan"
  on plan_rsvps for insert
  with check (
    user_id = auth.uid()
    and rsvp = 'requested'
    and guest_name is null
    and guest_secret is null
    and public.can_request_join(plan_id)
  );
```

`unique(plan_id, user_id)` prevents duplicate requests; a re-request after a
deny works because the deny DELETEs the prior row.

### 5. New UPDATE policy — host approves

```sql
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
        and prev.rsvp = 'requested'
        and prev.user_id = plan_rsvps.user_id
        and prev.plan_id = plan_rsvps.plan_id
        and prev.guest_name is not distinct from plan_rsvps.guest_name
        and prev.guest_secret is not distinct from plan_rsvps.guest_secret
        and prev.created_at = plan_rsvps.created_at
    )
  );
```

Host can transition only `requested`→`going` (approve). All other host row-edits
stay disallowed (§21 has no member removal beyond DELETE-invite). The two UPDATE
policies are permissive-OR'd; the host path requires `is_plan_host`, the user
path requires `user_id = auth.uid()` and `prev.rsvp <> 'requested'`, so neither
lets a requester self-approve.

### 6. DELETE — reuse existing

`"own row or host deletes rsvp"` (`user_id = auth.uid() OR is_plan_host`) already
covers **deny** (host deletes the requested row) and **withdraw** (requester
deletes own). No new policy.

### 7. New read function `plans_on_map()` — the map layer's single source

The map needs plans I can see: my own (host/member) **plus** friends' opted-in
plans, **with going-counts** — and a non-member friend cannot read `plan_rsvps`
rows to count them. A security-definer function returns exactly the curated
badge/detail fields and nothing else (no `note`, no attendee names, no tokens).

```sql
create or replace function public.plans_on_map()
returns table (
  plan_id       uuid,
  venue_id      uuid,
  planned_at    timestamptz,
  host_id       uuid,
  host_name     text,
  host_username text,
  going_count   bigint,
  viewer_is_host   boolean,
  viewer_is_member boolean,
  viewer_request   text        -- 'requested' | null  (viewer's own state)
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
    hp.name, hp.username,
    (select count(*) from plan_rsvps r where r.plan_id = v.id and r.rsvp = 'going'),
    v.creator_id = auth.uid(),
    public.is_plan_member(v.id),
    (select r.rsvp from plan_rsvps r
       where r.plan_id = v.id and r.user_id = auth.uid() and r.rsvp = 'requested')
  from visible v
  join profiles hp on hp.id = v.creator_id;
$$;

grant execute on function public.plans_on_map() to authenticated;
```

Notes: `note` and attendee names are never selected → the consent decision (#6)
is enforced at the data layer, not just the UI. Expiry (`planned_at > now()-6h`)
matches §21's client-derived window. Ghost suppression is in the friend branch
only (your own/member plans still show to you when you ghost — ghost hides you
from **others**, not the map from yourself).

## Client / UI

### `lib/plans.ts` + `usePlans.ts`
- `PlanOnMap` type mirroring the function columns.
- `plansOnMap()` → `supabase.rpc('plans_on_map')`.
- `usePlansOnMap()` React Query hook (parallels `useFriendsOutTonight`:
  `refetchInterval` ~60s, `staleTime` ~15s, enabled when signed in).
- `requestToJoin(planId)` → insert `{ plan_id, user_id, rsvp:'requested' }`.
- `withdrawRequest(planId)` → delete own requested row.
- `approveRequest(rsvpId)` → update `rsvp:'going'`.
- `denyRequest(rsvpId)` → delete.
- `usePendingRequestCount()` → host reads own plans' `requested` rows (allowed by
  §21 `"rsvps visible per plan rules"` via `is_plan_host`) → total for the badge.

### Map (`MapPage.tsx` + `components/Map`)
- `usePlansOnMap()` → `plansByVenue` grouped like `friendsByVenue`.
- A **distinct planning badge** on the pin — clock/calendar glyph + count,
  visually separate from the here-now avatar faces (never reuse faces). A venue
  with both reads as e.g. "3 here now · 2 planning" with no collision.
- Tap the badge → event detail (below). Time revealed there, not on the pin.

### Event detail
- **Member** (host or approved/invited): reuse `PlanDetailSheet` (full guest
  list + RSVP + share + host controls).
- **Non-member friend**: a light detail view — venue · planned time ·
  "Hosted by @{username}" · **N going** · a **Request to join** button, or a
  disabled **Requested** state when `viewer_request = 'requested'` (with a
  withdraw affordance). No names, no note.

### Host controls
- `PlanDetailSheet` gains a **Requests (N)** section at the top (host only):
  each pending requester's name/username + **Approve** / **Deny**. Uses
  `approveRequest` / `denyRequest`; optimistic update + invalidate
  `plans-on-map`, the plan's rsvps, and `pending-request-count`.
- Social **Plans** section header shows a **● N** pending-request badge from
  `usePendingRequestCount()`.

### Create / edit (`CreatePlanSheet`)
- A **"Show this plan on the map for friends"** toggle (switch row), default
  **off**, bound to `show_on_map`. Wired through `createPlan` / plan update.

## Out of scope (deferred, logged)

- Attendee names on the badge (member-only stays) — revisit with per-attendee
  opt-in if ever wanted.
- Friends-of-friends >5-mutuals tier → **Slice D**.
- "Planning to go" personal signal (check-in-supersedes) → **Slice B**.
- Approved-list sharing primitive → **Slice C**.
- Push / real notifications for requests (in-app badge only for now).

## Acceptance criteria

1. New plan defaults **off** the map; toggling **on** (create or edit) makes its
   badge appear on an **accepted friend's** map, and **not** on a non-friend's.
2. Host in **ghost mode** → the plan's badge disappears from friends' maps;
   invitees still see the plan in Social Plans.
3. Non-member friend taps badge → sees venue · time · "Hosted by @host" ·
   N going · **Request to join** (no names, no note). Tapping it → **Requested**
   state.
4. Host sees the Social Plans **● N** badge increment and a **Requests (N)** row
   in the plan detail. **Approve** → requester's `going` count increments and the
   requester now sees the full plan (member); **Deny** → request gone, requester
   can request again.
5. **Self-approval blocked**: a requester cannot move their own row out of
   `requested` (verified against the live policy).
6. Plans **older than `planned_at + 6h`** and **cancelled** plans do not appear
   on the map.
7. `note` and attendee names are **never** returned to a non-member friend
   (verified at the function boundary, not just hidden in UI).
8. Existing §21 flows (create, invite, RSVP, hide guest list, cancel, guest link)
   unchanged. `tsc -p tsconfig.app.json` + production build green.

## Deviations to flag if questioned

- **No broad "plans visible to friends" SELECT policy.** Map reads go through
  `plans_on_map()` (security-definer, curated columns) so the host's `note` and
  attendee names never leak; the only row-level `plans` SELECT path stays §21's
  host+members. This is deliberately more conservative than adding a friend
  SELECT policy.
- **The request row is the membership row** (reuses `unique(plan_id,user_id)`),
  not a separate `join_requests` table — smaller surface, and approve/deny map
  cleanly onto UPDATE/DELETE of one row.
