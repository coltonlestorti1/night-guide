/**
 * React Query layer for another user's ranked list and profile counts.
 *
 * Keyed by BOTH the viewer and the target. The target alone is not enough: the
 * answer depends on who is asking, so one cache entry per target would serve
 * a viewer a list they are no longer allowed to see — after being unfriended
 * or blocked, `staleTime` means no refetch happens at all for 30 seconds. It
 * would also cross accounts on any in-tab sign-in; Google's full-page OAuth
 * redirect is the only reason that is not already live, and Sign in with Apple
 * would change that. Every other viewer-dependent query here keys the same way.
 *
 * Both queries are gated server-side; nothing here filters.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { friendProfileStats, friendRankedList, type FriendStats } from "@/lib/night/friendLists";
import type { RatingRow } from "@/lib/night/ratings";

export function useFriendRankedList(targetUserId: string | undefined) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  return useQuery<RatingRow[]>({
    queryKey: ["friend-ranked-list", myId, targetUserId],
    enabled: !!targetUserId && signedIn,
    staleTime: 30_000,
    queryFn: () => friendRankedList(targetUserId!),
  });
}

export function useFriendProfileStats(targetUserId: string | undefined) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  return useQuery<FriendStats | null>({
    queryKey: ["friend-profile-stats", myId, targetUserId],
    enabled: !!targetUserId && signedIn,
    staleTime: 30_000,
    queryFn: () => friendProfileStats(targetUserId!),
  });
}
