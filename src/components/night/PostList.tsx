/**
 * A list of night posts with everything that hangs off them — photos,
 * comment previews, likes, tags.
 *
 * Extracted when the Tagged tab arrived and would have been the THIRD copy of
 * this block. MyActivity and ProfilePosts had already drifted apart in small
 * ways while claiming to render the same thing; a third copy would have made
 * that permanent.
 *
 * The companion hooks all key off the post ids, so they belong with the list
 * rather than with each caller. What stays with the caller is the query and
 * the copy — who these posts belong to and what it means when there are none.
 */
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { FeedPost } from "@/lib/night/posts";
import { useVenues } from "@/hooks/useVenues";
import { usePostPhotos } from "@/hooks/usePostPhotos";
import { useCommentPreviews } from "@/hooks/useComments";
import { reduceCommentPreviews } from "@/lib/night/comments";
import { usePostLikes } from "@/hooks/useLikes";
import { summarizeLikes } from "@/lib/night/likes";
import { usePostTags } from "@/hooks/useTags";
import { myTagOn, tagsByPost } from "@/lib/night/tags";
import { useAuthStore } from "@/store/auth";
import PostCard from "@/components/night/PostCard";
import TaggedPostCard from "@/components/night/TaggedPostCard";

/** Everything this list resolved for one row, handed to renderCard. */
export type CardProps = React.ComponentProps<typeof PostCard>;

export default function PostList({
  posts,
  isLoading,
  isError,
  errorText,
  empty,
  renderCard,
}: {
  posts: FeedPost[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Shown instead of the list when the request failed. */
  errorText: ReactNode;
  /** Shown when the request SUCCEEDED and returned nothing. */
  empty: ReactNode;
  /**
   * Renders one row, given the props this list resolved for it. The default
   * is a plain PostCard; Tagged overrides it to wrap the card in tag
   * management.
   *
   * A render prop rather than a `menuExtra` slot because the Tagged card needs
   * a RateSheet, and a drawer mounted inside DropdownMenuContent is destroyed
   * the moment the menu closes on select. It has to be a SIBLING of the menu,
   * which means something above PostCard has to own it.
   */
  renderCard?: (props: CardProps) => ReactNode;
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
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

  // The error and empty branches are deliberately separate and must stay that
  // way. "Nothing here yet" rendered from a failed request is a false claim
  // about someone's history — and to the one person who would know it is
  // false, it reads as data loss rather than a network blip.
  if (isError) return <>{errorText}</>;
  if (!posts?.length) return <>{empty}</>;

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const props: CardProps = {
          post,
          venue: venues?.find((v) => v.id === post.venueId),
          photos: (photos ?? []).filter((ph) => ph.postId === post.id),
          commentPreview: previews.get(post.id),
          likes: likes.get(post.id),
          tags: tags.get(post.id),
        };
        // One rule, every surface: if you are tagged on a post you did not
        // write, you get the controls for your own tag. Previously only the
        // Tagged tab wired these up, so the same post offered them on one
        // screen and only "Report" on another.
        const mine = myTagOn(props.tags, myId);
        const canManage = mine && myId && post.author.id !== myId;
        return (
          <div key={post.id}>
            {renderCard ? (
              renderCard(props)
            ) : canManage ? (
              <TaggedPostCard cardProps={props} myId={myId!} state={mine!.state} />
            ) : (
              <PostCard {...props} />
            )}
          </div>
        );
      })}
    </div>
  );
}
