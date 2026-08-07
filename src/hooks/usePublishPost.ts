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

function useInvalidateFeed() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return () => {
    // Prefix match: covers every limit and every night_date.
    qc.invalidateQueries({ queryKey: ["night-feed"] });
    qc.invalidateQueries({ queryKey: ["my-posts", userId] });
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
