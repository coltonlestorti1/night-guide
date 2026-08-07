/**
 * The rating interaction itself: pick a bucket, then head-to-head comparisons
 * inside it. No drawer of its own — RateSheet wraps it in one, and PublishForm
 * renders it inline so "how was it?" is part of posting rather than a separate
 * trip. Two vaul drawers for one flow interrupt each other (see AddNightSheet).
 *
 * People are bad at absolute ratings and good at comparisons, which is why the
 * bucket comes first and a score is never asked for directly. Comparisons never
 * cross buckets, so a venue you loved is never weighed against one you disliked.
 */
import { useMemo, useState } from "react";
import { Venue } from "@/data/types";
import { Button } from "@/components/ui/button";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings, useSaveRating } from "@/hooks/useMyRatings";
import { orderOf } from "@/lib/night/ratings";
import { BUCKET_LABELS, nextComparison, type Bucket } from "@/lib/night/ranking";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

const BUCKETS: Bucket[] = ["great", "good", "not_great"];

export default function RateSteps({
  venue,
  onDone,
  prompt = `How was ${""}`,
  compact = false,
}: {
  venue: Venue;
  /** Called once a rating is saved, or immediately if the user skips. */
  onDone: (rated: boolean) => void;
  prompt?: string;
  /** Inline inside another form rather than filling a sheet. */
  compact?: boolean;
}) {
  const { data: rows } = useMyRatings();
  const { data: venues } = useVenues({});
  const save = useSaveRating();

  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(0);

  const order = useMemo(
    () => (bucket ? orderOf(rows ?? [], bucket).filter((id) => id !== venue.id) : []),
    [rows, bucket, venue.id],
  );

  const nameOf = (id: string) => venues?.find((v) => v.id === id)?.title ?? "that spot";

  const commit = async (b: Bucket, index: number) => {
    try {
      await save.mutateAsync({ venueId: venue.id, bucket: b, index, allRows: rows ?? [] });
      logEvent("venue_rated", { venue_id: venue.id, bucket: b, position: index });
      onDone(true);
    } catch {
      toast.error("Couldn't save that rating. Try again.");
    }
  };

  const chooseBucket = (b: Bucket) => {
    const existing = orderOf(rows ?? [], b).filter((id) => id !== venue.id);
    setBucket(b);
    // First venue in this bucket: nothing to compare against, so it lands at
    // the band midpoint and we are done in one tap.
    if (existing.length === 0) {
      void commit(b, 0);
      return;
    }
    setLo(0);
    setHi(existing.length);
  };

  const comparison = bucket ? nextComparison(order, lo, hi) : null;

  /**
   * Narrow the range, and commit the moment it collapses. Deliberately not an
   * effect watching `comparison`: an effect would re-fire on any render while
   * the save was in flight, and the second commit could land against a
   * refetched list with a different index.
   */
  const answer = (newOneIsBetter: boolean) => {
    if (!bucket || !comparison) return;
    const at = order.indexOf(comparison.venueId);
    const nextLo = newOneIsBetter ? lo : at + 1;
    const nextHi = newOneIsBetter ? at : hi;

    if (!nextComparison(order, nextLo, nextHi)) {
      void commit(bucket, nextLo);
      return;
    }
    setLo(nextLo);
    setHi(nextHi);
  };

  if (bucket && order.length > 0 && comparison) {
    return (
      <>
        <p className="text-sm font-semibold mb-1">Which was better?</p>
        <p className="text-sm text-muted-foreground mb-3">
          A couple of these and we&apos;ll know where it sits.
        </p>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full h-12 rounded-xl text-base"
            disabled={save.isPending}
            onClick={() => answer(true)}
          >
            {venue.title}
          </Button>
          <Button
            variant="secondary"
            className="w-full h-12 rounded-xl text-base"
            disabled={save.isPending}
            onClick={() => answer(false)}
          >
            {nameOf(comparison.venueId)}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className={compact ? "text-xs uppercase tracking-wide text-muted-foreground mb-2" : "text-sm mb-3"}>
        {prompt}
      </p>
      <div className={compact ? "flex flex-wrap gap-2" : "space-y-2"}>
        {BUCKETS.map((b) => (
          <Button
            key={b}
            variant="secondary"
            className={
              compact
                ? "h-9 rounded-full px-4"
                : "w-full h-12 rounded-xl justify-start text-base"
            }
            disabled={save.isPending}
            onClick={() => chooseBucket(b)}
          >
            {BUCKET_LABELS[b]}
          </Button>
        ))}
      </div>
    </>
  );
}
