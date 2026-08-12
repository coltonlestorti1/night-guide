/**
 * RateSheet — rank a spot, and nothing else.
 *
 * Deliberately NOT the log sheet. Re-ranking is not a new night and must not
 * produce a post, so this stays the narrow path: "Rank again" from a list row,
 * and the recap's rate action. Logging a night goes through PublishForm.
 *
 * The bucket now lives here rather than inside RateSteps, because RateSteps was
 * narrowed to the comparisons — see the note at the top of that file.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import BucketCircles from "@/components/night/BucketCircles";
import RateSteps from "@/components/night/RateSteps";
import { type Bucket } from "@/lib/night/ranking";

export default function RateSheet({
  venue,
  open,
  onOpenChange,
}: {
  venue: Venue;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [bucket, setBucket] = useState<Bucket | null>(null);

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        // Reset on close, or reopening lands mid-comparison on the bucket the
        // user picked last time — for a different venue.
        if (!o) setBucket(null);
        onOpenChange(o);
      }}
    >
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">Rate {venue.title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick how it was, then compare it against places you&apos;ve already rated.
        </DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <h2 className="text-lg font-display font-bold">How was {venue.title}?</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Just your take — only you can see this.
          </p>
          {bucket ? (
            <RateSteps venue={venue} bucket={bucket} onDone={() => onOpenChange(false)} />
          ) : (
            <BucketCircles value={null} onChange={setBucket} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
