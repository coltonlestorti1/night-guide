/**
 * Someone else's nights on their profile.
 *
 * Shows posts they authored AND posts they were tagged in and accepted — a
 * collab is supposed to land here, and without the second half approving one
 * would have no visible effect anywhere.
 *
 * RLS decides what comes back, so two different viewers see two different
 * lists of the same profile. That is correct, not a bug: a friends-only post
 * is simply absent for someone who is not a friend.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listProfilePosts, type FeedPost } from "@/lib/night/posts";
import { useVenues } from "@/hooks/useVenues";
import { usePostPhotos } from "@/hooks/usePostPhotos";
import { useCommentPreviews } from "@/hooks/useComments";
import { reduceCommentPreviews } from "@/lib/night/comments";
import { usePostLikes } from "@/hooks/useLikes";
import { summarizeLikes } from "@/lib/night/likes";
import { usePostTags } from "@/hooks/useTags";
import { tagsByPost } from "@/lib/night/tags";
import { useAuthStore } from "@/store/auth";
import PostCard from "@/components/night/PostCard";

export default function ProfilePosts({
  userId,
  name,
}: {
  userId: string;
  /** Used only in the empty state, so it reads as being about a person. */
  name: string;
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const { data: posts, isLoading, isError } = useQuery<FeedPost[]>({
    queryKey: ["profile-posts", userId],
    queryFn: () => listProfilePosts(userId),
    enabled: !!userId,
  });

  const ids = (posts ?? []).map((p) => p.id);
  const { data: venues } = useVenues({});
  const { data: photos } = usePostPhotos(ids);
  const { data: commentRows } = useCommentPreviews(ids);
  const { data: likeRows } = usePostLikes(ids);
  const { data: tagRows } = usePostTags(ids);

  const previews = reduceCommentPreviews(commentRows ?? []);
  const likes = summarizeLikes(likeRows ?? [], myId);
  const tags = tagsByPost(tagRows ?? []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // A failure must not read as "they have never been out" — that is a claim
  // about a person, made from a network error.
  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground break-words">
        Couldn't load their nights.
      </p>
    );
  }

  if (!posts?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground break-words">
        Nothing from {name} you can see yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          venue={venues?.find((v) => v.id === post.venueId)}
          photos={(photos ?? []).filter((ph) => ph.postId === post.id)}
          commentPreview={previews.get(post.id)}
          likes={likes.get(post.id)}
          tags={tags.get(post.id)}
        />
      ))}
    </div>
  );
}
