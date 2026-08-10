/**
 * Per-row actions on the Been list: re-rank, or remove.
 *
 * Removing is confirmed because it throws away the comparisons that produced
 * the position, and re-earning them means answering the head-to-heads again.
 */
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { Venue } from "@/data/types";
import type { Bucket } from "@/lib/night/ranking";
import type { RatingRow } from "@/lib/night/ratings";
import { useDeleteRating } from "@/hooks/useMyRatings";
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

export default function BeenRowMenu({
  venue,
  bucket,
  allRows,
}: {
  venue: Venue;
  bucket: Bucket;
  allRows: RatingRow[];
}) {
  const [rateOpen, setRateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteRating();

  const onConfirmRemove = async () => {
    try {
      await remove.mutateAsync({ venueId: venue.id, bucket, allRows });
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
          className="shrink-0 self-center h-11 w-10 flex items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Options for ${venue.title}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRateOpen(true)}>Rank again</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
            Remove from Been
          </DropdownMenuItem>
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
