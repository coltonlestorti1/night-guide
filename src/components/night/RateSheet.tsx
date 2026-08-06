/**
 * Rate one venue: pick a bucket, then — only if that bucket already has
 * company — a few head-to-head comparisons inside it.
 *
 * People are bad at absolute ratings and good at comparisons, which is why the
 * bucket comes first and the score is never asked for directly. Comparisons
 * never cross buckets, so a venue you loved is never weighed against one you
 * disliked.
 */
import { useEffect, useMemo, useState } from "react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings, useSaveRating } from "@/hooks/useMyRatings";
import { orderOf } from "@/lib/night/ratings";
import { BUCKET_LABELS, nextComparison, type Bucket } from "@/lib/night/ranking";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

const BUCKETS: Bucket[] = ["great", "good", "not_great"];

export default function RateSheet({
  venue,
  open,
  onOpenChange,
}: {
  venue: Venue;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: rows } = useMyRatings();
  const { data: venues } = useVenues({});
  const save = useSaveRating();

  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(0);

  // Reset whenever the sheet opens for a venue, so a previous run's
  // comparison range never leaks into the next one.
  useEffect(() => {
    if (open) {
      setBucket(null);
      setLo(0);
      setHi(0);
    }
  }, [open, venue.id]);

  /** The chosen bucket's existing order, with this venue removed. */
  const order = useMemo(
    () => (bucket ? orderOf(rows ?? [], bucket).filter((id) => id !== venue.id) : []),
    [rows, bucket, venue.id],
  );

  const nameOf = (id: string) => venues?.find((v) => v.id === id)?.title ?? "that spot";

  const commit = async (b: Bucket, index: number) => {
    try {
      await save.mutateAsync({ venueId: venue.id, bucket: b, index, allRows: rows ?? [] });
      logEvent("venue_rated", { venue_id: venue.id, bucket: b, position: index });
      onOpenChange(false);
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
   * Narrow the range, and commit the moment it collapses.
   *
   * Deliberately not an effect watching `comparison`: an effect would fire
   * again on any re-render while the save was still in flight, and the second
   * commit could land against a refetched list with a different index.
   */
  const answer = (newOneIsBetter: boolean) => {
    if (!bucket || !comparison) return;
    const at = order.indexOf(comparison.venueId);
    const nextLo = newOneIsBetter ? lo : at + 1;
    const nextHi = newOneIsBetter ? at : hi;

    if (!nextComparison(order, nextLo, nextHi)) {
      void commit(bucket, nextLo); // range collapsed — nextLo is the insertion point
      return;
    }
    setLo(nextLo);
    setHi(nextHi);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">Rate {venue.title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick how it was, then compare it against places you've already rated.
        </DrawerDescription>

        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          {!bucket || order.length === 0 ? (
            <>
              <h2 className="text-lg font-display font-bold">How was {venue.title}?</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Just your take — only you can see this.
              </p>
              <div className="space-y-2">
                {BUCKETS.map((b) => (
                  <Button
                    key={b}
                    variant="secondary"
                    className="w-full h-12 rounded-xl justify-start text-base"
                    disabled={save.isPending}
                    onClick={() => chooseBucket(b)}
                  >
                    {BUCKET_LABELS[b]}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-display font-bold">Which was better?</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                A couple of these and we'll know where it sits.
              </p>
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full h-14 rounded-xl text-base"
                  disabled={save.isPending}
                  onClick={() => answer(true)}
                >
                  {venue.title}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full h-14 rounded-xl text-base"
                  disabled={save.isPending}
                  onClick={() => answer(false)}
                >
                  {comparison ? nameOf(comparison.venueId) : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
