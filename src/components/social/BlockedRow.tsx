/** A user you've blocked — Unblock deletes the block row (blocker-only per RLS). */
import { FriendProfile } from "@/lib/friends";
import { useUnblockUser } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function BlockedRow({ rowId, profile }: { rowId: string; profile: FriendProfile }) {
  const unblock = useUnblockUser();

  return (
    <div className="flex items-center gap-3 py-2.5">
      <ProfileAvatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">@{profile.username}</p>
        {profile.display_name && (
          <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
        )}
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="rounded-full px-4"
        onClick={() => unblock.mutate(rowId)}
      >
        Unblock
      </Button>
    </div>
  );
}
