/**
 * React Query layer for the user's own ranked list.
 *
 * PRIVATE in slice 1 — venue_ratings is owner-only at the RLS level.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  deleteRating,
  listMyRatings,
  orderOf,
  removeFromBucket,
  saveRating,
  type RatingRow,
} from "@/lib/night/ratings";
import { removeSave } from "@/lib/saves";
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

      // Rating it means you have been — it belongs in Been, not Want to Try.
      // Unconditional: the delete is a no-op when it was never saved, which is
      // cheaper than threading the saved-id list through this mutation. It
      // lives here rather than in the rating UI so it fires from every entry
      // point — the recap, the publish form, and the venue card.
      try {
        await removeSave(userId, v.venueId);
      } catch {
        // Bookkeeping. The rating is the user's intent and has already landed;
        // failing it because a save could not be tidied would be a lie.
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
      qc.invalidateQueries({ queryKey: ["my-saves", userId] });
    },
  });
}

/**
 * Remove a rating outright. Until this existed a rating was permanent, which
 * is what made a wrong tap in the recap flow unfixable.
 */
export function useDeleteRating() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (v: { venueId: string; bucket: Bucket; allRows: RatingRow[] }) => {
      if (!userId) throw new Error("Not signed in");
      await deleteRating(userId, v.venueId, v.bucket, orderOf(v.allRows, v.bucket));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
    },
  });
}
