/**
 * The Snapchat-verb button: Add → Requested (optimistic flip, rollback on
 * error). Shows Accept when they already added you, a quiet "Friends ✓"
 * when you're connected, nothing when blocked.
 */
import { useAuthStore } from "@/store/auth";
import { FriendProfile, deriveIncoming, deriveRelationship } from "@/lib/friends";
import { useAcceptRequest, useMyFriendships, useSendRequest } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";

export default function AddButton({ profile }: { profile: FriendProfile }) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const send = useSendRequest();
  const accept = useAcceptRequest();

  if (!userId || !rows) return null;
  const rel = deriveRelationship(rows, userId, profile.id);

  if (rel === "blocked") return null;
  if (rel === "friends")
    return <span className="text-xs font-medium text-muted-foreground shrink-0">Friends ✓</span>;
  if (rel === "outgoing")
    return (
      <Button size="sm" variant="secondary" disabled className="rounded-full px-4 shrink-0">
        Requested
      </Button>
    );
  if (rel === "incoming") {
    const row = deriveIncoming(rows, userId).find((r) => r.profile.id === profile.id);
    return (
      <Button
        size="sm"
        className="rounded-full px-4 shrink-0"
        onClick={() => row && accept.mutate(row.rowId)}
      >
        Accept
      </Button>
    );
  }
  return (
    <Button size="sm" className="rounded-full px-4 shrink-0" onClick={() => send.mutate(profile)}>
      Add
    </Button>
  );
}
