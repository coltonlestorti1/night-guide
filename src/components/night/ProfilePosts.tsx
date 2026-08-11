/**
 * Someone else's nights on their profile — what they AUTHORED.
 *
 * Posts they were tagged in used to be merged into this list. They now have
 * their own tab, so that this profile and the owner's own view of it are
 * organised the same way.
 *
 * RLS decides what comes back, so two different viewers see two different
 * lists of the same profile. That is correct, not a bug: a friends-only post
 * is simply absent for someone who is not a friend.
 */
import { useAuthoredPosts } from "@/hooks/useProfilePosts";
import PostList from "@/components/night/PostList";

export default function ProfilePosts({
  userId,
  name,
}: {
  userId: string;
  /** Used only in the empty state, so it reads as being about a person. */
  name: string;
}) {
  const { data: posts, isLoading, isError } = useAuthoredPosts(userId);

  return (
    <PostList
      posts={posts}
      isLoading={isLoading}
      isError={isError}
      // A failure must not read as "they have never been out" — that is a
      // claim about a person, made from a network error.
      errorText={
        <p className="py-8 text-center text-sm text-muted-foreground break-words">
          Couldn&apos;t load their nights.
        </p>
      }
      empty={
        <p className="py-8 text-center text-sm text-muted-foreground break-words">
          Nothing from {name} you can see yet.
        </p>
      }
    />
  );
}
