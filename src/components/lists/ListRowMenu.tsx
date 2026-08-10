/**
 * Per-row actions on a list.
 *
 * Been rows get "Rank again" and a confirmed "Remove". Want to try rows get
 * "Rate it" and "Remove" — rating from the saved list is the action that moves
 * a venue from one tab to the other, and the saved list is exactly where
 * someone forms the thought "I went to that one".
 *
 * Removing a rating is confirmed because it throws away the comparisons that
 * produced the position, and re-earning them means answering the head-to-heads
 * again. Unsaving is one tap to undo, so it is not.
 */
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { Venue } from "@/data/types";
import type { Bucket } from "@/lib/night/ranking";
import { useDeleteRating } from "@/hooks/useMyRatings";
import { useSaves } from "@/hooks/useSaves";
import RateSheet from "@/components/night/RateSheet";
import { logEvent } from "@/lib/analytics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Touch-sized menu rows. The shadcn default is py-1.5 — about 32px, which is
 *  too small for a destructive action on a phone. */
const ITEM = "h-11 px-3 text-sm";

export default function ListRowMenu({
  venue,
  bucket,
}: {
  venue: Venue;
  /** The rating's bucket on a Been row; absent on a Want to try row. */
  bucket?: Bucket;
}) {
  const [rateOpen, setRateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteRating();
  const { toggle: toggleSaved } = useSaves();

  const onConfirmRemove = async () => {
    if (!bucket) return;
    try {
      await remove.mutateAsync({ venueId: venue.id, bucket });
      logEvent("rating_removed", { venue_id: venue.id, bucket });
      setConfirmOpen(false);
    } catch {
      // Leave the dialog open — closing it would read as "removed" when the
      // row is still there.
      toast.error("Couldn't remove that. Try again.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="shrink-0 self-center h-11 w-11 flex items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Options for ${venue.title}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem className={ITEM} onSelect={() => setRateOpen(true)}>
            {bucket ? "Rank again" : "Rate it"}
          </DropdownMenuItem>
          {bucket ? (
            <DropdownMenuItem
              className={`${ITEM} text-destructive focus:text-destructive`}
              onSelect={() => setConfirmOpen(true)}
            >
              Remove from your Been list
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className={`${ITEM} text-destructive focus:text-destructive`}
              onSelect={() => toggleSaved(venue.id)}
            >
              Remove from Want to try
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mounted only while open: RateSheet renders a drawer, and one per row
          would put a few dozen of them on the page. */}
      {rateOpen && <RateSheet venue={venue} open onOpenChange={setRateOpen} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {venue.title} from your list?</AlertDialogTitle>
            <AlertDialogDescription>
              Its ranking goes with it. You can always rate it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => {
                // The primitive closes on click by default; the dialog must
                // stay up until the delete actually lands.
                e.preventDefault();
                void onConfirmRemove();
              }}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
