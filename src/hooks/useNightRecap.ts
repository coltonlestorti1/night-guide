/**
 * React Query layer for the morning-after recap.
 *
 * PRIVATE: this only ever reads the signed-in user's own check-ins.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { listMyNight, type NightVisit } from "@/lib/night/recap";
import { nightDateOf } from "@/lib/night/window";

/**
 * "Last night" means the night that has most recently ended.
 *
 * Taken from 12 hours ago rather than from now, so the answer is stable across
 * the whole morning: at 09:00 Tuesday that lands on Monday 21:00 -> Monday
 * night. Using `now` directly would flip the card to "tonight" the moment the
 * clock passed 18:00, hiding last night while the user was still looking at it.
 */
export function lastNightDate(now: Date = new Date()): string {
  return nightDateOf(new Date(now.getTime() - 12 * 60 * 60 * 1000));
}

/** Last night by default; pass a night-date to look further back. */
export function useNightRecap(nightDate?: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const target = nightDate ?? lastNightDate();

  return useQuery<NightVisit[]>({
    queryKey: ["night-recap", userId, target],
    queryFn: () => (userId ? listMyNight(userId, target) : Promise.resolve([])),
    enabled: !!userId,
  });
}
