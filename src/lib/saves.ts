/**
 * Saved-venue data layer — plain async functions, mirroring src/lib/friends.ts.
 * Reads happen through src/hooks/useSaves.ts (React Query).
 *
 * Saves lived in localStorage until 2026-08-05 (src/store/saved.ts). That store
 * is still the signed-out and offline fallback, but the server is the truth for
 * anyone signed in — a save has to be readable by a friend for the facepile on
 * a card to mean anything.
 *
 * RLS is the only privacy boundary: "saves visible per rules" returns exactly
 * what the caller may see (own / 'everyone' / accepted-friend 'friends', never
 * ghost mode). Render exactly what comes back — no client-side filtering.
 */
import { getSupabase } from "@/lib/supabase";
import type { FriendProfile } from "@/lib/friends";
import type { CheckinVisibility } from "@/lib/checkins";

const PROFILE_COLS = "id, username, display_name, avatar_url";

/** Venue ids the signed-in user has saved, newest first. */
export async function listMySaves(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("venue_saves")
    .select("venue_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { venue_id: string }) => r.venue_id);
}

export async function addSave(
  userId: string,
  venueId: string,
  visibility: CheckinVisibility
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  // upsert, not insert: the unique (user_id, venue_id) makes a double-tap a
  // 23505 otherwise, and a duplicate save is a no-op, not an error worth showing.
  const { error } = await supabase
    .from("venue_saves")
    .upsert({ user_id: userId, venue_id: venueId, visibility }, { onConflict: "user_id,venue_id" });
  if (error) throw error;
}

/**
 * `.select("id")` for the same reason setVibe does it: a delete that matches
 * zero rows returns no error, so an RLS block would look like a save removed.
 */
export async function removeSave(userId: string, venueId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("venue_saves")
    .delete()
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Save removal matched no row");
}

/**
 * One-time lift of the localStorage saves onto the server, on first signed-in
 * load. Upsert-based so re-running it is harmless — which matters, because the
 * "did we migrate" flag lives on the device and a second phone will run it too.
 */
export async function migrateLocalSaves(
  userId: string,
  localIds: string[],
  visibility: CheckinVisibility
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || localIds.length === 0) return;
  const { error } = await supabase.from("venue_saves").upsert(
    localIds.map((venue_id) => ({ user_id: userId, venue_id, visibility })),
    { onConflict: "user_id,venue_id" }
  );
  if (error) throw error;
}

export type VenueSaveFriends = Record<string, FriendProfile[]>;

/**
 * Friends-who-saved, grouped by venue — the facepile source.
 *
 * Self is excluded: "3 friends saved this" should never be counting you. The
 * query is unfiltered by venue on purpose — venue_saves is small, Discover
 * renders ~20 cards at once, and one round trip beats twenty.
 */
export async function friendSavesByVenue(myId: string): Promise<VenueSaveFriends> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("venue_saves")
    .select(`venue_id, user_id, profiles!inner(${PROFILE_COLS})`)
    .neq("user_id", myId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out: VenueSaveFriends = {};
  type Row = { venue_id: string; user_id: string; profiles: FriendProfile | FriendProfile[] | null };
  for (const row of (data ?? []) as Row[]) {
    // PostgREST returns the embedded row as an object for a to-one join, but
    // types it as an array depending on how it infers the relationship.
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!profile) continue;
    (out[row.venue_id] ??= []).push(profile);
  }
  return out;
}

/** The user's default visibility for new saves, stored on their profile row. */
export async function getSaveVisibility(userId: string): Promise<CheckinVisibility> {
  const supabase = getSupabase();
  if (!supabase) return "friends";
  const { data, error } = await supabase
    .from("profiles")
    .select("save_visibility")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return ((data?.save_visibility as CheckinVisibility) ?? "friends");
}

/** Applies to future saves AND retroactively to existing ones — "make my saves
 *  private" that left the old ones exposed would be a lie. */
export async function setSaveVisibility(
  userId: string,
  visibility: CheckinVisibility
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("profiles")
    .update({ save_visibility: visibility })
    .eq("id", userId);
  if (error) throw error;
  const { error: sErr } = await supabase
    .from("venue_saves")
    .update({ visibility })
    .eq("user_id", userId);
  if (sErr) throw sErr;
}
