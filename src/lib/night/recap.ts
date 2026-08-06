/**
 * The signed-in user's own night history.
 *
 * PRIVATE. Every read here is own-rows-only, which the existing check_ins
 * SELECT policy already permits via `auth.uid() = user_id`. This module must
 * never be used to read another user's history: the 2026-08-05 RLS fix
 * deliberately limits other users to live rows (`expires_at > now()`), and that
 * bound is what stops retained history becoming a permanent location log.
 *
 * Reads go through src/hooks/useNightRecap.ts (React Query), mirroring the
 * split in src/lib/saves.ts.
 */
import { getSupabase } from "@/lib/supabase";
import { nightRange } from "@/lib/night/window";

export type NightVisit = { checkInId: string; venueId: string };

/**
 * Venues the user checked into during one night, in arrival order.
 *
 * Collapsed to one entry per venue: coming back to the same bar later in the
 * night is still one thing to rate, and showing it twice would ask the user to
 * rank a venue against itself.
 */
export async function listMyNight(userId: string, nightDate: string): Promise<NightVisit[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { start, end } = nightRange(nightDate);
  const { data, error } = await supabase
    .from("check_ins")
    .select("id, venue_id, created_at")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const seen = new Set<string>();
  const out: NightVisit[] = [];
  for (const r of (data ?? []) as { id: string; venue_id: string }[]) {
    if (seen.has(r.venue_id)) continue;
    seen.add(r.venue_id);
    out.push({ checkInId: r.id, venueId: r.venue_id });
  }
  return out;
}
