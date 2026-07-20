# §21 Group Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-night group plans — a host picks a venue + time, invites friends in-app, and shares an unguessable `/p/:token` link that lets anyone (no account) view the plan and RSVP with just a name.

**Architecture:** Two phases. **Phase A** (Tasks 1–6): `plans` + `plan_rsvps` tables with RLS, a `src/lib/plans.ts` data layer + `usePlans.ts` React Query hooks (mirroring the friends layer), a create/edit Drawer, a Plans section on Social, and a "Plan a night here" entry on VenueDetail — all authed-side, verified live before Phase B starts. **Phase B** (Tasks 7–10): ENDZ's first Edge Function (`plan-guest`, service-role, token-scoped) plus the public `PlanPage` at `/p/:token`. The token surface never touches RLS; the authed surface never touches the token.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom, @tanstack/react-query, zustand, Supabase JS v2, Supabase Edge Functions (Deno), shadcn/ui (Drawer/Switch/Checkbox/AlertDialog), Tailwind, date-fns, lucide-react, sonner.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-19-group-plans-design.md`. Locked decisions: link-first (Approach B), guest list visible by default + host hide toggle, NO voting, NO comments, NO reminders, NO guest→account upgrade, NO plan archive. Do not build anything from the "Postponed" list.
- **No test runner exists in this repo** (no vitest/jest in package.json). Per-task verification is `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op) — expect **exit 0, no output**. Live verification happens at the two checkpoint tasks (6 and 10). Do not add a test framework.
- **DDL goes clipboard → Colton pastes in the Supabase SQL editor** (only the anon key exists locally). All DDL is also appended to `~/Documents/endz/endz-schema.sql`. **No existing table's policies change.**
- **Edge Function deploy is Colton-run** via Supabase CLI (Task 7 runbook). Never attempt to deploy or touch service-role keys yourself.
- **Work on branch `feat/group-plans`. Never merge or push** — Colton's explicit OK required.
- Plan expiry is a client/function-derived constant: **6 hours after `planned_at`** (`PLAN_EXPIRE_HOURS = 6` — defined once in `src/lib/plans.ts` and duplicated by necessity in the Deno function; a comment in each points at the other).
- Note ≤ 200 chars, guest name ≤ 40 chars, guest cap 100 per plan — enforced in UI, DB checks, and the Edge Function.
- **Privacy:** the token surface returns only that plan's data — venue, time, note, host identity-lite, guest names/RSVPs (or counts when hidden). Never bios, friend lists, check-ins, user ids, or anything ghost-mode-adjacent. `guest_secret` is never readable from the client (column-level grant, Task 1).
- Match existing idiom: lib = plain async functions + RLS-is-the-only-privacy-boundary (`src/lib/friends.ts` header comment); hooks = React Query keyed on userId; section cards `rounded-3xl border border-border bg-card`; page shell `container pt-6 pb-24 max-w-lg`; `animate-fade-in`; lucide icons; sonner toasts; `logEvent` for analytics (fail-safe, already no-ops until the events DDL lands).
- Google OAuth redirects target `localhost:8080` — all live verification on the local dev server (`npm run dev`), not Vercel previews.

---

## Phase A — schema + authed flows

### Task 1: Branch + DDL (tables, helper functions, RLS, grants)

**Files:**
- Modify: `~/Documents/endz/endz-schema.sql` (append at end)

**Interfaces:**
- Produces: tables `plans`, `plan_rsvps`; SQL functions `is_plan_member(pid uuid)`, `is_plan_host(pid uuid)`, `plan_guest_list_open(pid uuid)`, `plan_rsvp_counts(pid uuid)`. Later tasks assume exactly the column names below.

**Why the helper functions exist (do not "simplify" them away):** the spec's `plans` select policy references `plan_rsvps` and vice-versa. Policy subqueries go through the referenced table's own RLS, so writing them as plain `exists()` subqueries causes Postgres `infinite recursion detected in policy`. `security definer` functions bypass RLS inside themselves, breaking the cycle. Same reason `plan_rsvp_counts` exists: when `hide_guest_list = true`, RLS hides other rows from members entirely, so counts must come from a definer function (spec: "counts come from the host/function").

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/group-plans
```

- [ ] **Step 2: Append the DDL to the schema file**

Append to `~/Documents/endz/endz-schema.sql` (after the events section, keeping the file's `-- ---------- name ----------` style):

```sql
-- ---------- plans (§21 Group Plans, approved 2026-07-19) ----------
-- One night, one venue, one time. share_token is the unguessable public
-- handle served ONLY by the plan-guest Edge Function (service role) — the
-- anon/authenticated roles can never query by token because RLS scopes
-- plans to host + invitees. Cancel is a status flip, not a delete, so the
-- link can render a graceful "plan is over" state. Expiry (planned_at + 6h)
-- is client/function-derived — no DB job.

create table plans (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references profiles (id) on delete cascade,
  venue_id        uuid not null references venues (id) on delete cascade,
  planned_at      timestamptz not null,
  note            text check (char_length(note) <= 200),
  hide_guest_list boolean not null default false,
  status          text not null default 'active' check (status in ('active','cancelled')),
  share_token     uuid unique not null default gen_random_uuid(),
  created_at      timestamptz not null default now()
);

create index plans_creator_idx on plans (creator_id);
create index plans_planned_idx on plans (planned_at);

-- ---------- plan_rsvps ----------
-- One row per person on a plan. Exactly one of user_id / guest_name:
-- ENDZ users (host-invited with rsvp null, or self-RSVP'd) vs link guests
-- (Edge-Function-inserted, name + guest_secret; names unverified — accepted
-- Partiful tradeoff). unique(plan_id, user_id) allows many null-user guest
-- rows. guest_secret lets a guest edit their own RSVP; it is EXCLUDED from
-- client SELECT via column-level grants below — service role only.

create table plan_rsvps (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references plans (id) on delete cascade,
  user_id      uuid references profiles (id) on delete cascade,
  guest_name   text check (char_length(guest_name) <= 40),
  rsvp         text check (rsvp in ('going','maybe','no')),  -- null = invited, no response
  guest_secret uuid,
  created_at   timestamptz not null default now(),
  check ((user_id is null) <> (guest_name is null)),
  unique (plan_id, user_id)
);

create index plan_rsvps_plan_idx on plan_rsvps (plan_id);
create index plan_rsvps_user_idx on plan_rsvps (user_id);

-- Helper functions: security definer breaks the plans<->plan_rsvps policy
-- recursion (policy subqueries otherwise re-enter the other table's RLS and
-- Postgres errors with "infinite recursion detected in policy").

create or replace function public.is_plan_member(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from plan_rsvps
    where plan_id = pid and user_id = auth.uid()
  );
$$;

create or replace function public.is_plan_host(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from plans
    where id = pid and creator_id = auth.uid()
  );
$$;

create or replace function public.plan_guest_list_open(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from plans
    where id = pid and hide_guest_list = false
  );
$$;

-- Counts for hidden guest lists (members can't see others' rows then).
-- Gated: returns zero rows unless the caller is host or member.
create or replace function public.plan_rsvp_counts(pid uuid)
returns table (going bigint, maybe bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*) filter (where rsvp = 'going'),
    count(*) filter (where rsvp = 'maybe')
  from plan_rsvps
  where plan_id = pid
    and (public.is_plan_host(pid) or public.is_plan_member(pid));
$$;

alter table plans enable row level security;
alter table plan_rsvps enable row level security;

-- plans: visible to host + anyone with an rsvp row (invited or joined).
create policy "plans visible to host and members"
  on plans for select
  using (creator_id = auth.uid() or public.is_plan_member(id));

create policy "users create own plans"
  on plans for insert
  with check (creator_id = auth.uid());

-- Host-only update; id/creator_id/share_token/created_at immutable via the
-- pre-update-snapshot exists() pattern (same as check_ins/friendships —
-- RLS has no OLD reference). venue_id/planned_at/note/hide_guest_list/status
-- stay editable (host edit + cancel).
create policy "host updates own plan"
  on plans for update
  using (creator_id = auth.uid())
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from plans prev
      where prev.id = plans.id
        and prev.creator_id = plans.creator_id
        and prev.share_token = plans.share_token
        and prev.created_at = plans.created_at
    )
  );

-- plan_rsvps select: your own row, or you're the host, or the plan is
-- visible to you and the guest list isn't hidden.
create policy "rsvps visible per plan rules"
  on plan_rsvps for select
  using (
    user_id = auth.uid()
    or public.is_plan_host(plan_id)
    or (public.is_plan_member(plan_id) and public.plan_guest_list_open(plan_id))
  );

-- Host invites accepted friends only (can't spam strangers): user rows,
-- rsvp starts null, never a guest_secret from the client.
create policy "host invites accepted friends"
  on plan_rsvps for insert
  with check (
    public.is_plan_host(plan_id)
    and user_id is not null
    and user_id <> auth.uid()
    and rsvp is null
    and guest_name is null
    and guest_secret is null
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = plan_rsvps.user_id) or
          (f.friend_id = auth.uid() and f.user_id = plan_rsvps.user_id)
        )
    )
  );

-- Self-RSVP on a plan you can see (also how the host's own 'going' row is
-- created at plan creation).
create policy "self rsvp on visible plan"
  on plan_rsvps for insert
  with check (
    user_id = auth.uid()
    and guest_name is null
    and guest_secret is null
    and (public.is_plan_host(plan_id) or public.is_plan_member(plan_id))
  );

-- Own row, rsvp column only (snapshot pattern; null-safe compares for the
-- nullable guest columns).
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
        and prev.guest_name is not distinct from plan_rsvps.guest_name
        and prev.guest_secret is not distinct from plan_rsvps.guest_secret
        and prev.created_at = plan_rsvps.created_at
    )
  );

-- Own row (leave a plan) or host removing an invite.
create policy "own row or host deletes rsvp"
  on plan_rsvps for delete
  using (user_id = auth.uid() or public.is_plan_host(plan_id));

-- guest_secret must never reach a browser: replace the blanket table grant
-- with a column list that omits it (service role is unaffected).
revoke select on plan_rsvps from anon, authenticated;
grant select (id, plan_id, user_id, guest_name, rsvp, created_at)
  on plan_rsvps to authenticated;
```

- [ ] **Step 3: Copy the DDL to the clipboard for Colton**

```bash
sed -n '/---------- plans (§21/,$p' ~/Documents/endz/endz-schema.sql | pbcopy
```

Expected: silent success; tell Colton the §21 DDL is on the clipboard.

- [ ] **Step 4: Commit**

```bash
git -C ~/Documents/night-guide add -A && git -C ~/Documents/night-guide commit -m "docs: §21 plans DDL recorded (schema file lives in ~/Documents/endz)"
```

(If nothing under the repo changed, skip the commit — the schema file lives outside this repo; the commit is only needed once repo files change in Task 2.)

- [ ] **Step 5: CHECKPOINT — Colton pastes the DDL**

Report: "§21 DDL is on your clipboard — paste it into the Supabase SQL editor when ready. Tasks 2–5 are code-only and don't need it; Task 6 (live verification) does." Do not block on this; continue to Task 2.

---

### Task 2: Data layer — `src/lib/plans.ts` (authed side)

**Files:**
- Create: `src/lib/plans.ts`

**Interfaces:**
- Consumes: `getSupabase()` from `@/lib/supabase`; `FriendProfile` from `@/lib/friends`.
- Produces (exact signatures later tasks import):
  - `PLAN_EXPIRE_HOURS: number` (= 6)
  - `type PlanRsvpValue = "going" | "maybe" | "no"`
  - `type PlanRow = { id: string; creator_id: string; venue_id: string; planned_at: string; note: string | null; hide_guest_list: boolean; status: "active" | "cancelled"; share_token: string; created_at: string }`
  - `type PlanRsvpRow = { id: string; plan_id: string; user_id: string | null; guest_name: string | null; rsvp: PlanRsvpValue | null; created_at: string; profile: FriendProfile | null }`
  - `type PlanFeedItem = { plan: PlanRow; venueName: string; host: FriendProfile | null; isHost: boolean; rsvps: PlanRsvpRow[]; counts: { going: number; maybe: number } | null; myRsvp: PlanRsvpValue | null; invitedNoResponse: boolean }`
  - `planShareUrl(plan: PlanRow): string`
  - `isPlanPast(plan: Pick<PlanRow, "planned_at">): boolean`
  - `listMyPlanFeed(myId: string): Promise<PlanFeedItem[]>`
  - `createPlan(input: { creatorId: string; venueId: string; plannedAt: Date; note: string; hideGuestList: boolean; inviteFriendIds: string[] }): Promise<PlanRow>`
  - `updatePlan(planId: string, patch: { venue_id?: string; planned_at?: string; note?: string | null; hide_guest_list?: boolean }): Promise<void>`
  - `cancelPlan(planId: string): Promise<void>`
  - `setMyRsvp(planId: string, myId: string, value: PlanRsvpValue): Promise<void>`

- [ ] **Step 1: Write `src/lib/plans.ts`**

```ts
/**
 * Group plans data layer (§21) — plain async functions, mirroring
 * src/lib/friends.ts. State reads happen through src/hooks/usePlans.ts.
 *
 * RLS is the only privacy boundary: plans come back only for host +
 * invitees; rsvp rows follow the hide-guest-list rule server-side. When the
 * list is hidden, members can't see others' rows at all — counts come from
 * the security-definer rpc plan_rsvp_counts.
 *
 * The token/guest surface (/p/:token) is NOT here — it talks to the
 * plan-guest Edge Function (src/lib/planGuest.ts) and never touches RLS.
 *
 * Pre-DDL grace: list reads treat Postgres 42P01 (undefined table) as
 * empty, same stance as the profiles.bio 42703 fallback — the app renders,
 * the feature is dark until Colton pastes the DDL.
 */
import { getSupabase } from "@/lib/supabase";
import { FriendProfile } from "@/lib/friends";

/** Plans auto-age into "past" this many hours after planned_at.
 *  Duplicated in supabase/functions/plan-guest/index.ts — keep in sync. */
export const PLAN_EXPIRE_HOURS = 6;

export const PLAN_NOTE_MAX = 200;

export type PlanRsvpValue = "going" | "maybe" | "no";

export type PlanRow = {
  id: string;
  creator_id: string;
  venue_id: string;
  planned_at: string;
  note: string | null;
  hide_guest_list: boolean;
  status: "active" | "cancelled";
  share_token: string;
  created_at: string;
};

export type PlanRsvpRow = {
  id: string;
  plan_id: string;
  user_id: string | null;
  guest_name: string | null;
  rsvp: PlanRsvpValue | null;
  created_at: string;
  profile: FriendProfile | null;
};

export type PlanFeedItem = {
  plan: PlanRow;
  venueName: string;
  host: FriendProfile | null; // null while profiles fetch races; UI shows "a friend"
  isHost: boolean;
  /** Rows RLS let me see (all of them for host/open lists; just mine when hidden). */
  rsvps: PlanRsvpRow[];
  /** Filled via plan_rsvp_counts rpc only when hidden and I'm not the host. */
  counts: { going: number; maybe: number } | null;
  myRsvp: PlanRsvpValue | null;
  invitedNoResponse: boolean;
};

const PLAN_COLS =
  "id, creator_id, venue_id, planned_at, note, hide_guest_list, status, share_token, created_at";
// guest_secret is excluded from the authenticated column grant — never select it.
const RSVP_COLS = "id, plan_id, user_id, guest_name, rsvp, created_at";
const PROFILE_COLS = "id, username, display_name, avatar_url";

export function planShareUrl(plan: PlanRow): string {
  return `${window.location.origin}/p/${plan.share_token}`;
}

export function isPlanPast(plan: Pick<PlanRow, "planned_at">): boolean {
  return Date.now() > new Date(plan.planned_at).getTime() + PLAN_EXPIRE_HOURS * 3_600_000;
}

/** Missing-table grace: true for Postgres 42P01 (plans DDL not pasted yet). */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

/**
 * Everything the Social Plans section needs, assembled from four queries
 * (plans → venues + host profiles + rsvps-with-profile), the same explicit
 * client-side join style as friendsOutTonight. Active, non-expired plans
 * only — cancelled/expired plans simply drop off (one-night ethos, no
 * archive; the /p/ link handles the graceful "over" state).
 */
export async function listMyPlanFeed(myId: string): Promise<PlanFeedItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const cutoff = new Date(Date.now() - PLAN_EXPIRE_HOURS * 3_600_000).toISOString();
  const { data: planData, error } = await supabase
    .from("plans")
    .select(PLAN_COLS)
    .eq("status", "active")
    .gte("planned_at", cutoff)
    .order("planned_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const plans = (planData ?? []) as PlanRow[];
  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const venueIds = [...new Set(plans.map((p) => p.venue_id))];
  const hostIds = [...new Set(plans.map((p) => p.creator_id))];

  const [venuesRes, hostsRes, rsvpsRes] = await Promise.all([
    supabase.from("venues").select("id, name").in("id", venueIds),
    supabase.from("profiles").select(PROFILE_COLS).in("id", hostIds),
    supabase
      .from("plan_rsvps")
      .select(`${RSVP_COLS}, profile:profiles!plan_rsvps_user_id_fkey(${PROFILE_COLS})`)
      .in("plan_id", planIds)
      .order("created_at", { ascending: true }),
  ]);
  if (venuesRes.error) throw venuesRes.error;
  if (hostsRes.error) throw hostsRes.error;
  if (rsvpsRes.error) throw rsvpsRes.error;

  const venueName = new Map(
    (venuesRes.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name])
  );
  const hostById = new Map(
    ((hostsRes.data ?? []) as FriendProfile[]).map((p) => [p.id, p])
  );
  const rsvps = (rsvpsRes.data as unknown as PlanRsvpRow[]) ?? [];

  const items: PlanFeedItem[] = plans.map((plan) => {
    const planRsvps = rsvps.filter((r) => r.plan_id === plan.id);
    const mine = planRsvps.find((r) => r.user_id === myId) ?? null;
    return {
      plan,
      venueName: venueName.get(plan.venue_id) ?? "a spot nearby",
      host: hostById.get(plan.creator_id) ?? null,
      isHost: plan.creator_id === myId,
      rsvps: planRsvps,
      counts: null,
      myRsvp: mine?.rsvp ?? null,
      invitedNoResponse: !!mine && mine.rsvp === null && plan.creator_id !== myId,
    };
  });

  // Hidden guest list + not host → RLS returned only my row; fetch counts
  // via the gated security-definer rpc so the card can still show "N going".
  await Promise.all(
    items
      .filter((it) => it.plan.hide_guest_list && !it.isHost)
      .map(async (it) => {
        const { data, error: rpcErr } = await supabase.rpc("plan_rsvp_counts", {
          pid: it.plan.id,
        });
        if (rpcErr) return; // counts are decorative — never fail the feed
        const row = Array.isArray(data) ? data[0] : data;
        if (row) it.counts = { going: Number(row.going), maybe: Number(row.maybe) };
      })
  );

  return items;
}

/**
 * Create the plan, the host's own 'going' row, and the invite rows.
 * Invite failures don't roll back the plan (host still gets the link and
 * can share it) — surface via the thrown error after the plan exists.
 */
export async function createPlan(input: {
  creatorId: string;
  venueId: string;
  plannedAt: Date;
  note: string;
  hideGuestList: boolean;
  inviteFriendIds: string[];
}): Promise<PlanRow> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const note = input.note.trim().slice(0, PLAN_NOTE_MAX);
  const { data, error } = await supabase
    .from("plans")
    .insert({
      creator_id: input.creatorId,
      venue_id: input.venueId,
      planned_at: input.plannedAt.toISOString(),
      note: note || null,
      hide_guest_list: input.hideGuestList,
    })
    .select(PLAN_COLS)
    .single();
  if (error) throw error;
  const plan = data as PlanRow;

  const hostRow = await supabase
    .from("plan_rsvps")
    .insert({ plan_id: plan.id, user_id: input.creatorId, rsvp: "going" });
  if (hostRow.error) throw hostRow.error;

  if (input.inviteFriendIds.length > 0) {
    const { error: invErr } = await supabase.from("plan_rsvps").insert(
      input.inviteFriendIds.map((friendId) => ({ plan_id: plan.id, user_id: friendId }))
    );
    if (invErr) throw invErr;
  }
  return plan;
}

/** Host edits time/venue/note/visibility. Count-check like friends.ts —
 *  0 rows means RLS blocked it and the UI must not pretend it worked. */
export async function updatePlan(
  planId: string,
  patch: { venue_id?: string; planned_at?: string; note?: string | null; hide_guest_list?: boolean }
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plans")
    .update(patch)
    .eq("id", planId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't update that plan");
}

/** Cancel = status flip so the /p/ link renders "this plan is over". */
export async function cancelPlan(planId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plans")
    .update({ status: "cancelled" })
    .eq("id", planId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't cancel that plan");
}

/**
 * One-tap RSVP. Upsert covers both cases: invited (row exists, rsvp null →
 * update) and joining a visible plan with no row yet (insert). onConflict
 * targets the unique(plan_id, user_id) index; created_at isn't in the
 * payload so the snapshot-pattern update policy passes.
 */
export async function setMyRsvp(
  planId: string,
  myId: string,
  value: PlanRsvpValue
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plan_rsvps")
    .upsert(
      { plan_id: planId, user_id: myId, rsvp: value },
      { onConflict: "plan_id,user_id" }
    )
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't save your RSVP");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/plans.ts && git commit -m "feat(plans): data layer — feed assembly, create/edit/cancel, one-tap rsvp"
```

---

### Task 3: React Query hooks — `src/hooks/usePlans.ts`

**Files:**
- Create: `src/hooks/usePlans.ts`

**Interfaces:**
- Consumes: everything Task 2 produces; `useAuthStore` from `@/store/auth`.
- Produces:
  - `usePlanFeed(): UseQueryResult<PlanFeedItem[]>` — query key `["plans", userId]`
  - `useCreatePlan(): UseMutationResult<PlanRow, Error, Parameters-minus-creatorId>` (creatorId injected from the store)
  - `useSetRsvp()` — optimistic on `["plans", userId]`
  - `useUpdatePlan()`, `useCancelPlan()` — invalidate on settle

- [ ] **Step 1: Write `src/hooks/usePlans.ts`**

```ts
/**
 * React Query layer for group plans. One query (["plans", userId]) feeds the
 * Social Plans section: my hosted plans + open invites. RSVP is optimistic
 * (one-tap must feel instant); create/edit/cancel just invalidate — they're
 * low-frequency and end in a toast anyway.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  PlanFeedItem,
  PlanRow,
  PlanRsvpValue,
  cancelPlan,
  createPlan,
  listMyPlanFeed,
  setMyRsvp,
  updatePlan,
} from "@/lib/plans";

export function usePlanFeed() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<PlanFeedItem[]>({
    queryKey: ["plans", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: () => listMyPlanFeed(userId!),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (input: {
      venueId: string;
      plannedAt: Date;
      note: string;
      hideGuestList: boolean;
      inviteFriendIds: string[];
    }): Promise<PlanRow> => createPlan({ creatorId: userId!, ...input }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}

export function useSetRsvp() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: ({ planId, value }: { planId: string; value: PlanRsvpValue }) =>
      setMyRsvp(planId, userId!, value),
    onMutate: async ({ planId, value }) => {
      await queryClient.cancelQueries({ queryKey: ["plans", userId] });
      const prev = queryClient.getQueryData<PlanFeedItem[]>(["plans", userId]);
      if (prev) {
        queryClient.setQueryData(
          ["plans", userId],
          prev.map((it) =>
            it.plan.id === planId
              ? { ...it, myRsvp: value, invitedNoResponse: false }
              : it
          )
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["plans", userId], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: ({
      planId,
      patch,
    }: {
      planId: string;
      patch: { venue_id?: string; planned_at?: string; note?: string | null; hide_guest_list?: boolean };
    }) => updatePlan(planId, patch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}

export function useCancelPlan() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (planId: string) => cancelPlan(planId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePlans.ts && git commit -m "feat(plans): react-query hooks — feed, create, optimistic rsvp, edit, cancel"
```

---

### Task 4: Create/edit plan Drawer — `src/components/social/CreatePlanSheet.tsx`

**Files:**
- Create: `src/components/social/CreatePlanSheet.tsx`

**Interfaces:**
- Consumes: `useCreatePlan`/`useUpdatePlan` (Task 3), `useVenues` from `@/hooks/useVenues`, `useMyFriendships` + `deriveFriends` from the friends layer, `planShareUrl`, `PLAN_NOTE_MAX`, `PlanFeedItem` (edit mode), `logEvent`, shadcn `Drawer`/`Switch`/`Checkbox`, `ProfileAvatar`.
- Produces: `export default function CreatePlanSheet(props: { open: boolean; onOpenChange: (o: boolean) => void; initialVenueId?: string; surface: "social" | "venue"; editItem?: PlanFeedItem })` — `editItem` set = edit mode (venue/time/note/hide editable, no invite step, saves via updatePlan).

Analytics here: `logEvent("plan_created", { venue_id, surface })` on successful create (spec's `plan_created` event).

- [ ] **Step 1: Write the component**

```tsx
/**
 * Create-a-plan bottom sheet (§21) — the one shared create surface for both
 * entry points (Social "Make a plan", VenueDetail "Plan a night here").
 * Flow: venue + time + note + hide-toggle + check off friends → create →
 * share step with the /p/:token link. Edit mode (editItem set) reuses the
 * same fields, saves via updatePlan, and skips invites + share step
 * (invite changes are out of MVP scope; the link never changes).
 */
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Share2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/useVenues";
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
import { useCreatePlan, useUpdatePlan } from "@/hooks/usePlans";
import { PLAN_NOTE_MAX, PlanFeedItem, PlanRow, planShareUrl } from "@/lib/plans";
import { logEvent } from "@/lib/analytics";
import ProfileAvatar from "@/components/social/ProfileAvatar";

/** Tonight at 9pm local, as a datetime-local input value. */
function defaultPlannedAt(): string {
  const d = new Date();
  d.setHours(21, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setTime(Date.now() + 60 * 60_000);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function CreatePlanSheet({
  open,
  onOpenChange,
  initialVenueId,
  surface,
  editItem,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialVenueId?: string;
  surface: "social" | "venue";
  editItem?: PlanFeedItem;
}) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venues } = useVenues({});
  const { data: friendRows } = useMyFriendships();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueSearch, setVenueSearch] = useState("");
  const [plannedAt, setPlannedAt] = useState(defaultPlannedAt());
  const [note, setNote] = useState("");
  const [hideGuestList, setHideGuestList] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<PlanRow | null>(null);
  const [copied, setCopied] = useState(false);

  // (Re)seed fields each open — from the plan being edited, or fresh.
  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setCopied(false);
    setVenueSearch("");
    setInvited(new Set());
    if (editItem) {
      setVenueId(editItem.plan.venue_id);
      setPlannedAt(format(new Date(editItem.plan.planned_at), "yyyy-MM-dd'T'HH:mm"));
      setNote(editItem.plan.note ?? "");
      setHideGuestList(editItem.plan.hide_guest_list);
    } else {
      setVenueId(initialVenueId ?? null);
      setPlannedAt(defaultPlannedAt());
      setNote("");
      setHideGuestList(false);
    }
  }, [open, editItem, initialVenueId]);

  const friends = useMemo(
    () => (friendRows && userId ? deriveFriends(friendRows, userId) : []),
    [friendRows, userId]
  );

  const selectedVenue = venues?.find((v) => v.id === venueId) ?? null;
  const venueMatches = useMemo(() => {
    if (!venues) return [];
    const q = venueSearch.trim().toLowerCase();
    if (!q) return venues.slice(0, 6);
    return venues.filter((v) => v.title.toLowerCase().includes(q)).slice(0, 6);
  }, [venues, venueSearch]);

  const canSubmit =
    !!venueId && !!plannedAt && !Number.isNaN(new Date(plannedAt).getTime());

  const submit = async () => {
    if (!canSubmit || !venueId) return;
    if (editItem) {
      updatePlan.mutate(
        {
          planId: editItem.plan.id,
          patch: {
            venue_id: venueId,
            planned_at: new Date(plannedAt).toISOString(),
            note: note.trim() || null,
            hide_guest_list: hideGuestList,
          },
        },
        {
          onSuccess: () => {
            toast.success("Plan updated");
            onOpenChange(false);
          },
          onError: () => toast.error("Couldn't update the plan"),
        }
      );
      return;
    }
    createPlan.mutate(
      {
        venueId,
        plannedAt: new Date(plannedAt),
        note,
        hideGuestList,
        inviteFriendIds: [...invited],
      },
      {
        onSuccess: (plan) => {
          logEvent("plan_created", { venue_id: venueId, surface });
          setCreated(plan);
        },
        onError: () => toast.error("Couldn't create the plan — try again"),
      }
    );
  };

  const link = created ? planShareUrl(created) : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (non-secure context) — nothing sane to do
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: `${selectedVenue?.title ?? "Tonight"} — you in?`,
          url: link,
        });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      copyLink();
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">
          {editItem ? "Edit plan" : "Make a plan"}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick a spot and a time, then share the link.
        </DrawerDescription>

        {created ? (
          /* ── Share step ── */
          <div className="p-5 pb-8 space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <Check className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <p className="font-display text-lg font-bold">Plan made.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Anyone with this link can see it and RSVP — no app needed.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/60 px-3.5 py-3 text-xs font-mono break-all">
              {link}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11 rounded-xl" onClick={copyLink}>
                {copied ? "Copied ✓" : "Copy link"}
              </Button>
              <Button className="h-11 rounded-xl" onClick={shareLink}>
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full h-10 rounded-xl text-muted-foreground"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          /* ── Form step ── */
          <div className="p-5 pb-8 space-y-4 overflow-y-auto max-h-[85vh]">
            <p className="font-display text-lg font-bold">
              {editItem ? "Edit plan" : "Make a plan"}
            </p>

            {/* Venue */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Where
              </p>
              {selectedVenue ? (
                <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary-soft/40 px-3.5 py-3">
                  <p className="text-sm font-semibold truncate">{selectedVenue.title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-xs text-muted-foreground"
                    onClick={() => setVenueId(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search spots…"
                    value={venueSearch}
                    onChange={(e) => setVenueSearch(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="mt-2 space-y-1">
                    {venueMatches.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVenueId(v.id)}
                        className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-secondary transition-colors"
                      >
                        <span className="font-medium">{v.title}</span>
                        {v.neighborhood && (
                          <span className="text-muted-foreground"> · {v.neighborhood}</span>
                        )}
                      </button>
                    ))}
                    {venues && venueMatches.length === 0 && (
                      <p className="text-sm text-muted-foreground px-3 py-2">No matches.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Time */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                When
              </p>
              <Input
                type="datetime-local"
                value={plannedAt}
                onChange={(e) => setPlannedAt(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* Note */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Note <span className="normal-case font-normal">(optional)</span>
              </p>
              <Textarea
                placeholder="Pre-game at mine first…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={PLAN_NOTE_MAX}
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>

            {/* Guest list visibility */}
            <div className="flex items-center justify-between rounded-2xl border border-border px-3.5 py-3">
              <div className="min-w-0 pr-3">
                <p className="text-sm font-medium">Hide guest list</p>
                <p className="text-xs text-muted-foreground">
                  People see counts, not names.
                </p>
              </div>
              <Switch checked={hideGuestList} onCheckedChange={setHideGuestList} />
            </div>

            {/* Invites — create mode only */}
            {!editItem && friends.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Invite friends
                </p>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {friends.map((f) => {
                    const checked = invited.has(f.profile.id);
                    return (
                      <label
                        key={f.profile.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition-colors",
                          checked ? "bg-primary-soft/50" : "hover:bg-secondary"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setInvited((prev) => {
                              const next = new Set(prev);
                              if (c) next.add(f.profile.id);
                              else next.delete(f.profile.id);
                              return next;
                            });
                          }}
                        />
                        <ProfileAvatar profile={f.profile} className="h-8 w-8" />
                        <span className="text-sm font-medium truncate">
                          {f.profile.display_name || `@${f.profile.username}`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-xl shadow-glow"
              disabled={!canSubmit || createPlan.isPending || updatePlan.isPending}
              onClick={submit}
            >
              {editItem
                ? updatePlan.isPending ? "Saving…" : "Save changes"
                : createPlan.isPending ? "Making it…" : "Make the plan"}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/social/CreatePlanSheet.tsx && git commit -m "feat(plans): create/edit drawer with venue search, invites, share step"
```

---

### Task 5: Surfaces — PlanCard + Social Plans section + VenueDetail entry point

**Files:**
- Create: `src/components/social/PlanCard.tsx`
- Modify: `src/pages/Social.tsx` (add Plans section between Requests and Out tonight; add imports + state)
- Modify: `src/pages/VenueDetail.tsx` (add "Plan a night here" button under `<CheckInCard>`; add imports + state)

**Interfaces:**
- Consumes: `usePlanFeed`, `useSetRsvp`, `useCancelPlan` (Task 3); `PlanFeedItem`, `PlanRsvpValue`, `planShareUrl` (Task 2); `CreatePlanSheet` (Task 4); `logEvent`; shadcn `AlertDialog`; `ProfileAvatar`; existing `SectionCard` in Social.tsx.
- Produces: `export default function PlanCard({ item }: { item: PlanFeedItem })`.

Analytics here: `logEvent("plan_rsvp", { venue_id: item.plan.venue_id, surface: "social", value })` on RSVP tap (spec's `plan_rsvp` event + surface prop).

- [ ] **Step 1: Write `src/components/social/PlanCard.tsx`**

```tsx
/**
 * One plan in the Social Plans section: venue + time + host + note, one-tap
 * RSVP row, and the guest list per the visibility rule — RLS already
 * decided what rsvp rows came back; when the list is hidden and I'm not
 * host, `counts` (from the gated rpc) is all we show. Host gets share /
 * edit / cancel.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, MapPin, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PlanFeedItem, PlanRsvpValue, planShareUrl } from "@/lib/plans";
import { useCancelPlan, useSetRsvp } from "@/hooks/usePlans";
import { logEvent } from "@/lib/analytics";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";

const RSVP_OPTIONS: { value: PlanRsvpValue; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't" },
];

function rsvpName(r: PlanFeedItem["rsvps"][number]): string {
  if (r.profile) return r.profile.display_name || `@${r.profile.username}`;
  return r.guest_name ?? "Someone";
}

export default function PlanCard({ item }: { item: PlanFeedItem }) {
  const setRsvp = useSetRsvp();
  const cancel = useCancelPlan();
  const [editOpen, setEditOpen] = useState(false);
  const { plan, venueName, host, isHost, rsvps, counts, myRsvp } = item;

  const going = rsvps.filter((r) => r.rsvp === "going");
  const maybe = rsvps.filter((r) => r.rsvp === "maybe");
  const showNames = isHost || !plan.hide_guest_list;

  const tapRsvp = (value: PlanRsvpValue) => {
    setRsvp.mutate(
      { planId: plan.id, value },
      { onError: () => toast.error("Couldn't save your RSVP") }
    );
    logEvent("plan_rsvp", { venue_id: plan.venue_id, surface: "social", value });
  };

  const share = async () => {
    const url = planShareUrl(plan);
    if (navigator.share) {
      try {
        await navigator.share({ text: `${venueName} — you in?`, url });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        // Clipboard unavailable — nothing sane to do
      }
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-3.5 mb-2 last:mb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to={`/venue/${plan.venue_id}`} className="block">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {venueName}
            </p>
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {format(new Date(plan.planned_at), "EEE MMM d · h:mm a")}
          </p>
          {host && !isHost && (
            <Link
              to={`/u/${host.username}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ProfileAvatar profile={host} className="h-4 w-4" />
              {host.display_name || `@${host.username}`}&apos;s plan
            </Link>
          )}
          {plan.note && <p className="text-xs text-foreground/80 mt-1.5">{plan.note}</p>}
        </div>

        {isHost ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-full"
              onClick={share}
              aria-label="Share plan link"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-full"
                    aria-label="Plan options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    Edit plan
                  </DropdownMenuItem>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive">
                      Cancel plan
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Everyone's link will show the plan is off. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      cancel.mutate(plan.id, {
                        onSuccess: () => toast.success("Plan cancelled"),
                        onError: () => toast.error("Couldn't cancel the plan"),
                      })
                    }
                  >
                    Cancel plan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>

      {/* One-tap RSVP */}
      {!isHost && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {RSVP_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={myRsvp === opt.value ? "default" : "secondary"}
              className="h-9 rounded-xl text-xs"
              onClick={() => tapRsvp(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {/* Guest list / counts */}
      <div className="mt-2.5">
        {showNames ? (
          going.length + maybe.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {going.map(rsvpName).join(", ")}
              </span>
              {going.length > 0 && " going"}
              {maybe.length > 0 && (
                <>
                  {going.length > 0 && " · "}
                  {maybe.map(rsvpName).join(", ")} maybe
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No RSVPs yet — share the link.</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            {counts ? `${counts.going} going · ${counts.maybe} maybe` : "Guest list hidden"}
          </p>
        )}
      </div>

      {isHost && (
        <CreatePlanSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          surface="social"
          editItem={item}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the Plans section to `src/pages/Social.tsx`**

Add imports (after the existing `SuggestedList` import):

```tsx
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { usePlanFeed } from "@/hooks/usePlans";
import PlanCard from "@/components/social/PlanCard";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";
```

(Also change the existing `import { ReactNode } from "react";` to `import { ReactNode, useState } from "react";` instead of a duplicate import, and merge `CalendarClock` into the existing lucide import line.)

Inside the `Social` component, after the `const { data: out } = useFriendsOutTonight();` line, add:

```tsx
  const { data: planItems } = usePlanFeed();
  const [createOpen, setCreateOpen] = useState(false);
  const openInvites = (planItems ?? []).filter((p) => p.invitedNoResponse).length;
```

Then insert the Plans section into the JSX **between the Requests `</SectionCard>`-closing block (`{(incoming.length > 0 || outgoing.length > 0) && (...)}`) and the "Out tonight" block**:

```tsx
      <SectionCard
        title="Plans"
        icon={CalendarClock}
        tone="primary"
        badge={
          openInvites > 0 ? (
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
              {openInvites} new
            </span>
          ) : undefined
        }
      >
        {(planItems ?? []).map((item) => (
          <PlanCard key={item.plan.id} item={item} />
        ))}
        {(planItems ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            Nothing on the books tonight.
          </p>
        )}
        <Button
          variant="secondary"
          className="w-full h-10 rounded-xl mt-2"
          onClick={() => setCreateOpen(true)}
        >
          <CalendarClock className="h-4 w-4 mr-2" /> Make a plan
        </Button>
      </SectionCard>

      <CreatePlanSheet open={createOpen} onOpenChange={setCreateOpen} surface="social" />
```

- [ ] **Step 3: Add the VenueDetail entry point**

In `src/pages/VenueDetail.tsx`, add imports:

```tsx
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";
```

(Merge `CalendarClock` into the existing lucide import line.)

At the top of the component body add:

```tsx
  const status = useAuthStore((s) => s.status);
  const [planOpen, setPlanOpen] = useState(false);
```

In the Body section, directly **after `<CheckInCard venueId={data.id} />`**, add:

```tsx
            {status === "signedIn" && (
              <Button
                variant="secondary"
                className="w-full h-11 rounded-xl"
                onClick={() => setPlanOpen(true)}
              >
                <CalendarClock className="h-4 w-4 mr-2" /> Plan a night here
              </Button>
            )}
```

And directly before the closing `</section>` tag (after the sticky bottom CTA block):

```tsx
      {data && (
        <CreatePlanSheet
          open={planOpen}
          onOpenChange={setPlanOpen}
          initialVenueId={data.id}
          surface="venue"
        />
      )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.
Run: `npm run build`
Expected: Vite build completes without errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/social/PlanCard.tsx src/pages/Social.tsx src/pages/VenueDetail.tsx
git commit -m "feat(plans): Social Plans section + PlanCard + VenueDetail entry point"
```

---

### Task 6: CHECKPOINT — Phase A live verification (needs Colton: DDL pasted)

**Blocked until Colton confirms the Task 1 DDL is applied.** Then verify on `http://localhost:8080` (`npm run dev`), with a second test account in a second browser profile.

- [ ] **Step 1: Create-plan round trip (host)** — Social → Make a plan → pick venue, tonight 10pm, note, invite the test friend → share step shows a `/p/<uuid>` link → card appears in Plans section with "You" hosting, host counted as going.
- [ ] **Step 2: Invited friend flow (acceptance #2)** — second account: Social shows the plan with "1 new" badge on Plans, host's name + venue + time visible; tap "Going" → button fills instantly, badge clears on refetch; host's card shows the friend under going.
- [ ] **Step 3: Host edit propagates (acceptance #7, authed half)** — host: ⋯ → Edit plan → change time + note → Save → second account sees the new time/note after focus refetch.
- [ ] **Step 4: Hide guest list (acceptance #4, authed half)** — create a second plan with Hide guest list ON, invite the friend. Friend's card shows "N going · N maybe" (from the rpc) and never names; host's card shows names.
- [ ] **Step 5: Cancel** — host cancels plan → disappears from both accounts' Plans sections.
- [ ] **Step 6: RLS probe (acceptance #5 & #6, authed half)** — in the browser console on the second (non-invited-on-a-third-plan) account, run a raw select: `(await (window as any).__sbProbe)` is not available — instead create a third plan from the host inviting NOBODY, then on the second account verify it never appears in the feed. Re-smoke the untouched surfaces: friends list, requests, out-tonight rows, check-in/out — behavior unchanged.
- [ ] **Step 7: Commit any fixes; report** — summarize pass/fail per step to Colton before starting Phase B.

---

## Phase B — Edge Function + public plan page

### Task 7: Edge Function — `supabase/functions/plan-guest/index.ts` + deploy runbook

**Files:**
- Create: `supabase/functions/plan-guest/index.ts`
- Create: `supabase/functions/plan-guest/deno.json`
- Create: `docs/plans/2026-07-19-plan-guest-deploy-runbook.md`

**Interfaces:**
- Produces the HTTP contract Task 8's client consumes (exact JSON shapes below). Service-role only; token-scoped; CORS-open (`*` — the link is public by design).
- Response shape for GET (`TokenPlanView` on the client):

```json
{
  "plan": { "planned_at": "...", "note": "...", "status": "active", "is_past": false },
  "venue": { "name": "...", "latitude": 0, "longitude": 0 },
  "host": { "username": "...", "display_name": "...", "avatar_url": "..." },
  "guest_list": { "hidden": false, "going": 3, "maybe": 1, "entries": [ { "name": "...", "rsvp": "going" } ] }
}
```

(`entries` omitted when `hidden`; entry names are display-name-or-username for user rows, `guest_name` for guests. No user ids, no bios — identity-lite only.)

- POST body `{ token, rsvp, guest_name? }` → guest: `201 { rsvp_id, guest_secret }`; signed-in (valid `Authorization: Bearer <access_token>`): `201 { as_user: true }`.
- PATCH body `{ token, rsvp_id, guest_secret, rsvp }` → `200 { ok: true }`.
- Errors: invalid/unknown token → `404 { error: "Not found" }` (generic — no enumeration oracle); cancelled/expired on POST/PATCH → `410 { error: "This plan is over" }`; validation → `400`; guest cap → `429`.

- [ ] **Step 1: Write `supabase/functions/plan-guest/deno.json`**

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Write `supabase/functions/plan-guest/index.ts`**

```ts
/**
 * plan-guest — ENDZ's first Edge Function (§21 Group Plans).
 *
 * Serves the /p/:token surface ONLY: resolve a share_token to one plan's
 * public view, take a guest (or signed-in) RSVP, let a guest edit theirs
 * via guest_secret. Runs with the service role (RLS bypassed), so the rule
 * is absolute: every query is scoped by the token's plan id, and responses
 * carry identity-lite fields only — never user ids, bios, friend lists, or
 * check-ins. Deployed with --no-verify-jwt (guests have no JWT; see the
 * runbook in docs/plans/2026-07-19-plan-guest-deploy-runbook.md).
 *
 * Abuse guards (MVP): 100-guest cap per plan, length/enum validation,
 * cancelled/expired plans read-only, unknown token -> generic 404. Real
 * rate limiting rides the launch-readiness item — this endpoint is flagged
 * there as the most abusable surface.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** Keep in sync with PLAN_EXPIRE_HOURS in src/lib/plans.ts. */
const PLAN_EXPIRE_HOURS = 6;
const GUEST_CAP = 100;
const RSVP_VALUES = new Set(["going", "maybe", "no"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const notFound = () => json(404, { error: "Not found" });

type PlanRecord = {
  id: string;
  creator_id: string;
  venue_id: string;
  planned_at: string;
  note: string | null;
  hide_guest_list: boolean;
  status: string;
};

function isPast(plan: PlanRecord): boolean {
  return (
    Date.now() > new Date(plan.planned_at).getTime() + PLAN_EXPIRE_HOURS * 3_600_000
  );
}

async function planByToken(token: unknown): Promise<PlanRecord | null> {
  if (typeof token !== "string" || !UUID_RE.test(token)) return null;
  const { data } = await supabase
    .from("plans")
    .select("id, creator_id, venue_id, planned_at, note, hide_guest_list, status")
    .eq("share_token", token)
    .maybeSingle();
  return (data as PlanRecord | null) ?? null;
}

async function handleGet(token: string | null): Promise<Response> {
  const plan = await planByToken(token);
  if (!plan) return notFound();

  const [venueRes, hostRes, rsvpsRes] = await Promise.all([
    supabase.from("venues").select("name, lat, lng").eq("id", plan.venue_id).maybeSingle(),
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", plan.creator_id)
      .maybeSingle(),
    supabase
      .from("plan_rsvps")
      .select("user_id, guest_name, rsvp, profile:profiles!plan_rsvps_user_id_fkey(username, display_name)")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true }),
  ]);

  const rsvps = (rsvpsRes.data ?? []) as {
    user_id: string | null;
    guest_name: string | null;
    rsvp: string | null;
    profile: { username: string; display_name: string | null } | null;
  }[];
  const going = rsvps.filter((r) => r.rsvp === "going").length;
  const maybe = rsvps.filter((r) => r.rsvp === "maybe").length;

  const guest_list: Record<string, unknown> = {
    hidden: plan.hide_guest_list,
    going,
    maybe,
  };
  if (!plan.hide_guest_list) {
    guest_list.entries = rsvps
      .filter((r) => r.rsvp !== null)
      .map((r) => ({
        name: r.profile
          ? r.profile.display_name || `@${r.profile.username}`
          : r.guest_name ?? "Someone",
        rsvp: r.rsvp,
      }));
  }

  return json(200, {
    plan: {
      planned_at: plan.planned_at,
      note: plan.note,
      status: plan.status,
      is_past: isPast(plan),
    },
    venue: venueRes.data
      ? { name: venueRes.data.name, latitude: venueRes.data.lat, longitude: venueRes.data.lng }
      : null,
    host: hostRes.data ?? null,
    guest_list,
  });
}

/** Resolve an optional Authorization header to a user id (signed-in RSVP). */
async function userIdFromAuth(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const jwt = header.slice(7);
  const { data } = await supabase.auth.getUser(jwt);
  return data.user?.id ?? null;
}

async function handlePost(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const plan = await planByToken(body.token);
  if (!plan) return notFound();
  if (plan.status !== "active" || isPast(plan)) {
    return json(410, { error: "This plan is over" });
  }
  const rsvp = body.rsvp;
  if (typeof rsvp !== "string" || !RSVP_VALUES.has(rsvp)) {
    return json(400, { error: "Bad request" });
  }

  const userId = await userIdFromAuth(req);
  if (userId) {
    // Signed-in user arriving via link — RSVP as themselves (acceptance #3).
    const { error } = await supabase
      .from("plan_rsvps")
      .upsert(
        { plan_id: plan.id, user_id: userId, rsvp },
        { onConflict: "plan_id,user_id" }
      );
    if (error) return json(500, { error: "Something broke" });
    return json(201, { as_user: true });
  }

  const guestName = typeof body.guest_name === "string" ? body.guest_name.trim() : "";
  if (guestName.length < 1 || guestName.length > 40) {
    return json(400, { error: "Name must be 1-40 characters" });
  }
  const { count } = await supabase
    .from("plan_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", plan.id)
    .is("user_id", null);
  if ((count ?? 0) >= GUEST_CAP) {
    return json(429, { error: "This plan is full" });
  }

  const guestSecret = crypto.randomUUID();
  const { data, error } = await supabase
    .from("plan_rsvps")
    .insert({
      plan_id: plan.id,
      guest_name: guestName,
      rsvp,
      guest_secret: guestSecret,
    })
    .select("id")
    .single();
  if (error || !data) return json(500, { error: "Something broke" });
  return json(201, { rsvp_id: data.id, guest_secret: guestSecret });
}

async function handlePatch(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Bad request" });
  }
  const plan = await planByToken(body.token);
  if (!plan) return notFound();
  if (plan.status !== "active" || isPast(plan)) {
    return json(410, { error: "This plan is over" });
  }
  const { rsvp_id, guest_secret, rsvp } = body as Record<string, unknown>;
  if (
    typeof rsvp !== "string" || !RSVP_VALUES.has(rsvp) ||
    typeof rsvp_id !== "string" || !UUID_RE.test(rsvp_id) ||
    typeof guest_secret !== "string" || !UUID_RE.test(guest_secret)
  ) {
    return json(400, { error: "Bad request" });
  }
  // Scoped to this token's plan AND the secret — a leaked rsvp_id alone is useless.
  const { data, error } = await supabase
    .from("plan_rsvps")
    .update({ rsvp })
    .eq("id", rsvp_id)
    .eq("plan_id", plan.id)
    .eq("guest_secret", guest_secret)
    .select("id");
  if (error) return json(500, { error: "Something broke" });
  if (!data || data.length === 0) return notFound();
  return json(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method === "GET") {
      return await handleGet(new URL(req.url).searchParams.get("token"));
    }
    if (req.method === "POST") return await handlePost(req);
    if (req.method === "PATCH") return await handlePatch(req);
    return json(405, { error: "Method not allowed" });
  } catch {
    return json(500, { error: "Something broke" });
  }
});
```

- [ ] **Step 3: Write the deploy runbook `docs/plans/2026-07-19-plan-guest-deploy-runbook.md`**

```markdown
# plan-guest Edge Function — deploy runbook (Colton-run)

ENDZ's first Edge Function. One-time setup, then one command per deploy.
The service-role key never leaves Supabase — the platform injects
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into the function automatically.

## One-time setup

1. Install the CLI: `brew install supabase/tap/supabase`
2. `supabase login` (opens the browser)
3. From the night-guide repo root:
   `supabase link --project-ref <PROJECT_REF>`
   (PROJECT_REF is the subdomain in your dashboard URL:
   https://supabase.com/dashboard/project/<PROJECT_REF>)

## Deploy (every time the function changes)

    supabase functions deploy plan-guest --no-verify-jwt

`--no-verify-jwt` is REQUIRED: guests have no account and no JWT, and the
app's publishable key is not a JWT either. Without the flag every guest
request 401s. Safety doesn't depend on the gateway check — the function
itself never returns anything beyond the single plan a valid token names,
and unknown tokens get a generic 404.

## Smoke test (after deploy)

    curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/plan-guest?token=00000000-0000-0000-0000-000000000000"

Expected: `{"error":"Not found"}` (404). Then open a real plan link from
the app in an incognito window.

## Logs

Dashboard → Edge Functions → plan-guest → Logs (or `supabase functions logs plan-guest`).
```

- [ ] **Step 4: Typecheck the app still passes** (the Deno file is outside `tsconfig.app.json`'s `src` include — verify it stays that way)

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output — no Deno-global errors. If `supabase/` got picked up, add `"supabase"` to the `exclude` array of `tsconfig.app.json`.

- [ ] **Step 5: Commit + CHECKPOINT**

```bash
git add supabase docs/plans/2026-07-19-plan-guest-deploy-runbook.md tsconfig.app.json
git commit -m "feat(plans): plan-guest edge function (token GET/POST/PATCH) + deploy runbook"
```

Report: "plan-guest is written; runbook at docs/plans/2026-07-19-plan-guest-deploy-runbook.md — deploy whenever you're ready. Tasks 8–9 are code-only; Task 10 needs it live." Continue to Task 8.

---

### Task 8: Token-side client — `src/lib/planGuest.ts`

**Files:**
- Create: `src/lib/planGuest.ts`
- Modify: `src/lib/supabase.ts` (export the functions base URL)

**Interfaces:**
- Consumes: the Task 7 HTTP contract; `useAuthStore` for the access token; config-store precedence from `supabase.ts`.
- Produces:
  - In `supabase.ts`: `getFunctionsBase(): string | null` (e.g. `https://xyz.supabase.co/functions/v1`)
  - `type TokenPlanView = { plan: { planned_at: string; note: string | null; status: "active" | "cancelled"; is_past: boolean }; venue: { name: string; latitude: number; longitude: number } | null; host: { username: string; display_name: string | null; avatar_url: string | null } | null; guest_list: { hidden: boolean; going: number; maybe: number; entries?: { name: string; rsvp: PlanRsvpValue }[] } }`
  - `fetchPlanByToken(token: string): Promise<TokenPlanView | null>` (null = 404)
  - `submitTokenRsvp(input: { token: string; rsvp: PlanRsvpValue; guestName?: string }): Promise<{ asUser: boolean }>` — persists guest secret to localStorage itself
  - `updateGuestRsvp(token: string, rsvp: PlanRsvpValue): Promise<void>` — reads the stored secret
  - `getStoredGuestRsvp(token: string): { rsvpId: string; guestSecret: string; guestName: string; rsvp: PlanRsvpValue } | null`
  - `PlanGoneError` (class) — thrown on 410 so the page can flip to the "over" state

- [ ] **Step 1: Add `getFunctionsBase` to `src/lib/supabase.ts`**

Append at the end of the file:

```ts
/** Base URL for Edge Functions, same config precedence as getSupabase().
 *  Null when unconfigured (demo mode) — token surfaces render a dead-end. */
export function getFunctionsBase(): string | null {
  const { supabaseUrl } = useConfigStore.getState();
  const url = import.meta.env.VITE_SUPABASE_URL || supabaseUrl;
  return url ? `${url.replace(/\/$/, "")}/functions/v1` : null;
}
```

- [ ] **Step 2: Write `src/lib/planGuest.ts`**

```ts
/**
 * Client for the plan-guest Edge Function — the ONLY code the /p/:token
 * page uses for data. Deliberately not the supabase-js client: this surface
 * works fully signed-out and never touches RLS. Signed-in users get their
 * access token attached so the function records the RSVP as them
 * (acceptance #3); guests get a guest_secret back, kept in localStorage so
 * they can change their answer later.
 */
import { getFunctionsBase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { PlanRsvpValue } from "@/lib/plans";

export type TokenPlanView = {
  plan: {
    planned_at: string;
    note: string | null;
    status: "active" | "cancelled";
    is_past: boolean;
  };
  venue: { name: string; latitude: number; longitude: number } | null;
  host: { username: string; display_name: string | null; avatar_url: string | null } | null;
  guest_list: {
    hidden: boolean;
    going: number;
    maybe: number;
    entries?: { name: string; rsvp: PlanRsvpValue }[];
  };
};

export type StoredGuestRsvp = {
  rsvpId: string;
  guestSecret: string;
  guestName: string;
  rsvp: PlanRsvpValue;
};

/** Thrown on 410 — plan cancelled/expired between page load and tap. */
export class PlanGoneError extends Error {
  constructor() {
    super("This plan is over");
    this.name = "PlanGoneError";
  }
}

const storageKey = (token: string) => `endz:plan-guest:${token}`;

export function getStoredGuestRsvp(token: string): StoredGuestRsvp | null {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuestRsvp;
    return parsed && typeof parsed.rsvpId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function storeGuestRsvp(token: string, value: StoredGuestRsvp): void {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(value));
  } catch {
    // Private mode — guest just can't edit later. Accepted.
  }
}

function endpoint(): string {
  const base = getFunctionsBase();
  if (!base) throw new Error("Backend not configured");
  return `${base}/plan-guest`;
}

export async function fetchPlanByToken(token: string): Promise<TokenPlanView | null> {
  const res = await fetch(`${endpoint()}?token=${encodeURIComponent(token)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`plan fetch failed (${res.status})`);
  return (await res.json()) as TokenPlanView;
}

export async function submitTokenRsvp(input: {
  token: string;
  rsvp: PlanRsvpValue;
  guestName?: string;
}): Promise<{ asUser: boolean }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken = useAuthStore.getState().session?.access_token;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(endpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: input.token,
      rsvp: input.rsvp,
      guest_name: input.guestName,
    }),
  });
  if (res.status === 410) throw new PlanGoneError();
  if (!res.ok) throw new Error(`rsvp failed (${res.status})`);
  const body = (await res.json()) as {
    as_user?: boolean;
    rsvp_id?: string;
    guest_secret?: string;
  };
  if (body.as_user) return { asUser: true };
  if (body.rsvp_id && body.guest_secret) {
    storeGuestRsvp(input.token, {
      rsvpId: body.rsvp_id,
      guestSecret: body.guest_secret,
      guestName: input.guestName ?? "",
      rsvp: input.rsvp,
    });
  }
  return { asUser: false };
}

export async function updateGuestRsvp(token: string, rsvp: PlanRsvpValue): Promise<void> {
  const stored = getStoredGuestRsvp(token);
  if (!stored) throw new Error("No stored RSVP for this plan");
  const res = await fetch(endpoint(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      rsvp_id: stored.rsvpId,
      guest_secret: stored.guestSecret,
      rsvp,
    }),
  });
  if (res.status === 410) throw new PlanGoneError();
  if (!res.ok) throw new Error(`rsvp update failed (${res.status})`);
  storeGuestRsvp(token, { ...stored, rsvp });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/planGuest.ts src/lib/supabase.ts
git commit -m "feat(plans): token-side client for plan-guest (fetch, rsvp, guest secret store)"
```

---

### Task 9: Public plan page — `src/pages/PlanPage.tsx` + route

**Files:**
- Create: `src/pages/PlanPage.tsx`
- Modify: `src/App.tsx` (add `<Route path="p/:token" ...>` OUTSIDE `AppLayout`, above the catch-all)

**Interfaces:**
- Consumes: Task 8's client (`fetchPlanByToken`, `submitTokenRsvp`, `updateGuestRsvp`, `getStoredGuestRsvp`, `PlanGoneError`, `TokenPlanView`); `directionsUrl` from `@/lib/directions`; `useAuthStore`; `logEvent`; `PlanRsvpValue` from `@/lib/plans`.
- Route is public and standalone (no tab bar) — same tier as `/join`. Works fully signed-out.

Analytics here: `logEvent("plan_rsvp", { surface: "link", value })` on submit (no venue_id available client-side on this surface; the function knows the plan).

- [ ] **Step 1: Write `src/pages/PlanPage.tsx`**

```tsx
/**
 * /p/:token — the public plan page (§21). Dark, mobile-first, fully
 * functional signed-out (pre-OAuth-publish this is the only surface real
 * people can use). All data comes from the plan-guest Edge Function; this
 * page never queries Supabase tables. Signed-in visitors RSVP as
 * themselves; guests RSVP with a name and can change their answer via the
 * locally-stored guest secret. Cancelled/expired plans render a graceful
 * "this one's a wrap" state.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, MapPin, Moon, Navigation } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { directionsUrl } from "@/lib/directions";
import { PlanRsvpValue } from "@/lib/plans";
import {
  PlanGoneError,
  TokenPlanView,
  fetchPlanByToken,
  getStoredGuestRsvp,
  submitTokenRsvp,
  updateGuestRsvp,
} from "@/lib/planGuest";
import { logEvent } from "@/lib/analytics";

const RSVP_OPTIONS: { value: PlanRsvpValue; label: string }[] = [
  { value: "going", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't" },
];

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="dark min-h-svh bg-background text-foreground">
    <div className="container max-w-md pt-10 pb-16 px-5">{children}</div>
    <footer className="pb-10 text-center">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        ENDZ — see where tonight is happening
      </Link>
    </footer>
  </main>
);

const PlanPage = () => {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  // Signed-in users see their pick reflected on refetch; guests need local
  // state (the guest list may be hidden, and names aren't identifying).
  const [localRsvp, setLocalRsvp] = useState<PlanRsvpValue | null>(
    () => (token ? getStoredGuestRsvp(token)?.rsvp ?? null : null)
  );
  const stored = token ? getStoredGuestRsvp(token) : null;

  const { data, isLoading } = useQuery<TokenPlanView | null>({
    queryKey: ["plan-token", token],
    enabled: !!token,
    refetchOnWindowFocus: true,
    queryFn: () => fetchPlanByToken(token!),
  });

  const pick = async (value: PlanRsvpValue) => {
    if (!token || busy) return;
    if (!session && !stored && guestName.trim().length === 0) {
      toast.error("Add your name first so the crew knows who's in");
      return;
    }
    setBusy(true);
    try {
      if (!session && stored) {
        await updateGuestRsvp(token, value);
      } else {
        await submitTokenRsvp({
          token,
          rsvp: value,
          guestName: session ? undefined : guestName.trim(),
        });
      }
      setLocalRsvp(value);
      logEvent("plan_rsvp", { surface: "link", value });
      queryClient.invalidateQueries({ queryKey: ["plan-token", token] });
    } catch (e) {
      if (e instanceof PlanGoneError) {
        toast.error("This plan is over");
        queryClient.invalidateQueries({ queryKey: ["plan-token", token] });
      } else {
        toast.error("Couldn't save that — try again");
      }
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="h-8 w-2/3 mb-3" />
        <Skeleton className="h-4 w-1/3 mb-6" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <p className="font-display text-lg font-bold">Nothing here.</p>
          <p className="text-sm text-muted-foreground mt-1">
            This link isn't pointing at a plan anymore.
          </p>
        </div>
      </Shell>
    );
  }

  const over = data.plan.status !== "active" || data.plan.is_past;
  const hostName = data.host
    ? data.host.display_name || `@${data.host.username}`
    : "A friend";
  const hostInitial = (data.host?.display_name || data.host?.username || "E")
    .slice(0, 1)
    .toUpperCase();
  const gl = data.guest_list;

  return (
    <Shell>
      <div className="animate-fade-in">
        {/* Host */}
        <div className="flex items-center gap-3 mb-5">
          <Avatar className="h-11 w-11">
            <AvatarImage src={data.host?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-primary-soft text-primary font-semibold">
              {hostInitial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{hostName} made a plan</p>
            {data.host && (
              <p className="text-xs text-muted-foreground/70">@{data.host.username}</p>
            )}
          </div>
        </div>

        {/* The plan */}
        <div className="rounded-3xl border border-border bg-card p-5">
          <h1 className="font-display text-2xl font-bold leading-tight flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-1 shrink-0 text-primary" aria-hidden="true" />
            {data.venue?.name ?? "A spot TBD"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            {format(new Date(data.plan.planned_at), "EEEE MMM d · h:mm a")}
          </p>
          {data.plan.note && (
            <p className="mt-3 text-sm text-foreground/90">{data.plan.note}</p>
          )}
          {data.venue && !over && (
            <a
              href={directionsUrl("google", {
                title: data.venue.name,
                latitude: data.venue.latitude,
                longitude: data.venue.longitude,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" /> Directions
            </a>
          )}
        </div>

        {over ? (
          <div className="mt-4 rounded-3xl border border-border bg-card p-6 text-center">
            <p className="font-display text-lg font-bold">This one's a wrap.</p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.plan.status === "cancelled"
                ? "The host called it off."
                : "This plan already happened."}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-border bg-card p-5">
            {!session && !stored && (
              <Input
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={40}
                className="rounded-xl mb-3"
              />
            )}
            {stored && !session && (
              <p className="text-xs text-muted-foreground mb-3">
                You're on the list as <span className="font-medium text-foreground">{stored.guestName}</span> — tap to change your answer.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {RSVP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={localRsvp === opt.value ? "default" : "secondary"}
                  disabled={busy}
                  className={cn(
                    "h-11 rounded-xl",
                    localRsvp === opt.value && "shadow-glow"
                  )}
                  onClick={() => pick(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Guest list */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Who's in
          </p>
          {gl.hidden ? (
            <p className="text-sm text-muted-foreground">
              {gl.going} going{gl.maybe > 0 && ` · ${gl.maybe} maybe`}
            </p>
          ) : gl.entries && gl.entries.length > 0 ? (
            <ul className="space-y-1.5">
              {gl.entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{e.name}</span>
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0 ml-3",
                      e.rsvp === "going"
                        ? "text-emerald-500"
                        : e.rsvp === "maybe"
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {e.rsvp === "going" ? "going" : e.rsvp === "maybe" ? "maybe" : "can't"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nobody yet — be the first.</p>
          )}
        </div>
      </div>
    </Shell>
  );
};

export default PlanPage;
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, add the import:

```tsx
import PlanPage from "@/pages/PlanPage";
```

and inside `<Routes>`, after the `terms` route and before the catch-all comment:

```tsx
              <Route path="p/:token" element={<PlanPage />} />
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.
Run: `npm run build`
Expected: Vite build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PlanPage.tsx src/App.tsx
git commit -m "feat(plans): public /p/:token plan page — guest + signed-in rsvp, over state"
```

---

### Task 10: CHECKPOINT — full acceptance verification + docs

**Blocked until Colton deploys the Edge Function (Task 7 runbook).** Run through the spec's 8 acceptance criteria on `http://localhost:8080` with: host account, second test account, and a logged-out incognito window.

- [ ] **1. Guest round trip** — create plan → copy link → open in incognito → page renders (host, venue, time, note, guest list) → RSVP with a name → appears in guest list; refresh keeps the "you're on the list as X" state.
- [ ] **2. Invited friend** — (re-verify from Task 6) friend sees plan on Social, badge, one-tap RSVP, badge clears.
- [ ] **3. Signed-in via link** — second account (signed in) opens the link → no name field → taps Going → appears in the guest list under their display name, and the plan now shows in THEIR Social Plans section (they became a member).
- [ ] **4. Hide guest list** — hidden plan's link shows counts only, incognito and signed-in-non-host alike; host still sees names in-app.
- [ ] **5. Token probe** — invalid token → in-app "Nothing here" page and `curl` 404; response bodies contain only plan/venue/host-lite/guest-name fields (inspect the GET JSON — no ids, no bios, no emails); a second plan's token shows only that plan.
- [ ] **6. Existing RLS unchanged** — re-smoke friends + check-in flows on both accounts (same as Task 6 Step 6).
- [ ] **7. Edit/cancel/guest-edit propagation** — host edits time → link page shows new time on refresh; host cancels → link renders "The host called it off"; before cancelling, guest changes RSVP going→can't via their stored secret and the list updates.
- [ ] **8. Guards + clean build** — 101st guest is unrealistic to click; instead `curl` POST with a valid token 3× different names (works), then verify a POST with `rsvp: "yes!"` → 400, missing name → 400, cancelled plan POST → 410. `npx tsc --noEmit -p tsconfig.app.json` exit 0; `npm run build` clean; page checked at mobile width (devtools 390px).
- [ ] **Docs** — update `docs/ENDZ_MASTER_TASKS.md` §21 row (APPROVED → BUILT, verified date); append the decision-log entry; note the new operational surface (Edge Function + runbook link) in the §21 tracker row.
- [ ] **Commit docs; report** — full pass/fail table to Colton. **Do not merge — Colton's explicit OK required** (then `superpowers:finishing-a-development-branch`).

---

## Self-review notes (already applied)

- **Spec coverage check:** every locked decision maps to a task — link-first token surface (7–9), guest list toggle (1, 5, 7, 9), no voting (nothing built), both entry points (5), invite-at-create + share link (4), badge (5), 6-hour aging (2, 7), cancel-not-delete (2, 5, 7, 9), identity-lite token responses (7), analytics events (4, 5, 9), DDL via Colton (1), deploy via Colton (7), acceptance criteria (6, 10).
- **Deviation from spec worth flagging at review:** the spec sketches RLS as direct `exists()` subqueries; the DDL uses `security definer` helpers because the direct form recurses (`plans` policy ↔ `plan_rsvps` policy). Same effective rules. Also added: `plan_rsvp_counts` rpc (spec's "counts come from the host/function" for the in-app hidden case) and the column-grant excluding `guest_secret` from client reads (spec implies it: "secret returned once").
- **Type consistency:** `PlanRsvpValue`/`PlanRow`/`PlanFeedItem` defined once in Task 2 and imported everywhere; token-surface types live in Task 8 (`TokenPlanView`) and match Task 7's JSON contract field-for-field; `PLAN_EXPIRE_HOURS` duplicated exactly once (Deno function) with sync comments both ways.
