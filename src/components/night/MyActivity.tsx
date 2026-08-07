/**
 * Your own night activity, on your profile — the Beli "Activity" tab
 * (Colton, 2026-08-07).
 *
 * Shows YOUR posts, including the ones only you can see: a `nobody` post is
 * still activity, it just carries a lock. That is the whole reason the tier
 * exists — a private entry you can look back on without publishing it.
 *
 * Reuses PostCard, so the private and shared views of a post can never drift
 * apart in wording or in what they reveal.
 */
import { useQuery } from "@tanstack/react-query";
import { Moon } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import { getSupabase } from "@/lib/supabase";
import type { FeedPost } from "@/lib/night/posts";
import PostCard from "@/components/night/PostCard";
import { usePostPhotos } from "@/hooks/usePostPhotos";
import { listMyPosts } from "@/lib/night/posts";

export default function MyActivity({ limit = 20 }: { limit?: number }) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venues } = useVenues({});

  const { data: posts, isLoading } = useQuery<FeedPost[]>({
    queryKey: ["my-activity", userId, limit],
    queryFn: () => (userId ? listMyPosts(userId, limit) : Promise.resolve([])),
    enabled: !!userId && !!getSupabase(),
  });

  const photosQuery = usePostPhotos((posts ?? []).map((p) => p.id));
  const photos = photosQuery.data;

  if (isLoading) return null;

  if (!posts?.length) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
        <Moon className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium">No nights posted yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Rate a spot from last night and it shows up here.
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
        />
      ))}
    </div>
  );
}
