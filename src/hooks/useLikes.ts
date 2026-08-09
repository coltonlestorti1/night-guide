/**
 * Likes for the posts currently on screen.
 *
 * Batched by post id like usePostPhotos and useCommentPreviews: one query for
 * the whole feed, not one per card.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { likePost, listLikesForPosts, unlikePost, type LikeRow } from "@/lib/night/likes";

export function usePostLikes(postIds: string[]) {
  // Sorted so the key is stable regardless of feed ordering churn.
  const key = [...postIds].sort();
  return useQuery<LikeRow[]>({
    queryKey: ["post-likes", key],
    queryFn: () => listLikesForPosts(key),
    enabled: key.length > 0,
  });
}

/**
 * Toggle, applied optimistically.
 *
 * A heart that waits for a round trip before filling feels broken, and this is
 * the one write in the app where the user taps and immediately looks at the
 * result. On failure the cache is rolled back to the exact snapshot taken
 * before the mutation, so a failed like cannot leave a filled heart behind.
 */

/**
 * Add or remove one like across every cached page of likes.
 *
 * `removing` mirrors the button's prior state: true means the user had liked
 * it and is now unliking. Written as a standalone helper so the optimistic
 * write and its inverse cannot drift apart.
 */
function apply(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  postId: string,
  removing: boolean,
) {
  for (const [key, rows] of qc.getQueriesData<LikeRow[]>({ queryKey: ["post-likes"] })) {
    if (!rows) continue;
    const without = rows.filter((r) => !(r.postId === postId && r.userId === userId));
    // Guard against double-adding if two optimistic writes race.
    qc.setQueryData<LikeRow[]>(key, removing ? without : [...without, { postId, userId }]);
  }
}

export function useToggleLike() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      return liked ? unlikePost(postId, userId) : likePost(postId, userId);
    },
    onMutate: async ({ postId, liked }) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: ["post-likes"] });
      apply(qc, userId, postId, liked);
    },
    onError: (_e, { postId, liked }) => {
      if (!userId) return;
      // Invert THIS toggle rather than restoring a snapshot of the whole cache.
      // A snapshot taken before this mutation also predates any other toggle
      // still in flight, so restoring it would wipe their optimistic writes
      // too — tapping two hearts quickly and having one fail would visibly
      // un-toggle the other.
      apply(qc, userId, postId, !liked);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["post-likes"] }),
  });
}
