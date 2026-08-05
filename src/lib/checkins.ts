/**
 * Check-in writes and the venue-activity realtime poke.
 * Reads happen through src/hooks/useCheckIns.ts (React Query).
 *
 * The poke is a content-free broadcast: clients only learn "counts
 * changed, refetch" — no identities travel over the channel, so RLS
 * visibility rules are never bypassed.
 */
import { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

/**
 * `building` keeps its stored value and displays as "Good crowd" — that gives
 * all five options with zero data migration on the existing rows.
 * Order matters: this is the order the buttons render in, dead -> line outside.
 */
export type Vibe = "dead" | "chill" | "building" | "packed" | "line_outside";

export const VIBE_LABELS: Record<Vibe, string> = {
  dead: "Dead",
  chill: "Chill",
  building: "Good crowd",
  packed: "Packed",
  line_outside: "Line outside",
};

export type Recommend = "yes" | "maybe" | "no";

export const RECOMMEND_LABELS: Record<Recommend, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
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

export type MyCheckIn = {
  id: string;
  venue_id: string;
  vibe: Vibe | null;
  would_recommend: Recommend | null;
  expires_at: string;
};

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

export async function checkOut(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("check_ins")
    .delete()
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
}

/**
 * `.select()` is load-bearing, not decoration: a bare `.update()` that matches
 * zero rows (RLS blocked it, the row expired) returns NO error, so a silent
 * drop is indistinguishable from a save. Reading the row back means a vibe that
 * didn't land throws, and the caller can revert instead of showing a lie.
 * `vibe_at` is set by a database trigger — never written here (see endz-schema.sql).
 */
export async function setVibe(checkInId: string, vibe: Vibe): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("check_ins")
    .update({ vibe })
    .eq("id", checkInId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Vibe update matched no check-in");
}

/**
 * Shared broadcast channel: subscribed once (AppLayout), reused for sends.
 * supabase-js requires a joined channel before send(), so the module keeps
 * the singleton created by subscribeActivity().
 */
let channel: RealtimeChannel | null = null;

export function subscribeActivity(onChanged: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const ch = supabase.channel("venue-activity");
  ch.on("broadcast", { event: "changed" }, onChanged).subscribe();
  channel = ch;
  return () => {
    // Only clear the shared reference if it still points at OUR channel —
    // a newer subscriber may have replaced it.
    if (channel === ch) channel = null;
    supabase.removeChannel(ch);
  };
}

export function pokeActivity(): void {
  channel?.send({ type: "broadcast", event: "changed", payload: {} });
}

/**
 * "Would you send friends here right now?" — recommendation quality, kept
 * deliberately separate from crowd level. A packed room is not automatically
 * a good recommendation.
 */
export async function setRecommend(checkInId: string, value: Recommend): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("check_ins")
    .update({ would_recommend: value })
    .eq("id", checkInId)
    .select("id"); // same zero-row silence as setVibe — read it back
  if (error) throw error;
  if (!data?.length) throw new Error("Recommend update matched no check-in");
}
