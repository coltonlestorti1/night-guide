/**
 * Publish and delete mutations for night posts.
 *
 * Both invalidate the feed AND the caller's own-posts query: publishing changes
 * what the feed shows and what the recap card reports as already published, and
 * leaving either stale shows the user a state they did not leave the app in.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { deletePost, publishPost } from "@/lib/night/posts";
import type { Audience } from "@/lib/night/audience";

/**
 * Every list that can be showing a post right now.
 *
 * This missed `my-activity` from the day the Activity tab shipped, so deleting
 * a post from your own profile removed it from the database and from the feed
 * and left it sitting on the tab you deleted it from — no error, no spinner,
 * nothing to retry. It reads as "delete is broken" when the delete in fact
 * worked. Found on device 2026-08-11.
 *
 * If you add a surface that renders posts, add its key here. The cost of
 * missing one is silent and looks exactly like a failed write.
 */
function useInvalidateFeed() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return () => {
    // Prefix match: covers every limit and every night_date.
    qc.invalidateQueries({ queryKey: ["night-feed"] });
    qc.invalidateQueries({ queryKey: ["my-posts", userId] });
    // Profile → Activity tab.
    qc.invalidateQueries({ queryKey: ["my-activity"] });
    // Both halves of a profile, yours and anyone else's.
    qc.invalidateQueries({ queryKey: ["authored-posts"] });
    qc.invalidateQueries({ queryKey: ["tagged-posts"] });
  };
}

export function usePublishPost() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidateFeed();

  return useMutation({
    mutationFn: (v: {
      venueId: string;
      nightDate: string;
      note: string | null;
      visibility: Audience;
      score: number | null;
    }) => {
      if (!userId) throw new Error("Not signed in");
      return publishPost({ userId, ...v }); // resolves to the post id
    },
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const invalidate = useInvalidateFeed();

  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: invalidate,
  });
}
