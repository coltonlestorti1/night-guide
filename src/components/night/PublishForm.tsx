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
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Venue } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth";
import { useMyPostsForNight, postFor } from "@/hooks/useNightFeed";
import { useMyRatings, ratingFor } from "@/hooks/useMyRatings";
import { useDeletePost, usePublishPost } from "@/hooks/usePublishPost";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
import { useAddTag } from "@/hooks/useTags";
import ProfileAvatar from "@/components/social/ProfileAvatar";
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
import RateSteps from "@/components/night/RateSteps";
import {
  MAX_PHOTOS_PER_POST,
  attachPhotos,
  uploadNightPhoto,
} from "@/lib/night/photos";

const NOTE_MAX = 280;
const LINK_RE = /https?:\/\/|www\./i;

export default function PublishForm({
  venue,
  nightDate,
  onDone,
  onBack,
  onPickingChange,
}: {
  venue: Venue;
  nightDate: string;
  onDone: () => void;
  /** Shown as the secondary action when this is a step in a larger flow. */
  onBack?: () => void;
  /**
   * Raised while the OS file dialog is open. The enclosing drawer must not
   * close on outside-interaction during that window — opening a native file
   * picker moves focus out of the page, which vaul reads as "user tapped
   * away" and dismisses the sheet, losing everything they had typed.
   */
  onPickingChange?: (picking: boolean) => void;
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

  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  // After posting, offer the rating in the SAME sheet rather than sending the
  // user somewhere else — this is what starts the spot rankings.
  const [rateAfterPost, setRateAfterPost] = useState(false);
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<Audience>(defaultAudience(collegeSlug));
  // Who to tag on THIS publish. Tags can only be written once the post has an
  // id, so this stays local state and turns into addTag calls after publish
  // succeeds — see doPublish.
  const [taggedIds, setTaggedIds] = useState<string[]>([]);

  // Seed once per venue. Seeding on every render would wipe what the user is
  // typing the moment the posts query refetches.
  useEffect(() => {
    setNote(existing?.note ?? "");
    setAudience(existing?.visibility ?? defaultAudience(collegeSlug));
    setTaggedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id, nightDate]);

  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: friendshipRows } = useMyFriendships();
  const friends = userId && friendshipRows ? deriveFriends(friendshipRows, userId) : [];
  const addTag = useAddTag();

  /**
   * Open the file dialog behind a guard.
   *
   * The dialog is a native window: it blurs the page, and vaul treats that as
   * an outside interaction and closes the drawer. The flag stays up until the
   * window regains focus — which happens whether the user picks a file or
   * cancels, and `change` alone does not fire on cancel.
   */
  const beginPick = () => {
    onPickingChange?.(true);
    const release = () => {
      onPickingChange?.(false);
      window.removeEventListener("focus", release);
    };
    window.addEventListener("focus", release);
    fileInput.current?.click();
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || !userId) return;
    const room = MAX_PHOTOS_PER_POST - pending.length;
    if (room <= 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        // Uploaded immediately rather than held until Post: the re-encode is
        // the slow part, and doing it here means the publish tap is instant
        // and the EXIF strip has definitely happened before anything is stored.
        const path = await uploadNightPhoto(file, userId);
        setPending((p) => [...p, { path, preview: URL.createObjectURL(file) }]);
      }
    } catch {
      toast.error("Couldn't add that photo. Try another.");
    } finally {
      setUploading(false);
      onPickingChange?.(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const remaining = NOTE_MAX - note.length;
  const hasLink = LINK_RE.test(note);
  const busy = publish.isPending || remove.isPending;

  const doPublish = async () => {
    if (hasLink) return;
    try {
      const postId = await publish.mutateAsync({
        venueId: venue.id,
        nightDate,
        note: note.trim() || null,
        visibility: audience,
        score: myScore,
      });
      if (pending.length) {
        await attachPhotos(postId, pending.map((p) => p.path));
      }
      if (taggedIds.length) {
        // Tags need a post id, so they can only happen after publish
        // succeeds — a failed tag must not undo or block the post itself,
        // it's just reported so the author knows to retry it.
        const results = await Promise.allSettled(
          taggedIds.map((id) =>
            addTag.mutateAsync({ postId, taggedUserId: id, isPrivatePost: audience === "nobody" }),
          ),
        );
        if (results.some((r) => r.status === "rejected")) {
          toast.error("Posted, but couldn't tag everyone. Try tagging them again.");
        }
      }
      logEvent("night_post_published", {
        venue_id: venue.id,
        visibility: audience,
        has_note: !!note.trim(),
        photos: pending.length,
      });
      // Unrated spots get the "how was it?" step now; already-rated ones are
      // done. Skippable either way — a post without a score is normal, and
      // "went to" vs "ranked" depends on that staying true.
      if (myScore === null) setRateAfterPost(true);
      else onDone();
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

  if (rateAfterPost) {
    return (
      <>
        <h2 className="text-lg font-display font-bold">Posted. How was {venue.title}?</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Only you see this — it's what tunes your recommendations.
        </p>
        <RateSteps venue={venue} prompt="" onDone={() => onDone()} />
        <Button variant="ghost" className="w-full h-10 rounded-xl mt-3" onClick={onDone}>
          Skip
        </Button>
      </>
    );
  }

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

      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Photos</p>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {pending.map((p) => (
          <div key={p.path} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setPending((cur) => cur.filter((x) => x.path !== p.path))}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {pending.length < MAX_PHOTOS_PER_POST && (
          <button
            type="button"
            onClick={beginPick}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground hover:bg-secondary/60 disabled:opacity-50"
            aria-label="Add a photo"
          >
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px]">{uploading ? "Adding…" : "Add"}</span>
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
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

      {friends.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Tag people you were with
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            {friends.map((f) => {
              const selected = taggedIds.includes(f.profile.id);
              return (
                <button
                  key={f.profile.id}
                  type="button"
                  onClick={() =>
                    setTaggedIds((cur) =>
                      selected ? cur.filter((id) => id !== f.profile.id) : [...cur, f.profile.id],
                    )
                  }
                  aria-pressed={selected}
                  aria-label={`Tag ${f.profile.display_name || f.profile.username}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1.5 text-sm transition-all",
                    selected
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-secondary border-border hover:bg-secondary/70",
                  )}
                >
                  <ProfileAvatar profile={f.profile} className="h-6 w-6 shrink-0" />
                  {/* Bounded width + truncate rather than break-words: a
                      wrapping chip in a flex-wrap row has no shrink target to
                      wrap against (min-w-0 only helps inside a flex row that
                      is itself constrained), so an unbroken long name would
                      widen the chip past the sheet instead of breaking — the
                      same page-scroll bug class, blocked here by a hard cap
                      instead. */}
                  <span className="max-w-[9rem] truncate">
                    {f.profile.display_name || f.profile.username}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

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
