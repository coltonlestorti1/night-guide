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

export type Vibe = "chill" | "building" | "packed";

export type MyCheckIn = {
  id: string;
  venue_id: string;
  vibe: Vibe | null;
  expires_at: string;
};

/** One place at a time: end any active check-in, then create the new one. */
export async function checkIn(userId: string, venueId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error: endError } = await supabase
    .from("check_ins")
    .delete()
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  if (endError) throw endError;
  const { error } = await supabase.from("check_ins").insert({ user_id: userId, venue_id: venueId });
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

export async function setVibe(checkInId: string, vibe: Vibe): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("check_ins").update({ vibe }).eq("id", checkInId);
  if (error) throw error;
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
  channel = supabase.channel("venue-activity");
  channel.on("broadcast", { event: "changed" }, onChanged).subscribe();
  return () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
  };
}

export function pokeActivity(): void {
  channel?.send({ type: "broadcast", event: "changed", payload: {} });
}
