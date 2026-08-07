/**
 * React Query layer for the morning-after recap.
 *
 * PRIVATE: this only ever reads the signed-in user's own check-ins.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { listMyNight, type NightVisit } from "@/lib/night/recap";
import { lastCompletedNightDate } from "@/lib/night/window";


/** Last night by default; pass a night-date to look further back. */
export function useNightRecap(nightDate?: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const target = nightDate ?? lastCompletedNightDate();

  return useQuery<NightVisit[]>({
    queryKey: ["night-recap", userId, target],
    queryFn: () => (userId ? listMyNight(userId, target) : Promise.resolve([])),
    enabled: !!userId,
  });
}
