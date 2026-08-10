/**
 * One venue row, shared by every list surface. It began as the row inside the
 * old profile SavedSpotsList (removed when /lists took over that job), lifted
 * out so Been and Want to try cannot drift apart in padding, focus ring or
 * fallback image behaviour.
 *
 * The whole row navigates, thumbnail included. The old saved-spots row opened
 * a lightbox from the photo instead, which meant two visually identical rows
 * did different things depending on whether the venue happened to have a real
 * photo — and tapping a picture in a list reads as "open this place"
 * everywhere else in the app. Photos are one tap away on the venue card.
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Venue } from "@/data/types";
import type { Bucket } from "@/lib/night/ranking";
import { venueImageSrc, PLACEHOLDER } from "@/lib/venueImages";
import ScoreBadge from "@/components/lists/ScoreBadge";

export default function VenueListRow({
  venue,
  rank,
  score,
  bucket,
  trailing,
}: {
  venue: Venue;
  /** 1-based position, shown only on a ranked list. */
  rank?: number;
  score?: number;
  bucket?: Bucket;
  /** Sits after the row body — the overflow menu. */
  trailing?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <li className="flex w-full p-0 transition-colors hover:bg-secondary/40">
      <button
        type="button"
        onClick={() => navigate(`/venue/${venue.id}`)}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {rank !== undefined && (
          <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
            {/* Read out as part of the row's label below, not as a stray digit. */}
            <span aria-hidden="true">{rank}</span>
            <span className="sr-only">Number {rank}:</span>
          </span>
        )}
        <img
          src={venueImageSrc(venue)}
          alt=""
          className="h-11 w-11 rounded-xl object-cover shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{venue.title}</span>
          {venue.neighborhood && (
            <span className="block truncate text-xs text-muted-foreground">
              {venue.neighborhood}
            </span>
          )}
        </span>
        {score !== undefined && bucket && <ScoreBadge score={score} bucket={bucket} />}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {trailing}
    </li>
  );
}
