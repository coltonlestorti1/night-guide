/**
 * The night feed.
 *
 * Renders exactly what the query returned. RLS decides who can see what — there
 * is no audience filtering here, deliberately, because a filter in the client
 * would be a second copy of the policy that can silently disagree with it.
 */
import { useNightFeed } from "@/hooks/useNightFeed";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import PostCard from "@/components/night/PostCard";
import { usePostPhotos } from "@/hooks/usePostPhotos";
import { useCommentPreviews } from "@/hooks/useComments";
import { usePostLikes } from "@/hooks/useLikes";
import { usePostTags } from "@/hooks/useTags";
import { reduceCommentPreviews } from "@/lib/night/comments";
import { summarizeLikes } from "@/lib/night/likes";
import { tagsByPost } from "@/lib/night/tags";

export default function FeedList() {
  const { data: posts, isLoading, isError } = useNightFeed();
  const { data: venues } = useVenues({});
  const { data: photos } = usePostPhotos((posts ?? []).map((p) => p.id));
  const { data: commentRows } = useCommentPreviews((posts ?? []).map((p) => p.id));
  const previews = reduceCommentPreviews(commentRows ?? []);
  const { data: likeRows } = usePostLikes((posts ?? []).map((p) => p.id));
  const myId = useAuthStore((s) => s.session?.user.id);
  const likes = summarizeLikes(likeRows ?? [], myId);
  const { data: tagRows } = usePostTags((posts ?? []).map((p) => p.id));
  const tags = tagsByPost(tagRows ?? []);

  if (isLoading) return null;

  // A failed load must NOT render as "nobody posted". The 42P17 policy
  // recursion that took this feed down on 2026-08-09 returned a 400, which
  // landed here as `posts === undefined` and rendered the calm empty state
  // below — so the outage looked exactly like a quiet night and nobody
  // reported it. Same rule ProfilePosts.tsx already follows.
  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load the feed.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Check your connection and pull to refresh.
        </p>
      </div>
    );
  }

  if (!posts?.length) {
    // Measured 2026-08-06: 11 profiles, largest school cohort 2. This empty
    // state is the common case until the beachhead lands, so it reads as calm
    // rather than broken — no "nobody has posted!", no exhortation.
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
        <p className="text-sm font-medium">Nothing from your people yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Posts from friends and people at your school show up here.
        </p>
      </div>
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
