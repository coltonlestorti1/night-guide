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

export type VenueActivity = Record<string, {
  count: number;
  vibe: Vibe | null;
  /** Age buckets. Absent until the slice-4 DDL is applied. */
  count15?: number;
  count45?: number;
  count90?: number;
  vibeTally?: Partial<Record<Vibe, number>>;
  recommendTally?: Partial<Record<"yes" | "maybe" | "no", number>>;
}>;

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
      // Read defensively: the bucketed columns only exist once the slice-4 DDL
      // has been pasted, and this code ships first (see SupabaseDataSource.ts).
      const map: VenueActivity = {};
      type Row = Record<string, unknown>;
      for (const row of (data ?? []) as Row[]) {
        const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : undefined);
        const tally: Partial<Record<Vibe, number>> = {};
        for (const v of ["dead", "chill", "building", "packed", "line_outside"] as Vibe[]) {
          const n = num(`vibe_${v}`);
          if (n) tally[v] = n;
        }
        const rec: Partial<Record<"yes" | "maybe" | "no", number>> = {};
        for (const r of ["yes", "maybe", "no"] as const) {
          const n = num(`rec_${r}`);
          if (n) rec[r] = n;
        }
        map[String(row.venue_id)] = {
          count: Number(row.active_count ?? 0),
          vibe: (row.latest_vibe as Vibe) ?? null,
          count15: num("count_15m"),
          count45: num("count_45m"),
          count90: num("count_90m"),
          vibeTally: Object.keys(tally).length ? tally : undefined,
          recommendTally: Object.keys(rec).length ? rec : undefined,
        };
      }
      return map;
    },
  });
}
