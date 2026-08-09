/** Reactions to your own posts. Derived on read — there is no activity table. */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { listActivity, type ActivityItem } from "@/lib/social/activity";

export function useActivity(enabled = true) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<ActivityItem[]>({
    queryKey: ["activity", userId],
    enabled: !!userId && enabled,
    queryFn: () => listActivity(userId!),
    staleTime: 60_000,
    // retry once: a transient blip should not paint an error over an inbox.
    retry: 1,
  });
}
