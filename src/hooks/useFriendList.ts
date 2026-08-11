/**
 * React Query layer for another user's ranked list and profile counts.
 *
 * Keyed by the TARGET user, not the viewer, so two profiles never share a cache
 * entry. Both queries are gated server-side; nothing here filters.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { friendProfileStats, friendRankedList, type FriendStats } from "@/lib/night/friendLists";
import type { RatingRow } from "@/lib/night/ratings";

export function useFriendRankedList(targetUserId: string | undefined) {
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  return useQuery<RatingRow[]>({
    queryKey: ["friend-ranked-list", targetUserId],
    enabled: !!targetUserId && signedIn,
    staleTime: 30_000,
    queryFn: () => friendRankedList(targetUserId!),
  });
}

export function useFriendProfileStats(targetUserId: string | undefined) {
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  return useQuery<FriendStats | null>({
    queryKey: ["friend-profile-stats", targetUserId],
    enabled: !!targetUserId && signedIn,
    staleTime: 30_000,
    queryFn: () => friendProfileStats(targetUserId!),
  });
}
