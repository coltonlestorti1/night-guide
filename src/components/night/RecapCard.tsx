/**
 * "Last night · N spots" — the morning-after recap.
 *
 * PRIVATE. This is the user's own check-in history and nobody else's; slice 2
 * adds the published feed. Renders nothing at all when there is no night to
 * show, because a user who stayed in should not be told so.
 */
import { useState } from "react";
import { Moon } from "lucide-react";
import { Venue } from "@/data/types";
import { useNightRecap } from "@/hooks/useNightRecap";
import { useMyRatings, ratingFor } from "@/hooks/useMyRatings";
import { useVenues } from "@/hooks/useVenues";
import { Button } from "@/components/ui/button";
import RateSheet from "@/components/night/RateSheet";
import PublishSheet from "@/components/night/PublishSheet";
import { useMyPostsForNight, postFor } from "@/hooks/useNightFeed";
import { lastCompletedNightDate } from "@/lib/night/window";
import { Lock, Send } from "lucide-react";

export default function RecapCard() {
  // One night-date for the whole card: useNightRecap would otherwise derive its
  // own, and the two could disagree across the 06:00 boundary.
  const nightDate = lastCompletedNightDate();
  const { data: visits } = useNightRecap(nightDate);
  const { data: ratings } = useMyRatings();
  const { data: venues } = useVenues({});
  const [rating, setRating] = useState<Venue | null>(null);
  const [publishing, setPublishing] = useState<Venue | null>(null);
  const { data: myPosts } = useMyPostsForNight(nightDate);

  // No card at all rather than an empty state: "you didn't go out" is not
  // something the app needs to say.
  if (!visits?.length) return null;

  const rows = visits
    .map((v) => venues?.find((x) => x.id === v.venueId))
    .filter((v): v is Venue => !!v);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">
          Last night · {rows.length} {rows.length === 1 ? "spot" : "spots"}
        </h2>
      </div>

      <ul className="space-y-2">
        {rows.map((venue) => {
          const rated = ratingFor(ratings, venue.id);
          return (
            <li key={venue.id} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate text-sm">{venue.title}</span>

              {rated ? (
                <button
                  type="button"
                  onClick={() => setRating(venue)}
                  className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary"
                  aria-label={`You rated ${venue.title} ${rated.score.toFixed(1)} out of 10. Change it.`}
                >
                  {rated.score.toFixed(1)}
                </button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 h-8 rounded-full px-3"
                  onClick={() => setRating(venue)}
                >
                  Rate
                </Button>
              )}

              {/* Posting is a separate act from rating — you can do either,
                  both, or neither, and rating never publishes anything. */}
              <Button
                size="sm"
                variant={postFor(myPosts, venue.id) ? "ghost" : "secondary"}
                className="shrink-0 h-8 rounded-full px-3"
                onClick={() => setPublishing(venue)}
                aria-label={
                  postFor(myPosts, venue.id)
                    ? `Edit your post about ${venue.title}`
                    : `Post about ${venue.title}`
                }
              >
                {postFor(myPosts, venue.id) ? (
                  postFor(myPosts, venue.id)!.visibility === "nobody" ? (
                    <><Lock className="h-3 w-3 mr-1" /> Private</>
                  ) : (
                    "Posted"
                  )
                ) : (
                  <><Send className="h-3 w-3 mr-1" /> Post</>
                )}
              </Button>
            </li>
          );
        })}
      </ul>

      {rating && (
        <RateSheet
          venue={rating}
          open={!!rating}
          onOpenChange={(o) => !o && setRating(null)}
        />
      )}

      {publishing && (
        <PublishSheet
          venue={publishing}
          nightDate={nightDate}
          open={!!publishing}
          onOpenChange={(o) => !o && setPublishing(null)}
        />
      )}
    </div>
  );
}
