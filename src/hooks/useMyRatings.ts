/**
 * React Query layer for the user's own ranked list.
 *
 * PRIVATE in slice 1 — venue_ratings is owner-only at the RLS level.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  listMyRatings,
  orderOf,
  removeFromBucket,
  saveRating,
  type RatingRow,
} from "@/lib/night/ratings";
import type { Bucket } from "@/lib/night/ranking";

export function useMyRatings() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery<RatingRow[]>({
    queryKey: ["my-ratings", userId],
    queryFn: () => (userId ? listMyRatings(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

/** The rating for one venue, or undefined if it has never been rated. */
export function ratingFor(rows: RatingRow[] | undefined, venueId: string): RatingRow | undefined {
  return rows?.find((r) => r.venueId === venueId);
}

export function useSaveRating() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (v: {
      venueId: string;
      bucket: Bucket;
      index: number;
      /** The full current list, so a bucket change can reindex the old bucket. */
      allRows: RatingRow[];
    }) => {
      if (!userId) throw new Error("Not signed in");

      const previous = v.allRows.find((r) => r.venueId === v.venueId);
      await saveRating(userId, v.venueId, v.bucket, v.index, orderOf(v.allRows, v.bucket));

      // Moved between buckets: close the gap it left behind, or the old
      // bucket's scores stay spread for a size it no longer has.
      if (previous && previous.bucket !== v.bucket) {
        await removeFromBucket(userId, v.venueId, previous.bucket, orderOf(v.allRows, previous.bucket));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
    },
  });
}
