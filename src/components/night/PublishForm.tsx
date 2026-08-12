/**
 * The log sheet body: how it was, who you were with, a note, photos, which
 * night, and who can see it — one screen, everything below the circles
 * optional and collapsed.
 *
 * Deliberately NOT a Drawer. It is rendered inside one — by PublishSheet from
 * the recap and the map, and by AddNightSheet as its second step. Two vaul
 * drawers alive for one flow interrupt each other's transitions (the outgoing
 * one stays visible at data-state="closed" while the incoming one mounts stuck
 * at its start transform, with a stale body pointer-events lock). One drawer
 * with two steps makes that impossible rather than merely unlikely.
 *
 * The comparisons run AFTER Post, not on the circle tap: one circle plus one
 * Post is a complete log, and the ranking is a follow-up rather than a toll.
 */
import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Eye, ImagePlus, PencilLine, Users, X } from "lucide-react";
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
import BucketCircles from "@/components/night/BucketCircles";
import LogRow from "@/components/night/LogRow";
import NightDateField from "@/components/night/NightDateField";
import { nightChoices, nightLabelFor, ratingAction } from "@/lib/night/logNight";
import { type Bucket } from "@/lib/night/ranking";
import {
  MAX_PHOTOS_PER_POST,
  attachPhotos,
  removeStoredPhotos,
  uploadNightPhoto,
} from "@/lib/night/photos";

const NOTE_MAX = 280;
const LINK_RE = /https?:\/\/|www\./i;

/** Which optional row is expanded. One at a time keeps the sheet short. */
type RowKey = "who" | "note" | "photos" | "night" | "audience";

const isoToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

export default function PublishForm({
  venue,
  nightDate,
  onDone,
  onBack,
  onPickingChange,
  nightEditable = false,
  onNightDateChange,
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
  /**
   * Whether the night can be changed here. FALSE for the recap and for editing
   * an existing post: the upsert key is (user_id, venue_id, night_date), so
   * changing the night would quietly create a second post rather than move
   * this one.
   */
  nightEditable?: boolean;
  onNightDateChange?: (next: string) => void;
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
  const existingBucket = ratingFor(ratings, venue.id)?.bucket;
  const options = audienceOptions(collegeSlug);

  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  // After posting, run the comparisons in the SAME sheet rather than sending
  // the user somewhere else — this is what builds the spot rankings.
  const [rateAfterPost, setRateAfterPost] = useState(false);
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<Audience>(defaultAudience(collegeSlug));
  const [openRow, setOpenRow] = useState<RowKey | null>(null);
  // Who to tag on THIS publish. Tags can only be written once the post has an
  // id, so this stays local state and turns into addTag calls after publish
  // succeeds — see doPublish.
  const [taggedIds, setTaggedIds] = useState<string[]>([]);

  /**
   * The circle selection, as an OVERRIDE of the venue's existing rating rather
   * than state seeded from it.
   *
   * Seeding in an effect would be wrong: useMyRatings can resolve after first
   * paint, so the effect would either miss the existing bucket or fight the
   * user's tap when the query refetched. Deriving it means an untouched sheet
   * always shows the truth, and ratingAction sees `selected === existing` and
   * correctly skips re-ranking.
   */
  const [bucketOverride, setBucketOverride] = useState<Bucket | null>(null);
  const bucket: Bucket | null = bucketOverride ?? existingBucket ?? null;

  /**
   * A photo is uploaded the instant it is picked, so `pending` holds REAL
   * FILES in the bucket that no row points at yet.
   *
   * If the user walks away — taps X, switches venue, closes the sheet —
   * nothing else will ever delete them. No night_post_photos row exists, so
   * neither the post-delete path nor the account-delete cascade knows they are
   * there. This is where every confirmed orphan in the bucket came from.
   *
   * The ref exists because the unmount cleanup below runs with the state as it
   * was when the effect was created, which is empty.
   */
  const pendingRef = useRef<{ path: string; preview: string }[]>([]);
  pendingRef.current = pending;

  const discardPending = (items: { path: string; preview: string }[]) => {
    if (!items.length) return;
    // The previews are object URLs; dropping the state alone leaks them.
    items.forEach((p) => URL.revokeObjectURL(p.preview));
    void removeStoredPhotos(items.map((p) => p.path));
  };

  useEffect(() => {
    return () => discardPending(pendingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Seed once per venue AND per night. Seeding on every render would wipe what
   * the user is typing the moment the posts query refetches.
   *
   * The nightDate dependency is load-bearing now that the night is editable
   * here: night_posts is keyed (user_id, venue_id, night_date), so switching
   * night switches which post is being written. Without this, last night's
   * note would follow you onto a different night's post.
   */
  useEffect(() => {
    setNote(existing?.note ?? "");
    setAudience(existing?.visibility ?? defaultAudience(collegeSlug));
    setTaggedIds([]);
    setBucketOverride(null);
    // Photos are per-post as well: carrying them to another venue would attach
    // them to the wrong night. Discard the files, not just the state — on the
    // first run pendingRef is empty, so this is a no-op on mount.
    discardPending(pendingRef.current);
    setPending([]);
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
        // Attached: a row now points at these files, so they are no longer the
        // unmount cleanup's problem. Clearing here is what stops it deleting
        // photos that were successfully posted. If attachPhotos THREW, pending
        // deliberately survives and the cleanup collects the strays.
        pending.forEach((p) => URL.revokeObjectURL(p.preview));
        setPending([]);
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
      // Only rank when there is something new to rank: a bucket that matches
      // the existing rating means a second night at a place already placed,
      // and re-answering the head-to-heads for it would be a punishment.
      if (ratingAction(bucket, existingBucket) === "rank") setRateAfterPost(true);
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

  if (rateAfterPost && bucket) {
    return (
      <>
        <h2 className="text-lg font-display font-bold">Posted. Where does it sit?</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          Only you see this — it&apos;s what tunes your recommendations.
        </p>
        <RateSteps venue={venue} bucket={bucket} onDone={() => onDone()} />
        <Button variant="ghost" className="w-full h-10 rounded-xl mt-3" onClick={onDone}>
          Skip
        </Button>
      </>
    );
  }

  const toggle = (k: RowKey) => setOpenRow((cur) => (cur === k ? null : k));

  const taggedNames = friends
    .filter((f) => taggedIds.includes(f.profile.id))
    .map((f) => f.profile.display_name || f.profile.username);

  const nightSummary =
    nightLabelFor(nightDate) ?? format(parseISO(nightDate), "EEE, d MMM yyyy");

  return (
    <>
      {/* Header — the spot, then what it is and where. Mirrors the venue
          sheet's pill so the two read as the same place. */}
      <div className="mb-4">
        <h2 className="text-xl font-display font-bold leading-tight">{venue.title}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-white",
              venue.category === "bar"
                ? "bg-[hsl(var(--venue-bar))]"
                : venue.category === "club"
                  ? "bg-[hsl(var(--venue-club))]"
                  : "bg-[hsl(var(--venue-lounge))]",
            )}
          >
            {venue.category}
          </span>
          {venue.neighborhood && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {venue.neighborhood}
            </span>
          )}
        </div>
      </div>

      {/* How was it? */}
      <div className="rounded-2xl bg-secondary/40 px-3 py-4 mb-4">
        <p className="text-center text-sm font-semibold mb-3">How was it?</p>
        <BucketCircles value={bucket} onChange={setBucketOverride} disabled={busy} />
      </div>

      <div className="rounded-2xl bg-secondary/40 px-3 mb-5">
        {friends.length > 0 && (
          <LogRow
            icon={Users}
            label="Who were you with?"
            summary={taggedNames.length ? taggedNames.join(", ") : undefined}
            open={openRow === "who"}
            onToggle={() => toggle("who")}
          >
            <div className="flex flex-wrap gap-2">
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
          </LogRow>
        )}

        <LogRow
          icon={PencilLine}
          label="Add a note"
          summary={note.trim() || undefined}
          open={openRow === "note"}
          onToggle={() => toggle("note")}
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            placeholder="How was it? (optional)"
            rows={3}
            className="resize-none"
            aria-label="Note about your night"
          />
          <div className="flex items-center justify-between mt-1.5 text-xs">
            <span className={cn("text-muted-foreground", hasLink && "text-destructive")}>
              {hasLink ? "Links aren't allowed in notes." : " "}
            </span>
            <span className={cn("text-muted-foreground", remaining < 20 && "text-destructive")}>
              {remaining}
            </span>
          </div>
        </LogRow>

        <LogRow
          icon={ImagePlus}
          label="Add photos"
          summary={
            pending.length ? `${pending.length} photo${pending.length > 1 ? "s" : ""}` : undefined
          }
          open={openRow === "photos"}
          onToggle={() => toggle("photos")}
        >
          <div className="flex flex-wrap items-center gap-2">
            {pending.map((p) => (
              <div
                key={p.path}
                className="relative h-20 w-20 overflow-hidden rounded-xl border border-border"
              >
                <img src={p.preview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPending((cur) => cur.filter((x) => x.path !== p.path));
                    discardPending([p]);
                  }}
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
        </LogRow>

        {/* The question the map path never asked. Absent when the night is
            fixed — see the nightEditable prop. */}
        {nightEditable && onNightDateChange && (
          <LogRow
            icon={CalendarDays}
            label="Which night?"
            summary={nightSummary}
            open={openRow === "night"}
            onToggle={() => toggle("night")}
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {nightChoices().map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onNightDateChange(c.value)}
                  aria-pressed={nightDate === c.value}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                    nightDate === c.value
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "bg-secondary border-border hover:bg-secondary/70",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {/* Any earlier night. max=today because you cannot have been out
                tomorrow. */}
            <NightDateField value={nightDate} max={isoToday()} onChange={onNightDateChange} />
          </LogRow>
        )}

        <LogRow
          icon={Eye}
          label="Who can see this?"
          summary={AUDIENCE_SHORT[audience]}
          open={openRow === "audience"}
          onToggle={() => toggle("audience")}
        >
          <div className="flex flex-wrap gap-2">
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
        </LogRow>
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
