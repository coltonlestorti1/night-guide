/**
 * Your own night activity, on your profile — the Beli "Activity" tab
 * (Colton, 2026-08-07).
 *
 * Shows YOUR posts, including the ones only you can see: a `nobody` post is
 * still activity, it just carries a lock. That is the whole reason the tier
 * exists — a private entry you can look back on without publishing it.
 *
 * Posts you were TAGGED in are not here; they have their own tab, because
 * "what I posted" and "what I was named in" are different claims and the
 * management controls only apply to the second.
 *
 * Rendering goes through PostList, so the private and shared views of a post
 * can never drift apart in wording or in what they reveal.
 */
import { useQuery } from "@tanstack/react-query";
import { Moon } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getSupabase } from "@/lib/supabase";
import type { FeedPost } from "@/lib/night/posts";
import { listMyPosts } from "@/lib/night/posts";
import PostList from "@/components/night/PostList";

export default function MyActivity({ limit = 20 }: { limit?: number }) {
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: posts, isLoading, isError } = useQuery<FeedPost[]>({
    queryKey: ["my-activity", userId, limit],
    queryFn: () => (userId ? listMyPosts(userId, limit) : Promise.resolve([])),
    enabled: !!userId && !!getSupabase(),
  });

  // Deliberately renders nothing at all while loading rather than a spinner:
  // this sits directly under the profile header, and a spinner there flickers
  // on every visit for a list that is usually short.
  if (isLoading) return null;

  return (
    <PostList
      posts={posts}
      isLoading={false}
      isError={isError}
      // "No nights posted yet." is a claim about the viewer's OWN history. Made
      // from a failed request it is simply false, and it is the one person who
      // would know it is false — so it reads as data loss, not a network blip.
      errorText={
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load your nights.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            They&apos;re still there — check your connection and try again.
          </p>
        </div>
      }
      empty={
        <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
          <Moon className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">No nights posted yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rate a spot from last night and it shows up here.
          </p>
        </div>
      }
    />
  );
}
