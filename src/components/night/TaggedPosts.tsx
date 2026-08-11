/**
 * The Tagged tab — posts someone else wrote where this person is named and
 * accepted ('tag' or 'collab').
 *
 * 'pending' is deliberately absent: an undecided tag is an item of business,
 * and it already has a home as an actionable row in Activity. A profile shows
 * nights, not decisions waiting to be made.
 *
 * The score on these cards is the TAGGED person's, off the tag row — not the
 * author's off the post. Whose profile you are on decides whose opinion you
 * see.
 */
import { useTaggedPosts } from "@/hooks/useProfilePosts";
import PostList from "@/components/night/PostList";

export default function TaggedPosts({
  userId,
  /** Whose tab this is. Own profile gets the management controls. */
  isSelf,
  /** Used only in the empty state, so it reads as being about a person. */
  name,
}: {
  userId: string;
  isSelf: boolean;
  name?: string;
}) {
  const { data: posts, isLoading, isError } = useTaggedPosts(userId);

  return (
    <PostList
      posts={posts}
      isLoading={isLoading}
      isError={isError}
      errorText={
        <p className="py-8 text-center text-sm text-muted-foreground break-words">
          {isSelf ? "Couldn't load your tagged nights." : "Couldn't load their tagged nights."}
        </p>
      }
      empty={
        <p className="py-8 text-center text-sm text-muted-foreground break-words">
          {isSelf
            ? "No one's tagged you in a night yet."
            : `Nothing ${name ?? "they"}'s tagged in that you can see.`}
        </p>
      }
    />
  );
}
