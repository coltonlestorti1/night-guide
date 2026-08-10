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

      // NOTE: rating deliberately does NOT unsave. Saved means "I bookmarked
      // this", and a place you have been to is exactly what you re-save. The
      // first cut moved a rated venue out of Saved the way Beli moves it out of
      // "Want to Try" — but that word is a statement of intent that expires
      // once you have been, and "Saved" is not. Silently undoing a bookmark the
      // user deliberately set is the app overruling them. The Saved list shows
      // your score on anything you have rated instead, so the two read as one
      // shortlist rather than two lists that fight over the same venue.
    },
    // onSettled, not onSuccess: saveRating + removeFromBucket are two round
    // trips, so a failure can still have changed the server. Invalidating only
    // on success leaves the cache showing the pre-write state after a partial
    // write, and the UI then lies in the direction of "nothing happened".
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
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
    mutationFn: async (v: { venueId: string; bucket: Bucket }) => {
      if (!userId) throw new Error("Not signed in");
      await deleteRating(userId, v.venueId, v.bucket);
    },
    // onSettled for the same reason as above: the delete can land while the
    // reindex fails. Without this the row stays on screen, and the retry then
    // fails forever because its delete matches no rows.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
    },
  });
}
