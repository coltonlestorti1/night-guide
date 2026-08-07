/**
 * The publish form: note, audience, and the publish/skip controls.
 *
 * Deliberately NOT a Drawer. It is rendered inside one — by PublishSheet from
 * the recap, and by AddNightSheet as its second step. Two vaul drawers alive
 * for one flow interrupt each other's transitions (the outgoing one stays
 * visible at data-state="closed" while the incoming one mounts stuck at its
 * start transform, with a stale body pointer-events lock). One drawer with two
 * steps makes that impossible rather than merely unlikely.
 */
import { useEffect, useState } from "react";
import { Venue } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth";
import { useMyPostsForNight, postFor } from "@/hooks/useNightFeed";
import { useMyRatings, ratingFor } from "@/hooks/useMyRatings";
import { useDeletePost, usePublishPost } from "@/hooks/usePublishPost";
import {
  AUDIENCE_LABELS,
  AUDIENCE_SHORT,
  audienceOptions,
  defaultAudience,
  type Audience,
} from "@/lib/night/audience";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

const NOTE_MAX = 280;
const LINK_RE = /https?:\/\/|www\./i;

export default function PublishForm({
  venue,
  nightDate,
  onDone,
  onBack,
}: {
  venue: Venue;
  nightDate: string;
  onDone: () => void;
  /** Shown as the secondary action when this is a step in a larger flow. */
  onBack?: () => void;
}) {
  const collegeSlug = useAuthStore((s) => s.profile?.college_slug);
  const { data: myPosts } = useMyPostsForNight(nightDate);
  const { data: ratings } = useMyRatings();
  const publish = usePublishPost();
  const remove = useDeletePost();

  const existing = postFor(myPosts, venue.id);
  // Snapshot, not a live join: venue_ratings stays owner-only, so the post
  // carries the score as it stood when published. Editing refreshes it.
  const myScore = ratingFor(ratings, venue.id)?.score ?? null;
  const options = audienceOptions(collegeSlug);

  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<Audience>(defaultAudience(collegeSlug));

  // Seed once per venue. Seeding on every render would wipe what the user is
  // typing the moment the posts query refetches.
  useEffect(() => {
    setNote(existing?.note ?? "");
    setAudience(existing?.visibility ?? defaultAudience(collegeSlug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id, nightDate]);

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
        score: myScore,
      });
      logEvent("night_post_published", {
        venue_id: venue.id,
        visibility: audience,
        has_note: !!note.trim(),
      });
      onDone();
    } catch {
      toast.error("Couldn't post that. Try again.");
    }
  };

  const doDelete = async () => {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
      logEvent("night_post_deleted", { venue_id: venue.id });
      onDone();
    } catch {
      toast.error("Couldn't remove that post. Try again.");
    }
  };

  return (
    <>
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
          {hasLink ? "Links aren't allowed in notes." : " "}
        </span>
        <span className={cn("text-muted-foreground", remaining < 20 && "text-destructive")}>
          {remaining}
        </span>
      </div>

      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        Who can see this?
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setAudience(o)}
            aria-pressed={audience === o}
            aria-label={AUDIENCE_LABELS[o]}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-all",
              audience === o
                ? "bg-primary text-primary-foreground border-transparent"
                : "bg-secondary border-border hover:bg-secondary/70",
            )}
          >
            {AUDIENCE_SHORT[o]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="h-11 rounded-xl"
          disabled={busy}
          onClick={onBack ?? onDone}
        >
          {onBack ? "Back" : existing ? "Cancel" : "Skip"}
        </Button>
        <Button className="h-11 rounded-xl" disabled={busy || hasLink} onClick={doPublish}>
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
    </>
  );
}
