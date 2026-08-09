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

function Row({
  item,
  venueName,
  fresh,
}: {
  item: ActivityItem;
  venueName: string;
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
          {item.kind === "like" ? (
            <span className="text-muted-foreground">liked your night at </span>
          ) : (
            <span className="text-muted-foreground">commented on your night at </span>
          )}
          <span className="font-semibold">{venueName}</span>
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
  const { data: items, isLoading } = useActivity(open);
  const { data: venues } = useVenues({});
  const nameFor = (id: string) => venues?.find((v) => v.id === id)?.title ?? "a spot";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border sheet-h-88">
        <DrawerTitle className="px-4 pt-2 text-base font-semibold">Activity</DrawerTitle>
        <DrawerDescription className="sr-only">
          Likes and comments on your nights.
        </DrawerDescription>
        <div className="px-2 pt-2 pb-8 max-w-lg mx-auto w-full overflow-y-auto overflow-x-hidden">
          {isLoading ? (
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
