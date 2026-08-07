/**
 * React Query layer for the night feed.
 *
 * The feed returns whatever RLS allows; nothing here filters by audience.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { listFeed, listMyPostsForNight, type FeedPost } from "@/lib/night/posts";

export function useNightFeed(limit = 50) {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery<FeedPost[]>({
    queryKey: ["night-feed", userId, limit],
    queryFn: () => listFeed(limit),
    enabled: !!userId,
  });
}

/** The caller's own posts for one night — drives the recap's published state. */
export function useMyPostsForNight(nightDate: string) {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery<FeedPost[]>({
    queryKey: ["my-posts", userId, nightDate],
    queryFn: () => (userId ? listMyPostsForNight(userId, nightDate) : Promise.resolve([])),
    enabled: !!userId,
  });
}

/** The post for one venue on one night, or undefined if not published. */
export function postFor(posts: FeedPost[] | undefined, venueId: string): FeedPost | undefined {
  return posts?.find((p) => p.venueId === venueId);
}
