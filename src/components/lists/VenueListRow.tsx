/**
 * One venue row, shared by every list surface. Extracted from SavedSpotsList so
 * Been and Want to Try cannot drift apart in padding, focus ring or fallback
 * image behaviour.
 *
 * The lightbox itself stays with the parent list: one lightbox per list, not
 * one per row.
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Venue } from "@/data/types";
import type { Bucket } from "@/lib/night/ranking";
import { venueImageSrc, PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
import ScoreBadge from "@/components/lists/ScoreBadge";

export default function VenueListRow({
  venue,
  rank,
  score,
  bucket,
  trailing,
  onPhotoClick,
}: {
  venue: Venue;
  /** 1-based position, shown only on a ranked list. */
  rank?: number;
  score?: number;
  bucket?: Bucket;
  /** Sits after the row body — the overflow menu on Been rows. */
  trailing?: ReactNode;
  onPhotoClick?: (url: string, alt: string) => void;
}) {
  const navigate = useNavigate();

  const thumb = (
    <img
      src={venueImageSrc(venue)}
      alt=""
      className="h-11 w-11 rounded-xl object-cover shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
      }}
    />
  );

  // Only a real photo is worth opening full-screen; the category placeholder
  // is not, so it stays part of the navigating button.
  const photoOpens = hasRealPhoto(venue) && !!onPhotoClick;

  return (
    <li className="flex w-full p-0 transition-colors hover:bg-secondary/40">
      {rank !== undefined && (
        <span className="w-6 shrink-0 self-center pl-3 text-sm font-semibold tabular-nums text-muted-foreground">
          {rank}
        </span>
      )}

      {photoOpens && (
        <button
          type="button"
          onClick={() => onPhotoClick!(venue.image_url!, venue.title)}
          className="shrink-0 rounded-xl py-3 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View photo of ${venue.title}`}
        >
          {thumb}
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate(`/venue/${venue.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {!photoOpens && thumb}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{venue.title}</span>
          {venue.neighborhood && (
            <span className="block truncate text-xs text-muted-foreground">
              {venue.neighborhood}
            </span>
          )}
        </span>
        {score !== undefined && bucket && <ScoreBadge score={score} bucket={bucket} />}
        {!trailing && (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {trailing}
    </li>
  );
}
