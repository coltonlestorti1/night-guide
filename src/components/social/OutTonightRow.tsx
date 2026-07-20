/**
 * A friend with an active check-in. Tap flies the map to their venue —
 * same selection path a search pick uses (MapPage reads the venueId from
 * navigation state).
 */
import { useNavigate } from "react-router-dom";
import { FriendOutTonight } from "@/lib/friends";
import { VIBE_LABELS } from "@/lib/checkins";
import { timeAgo } from "@/lib/format";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function OutTonightRow({ friend }: { friend: FriendOutTonight }) {
  const navigate = useNavigate();
  const firstName = friend.profile.display_name?.split(" ")[0] || `@${friend.profile.username}`;

  return (
    <div className="flex w-full items-center gap-3 py-2.5">
      <button
        className="relative shrink-0 rounded-full"
        onClick={() => navigate(`/u/${friend.profile.username}`)}
        aria-label={`View @${friend.profile.username}'s profile`}
      >
        <ProfileAvatar profile={friend.profile} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
          aria-hidden="true"
        />
      </button>
      <button
        onClick={() => navigate("/", { state: { venueId: friend.venueId } })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {firstName} <span className="font-normal text-muted-foreground">is at</span>{" "}
            {friend.venueName}
          </span>
          <span className="block text-xs text-muted-foreground">{timeAgo(friend.checkedInAt)}</span>
        </span>
        {friend.vibe && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs">
            {VIBE_LABELS[friend.vibe]}
          </span>
        )}
      </button>
    </div>
  );
}
