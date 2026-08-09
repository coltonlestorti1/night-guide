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
      const snapshots = qc.getQueriesData<LikeRow[]>({ queryKey: ["post-likes"] });
      for (const [key, rows] of snapshots) {
        if (!rows) continue;
        qc.setQueryData<LikeRow[]>(
          key,
          liked
            ? rows.filter((r) => !(r.postId === postId && r.userId === userId))
            : [...rows, { postId, userId }],
        );
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      // Put back exactly what was there — not a refetch, which could race the
      // failed write and briefly show the wrong state.
      ctx?.snapshots?.forEach(([key, rows]) => qc.setQueryData(key, rows));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["post-likes"] }),
  });
}
