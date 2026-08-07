/**
 * RateSheet — the drawer wrapper around RateSteps, opened from the recap.
 *
 * PublishForm renders RateSteps inline instead of opening this, so posting and
 * rating happen in one sheet rather than two stacked drawers.
 */
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import RateSteps from "@/components/night/RateSteps";

export default function RateSheet({
  venue,
  open,
  onOpenChange,
}: {
  venue: Venue;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">Rate {venue.title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick how it was, then compare it against places you've already rated.
        </DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <h2 className="text-lg font-display font-bold">How was {venue.title}?</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Just your take — only you can see this.
          </p>
          <RateSteps venue={venue} prompt="" onDone={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
