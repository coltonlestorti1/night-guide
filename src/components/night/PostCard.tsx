/**
 * One night-feed post — shaped after Beli's feed card (Colton, 2026-08-07):
 * "<name> ranked <venue>", the score in a circle on the right, the
 * neighbourhood underneath, and a relative night at the bottom.
 *
 * The verb follows the data: "ranked" only when there is a score, "went to"
 * when there isn't. Rating and posting are separate acts, so a post without a
 * rating is normal, and claiming someone ranked something they didn't would be
 * the same class of lie as inventing a venue detail.
 *
 * A night ("Last night", "Friday"), never a time. night_posts stores a DATE and
 * has no link to check_ins, so the shape of the data enforces that, not this
 * component.
 */
import { useState } from "react";
import { Lock, MapPin, MoreHorizontal, Trash2 } from "lucide-react";
import { Venue } from "@/data/types";
import type { FeedPost } from "@/lib/night/posts";
import { useAuthStore } from "@/store/auth";
import { useDeletePost } from "@/hooks/usePublishPost";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import ReportDialog from "@/components/social/ReportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { nightLabel } from "@/lib/night/nightLabel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Beli-style ring: warmer as the score climbs, muted when there is none. */
function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return null;
  const tone =
    score >= 6.7
      ? "border-emerald-500/60 text-emerald-700"
      : score >= 3.4
        ? "border-amber-500/60 text-amber-700"
        : "border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums",
        tone,
      )}
      aria-label={`Rated ${score.toFixed(1)} out of 10`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export default function PostCard({
  post,
  venue,
  photos = [],
}: {
  post: FeedPost;
  venue?: Venue;
  /** Signed URLs for this post, already filtered by the caller. */
  photos?: { id: string; url: string | null }[];
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const remove = useDeletePost();
  const [confirming, setConfirming] = useState(false);
  const mine = post.author.id === myId;
  const ranked = post.score !== null;

  const doDelete = async () => {
    try {
      await remove.mutateAsync(post.id);
      setConfirming(false);
    } catch {
      toast.error("Couldn't remove that post. Try again.");
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <ProfileAvatar profile={post.author} className="h-10 w-10 shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            <span className="font-semibold">
              {mine ? "You" : post.author.display_name || post.author.username}
            </span>{" "}
            <span className="text-muted-foreground">{ranked ? "ranked" : "went to"}</span>{" "}
            <span className="font-semibold">{venue?.title ?? "a spot"}</span>
          </p>

          {venue?.neighborhood && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              {venue.neighborhood}
            </p>
          )}

          {post.note && (
            <p className="mt-2 text-sm whitespace-pre-wrap break-words">{post.note}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Only the author ever sees this row, so the lock is a reminder of
              their own choice rather than a hint to anyone else. */}
          {mine && post.visibility === "nobody" && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground"
              aria-label="Private — only you can see this"
              title="Only you can see this"
            >
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}
          <ScoreRing score={post.score} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Post options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mine ? (
                <DropdownMenuItem
                  onSelect={() => setConfirming(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete post
                </DropdownMenuItem>
              ) : (
                // Reuses the report flow shipped 2026-08-05 for App Store
                // compliance — same reasons, same dedup, now pointed at a post.
                <ReportDialog profile={post.author} context="post" contextId={post.id} />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {photos.length > 0 && (
        <div className={cn("mt-3 grid gap-2", photos.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {photos.map(
            (ph) =>
              ph.url && (
                <img
                  key={ph.id}
                  src={ph.url}
                  alt=""
                  loading="lazy"
                  className="h-40 w-full rounded-xl object-cover"
                />
              ),
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{nightLabel(post.nightDate)}</p>

      {confirming && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-lg"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button size="sm" className="rounded-lg" disabled={remove.isPending} onClick={doDelete}>
            Delete for good
          </Button>
        </div>
      )}
    </article>
  );
}
