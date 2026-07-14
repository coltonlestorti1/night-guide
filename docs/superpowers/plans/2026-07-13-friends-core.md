# Friends Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the base friends layer for ENDZ: username search → Add → Accept, a real Social page replacing the 34-line stub, a "friends here" row on the venue sheet, and a per-check-in visibility toggle.

**Architecture:** Mirror the check-in stack — plain async functions in `src/lib/friends.ts`, React Query hooks with optimistic mutations in `src/hooks/useFriends.ts`, thin composition in `Social.tsx` with new components under `src/components/social/`. RLS is the only privacy boundary; the client renders exactly what queries return. One query (`["friendships", userId]`) is the single source for friends/requests/button states; presence rides the existing content-free realtime poke plus a 60s poll.

**Tech Stack:** Vite + React 18 + TypeScript, shadcn/ui (Avatar, Drawer, Collapsible, Button, Input already in repo), @tanstack/react-query v5, Supabase JS. Repo: `~/Documents/night-guide`. Spec: `docs/superpowers/specs/2026-07-13-friends-core-design.md`.

## Global Constraints

- **Branch:** all work on `feat/friends-core`, branched from local `main`.
- **No new packages. No schema changes in this branch. No map-pin avatars** (fast follow — `Map.tsx` marker code is fragile; do not touch it).
- **RLS pre-patch reality:** `friendships` currently has **no DELETE policy** and UPDATE has **no WITH CHECK** — decline/cancel/remove/block will fail (deletes silently match 0 rows) against the live DB until the Opus RLS patch lands. **Build them anyway**; the data layer uses `.select("id")` count checks so a 0-row delete/update throws and optimistic UI rolls back. **Hold the merge until the patch is in.**
- Enum reality: `friend_status = pending | accepted | blocked` — there is no `declined`. Decline/cancel/remove are **row deletes**. Blocking = delete any existing row between the pair, then insert `(blocker, blocked, 'blocked')` — `user_id` is always the blocker.
- **Language:** "Add" is the verb (never "request/connect"). Button states: Add → Requested. Accept / Decline on incoming.
- **Reads go through `active_check_ins`**, never raw `check_ins`. The UI never filters "extra" rows in and never re-implements ghost mode / visibility client-side.
- **One-tap check-in preserved** — the visibility toggle never adds a required step. `checkIn()` gains optional `visibility` param, default `'friends'` (= current behavior).
- Light theme: white cards (`bg-card`), hairline borders (`border-border`, resolves to `#E8E8E5`), purple `#6C45FF` only via existing `primary` tokens for actions/active. Use tokens, never raw hex.
- **Typecheck:** always `npx tsc --noEmit -p tsconfig.app.json` — bare `npx tsc` is a silent no-op.
- **No test framework exists** in this repo and new packages are banned, so per-task verification = typecheck + dev-server behavior check (`npm run dev`); full verification (build + two-account Playwright matrix on deployed preview) is Task 8.
- **21st.dev budget:** exactly one `mcp__21st__get_component` call for **id 17144 "Astryx Avatar"**, in Task 7 only. Id 7734 (Place Card) is NOT part of this feature. Search calls are free.
- Realtime: no new channels; the existing `venue-activity` poke stays content-free. Freshness = 60s poll + refetch-on-focus + one added invalidation in AppLayout's poke handler.
- Banned copy: "seamless experience", "unlock the power of", etc. (CLAUDE.md tone rules). Casual, human, direct.

**localStorage keys (on-device persistence):** `endz:checkin-visibility` (last visibility choice), `endz:dismissed-suggestions` (JSON array of dismissed profile ids).

---

### Task 1: Branch + friends data layer (`src/lib/friends.ts`)

**Files:**
- Create: `src/lib/friends.ts`

**Interfaces:**
- Consumes: `getSupabase()` from `src/lib/supabase.ts`, `Vibe` from `src/lib/checkins.ts`.
- Produces (all consumed by Task 2's hooks and later components):
  - Types: `FriendProfile`, `FriendshipStatus`, `FriendshipRow`, `FriendOutTonight`, `Relationship`
  - Async: `listMyFriendships()`, `searchProfiles(myId, q)`, `suggestedProfiles(myId)`, `sendRequest(myId, friendId)`, `acceptRequest(rowId)`, `declineRequest(rowId)`, `cancelRequest(rowId)`, `removeFriend(rowId)`, `blockUser(myId, profileId)`, `friendsOutTonight(friends)`
  - Pure selectors: `otherProfile(row, myId)`, `deriveFriends(rows, myId)`, `deriveIncoming(rows, myId)`, `deriveOutgoing(rows, myId)`, `deriveRelationship(rows, myId, otherId)`
  - localStorage helpers: `getDismissedSuggestions(): string[]`, `dismissSuggestion(id: string): void`

- [ ] **Step 1: Create the branch**

```bash
cd ~/Documents/night-guide
git checkout main && git checkout -b feat/friends-core
```

- [ ] **Step 2: Write `src/lib/friends.ts`**

Note on the spec's function list: the spec names `listFriends()` / `listPending()`. Here they are pure selectors (`deriveFriends`/`deriveIncoming`/`deriveOutgoing`) over one fetch (`listMyFriendships`) so Requests, Your friends, Suggested-exclusion, and Add-button states all share a single query/poll instead of 3 overlapping ones. Same capabilities, one network call.

```typescript
/**
 * Friends data layer — plain async functions, mirroring src/lib/checkins.ts.
 * State reads happen through src/hooks/useFriends.ts (React Query).
 *
 * RLS is the only privacy boundary: queries return exactly what the caller
 * may see and the UI renders exactly that — no client-side privacy filtering.
 *
 * Enum reality: friend_status = pending | accepted | blocked (no 'declined').
 * Decline/cancel/remove are row DELETEs. Blocking is delete-then-insert so
 * user_id is always the blocker.
 *
 * Deletes/updates verify a row actually changed (.select("id") count check):
 * until the friendships RLS patch lands, deletes silently match 0 rows —
 * throwing here lets optimistic UI roll back instead of lying.
 */
import { getSupabase } from "@/lib/supabase";
import { Vibe } from "@/lib/checkins";

export type FriendProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type FriendshipRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  requester: FriendProfile; // profiles row for user_id
  recipient: FriendProfile; // profiles row for friend_id
};

export type FriendOutTonight = {
  checkInId: string;
  profile: FriendProfile;
  venueId: string;
  venueName: string;
  vibe: Vibe | null;
  checkedInAt: string;
};

export type Relationship = "none" | "friends" | "incoming" | "outgoing" | "blocked";

const PROFILE_COLS = "id, username, display_name, avatar_url";
const FRIENDSHIP_COLS = `id, user_id, friend_id, status, created_at,
  requester:profiles!friendships_user_id_fkey(${PROFILE_COLS}),
  recipient:profiles!friendships_friend_id_fkey(${PROFILE_COLS})`;

/** Every friendship row I'm party to (any status) — RLS scopes it to mine. */
export async function listMyFriendships(): Promise<FriendshipRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("friendships").select(FRIENDSHIP_COLS);
  if (error) throw error;
  return (data as unknown as FriendshipRow[]) ?? [];
}

export function otherProfile(row: FriendshipRow, myId: string): FriendProfile {
  return row.user_id === myId ? row.recipient : row.requester;
}

export function deriveFriends(rows: FriendshipRow[], myId: string) {
  return rows
    .filter((r) => r.status === "accepted")
    .map((r) => ({ rowId: r.id, profile: otherProfile(r, myId) }));
}

export function deriveIncoming(rows: FriendshipRow[], myId: string) {
  return rows
    .filter((r) => r.status === "pending" && r.friend_id === myId)
    .map((r) => ({ rowId: r.id, profile: r.requester }));
}

export function deriveOutgoing(rows: FriendshipRow[], myId: string) {
  return rows
    .filter((r) => r.status === "pending" && r.user_id === myId)
    .map((r) => ({ rowId: r.id, profile: r.recipient }));
}

export function deriveRelationship(rows: FriendshipRow[], myId: string, otherId: string): Relationship {
  const row = rows.find(
    (r) =>
      (r.user_id === myId && r.friend_id === otherId) ||
      (r.user_id === otherId && r.friend_id === myId)
  );
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  if (row.status === "blocked") return "blocked";
  return row.user_id === myId ? "outgoing" : "incoming";
}

/** Username + display-name search, excluding self. Leading @ is fine. */
export async function searchProfiles(myId: string, q: string): Promise<FriendProfile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  // Strip a leading @ and PostgREST or()-syntax characters
  const term = q.replace(/^@/, "").replace(/[,()%]/g, "").trim();
  if (!term) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    .neq("id", myId)
    .limit(10);
  if (error) throw error;
  return (data as FriendProfile[]) ?? [];
}

/**
 * Newest sign-ups first, excluding self. Overfetches so the hook can drop
 * profiles with an existing friendships row or an on-device dismissal.
 */
export async function suggestedProfiles(myId: string): Promise<FriendProfile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .neq("id", myId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data as FriendProfile[]) ?? [];
}

export async function sendRequest(myId: string, friendId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("friendships")
    .insert({ user_id: myId, friend_id: friendId });
  if (error) throw error;
}

export async function acceptRequest(rowId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", rowId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Request not found");
}

async function deleteFriendshipRow(rowId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", rowId)
    .select("id");
  if (error) throw error;
  // 0 rows = RLS blocked the delete (expected until the friendships patch lands)
  if (!data || data.length === 0) throw new Error("Couldn't remove that row");
}

export async function declineRequest(rowId: string): Promise<void> {
  return deleteFriendshipRow(rowId);
}

export async function cancelRequest(rowId: string): Promise<void> {
  return deleteFriendshipRow(rowId);
}

export async function removeFriend(rowId: string): Promise<void> {
  return deleteFriendshipRow(rowId);
}

/**
 * Block semantics (spec): delete any existing row between the pair, then
 * insert (blocker, blocked, 'blocked') so user_id is always the blocker.
 * No count check on the delete — blocking someone with no prior row is legit.
 */
export async function blockUser(myId: string, profileId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const del = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(user_id.eq.${myId},friend_id.eq.${profileId}),and(user_id.eq.${profileId},friend_id.eq.${myId})`
    );
  if (del.error) throw del.error;
  const ins = await supabase
    .from("friendships")
    .insert({ user_id: myId, friend_id: profileId, status: "blocked" });
  if (ins.error) throw ins.error;
}

/**
 * Accepted friends ∩ active_check_ins, joined with venue names.
 * Three explicit queries (no PostgREST embedding through the view):
 * check-ins for friend ids, venues for names, profiles come from the caller.
 * RLS ("checkins visible per rules") already excludes ghost mode, 'nobody',
 * and non-friend rows — render exactly what comes back.
 */
export async function friendsOutTonight(friends: FriendProfile[]): Promise<FriendOutTonight[]> {
  const supabase = getSupabase();
  if (!supabase || friends.length === 0) return [];
  const { data, error } = await supabase
    .from("active_check_ins")
    .select("id, user_id, venue_id, vibe, created_at")
    .in("user_id", friends.map((f) => f.id))
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; user_id: string; venue_id: string; vibe: Vibe | null; created_at: string }[];
  if (rows.length === 0) return [];
  const venueIds = [...new Set(rows.map((r) => r.venue_id))];
  const { data: venues, error: vErr } = await supabase
    .from("venues")
    .select("id, name")
    .in("id", venueIds);
  if (vErr) throw vErr;
  const venueName = new Map((venues ?? []).map((v: { id: string; name: string }) => [v.id, v.name]));
  const profileById = new Map(friends.map((f) => [f.id, f]));
  return rows.flatMap((r) => {
    const profile = profileById.get(r.user_id);
    if (!profile) return [];
    return [{
      checkInId: r.id,
      profile,
      venueId: r.venue_id,
      venueName: venueName.get(r.venue_id) ?? "a spot nearby",
      vibe: r.vibe,
      checkedInAt: r.created_at,
    }];
  });
}

/* ── On-device dismissals for "Suggested for you" ── */

const DISMISSED_KEY = "endz:dismissed-suggestions";

export function getDismissedSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function dismissSuggestion(id: string): void {
  const next = [...new Set([...getDismissedSuggestions(), id])];
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/friends.ts
git commit -m "feat: friends data layer (search, requests, block, out-tonight)"
```

---

### Task 2: React Query hooks (`src/hooks/useFriends.ts`) + AppLayout poke invalidation

**Files:**
- Create: `src/hooks/useFriends.ts`
- Modify: `src/layouts/AppLayout.tsx:20-24` (poke handler)

**Interfaces:**
- Consumes: everything from Task 1; `useAuthStore` from `src/store/auth.ts`.
- Produces (consumed by Tasks 4–7):
  - `useMyFriendships(): UseQueryResult<FriendshipRow[]>` — key `["friendships", userId]`
  - `useFriendsOutTonight(): UseQueryResult<FriendOutTonight[]>` — key `["friends-out-tonight", userId]`, 60s poll + refetch-on-focus
  - `useSearchProfiles(term: string): UseQueryResult<FriendProfile[]>` — enabled at `term.length >= 2`
  - `useSuggestedProfiles(): UseQueryResult<FriendProfile[]>`
  - Mutations (all optimistic against `["friendships", userId]`, rollback on error):
    `useSendRequest()` (`mutate(profile: FriendProfile)`), `useAcceptRequest()` (`mutate(rowId: string)`), `useDeclineRequest()`, `useCancelRequest()`, `useRemoveFriend()` (each `mutate(rowId: string)`), `useBlockUser()` (`mutate(profile: FriendProfile)`)

- [ ] **Step 1: Write `src/hooks/useFriends.ts`**

```typescript
/**
 * React Query layer for the friends graph. One query (["friendships", userId])
 * feeds requests, the friends list, suggested-exclusion, and Add-button
 * states; mutations flip it optimistically and roll back on error
 * (pre-RLS-patch, decline/cancel/remove/block are EXPECTED to roll back —
 * see the spec's "hard prerequisite before merge").
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  FriendOutTonight,
  FriendProfile,
  FriendshipRow,
  acceptRequest,
  blockUser,
  cancelRequest,
  declineRequest,
  deriveFriends,
  friendsOutTonight,
  listMyFriendships,
  removeFriend,
  searchProfiles,
  sendRequest,
  suggestedProfiles,
} from "@/lib/friends";

export function useMyFriendships() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendshipRow[]>({
    queryKey: ["friendships", userId],
    enabled: !!userId,
    queryFn: () => listMyFriendships(),
  });
}

/** Accepted friends with an active check-in. Poll + focus keep it fresh; the
 *  AppLayout poke invalidation makes it ~2s after any check-in. */
export function useFriendsOutTonight() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const friends = useMemo(
    () => (rows && userId ? deriveFriends(rows, userId).map((f) => f.profile) : undefined),
    [rows, userId]
  );
  return useQuery<FriendOutTonight[]>({
    queryKey: ["friends-out-tonight", userId],
    enabled: !!userId && friends !== undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => friendsOutTonight(friends ?? []),
  });
}

export function useSearchProfiles(term: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendProfile[]>({
    queryKey: ["profile-search", userId, term],
    enabled: !!userId && term.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: () => searchProfiles(userId!, term),
  });
}

export function useSuggestedProfiles() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendProfile[]>({
    queryKey: ["suggested-profiles", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => suggestedProfiles(userId!),
  });
}

/* ── Optimistic mutation plumbing ── */

function useFriendshipMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<void>,
  update: (rows: FriendshipRow[], vars: TVars) => FriendshipRow[]
) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: ["friendships", userId] });
      const prev = queryClient.getQueryData<FriendshipRow[]>(["friendships", userId]);
      if (prev) queryClient.setQueryData(["friendships", userId], update(prev, vars));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["friendships", userId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
      queryClient.invalidateQueries({ queryKey: ["friends-out-tonight", userId] });
    },
  });
}

function meAsProfile(): FriendProfile | null {
  const me = useAuthStore.getState().profile;
  if (!me) return null;
  return { id: me.id, username: me.username, display_name: me.display_name, avatar_url: me.avatar_url };
}

export function useSendRequest() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useFriendshipMutation<FriendProfile>(
    (profile) => sendRequest(userId!, profile.id),
    (rows, profile) => {
      const me = meAsProfile();
      if (!userId || !me) return rows;
      const optimistic: FriendshipRow = {
        id: `optimistic-${profile.id}`,
        user_id: userId,
        friend_id: profile.id,
        status: "pending",
        created_at: new Date().toISOString(),
        requester: me,
        recipient: profile,
      };
      return [...rows, optimistic];
    }
  );
}

export function useAcceptRequest() {
  return useFriendshipMutation<string>(
    (rowId) => acceptRequest(rowId),
    (rows, rowId) => rows.map((r) => (r.id === rowId ? { ...r, status: "accepted" as const } : r))
  );
}

export function useDeclineRequest() {
  return useFriendshipMutation<string>(
    (rowId) => declineRequest(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useCancelRequest() {
  return useFriendshipMutation<string>(
    (rowId) => cancelRequest(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useRemoveFriend() {
  return useFriendshipMutation<string>(
    (rowId) => removeFriend(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useBlockUser() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useFriendshipMutation<FriendProfile>(
    (profile) => blockUser(userId!, profile.id),
    (rows, profile) => {
      const me = meAsProfile();
      if (!userId || !me) return rows;
      const rest = rows.filter(
        (r) =>
          !(
            (r.user_id === userId && r.friend_id === profile.id) ||
            (r.user_id === profile.id && r.friend_id === userId)
          )
      );
      const blockedRow: FriendshipRow = {
        id: `optimistic-block-${profile.id}`,
        user_id: userId,
        friend_id: profile.id,
        status: "blocked",
        created_at: new Date().toISOString(),
        requester: me,
        recipient: profile,
      };
      return [...rest, blockedRow];
    }
  );
}
```

- [ ] **Step 2: Add the poke invalidation in `src/layouts/AppLayout.tsx`**

Replace the existing effect body (lines 20–24):

```typescript
  // Live venue activity: any client's check-in/out pokes this channel and
  // every open map refetches counts within ~2s. Friends presence rides the
  // same content-free poke — identities only ever come back through the
  // RLS-guarded refetch, never over the channel.
  useEffect(() => {
    return subscribeActivity(() => {
      queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
      queryClient.invalidateQueries({ queryKey: ["friends-out-tonight"] });
    });
  }, [queryClient]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFriends.ts src/layouts/AppLayout.tsx
git commit -m "feat: friends React Query hooks with optimistic mutations"
```

---

### Task 3: Check-in visibility toggle

**Files:**
- Modify: `src/lib/checkins.ts` (add `CheckinVisibility`, `VIBE_LABELS`, storage helpers; extend `checkIn`)
- Create: `src/components/CheckInVisibility.tsx`
- Modify: `src/components/CheckInCard.tsx` (use `VIBE_LABELS`, wire visibility)

**Interfaces:**
- Produces:
  - `CheckinVisibility = "everyone" | "friends" | "nobody"` (lib/checkins.ts)
  - `checkIn(userId: string, venueId: string, visibility?: CheckinVisibility)` — default `'friends'`
  - `getStoredVisibility(): CheckinVisibility`, `storeVisibility(v): void`
  - `VIBE_LABELS: Record<Vibe, string>` (consumed by Task 4's `OutTonightRow`)
  - `<CheckInVisibility value onChange />` component

- [ ] **Step 1: Extend `src/lib/checkins.ts`**

Add below the `Vibe` type:

```typescript
export const VIBE_LABELS: Record<Vibe, string> = {
  chill: "😌 Chill",
  building: "📈 Building",
  packed: "🔥 Packed",
};

export type CheckinVisibility = "everyone" | "friends" | "nobody";

/** Last visibility choice, remembered on-device as the new default. */
const VISIBILITY_KEY = "endz:checkin-visibility";

export function getStoredVisibility(): CheckinVisibility {
  const v = localStorage.getItem(VISIBILITY_KEY);
  return v === "everyone" || v === "nobody" ? v : "friends";
}

export function storeVisibility(v: CheckinVisibility): void {
  localStorage.setItem(VISIBILITY_KEY, v);
}
```

Change `checkIn` to accept visibility (default preserves current behavior — the DB column already exists with default `'friends'`, no schema change):

```typescript
/** One place at a time: end any active check-in, then create the new one. */
export async function checkIn(
  userId: string,
  venueId: string,
  visibility: CheckinVisibility = "friends"
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error: endError } = await supabase
    .from("check_ins")
    .delete()
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  if (endError) throw endError;
  const { error } = await supabase
    .from("check_ins")
    .insert({ user_id: userId, venue_id: venueId, visibility });
  if (error) throw error;
}
```

- [ ] **Step 2: Create `src/components/CheckInVisibility.tsx`**

```tsx
/**
 * Quiet per-check-in visibility control: one line under the check-in button,
 * a 3-option bottom sheet on tap. Never a required step — check-in stays
 * one tap. Enforcement is the DB's "checkins visible per rules" policy;
 * this only picks the value written with the row.
 */
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CheckinVisibility as Visibility } from "@/lib/checkins";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Anyone on ENDZ can see you're here" },
  { value: "friends", label: "Friends", hint: "Only your friends see you" },
  { value: "nobody", label: "Nobody", hint: "Check in silently — you still count in the crowd" },
];

export default function CheckInVisibility({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Check-in visibility: ${current.label}. Change`}
      >
        Visible to: <span className="font-semibold text-foreground">{current.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerTitle className="px-4 pt-2 text-base font-semibold text-center">
            Who sees your check-in?
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose who can see you're here. Your choice sticks for next time.
          </DrawerDescription>
          <div className="max-w-lg mx-auto w-full px-4 pb-8 pt-3 space-y-2">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  value === o.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:bg-secondary"
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
                {value === o.value && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 3: Wire into `src/components/CheckInCard.tsx`**

Three edits:

1. Imports — replace the local `VIBES` array with `VIBE_LABELS` and pull in the new pieces:

```typescript
import {
  checkIn, checkOut, setVibe, pokeActivity, Vibe, VIBE_LABELS,
  CheckinVisibility as Visibility, getStoredVisibility, storeVisibility,
} from "@/lib/checkins";
import CheckInVisibility from "@/components/CheckInVisibility";

const VIBES: { value: Vibe; label: string }[] = (
  Object.keys(VIBE_LABELS) as Vibe[]
).map((value) => ({ value, label: VIBE_LABELS[value] }));
```

2. State + call site — inside the component add:

```typescript
const [visibility, setVisibility] = useState<Visibility>(getStoredVisibility);
const changeVisibility = (v: Visibility) => {
  setVisibility(v);
  storeVisibility(v); // last choice becomes the new default
};
```

and in `doCheckIn` change `await checkIn(userId, venueId);` to:

```typescript
await checkIn(userId, venueId, visibility);
```

3. Render — wrap the final not-checked-in branch (the `<Button ...>Check in</Button>` at the end of the JSX) so the quiet line sits under the button:

```tsx
      ) : (
        <div>
          <Button className="w-full h-12 rounded-xl" disabled={busy} onClick={doCheckIn}>
            {checkedInElsewhere ? "Check in here instead" : "Check in"}
          </Button>
          <CheckInVisibility value={visibility} onChange={changeVisibility} />
        </div>
      )}
```

- [ ] **Step 4: Typecheck + behavior check**

Run: `npx tsc --noEmit -p tsconfig.app.json` → exit 0.
Run `npm run dev`, open a venue sheet:
- "Visible to: **Friends** ▾" shows under the Check in button.
- Tapping opens the 3-option sheet; picking "Everyone" closes it, line updates, `localStorage["endz:checkin-visibility"] === "everyone"`, survives reload.
- Check-in itself is still exactly one tap (the line never blocks it).

- [ ] **Step 5: Commit**

```bash
git add src/lib/checkins.ts src/components/CheckInVisibility.tsx src/components/CheckInCard.tsx
git commit -m "feat: per-check-in visibility toggle (everyone/friends/nobody)"
```

---

### Task 4: Social row components (avatar, add button, request/friend/out-tonight rows)

**Files:**
- Modify: `src/lib/format.ts` (add `timeAgo`)
- Create: `src/components/social/ProfileAvatar.tsx`
- Create: `src/components/social/AddButton.tsx`
- Create: `src/components/social/RequestRow.tsx`
- Create: `src/components/social/FriendRow.tsx`
- Create: `src/components/social/OutTonightRow.tsx`

**Interfaces:**
- Consumes: Task 1 types/selectors, Task 2 hooks, `VIBE_LABELS` (Task 3), shadcn `Avatar`/`Button`/`Drawer`.
- Produces (consumed by Tasks 5–6):
  - `timeAgo(iso: string): string`
  - `<ProfileAvatar profile={FriendProfile} className? />`
  - `<AddButton profile={FriendProfile} />` — renders Add / Requested / Accept / "Friends ✓" from relationship state
  - `<RequestRow rowId profile direction={"incoming" | "outgoing"} />`
  - `<FriendRow rowId profile />` — row tap → Remove/Block action sheet
  - `<OutTonightRow friend={FriendOutTonight} />` — tap → navigate `/` with `{ state: { venueId } }`

- [ ] **Step 1: Add `timeAgo` to `src/lib/format.ts`**

```typescript
/** "just now" / "12m ago" / "2h ago" — coarse on purpose, it's nightlife not logistics. */
export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
```

- [ ] **Step 2: Create `src/components/social/ProfileAvatar.tsx`**

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FriendProfile } from "@/lib/friends";
import { cn } from "@/lib/utils";

export default function ProfileAvatar({
  profile,
  className,
}: {
  profile: FriendProfile;
  className?: string;
}) {
  const initial = (profile.display_name || profile.username).slice(0, 1).toUpperCase();
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
      <AvatarFallback className="bg-primary-soft text-primary text-sm font-semibold">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
```

- [ ] **Step 3: Create `src/components/social/AddButton.tsx`**

```tsx
/**
 * The Snapchat-verb button: Add → Requested (optimistic flip, rollback on
 * error). Shows Accept when they already added you, a quiet "Friends ✓"
 * when you're connected, nothing when blocked.
 */
import { useAuthStore } from "@/store/auth";
import { FriendProfile, deriveIncoming, deriveRelationship } from "@/lib/friends";
import { useAcceptRequest, useMyFriendships, useSendRequest } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";

export default function AddButton({ profile }: { profile: FriendProfile }) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const send = useSendRequest();
  const accept = useAcceptRequest();

  if (!userId || !rows) return null;
  const rel = deriveRelationship(rows, userId, profile.id);

  if (rel === "blocked") return null;
  if (rel === "friends")
    return <span className="text-xs font-medium text-muted-foreground shrink-0">Friends ✓</span>;
  if (rel === "outgoing")
    return (
      <Button size="sm" variant="secondary" disabled className="rounded-full px-4 shrink-0">
        Requested
      </Button>
    );
  if (rel === "incoming") {
    const row = deriveIncoming(rows, userId).find((r) => r.profile.id === profile.id);
    return (
      <Button
        size="sm"
        className="rounded-full px-4 shrink-0"
        onClick={() => row && accept.mutate(row.rowId)}
      >
        Accept
      </Button>
    );
  }
  return (
    <Button size="sm" className="rounded-full px-4 shrink-0" onClick={() => send.mutate(profile)}>
      Add
    </Button>
  );
}
```

- [ ] **Step 4: Create `src/components/social/RequestRow.tsx`**

```tsx
/** Incoming: Accept (filled) / Decline (ghost). Outgoing: Cancel (ghost). */
import { FriendProfile } from "@/lib/friends";
import { useAcceptRequest, useCancelRequest, useDeclineRequest } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function RequestRow({
  rowId,
  profile,
  direction,
}: {
  rowId: string;
  profile: FriendProfile;
  direction: "incoming" | "outgoing";
}) {
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const cancel = useCancelRequest();

  return (
    <div className="flex items-center gap-3 py-2.5">
      <ProfileAvatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">@{profile.username}</p>
        {profile.display_name && (
          <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
        )}
      </div>
      {direction === "incoming" ? (
        <>
          <Button size="sm" className="rounded-full px-4" onClick={() => accept.mutate(rowId)}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full px-3 text-muted-foreground"
            onClick={() => decline.mutate(rowId)}
          >
            Decline
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full px-3 text-muted-foreground"
          onClick={() => cancel.mutate(rowId)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/social/FriendRow.tsx`**

```tsx
/** A friend in "Your friends" — row tap opens a Remove / Block action sheet. */
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { FriendProfile } from "@/lib/friends";
import { useBlockUser, useRemoveFriend } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function FriendRow({ rowId, profile }: { rowId: string; profile: FriendProfile }) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveFriend();
  const block = useBlockUser();

  return (
    <>
      <button
        className="w-full flex items-center gap-3 py-2.5 text-left"
        onClick={() => setOpen(true)}
        aria-label={`Manage @${profile.username}`}
      >
        <ProfileAvatar profile={profile} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">@{profile.username}</p>
          {profile.display_name && (
            <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
          )}
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerTitle className="px-4 pt-2 text-base font-semibold text-center">
            @{profile.username}
          </DrawerTitle>
          <DrawerDescription className="sr-only">Remove or block this friend.</DrawerDescription>
          <div className="max-w-lg mx-auto w-full px-4 pb-8 pt-3 space-y-2">
            <Button
              variant="secondary"
              className="w-full h-11 rounded-xl"
              onClick={() => {
                remove.mutate(rowId);
                setOpen(false);
              }}
            >
              Remove friend
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl text-red-600 hover:text-red-700"
              onClick={() => {
                block.mutate(profile);
                setOpen(false);
              }}
            >
              Block @{profile.username}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 6: Create `src/components/social/OutTonightRow.tsx`**

```tsx
/**
 * A friend with an active check-in. Tap flies the map to their venue —
 * same selection path a search pick uses (MapPage reads the venueId from
 * navigation state; wired in Task 6).
 */
import { useNavigate } from "react-router-dom";
import { FriendOutTonight } from "@/lib/friends";
import { VIBE_LABELS } from "@/lib/checkins";
import { timeAgo } from "@/lib/format";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function OutTonightRow({ friend }: { friend: FriendOutTonight }) {
  const navigate = useNavigate();
  const firstName = friend.profile.display_name?.split(" ")[0] || `@${friend.profile.username}`;

  return (
    <button
      onClick={() => navigate("/", { state: { venueId: friend.venueId } })}
      className="w-full flex items-center gap-3 py-2.5 text-left"
    >
      <div className="relative shrink-0">
        <ProfileAvatar profile={friend.profile} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {firstName} <span className="font-normal text-muted-foreground">is at</span>{" "}
          {friend.venueName}
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo(friend.checkedInAt)}</p>
      </div>
      {friend.vibe && (
        <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-secondary">
          {VIBE_LABELS[friend.vibe]}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json` → exit 0. (Components aren't mounted yet; behavior lands with Task 6.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/format.ts src/components/social/
git commit -m "feat: social row components (add/request/friend/out-tonight)"
```

---

### Task 5: Find-friends block (search, share-handle card, suggested list)

**Files:**
- Create: `src/components/social/ProfileSearch.tsx`
- Create: `src/components/social/ShareHandleCard.tsx`
- Create: `src/components/social/SuggestedList.tsx`

**Interfaces:**
- Consumes: Task 2 hooks, Task 4 `ProfileAvatar`/`AddButton`, Task 1 `deriveRelationship`/`getDismissedSuggestions`/`dismissSuggestion`.
- Produces: `<ProfileSearch />`, `<ShareHandleCard />`, `<SuggestedList />` — all self-contained, composed by Task 6's Social page.

- [ ] **Step 1: Create `src/components/social/ProfileSearch.tsx`**

Debounce mirrors PickUsername's 400ms pattern.

```tsx
/** Debounced people search — username + display name, self excluded server-side. */
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useSearchProfiles } from "@/hooks/useFriends";
import { Input } from "@/components/ui/input";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import AddButton from "@/components/social/AddButton";

export default function ProfileSearch() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // Debounced availability-check pattern from PickUsername
  useEffect(() => {
    const t = setTimeout(() => setTerm(input.trim()), 400);
    return () => clearTimeout(t);
  }, [input]);

  const { data: results, isFetching } = useSearchProfiles(term);
  const searching = term.length >= 2;

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by username or name"
          className="pl-9 h-11 rounded-xl"
          aria-label="Search people"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {searching && results && results.length > 0 && (
        <div className="mt-1">
          {results.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <ProfileAvatar profile={p} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">@{p.username}</p>
                {p.display_name && (
                  <p className="text-xs text-muted-foreground truncate">{p.display_name}</p>
                )}
              </div>
              <AddButton profile={p} />
            </div>
          ))}
        </div>
      )}
      {searching && results && results.length === 0 && !isFetching && (
        <p className="text-sm text-muted-foreground py-3">No one by that name yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/social/ShareHandleCard.tsx`**

```tsx
/** "You're @handle — send it to the crew." Native share, copy fallback. */
import { useState } from "react";
import { Share2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";

export default function ShareHandleCard() {
  const profile = useAuthStore((s) => s.profile);
  const [copied, setCopied] = useState(false);
  if (!profile) return null;
  const handle = `@${profile.username}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (non-secure context) — nothing sane to do
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: `I'm ${handle} on ENDZ — add me`,
          url: window.location.origin,
        });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      copy();
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-3.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">You're {handle}</p>
        <p className="text-xs text-muted-foreground">Send it to the crew.</p>
      </div>
      <Button size="sm" variant="secondary" className="rounded-full shrink-0" onClick={copy}>
        {copied ? "Copied ✓" : "Copy"}
      </Button>
      <Button size="sm" className="rounded-full shrink-0" onClick={share}>
        <Share2 className="h-3.5 w-3.5 mr-1" /> Share
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/social/SuggestedList.tsx`**

Filtering note: rows with an outgoing pending request stay visible (showing "Requested") so the optimistic Add→Requested flip doesn't make the row vanish mid-tap. Friends, incoming, and blocked are excluded, as are on-device dismissals.

```tsx
/** "Suggested for you" — newest sign-ups, ✕ dismissals persisted on-device. */
import { useState } from "react";
import { X } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  deriveRelationship,
  dismissSuggestion,
  getDismissedSuggestions,
} from "@/lib/friends";
import { useMyFriendships, useSuggestedProfiles } from "@/hooks/useFriends";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import AddButton from "@/components/social/AddButton";

export default function SuggestedList() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const { data: suggestions } = useSuggestedProfiles();
  const [dismissed, setDismissed] = useState<string[]>(getDismissedSuggestions);

  if (!userId || !rows || !suggestions) return null;

  const visible = suggestions
    .filter((p) => {
      const rel = deriveRelationship(rows, userId, p.id);
      return rel === "none" || rel === "outgoing"; // keep just-added rows showing "Requested"
    })
    .filter((p) => !dismissed.includes(p.id))
    .slice(0, 8);

  if (visible.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Suggested for you
      </h3>
      {visible.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <ProfileAvatar profile={p} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">@{p.username}</p>
            {p.display_name && (
              <p className="text-xs text-muted-foreground truncate">{p.display_name}</p>
            )}
          </div>
          <AddButton profile={p} />
          <button
            aria-label={`Dismiss @${p.username}`}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              dismissSuggestion(p.id);
              setDismissed((d) => [...d, p.id]);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/social/
git commit -m "feat: find-friends block (search, share handle, suggested)"
```

---

### Task 6: Social page composition + map fly-to from navigation state

**Files:**
- Modify: `src/pages/Social.tsx` (full rebuild — the 34-line stub becomes a thin composition)
- Modify: `src/pages/MapPage.tsx` (select a venue passed via `location.state.venueId`)

**Interfaces:**
- Consumes: Tasks 1–5. `OutTonightRow` navigates with `navigate("/", { state: { venueId } })`; MapPage must honor it.
- Produces: the shipped `/social` page (existing tab + route, no route changes).

- [ ] **Step 1: Rewrite `src/pages/Social.tsx`**

Empty-state rules (spec): Requests renders only when non-empty; Out tonight and Your friends collapse at 0 friends so Find friends leads the page; friends-but-nobody-out shows "Nobody's out yet — someone's gotta go first."; signed-out keeps the existing sign-in prompt unchanged.

```tsx
/**
 * Social — thin composition over src/components/social/*.
 * Section order (spec): header → requests → out tonight → find friends →
 * your friends. RLS decides every list's contents; nothing is filtered in.
 */
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { deriveFriends, deriveIncoming, deriveOutgoing } from "@/lib/friends";
import { useFriendsOutTonight, useMyFriendships } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import RequestRow from "@/components/social/RequestRow";
import FriendRow from "@/components/social/FriendRow";
import OutTonightRow from "@/components/social/OutTonightRow";
import ProfileSearch from "@/components/social/ProfileSearch";
import ShareHandleCard from "@/components/social/ShareHandleCard";
import SuggestedList from "@/components/social/SuggestedList";

const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-3xl border border-border bg-card p-4 mb-4 animate-fade-in">
    <h2 className="text-sm font-semibold mb-1">{title}</h2>
    {children}
  </div>
);

const Social = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const { data: out } = useFriendsOutTonight();

  const header = (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">Social</h1>
      <p className="text-sm text-muted-foreground">Find out where your friends are tonight</p>
    </header>
  );

  // Signed out / mid-onboarding: existing prompt, unchanged.
  if (status !== "signedIn") {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {header}
        <div className="glass rounded-3xl p-8 text-center animate-fade-in">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No friend check-ins yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to add friends and see where they're at.
          </p>
          {status === "signedOut" && (
            <Button className="w-full h-11 rounded-xl mt-5" onClick={() => navigate("/profile")}>
              Sign in
            </Button>
          )}
        </div>
      </section>
    );
  }

  const incoming = rows && userId ? deriveIncoming(rows, userId) : [];
  const outgoing = rows && userId ? deriveOutgoing(rows, userId) : [];
  const friends = rows && userId ? deriveFriends(rows, userId) : [];

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {header}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <SectionCard title="Requests">
          {incoming.map((r) => (
            <RequestRow key={r.rowId} rowId={r.rowId} profile={r.profile} direction="incoming" />
          ))}
          {outgoing.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-180">
                Requested ({outgoing.length}) <ChevronDown className="h-3 w-3 transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {outgoing.map((r) => (
                  <RequestRow key={r.rowId} rowId={r.rowId} profile={r.profile} direction="outgoing" />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </SectionCard>
      )}

      {friends.length > 0 && (
        <SectionCard title="Out tonight">
          {out && out.length > 0 ? (
            out.map((f) => <OutTonightRow key={f.checkInId} friend={f} />)
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nobody's out yet — someone's gotta go first.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard title="Find friends">
        <ProfileSearch />
        <ShareHandleCard />
        <SuggestedList />
      </SectionCard>

      {friends.length > 0 && (
        <SectionCard title={`Your friends (${friends.length})`}>
          {friends.map((f) => (
            <FriendRow key={f.rowId} rowId={f.rowId} profile={f.profile} />
          ))}
        </SectionCard>
      )}
    </section>
  );
};

export default Social;
```

- [ ] **Step 2: Honor `location.state.venueId` in `src/pages/MapPage.tsx`**

Selecting a venue is the existing fly-to path (`Map` flies to `selectedId`, `MapPage.tsx:214-223`). Add imports at the top: change the react-router import to `import { useNavigate, useLocation } from "react-router-dom";` and add `useEffect` to the react import (`import { useState, useMemo, useEffect } from "react";`).

Inside the `MapPage` component (after the `useVenues` calls, which define `allVenues`), add:

```typescript
  const location = useLocation();

  // Social's "out tonight" rows land here with a venue to spotlight.
  // Selecting it reuses the search-pick path (Map flies to selectedId).
  // allVenues, not the bbox-filtered set: the target may be off-viewport.
  useEffect(() => {
    const venueId = (location.state as { venueId?: string } | null)?.venueId;
    if (!venueId || !allVenues) return;
    const v = allVenues.find((x) => x.id === venueId);
    if (v) setSelected(v);
    navigate(".", { replace: true, state: null }); // consume the state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, allVenues]);
```

- [ ] **Step 3: Typecheck + behavior check**

Run: `npx tsc --noEmit -p tsconfig.app.json` → exit 0.
Run `npm run dev`:
- Signed out: `/social` shows the unchanged sign-in card.
- Signed in with 0 friends: page is header + Find friends only (search + share card + suggested); no Requests / Out tonight / Your friends sections.
- Search for a known username → row appears with **Add**; tap → flips to **Requested** instantly; the outgoing request appears under Requests → "Requested (1)" collapsed.
- Share card shows your real `@handle`; Copy puts it on the clipboard.
- Suggested: ✕ removes the row and it stays gone after reload (`endz:dismissed-suggestions`).
- Console: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Social.tsx src/pages/MapPage.tsx
git commit -m "feat: Social page — requests, out tonight, find friends, friends list"
```

---

### Task 7: Venue-sheet "friends here" row (21st.dev Astryx Avatar)

**Files:**
- Create: `src/components/ui/avatar-cluster.tsx`
- Create: `src/components/FriendsHereRow.tsx`
- Modify: `src/components/VenuePreview.tsx` (insert row between title block and check-in card)

**Interfaces:**
- Consumes: `useFriendsOutTonight()` (Task 2), shadcn `Avatar`.
- Produces:
  - `AvatarCluster({ people: ClusterPerson[]; max?: number; className?: string })` with `ClusterPerson = { id: string; name: string; avatarUrl: string | null }`
  - `<FriendsHereRow venueId={string} />` — renders null when no friend is visibly checked in.

- [ ] **Step 1: Pull the reserved 21st.dev component (budgeted — one call, this task only)**

Load the tool schema via `ToolSearch` query `select:mcp__21st__get_component`, then call `mcp__21st__get_component` with id **17144** ("Astryx Avatar"). Adapt its overlapping-cluster visuals into `src/components/ui/avatar-cluster.tsx` with the exact props interface below: strip any external deps/fonts (no new packages; strict self-containment), swap its colors for theme tokens (`ring-card`, `bg-secondary`, `bg-primary-soft`), and keep the repo's shadcn `Avatar` as the image primitive.

**If the pull fails or the component doesn't adapt cleanly, use this complete fallback implementation** (same file, same interface — later steps don't care which visual won):

```tsx
/**
 * Overlapping avatar cluster — max N faces then a "+K" chip.
 * Visual adapted from 21st.dev id 17144 "Astryx Avatar" (or fallback).
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ClusterPerson = { id: string; name: string; avatarUrl: string | null };

export default function AvatarCluster({
  people,
  max = 4,
  className,
}: {
  people: ClusterPerson[];
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {shown.map((p) => (
        <Avatar key={p.id} className="h-7 w-7 ring-2 ring-card">
          <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[10px] font-semibold bg-primary-soft text-primary">
            {p.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="h-7 w-7 rounded-full ring-2 ring-card bg-secondary flex items-center justify-center text-[10px] font-semibold">
          +{extra}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/FriendsHereRow.tsx`**

```tsx
/**
 * "Sam and 2 friends are here" on the venue sheet. Renders only when ≥1
 * friend is visibly checked in — visibility is whatever RLS returned, the
 * row never filters anyone in. Tap expands the names inline.
 */
import { useMemo, useState } from "react";
import { useFriendsOutTonight } from "@/hooks/useFriends";
import AvatarCluster from "@/components/ui/avatar-cluster";

function firstName(p: { display_name: string | null; username: string }): string {
  return p.display_name?.split(" ")[0] || `@${p.username}`;
}

export default function FriendsHereRow({ venueId }: { venueId: string }) {
  const { data: out } = useFriendsOutTonight();
  const [expanded, setExpanded] = useState(false);

  const here = useMemo(() => (out ?? []).filter((f) => f.venueId === venueId), [out, venueId]);
  if (here.length === 0) return null;

  const label =
    here.length === 1
      ? `${firstName(here[0].profile)} is here`
      : here.length === 2
      ? `${firstName(here[0].profile)} and ${firstName(here[1].profile)} are here`
      : `${firstName(here[0].profile)} and ${here.length - 1} friends are here`;

  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      aria-expanded={expanded}
      className="w-full mt-3 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 text-left hover:bg-secondary/60 transition-colors animate-fade-in"
    >
      <AvatarCluster
        people={here.map((f) => ({
          id: f.profile.id,
          name: f.profile.display_name || f.profile.username,
          avatarUrl: f.profile.avatar_url,
        }))}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{label}</p>
        {expanded && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {here.map((f) => f.profile.display_name || `@${f.profile.username}`).join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Insert into `src/components/VenuePreview.tsx`**

Add the import:

```typescript
import FriendsHereRow from "@/components/FriendsHereRow";
```

Place it between the title block and the check-in card — i.e., right after `<VenueQuickInfo venue={venue} />` (line 85):

```tsx
      <VenueQuickInfo venue={venue} />

      <FriendsHereRow venueId={venue.id} />

      {/* Stats */}
```

- [ ] **Step 4: Typecheck + behavior check**

Run: `npx tsc --noEmit -p tsconfig.app.json` → exit 0.
Run `npm run dev`: open a venue sheet with no friends checked in → no row, layout identical to before (renders null). With a friend checked in (needs the second account — if not available yet, defer the positive case to Task 8's matrix): cluster + "X is here", tap expands names. Check the sheet at 390 / 768 / 1440 widths — row must not overflow or push the check-in button around.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/avatar-cluster.tsx src/components/FriendsHereRow.tsx src/components/VenuePreview.tsx
git commit -m "feat: venue-sheet friends-here row with avatar cluster"
```

---

### Task 8: Full verification — build, deploy preview, two-account matrix. HOLD MERGE.

**Files:** none (verification only; fix-forward commits allowed).

- [ ] **Step 1: Static gates**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```
Expected: both exit 0. (Bare `npx tsc` is a silent no-op — don't use it.)

- [ ] **Step 2: Push for a deployed preview**

```bash
git push -u origin feat/friends-core
```
Vercel builds a preview for the branch — grab the preview URL from the Vercel dashboard or the GitHub check.

- [ ] **Step 3: STOP — coordinate with Colton on the two test accounts**

Auth is Google-OAuth-only (`src/store/auth.ts`), which Playwright can't automate cleanly. Ask Colton to either sign in manually in two browser profiles on the preview URL, or supply two test-account sessions. Do not fake accounts or touch auth code.

- [ ] **Step 4: Two-account matrix (Playwright on the deployed preview)**

Social is a non-map route, so the MapLibre screenshot gotcha doesn't apply there; for venue-sheet checks use computed styles / DOM assertions, not screenshots. Record each result:

| # | Check | Expected now (pre-RLS-patch) | Expected post-patch |
|---|---|---|---|
| 1 | A adds B → B accepts → both see "Friends" | PASS | PASS |
| 2 | Stranger cannot see a friends-visibility check-in | PASS | PASS |
| 3 | Ghost mode hides an active check-in from an accepted friend | PASS | PASS |
| 4 | Nobody-visibility hides from friends | PASS | PASS |
| 5 | Decline / cancel / remove | **EXPECTED FAIL** (row reappears after optimistic rollback — deletes match 0 rows) | PASS |
| 6 | Block, then blocked user cannot re-request | **EXPECTED FAIL** (insert-hardening missing) | PASS |
| 7 | Sender cannot self-accept | **EXPECTED FAIL** (no UPDATE WITH CHECK) | PASS |
| 8 | Social renders all four states: 0 friends / pending / friends-none-out / friends-out | PASS | PASS |
| 9 | Venue sheet friends-here row at 390 / 768 / 1440; check-in still one tap | PASS | PASS |
| 10 | 0 new console errors across /, /social, venue sheet | PASS | PASS |

- [ ] **Step 5: Report + hold**

Summarize the matrix results to Colton. **Do not merge.** The branch waits for the Opus session's `friendships` RLS patch (DELETE policy, UPDATE WITH CHECK, INSERT hardening, recorded in `~/Documents/endz/endz-schema.sql`); after it lands, re-run rows 5–7 and only then use superpowers:finishing-a-development-branch.

---

## Self-Review (done at plan time)

**Spec coverage:** header/tagline (T6) · requests incoming + collapsed outgoing w/ cancel (T4/T6) · out tonight w/ presence dot, vibe chip, time-since, fly-to (T4/T6, MapPage state hook) · debounced search (T5) · share-handle card w/ Web Share + copy fallback (T5) · suggested newest-first, exclusions, optimistic Add→Requested, persisted ✕ (T1/T5) · your friends w/ count + Remove/Block sheet (T4/T6) · venue-sheet friends-here w/ 21st id 17144, max 4 + "+N", inline expand (T7) · visibility toggle, remembered default, one-tap preserved (T3) · data layer mirroring check-in stack, 60s poll + focus + poke invalidation (T1/T2) · reads via active_check_ins, no client privacy filtering (T1) · verification incl. expected-fail rows pre-patch, merge held (T8). Contacts sync, mutual subtitles, map-pin avatars, crew strip: correctly absent (out of scope).

**Known deviations from the spec's letter (intentional):** `listFriends()`/`listPending()` became pure selectors over one `listMyFriendships()` query (one poll instead of three); suggested list keeps "outgoing" rows visible so the optimistic Requested flip doesn't delete the row under the user's finger.
