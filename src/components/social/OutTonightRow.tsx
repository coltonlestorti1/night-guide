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
    <button
      onClick={() => navigate("/", { state: { venueId: friend.venueId } })}
      className="w-full flex items-center gap-3 py-2.5 text-left"
    >
      <div className="relative shrink-0">
        <ProfileAvatar profile={friend.profile} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {firstName} <span className="font-normal text-muted-foreground">is at</span>{" "}
          {friend.venueName}
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo(friend.checkedInAt)}</p>
      </div>
      {friend.vibe && (
        <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-secondary">
          {VIBE_LABELS[friend.vibe]}
        </span>
      )}
    </button>
  );
}
