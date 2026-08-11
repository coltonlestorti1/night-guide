/**
 * Collab tags — who you were out with.
 *
 * Batched read mirrors useCommentPreviews/usePostLikes: one query for every
 * post on screen, sorted key so it stays stable across feed reordering.
 *
 * Every mutation invalidates post-tags, pending-tags, AND night-feed. The
 * first two keep the "with Sam" line and the actionable Activity rows in
 * sync; night-feed is invalidated too because accepting a tag as 'collab'
 * changes who night_posts' SELECT policy lets see the post
 * (post_has_collab_for_me) — not just how the card that was already visible
 * to you renders.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  addTag,
  listMyPendingTags,
  listTagsForPosts,
  removeTag,
  setTagState,
  type PendingTag,
  type PostTag,
} from "@/lib/night/tags";

/** Accepted tags ('tag' | 'collab') for the posts currently on screen. */
export function usePostTags(postIds: string[]) {
  // Sorted so the key is stable regardless of feed ordering churn — same
  // reason as useCommentPreviews / usePostLikes.
  const key = [...postIds].sort();
  return useQuery<PostTag[]>({
    queryKey: ["post-tags", key],
    queryFn: () => listTagsForPosts(key),
    enabled: key.length > 0,
  });
}

/** Tags waiting on the caller's decision. Drives the actionable Activity rows. */
export function useMyPendingTags() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<PendingTag[]>({
    queryKey: ["pending-tags", userId],
    queryFn: () => listMyPendingTags(userId!),
    enabled: !!userId,
  });
}

function useInvalidateTags() {
  const qc = useQueryClient();
  return () => {
    // Prefix match: post-tags carries the whole sorted id list in its key.
    qc.invalidateQueries({ queryKey: ["post-tags"] });
    qc.invalidateQueries({ queryKey: ["pending-tags"] });
    qc.invalidateQueries({ queryKey: ["night-feed"] });
    // Accepting a collab makes the post appear on a PROFILE too, so those
    // lists have to be invalidated with the feed. Missing this meant a profile
    // page already mounted elsewhere kept showing the old list until something
    // unrelated forced a refetch.
    qc.invalidateQueries({ queryKey: ["authored-posts"] });
    qc.invalidateQueries({ queryKey: ["tagged-posts"] });
  };
}

/** The tagged person's decision: stay named, or also share with their friends. */
export function useSetTagState() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (v: { postId: string; state: "tag" | "collab" }) => {
      if (!userId) throw new Error("Not signed in");
      return setTagState(v.postId, userId, v.state);
    },
    onSuccess: invalidate,
  });
}

/** Either party removes a tag. Never removes the post. */
export function useRemoveTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (v: { postId: string; taggedUserId: string }) =>
      removeTag(v.postId, v.taggedUserId),
    onSuccess: invalidate,
  });
}

/** The author tagging someone, right after the post itself exists. */
export function useAddTag() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: (v: { postId: string; taggedUserId: string; isPrivatePost: boolean }) =>
      addTag(v.postId, v.taggedUserId, v.isPrivatePost),
    onSuccess: invalidate,
  });
}
