/**
 * "Your rating · 8.4 · #3 on your list", or an invitation to log the night.
 *
 * This is the venue sheet's entry into logging. It used to open RateSheet,
 * which wrote a rating and nothing else — no night, no post — so a spot rated
 * from the map never appeared in your Activity and the night you actually went
 * was never recorded. It now opens the log sheet.
 *
 * "Log another night" and "Rank again" are deliberately different things and
 * live in different places: a second visit is a new post, and re-ranking is not
 * a visit at all. Re-ranking stays on the list row menu (ListRowMenu).
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
import { lastCompletedNightDate } from "@/lib/night/window";
import PublishSheet from "@/components/night/PublishSheet";
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

  // Logging is a signed-in action, so there is nothing to show a logged-out
  // visitor.
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
              Log another night
            </Button>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Star className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Been here?</p>
              {/* NOT "only you can see this" any more — this button can now
                  publish a post, and the audience row on the sheet is where
                  that choice is actually made. */}
              <p className="text-xs text-muted-foreground">
                Log the night — you choose who sees it.
              </p>
            </div>
            <Button size="sm" className="rounded-xl shrink-0" onClick={() => setOpen(true)}>
              Log the night
            </Button>
          </>
        )}
      </div>
      {/* Mounted only while open — PublishSheet is a drawer, and the venue
          sheet already has one of its own on mobile. */}
      {open && (
        <PublishSheet
          venue={venue}
          nightDate={lastCompletedNightDate()}
          nightEditable
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
