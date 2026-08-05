/**
 * Friend facepile on a venue card — overlapping avatars plus a short label,
 * sitting under the card's metadata line.
 *
 * Renders nothing when no visible friend has saved the venue. That is the
 * common case until saves accumulate, and an empty-state ("no friends saved
 * this") on every card would make Discover look dead — the exact failure
 * CLAUDE.md calls the #1 risk. Silence is the correct empty state.
 *
 * Wording is deliberately "saved this", not "comes here": a save is a bookmark,
 * not attendance. Once check-in history has run for a while, a genuine
 * "regulars" signal can replace this and earn the stronger verb.
 */
import type { FriendProfile } from "@/lib/friends";
import AvatarCluster from "@/components/ui/avatar-cluster";
import { cn } from "@/lib/utils";

const MAX_FACES = 3;

function firstName(p: FriendProfile): string {
  return p.display_name?.split(" ")[0] || `@${p.username}`;
}

function label(friends: FriendProfile[]): string {
  if (friends.length === 1) return `${firstName(friends[0])} saved this`;
  if (friends.length === 2) return `${firstName(friends[0])} + 1 saved this`;
  return `${firstName(friends[0])} + ${friends.length - 1} saved this`;
}

export default function FriendSavesRow({
  friends,
  className,
}: {
  friends: FriendProfile[] | undefined;
  className?: string;
}) {
  if (!friends || friends.length === 0) return null;
  return (
    <div
      className={cn("mt-1.5 flex items-center gap-1.5 min-w-0", className)}
      // The faces are decorative; the sentence carries the meaning.
      aria-label={label(friends)}
    >
      <AvatarCluster
        size="sm"
        max={MAX_FACES}
        people={friends.map((f) => ({
          id: f.id,
          name: f.display_name || f.username,
          avatarUrl: f.avatar_url,
        }))}
        aria-hidden="true"
      />
      <span className="truncate text-[11px] font-medium text-muted-foreground">
        {label(friends)}
      </span>
    </div>
  );
}
