/**
 * Reactions to your posts — likes and comments, newest first.
 *
 * Reactions ONLY. Friend requests and plan invites deliberately stay on their
 * own surfaces: a like clears when you see it, a request must not, and one
 * list with two clearing rules is exactly the confusion this split avoids.
 */
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Heart, Loader2, MessageCircle } from "lucide-react";
import { useActivity } from "@/hooks/useActivity";
import { isNew, type ActivityItem } from "@/lib/social/activity";
import { useVenues } from "@/hooks/useVenues";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import { nightLabel } from "@/lib/night/nightLabel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useMyPendingTags, useRemoveTag, useSetTagState } from "@/hooks/useTags";
import type { PendingTag } from "@/lib/night/tags";
import { toast } from "sonner";

/**
 * One tag awaiting the caller's decision. ACTIONABLE, unlike the reaction
 * rows below it — it persists until the caller acts, and is never gated on
 * `lastSeen`. A like clears when you see it; a name on a post does not clear
 * itself just because you scrolled past it.
 */
function PendingTagRow({ tag, venueName }: { tag: PendingTag; venueName: string | undefined }) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const setState = useSetTagState();
  const remove = useRemoveTag();
  const busy = setState.isPending || remove.isPending;
  const who = tag.author.display_name || tag.author.username;

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch {
      toast.error("Couldn't update that tag. Try again.");
    }
  };

  return (
    <li className="rounded-xl bg-primary-soft/40 px-2 py-2.5">
      <div className="flex items-start gap-3">
        <ProfileAvatar profile={tag.author} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug break-words">
            <span className="font-semibold">{who}</span>{" "}
            <span className="text-muted-foreground">
              tagged you{venueName ? " at " : ""}
            </span>
            {venueName && <span className="font-semibold">{venueName}</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{nightLabel(tag.nightDate)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-8 rounded-lg"
          disabled={busy}
          onClick={() => act(() => setState.mutateAsync({ postId: tag.postId, state: "collab" }))}
        >
          Share with my friends
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 rounded-lg"
          disabled={busy}
          onClick={() => act(() => setState.mutateAsync({ postId: tag.postId, state: "tag" }))}
        >
          Just a tag
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 rounded-lg text-muted-foreground"
          disabled={busy || !myId}
          onClick={() => myId && act(() => remove.mutateAsync({ postId: tag.postId, taggedUserId: myId }))}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

function Row({
  item,
  venueName,
  fresh,
}: {
  item: ActivityItem;
  venueName: string | undefined;
  fresh: boolean;
}) {
  const who = item.actor.display_name || item.actor.username;
  return (
    <li className={cn("flex items-start gap-3 rounded-xl px-2 py-2", fresh && "bg-primary-soft/40")}>
      <ProfileAvatar profile={item.actor} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        {/* break-words on the whole line: display names have no length limit,
            and a missing one shipped a page-wide scroll bug on 2026-08-07. */}
        <p className="text-sm leading-snug break-words">
          <span className="font-semibold">{who}</span>{" "}
          <span className="text-muted-foreground">
            {item.kind === "like" ? "liked your night" : "commented on your night"}
            {venueName ? " at " : ""}
          </span>
          {venueName && <span className="font-semibold">{venueName}</span>}
        </p>
        {item.kind === "comment" && item.body && (
          <p className="mt-0.5 text-sm text-muted-foreground break-words line-clamp-2">
            {item.body}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{nightLabel(item.nightDate)}</p>
      </div>
      <span className="shrink-0 pt-1 text-muted-foreground" aria-hidden="true">
        {item.kind === "like" ? (
          <Heart className="h-4 w-4 fill-rose-500/20 text-rose-500" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
      </span>
    </li>
  );
}

export default function ActivitySheet({
  open,
  onOpenChange,
  lastSeen,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Watermark from profiles.social_last_seen_at — highlights what is new. */
  lastSeen: string | null;
}) {
  const { data: items, isLoading, isError } = useActivity(open);
  const { data: pendingTags } = useMyPendingTags();
  const { data: venues } = useVenues({});
  // undefined while venues are still loading — the row then omits the
  // venue clause entirely rather than briefly asserting "a spot".
  const nameFor = (id: string) => venues?.find((v) => v.id === id)?.title;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border sheet-h-88">
        <DrawerTitle className="px-4 pt-2 text-base font-semibold">Activity</DrawerTitle>
        <DrawerDescription className="sr-only">
          Likes and comments on your nights.
        </DrawerDescription>
        <div className="px-2 pt-2 pb-8 max-w-lg mx-auto w-full overflow-y-auto overflow-x-hidden">
          {/* Own group, own heading, above the reactions — and never emptied
              by isNew/lastSeen the way the rows below are. */}
          {pendingTags?.length ? (
            <div className="mb-3">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Waiting on you
              </p>
              <ul className="space-y-1.5">
                {pendingTags.map((t) => (
                  <PendingTagRow key={t.postId} tag={t} venueName={nameFor(t.venueId)} />
                ))}
              </ul>
            </div>
          ) : null}

          {isError ? (
            // A failed query must NOT look like an empty inbox. Showing
            // "Nothing yet." for a network failure tells the user their
            // friends ignored them when in fact nothing loaded.
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">Couldn't load your activity.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your connection and reopen this.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items?.length ? (
            <ul className="space-y-1">
              {items.map((i) => (
                <Row key={i.id} item={i} venueName={nameFor(i.venueId)} fresh={isNew(i, lastSeen)} />
              ))}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium">Nothing yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Likes and comments on your nights show up here.
              </p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
