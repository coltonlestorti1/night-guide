import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MyCheckIn, Vibe } from "@/lib/checkins";

/** The caller's active check-in, or null. */
export function useMyCheckIn() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<MyCheckIn | null>({
    queryKey: ["my-check-in", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !userId) return null;
      const { data, error } = await supabase
        .from("active_check_ins")
        .select("id, venue_id, vibe, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as MyCheckIn) ?? null;
    },
  });
}

export type VenueActivity = Record<string, { count: number; vibe: Vibe | null }>;

/** Anonymous per-venue activity counts. Polls as the realtime fallback. */
export function useVenueActivity() {
  return useQuery<VenueActivity>({
    queryKey: ["venue-activity"],
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return {};
      const { data, error } = await supabase.rpc("venue_activity");
      if (error) throw error;
      const map: VenueActivity = {};
      for (const row of data as { venue_id: string; active_count: number; latest_vibe: Vibe | null }[]) {
        map[row.venue_id] = { count: Number(row.active_count), vibe: row.latest_vibe };
      }
      return map;
    },
  });
}
