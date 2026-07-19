/** Incoming: Accept (filled) / Decline (ghost). Outgoing: Cancel (ghost).
 *  Avatar+name tap opens the profile. */
import { useNavigate } from "react-router-dom";
import { FriendProfile } from "@/lib/friends";
import { useAcceptRequest, useCancelRequest, useDeclineRequest } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function RequestRow({
  rowId,
  profile,
  direction,
}: {
  rowId: string;
  profile: FriendProfile;
  direction: "incoming" | "outgoing";
}) {
  const navigate = useNavigate();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const cancel = useCancelRequest();

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => navigate(`/u/${profile.username}`)}
        aria-label={`View @${profile.username}'s profile`}
      >
        <ProfileAvatar profile={profile} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">@{profile.username}</span>
          {profile.display_name && (
            <span className="block truncate text-xs text-muted-foreground">
              {profile.display_name}
            </span>
          )}
        </span>
      </button>
      {direction === "incoming" ? (
        <>
          <Button size="sm" className="rounded-full px-4" onClick={() => accept.mutate(rowId)}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full px-3 text-muted-foreground"
            onClick={() => decline.mutate(rowId)}
          >
            Decline
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full px-3 text-muted-foreground"
          onClick={() => cancel.mutate(rowId)}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
