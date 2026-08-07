/**
 * Comment reads and writes.
 *
 * Both mutations invalidate the thread AND the feed previews: a new comment
 * changes the count under the card as well as the open thread, and leaving
 * either stale shows the user a state they did not leave the app in.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  addComment,
  deleteComment,
  listComments,
  listCommentPreviews,
  type NightComment,
} from "@/lib/night/comments";

/** Every comment on the posts currently on screen, in one query. */
export function useCommentPreviews(postIds: string[]) {
  // Sorted so the key is stable regardless of feed ordering churn — same
  // reason as usePostPhotos.
  const key = [...postIds].sort();
  return useQuery<NightComment[]>({
    queryKey: ["comment-previews", key],
    queryFn: () => listCommentPreviews(key),
    enabled: key.length > 0,
  });
}

export function useCommentThread(postId: string | null) {
  return useQuery<NightComment[]>({
    queryKey: ["comment-thread", postId],
    queryFn: () => listComments(postId!),
    enabled: !!postId,
  });
}

function useInvalidateComments() {
  const qc = useQueryClient();
  return (postId: string) => {
    qc.invalidateQueries({ queryKey: ["comment-thread", postId] });
    // Prefix match: the preview key carries the whole sorted id list, so an
    // exact key is not knowable from here.
    qc.invalidateQueries({ queryKey: ["comment-previews"] });
  };
}

export function useAddComment() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidateComments();
  return useMutation({
    mutationFn: (v: { postId: string; body: string }) => {
      if (!userId) throw new Error("Not signed in");
      return addComment({ postId: v.postId, userId, body: v.body });
    },
    onSuccess: (_data, v) => invalidate(v.postId),
  });
}

export function useDeleteComment() {
  const invalidate = useInvalidateComments();
  return useMutation({
    mutationFn: (v: { commentId: string; postId: string }) => deleteComment(v.commentId),
    onSuccess: (_data, v) => invalidate(v.postId),
  });
}
