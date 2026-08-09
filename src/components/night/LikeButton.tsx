/**
 * The heart on a feed card.
 *
 * Deliberately shows the count next to the heart rather than a separate
 * "N likes" line: the feed card already carries author, venue, score, note,
 * photos and the comment preview, and another full-width row of text is height
 * this card cannot spare.
 */
import { Heart } from "lucide-react";
import { useToggleLike } from "@/hooks/useLikes";
import type { LikeSummary } from "@/lib/night/likes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function LikeButton({
  postId,
  summary,
}: {
  postId: string;
  summary: LikeSummary | undefined;
}) {
  const toggle = useToggleLike();
  const liked = summary?.likedByMe ?? false;
  const count = summary?.count ?? 0;

  const onTap = async () => {
    try {
      await toggle.mutateAsync({ postId, liked });
    } catch {
      toast.error("Couldn't save that. Try again.");
    }
  };

  return (
    <button
      type="button"
      onClick={onTap}
      // The hit area is grown by a pseudo-element rather than padding, so the
      // visible row does not shift. Negative margins collapse through a plain
      // block parent — that shipped a 2px overlap once already.
      className={cn(
        "relative inline-flex items-center gap-1.5 text-sm transition-colors",
        "before:absolute before:-inset-y-3 before:-inset-x-2 before:content-['']",
        liked ? "text-rose-600" : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={liked}
      aria-label={
        // "1 likes" is what a screen reader would otherwise read out.
        `${liked ? "Unlike" : "Like"} — ${count} ${count === 1 ? "like" : "likes"}`
      }
    >
      <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
