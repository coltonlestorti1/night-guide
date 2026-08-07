/**
 * Photos for the posts currently on screen, with fresh signed URLs.
 *
 * Batched by post id rather than fetched per card: one query and one signing
 * round trip for the whole feed instead of two per post.
 */
import { useQuery } from "@tanstack/react-query";
import { listPhotosForPosts, type PostPhoto } from "@/lib/night/photos";

export function usePostPhotos(postIds: string[]) {
  // Sorted so the key is stable regardless of feed ordering churn.
  const key = [...postIds].sort();
  return useQuery<PostPhoto[]>({
    queryKey: ["post-photos", key],
    queryFn: () => listPhotosForPosts(key),
    enabled: key.length > 0,
    // Signed URLs last an hour; refetching sooner just burns requests.
    staleTime: 30 * 60 * 1000,
  });
}
