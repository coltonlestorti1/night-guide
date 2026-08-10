/**
 * "Your rating · 8.4 · #3 on your list", or a Rate it button.
 *
 * This is the only place a venue can be rated outside the night recap. Before
 * it existed a spot could only be rated if it happened to surface in a recap,
 * which is why the Been list had nothing in it.
 *
 * Position comes from beenList — the same function /lists renders — so the
 * number here always names the row you would actually find there.
 */
import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { Venue } from "@/data/types";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings } from "@/hooks/useMyRatings";
import { beenList } from "@/lib/night/lists";
import RateSheet from "@/components/night/RateSheet";
import ScoreBadge from "@/components/lists/ScoreBadge";
import { Button } from "@/components/ui/button";

export default function VenueRatingRow({ venue }: { venue: Venue }) {
  const signedIn = useAuthStore((s) => s.status) === "signedIn";
  const { data: ratings } = useMyRatings();
  const { data: venues } = useVenues({});
  const [open, setOpen] = useState(false);

  const entry = useMemo(
    () => beenList(ratings, venues ?? []).find((e) => e.venue.id === venue.id),
    [ratings, venues, venue.id],
  );

  // Rating is a signed-in action and the list is private, so there is nothing
  // to show a logged-out visitor.
  if (!signedIn) return null;

  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/50 px-3 py-2">
        {entry ? (
          <>
            <ScoreBadge score={entry.score} bucket={entry.bucket} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Your rating</p>
              <p className="text-xs text-muted-foreground">#{entry.position} on your list</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl shrink-0"
              onClick={() => setOpen(true)}
            >
              Rank again
            </Button>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Star className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Been here?</p>
              <p className="text-xs text-muted-foreground">Rate it — only you can see this.</p>
            </div>
            <Button size="sm" className="rounded-xl shrink-0" onClick={() => setOpen(true)}>
              Rate it
            </Button>
          </>
        )}
      </div>
      {open && <RateSheet venue={venue} open onOpenChange={setOpen} />}
    </>
  );
}
