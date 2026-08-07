/**
 * Publish one venue from last night to the feed — or don't.
 *
 * Rating and publishing are deliberately separate acts. A rating is private and
 * feeds the recommender; a post is authored and public to some audience. Rating
 * something must never imply broadcasting it.
 *
 * Reopening a published venue puts the sheet in edit mode rather than creating
 * a second post, because "change what I said" is the same act as saying it.
 */
import { useEffect, useState } from "react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth";
import { useMyPostsForNight, postFor } from "@/hooks/useNightFeed";
import { useDeletePost, usePublishPost } from "@/hooks/usePublishPost";
import { AUDIENCE_LABELS, audienceOptions, defaultAudience, type Audience } from "@/lib/night/audience";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

const NOTE_MAX = 280;
const LINK_RE = /https?:\/\/|www\./i;

export default function PublishSheet({
  venue,
  nightDate,
  open,
  onOpenChange,
}: {
  venue: Venue;
  nightDate: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const collegeSlug = useAuthStore((s) => s.profile?.college_slug);
  const { data: myPosts } = useMyPostsForNight(nightDate);
  const publish = usePublishPost();
  const remove = useDeletePost();

  const existing = postFor(myPosts, venue.id);
  const options = audienceOptions(collegeSlug);

  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<Audience>(defaultAudience(collegeSlug));

  // Seed only when the sheet opens. Seeding on every render would wipe what the
  // user is typing the moment the posts query refetches.
  useEffect(() => {
    if (!open) return;
    setNote(existing?.note ?? "");
    setAudience(existing?.visibility ?? defaultAudience(collegeSlug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, venue.id]);

  const remaining = NOTE_MAX - note.length;
  const hasLink = LINK_RE.test(note);
  const busy = publish.isPending || remove.isPending;

  const doPublish = async () => {
    if (hasLink) return;
    try {
      await publish.mutateAsync({
        venueId: venue.id,
        nightDate,
        note: note.trim() || null,
        visibility: audience,
      });
      logEvent("night_post_published", {
        venue_id: venue.id,
        visibility: audience,
        has_note: !!note.trim(),
      });
      onOpenChange(false);
    } catch {
      toast.error("Couldn't post that. Try again.");
    }
  };

  const doDelete = async () => {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
      logEvent("night_post_deleted", { venue_id: venue.id });
      onOpenChange(false);
    } catch {
      toast.error("Couldn't remove that post. Try again.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">
          {existing ? "Edit your post" : "Post"} about {venue.title}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Add an optional note and choose who can see it.
        </DrawerDescription>

        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <h2 className="text-lg font-display font-bold">
            {existing ? "Edit your post" : `Post about ${venue.title}?`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Optional — say something about the night, or just post the spot.
          </p>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder="How was it? (optional)"
            rows={3}
            className="resize-none"
            aria-label="Note about your night"
          />
          <div className="flex items-center justify-between mt-1.5 mb-4 text-xs">
            <span className={cn("text-muted-foreground", hasLink && "text-destructive")}>
              {hasLink ? "Links aren't allowed in notes." : " "}
            </span>
            <span className={cn("text-muted-foreground", remaining < 20 && "text-destructive")}>
              {remaining}
            </span>
          </div>

          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Who can see this?
          </p>
          <div className="space-y-2 mb-5">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setAudience(o)}
                aria-pressed={audience === o}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                  audience === o
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-secondary border-border hover:bg-secondary/70",
                )}
              >
                {AUDIENCE_LABELS[o]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-11 rounded-xl"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {existing ? "Cancel" : "Skip"}
            </Button>
            <Button
              className="h-11 rounded-xl"
              disabled={busy || hasLink}
              onClick={doPublish}
            >
              {existing ? "Save" : "Post"}
            </Button>
          </div>

          {existing && (
            <Button
              variant="ghost"
              className="w-full h-10 rounded-xl mt-2 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={doDelete}
            >
              Delete post
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
