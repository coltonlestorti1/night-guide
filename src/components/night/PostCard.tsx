/**
 * One night-feed post: who, where, what they thought, what they said.
 *
 * Shows a night ("Last night", "Friday"), never a time. night_posts carries a
 * DATE and no link back to check_ins, so there is no timestamp here to leak
 * even by accident — the shape of the data enforces it, not this component.
 */
import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

export default function PostCard({ post, venue }: { post: FeedPost; venue?: Venue }) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const remove = useDeletePost();
  const [confirming, setConfirming] = useState(false);
  const mine = post.author.id === myId;

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
        <ProfileAvatar profile={post.author} className="h-9 w-9 shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold">
              {post.author.display_name || post.author.username}
            </span>{" "}
            <span className="text-muted-foreground">went to</span>{" "}
            <span className="font-semibold">{venue?.title ?? "a spot"}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{nightLabel(post.nightDate)}</p>

          {post.note && <p className="text-sm mt-2 whitespace-pre-wrap break-words">{post.note}</p>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Post options"
            >
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
          <Button
            size="sm"
            className="rounded-lg"
            disabled={remove.isPending}
            onClick={doDelete}
          >
            Delete for good
          </Button>
        </div>
      )}
    </article>
  );
}
