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
