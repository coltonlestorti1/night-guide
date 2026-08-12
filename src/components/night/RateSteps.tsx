/**
 * The head-to-head comparisons, and nothing else.
 *
 * The bucket picker used to live here and now lives in BucketCircles, because
 * two callers need the bucket BEFORE this runs: the log sheet collects it with
 * the rest of the night, and RateSheet asks for it on its own screen. A bucket
 * is therefore a required input here, not something this component discovers.
 *
 * People are bad at absolute ratings and good at comparisons, which is why a
 * score is never asked for directly. Comparisons never cross buckets, so a
 * venue you loved is never weighed against one you disliked.
 */
import { useMemo, useState } from "react";
import { Venue } from "@/data/types";
import { Button } from "@/components/ui/button";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings, useSaveRating } from "@/hooks/useMyRatings";
import { orderOf } from "@/lib/night/ratings";
import { nextComparison, type Bucket } from "@/lib/night/ranking";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

export default function RateSteps({
  venue,
  bucket,
  onDone,
}: {
  venue: Venue;
  bucket: Bucket;
  /** Called once a rating is saved. */
  onDone: (rated: boolean) => void;
}) {
  const { data: rows } = useMyRatings();
  const { data: venues } = useVenues({});
  const save = useSaveRating();

  const order = useMemo(
    () => orderOf(rows ?? [], bucket).filter((id) => id !== venue.id),
    [rows, bucket, venue.id],
  );

  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(0);

  /**
   * useMyRatings can resolve AFTER first paint, so `hi` cannot simply be seeded
   * from order.length at mount — it would be 0 against a list that later has
   * entries, and the very first comparison would be skipped. Untouched state
   * (lo and hi both 0) means "not started", so derive the real top from the
   * order we have right now.
   */
  const started = !(lo === 0 && hi === 0);
  const effectiveHi = started ? hi : order.length;

  const nameOf = (id: string) => venues?.find((v) => v.id === id)?.title ?? "that spot";

  const commit = async (index: number) => {
    try {
      await save.mutateAsync({ venueId: venue.id, bucket, index, allRows: rows ?? [] });
      logEvent("venue_rated", { venue_id: venue.id, bucket, position: index });
      onDone(true);
    } catch {
      toast.error("Couldn't save that rating. Try again.");
    }
  };

  const comparison = nextComparison(order, lo, effectiveHi);

  /**
   * Narrow the range, and commit the moment it collapses. Deliberately not an
   * effect watching `comparison`: an effect would re-fire on any render while
   * the save was in flight, and the second commit could land against a
   * refetched list with a different index.
   */
  const answer = (newOneIsBetter: boolean) => {
    if (!comparison) return;
    const at = order.indexOf(comparison.venueId);
    const nextLo = newOneIsBetter ? lo : at + 1;
    const nextHi = newOneIsBetter ? at : effectiveHi;

    if (!nextComparison(order, nextLo, nextHi)) {
      void commit(nextLo);
      return;
    }
    setLo(nextLo);
    setHi(nextHi);
  };

  /**
   * First one in this bucket: nothing to compare against, so it lands at the
   * band midpoint. This is a tap rather than an auto-commit on mount — an
   * effect firing here would run twice under StrictMode, and the second write
   * would land against a refetched list.
   */
  if (!comparison) {
    return (
      <>
        <p className="text-sm font-semibold mb-1">First one in this group.</p>
        <p className="text-sm text-muted-foreground mb-3">
          Nothing to weigh it against yet — we&apos;ll place it for now and it&apos;ll
          settle as you rate more.
        </p>
        <Button
          className="w-full h-12 rounded-xl text-base"
          disabled={save.isPending}
          onClick={() => void commit(0)}
        >
          {save.isPending ? "Saving…" : "Save it"}
        </Button>
      </>
    );
  }

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
          <span className="truncate">{venue.title}</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full h-12 rounded-xl text-base"
          disabled={save.isPending}
          onClick={() => answer(false)}
        >
          <span className="truncate">{nameOf(comparison.venueId)}</span>
        </Button>
      </div>
    </>
  );
}
