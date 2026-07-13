/** Incoming: Accept (filled) / Decline (ghost). Outgoing: Cancel (ghost). */
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
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const cancel = useCancelRequest();

  return (
    <div className="flex items-center gap-3 py-2.5">
      <ProfileAvatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">@{profile.username}</p>
        {profile.display_name && (
          <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
        )}
      </div>
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
