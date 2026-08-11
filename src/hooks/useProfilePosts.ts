/**
 * The two halves of a profile: what someone posted, and what they were
 * tagged in.
 *
 * These replace the single `profile-posts` query, which fetched both and
 * merged them. Splitting is what the Activity/Tagged tabs need, and it also
 * removes the merge, the sort and the dedupe that existed only to put the two
 * back together.
 *
 * Both keys carry the VIEWER as well as the profile owner. What comes back is
 * RLS-filtered per viewer, so a key that ignores who is asking can flash one
 * person's permitted list to another before the refetch lands.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { listAuthoredPosts, listTaggedPosts, type FeedPost } from "@/lib/night/posts";

export function useAuthoredPosts(userId: string | undefined, limit = 20) {
  const myId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FeedPost[]>({
    queryKey: ["authored-posts", userId, myId, limit],
    queryFn: () => listAuthoredPosts(userId!, limit),
    enabled: !!userId,
  });
}

export function useTaggedPosts(userId: string | undefined, limit = 20) {
  const myId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FeedPost[]>({
    queryKey: ["tagged-posts", userId, myId, limit],
    queryFn: () => listTaggedPosts(userId!, limit),
    enabled: !!userId,
  });
}
