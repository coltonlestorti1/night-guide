/** "Suggested for you" — newest sign-ups, ✕ dismissals persisted on-device. */
import { useState } from "react";
import { X } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import {
  deriveRelationship,
  dismissSuggestion,
  getDismissedSuggestions,
} from "@/lib/friends";
import { useMyFriendships, useSuggestedProfiles } from "@/hooks/useFriends";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import AddButton from "@/components/social/AddButton";

export default function SuggestedList() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const { data: suggestions } = useSuggestedProfiles();
  const [dismissed, setDismissed] = useState<string[]>(getDismissedSuggestions);

  if (!userId || !rows || !suggestions) return null;

  const visible = suggestions
    .filter((p) => {
      const rel = deriveRelationship(rows, userId, p.id);
      return rel === "none" || rel === "outgoing"; // keep just-added rows showing "Requested"
    })
    .filter((p) => !dismissed.includes(p.id))
    .slice(0, 8);

  if (visible.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Suggested for you
      </h3>
      {visible.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <ProfileAvatar profile={p} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">@{p.username}</p>
            {p.display_name && (
              <p className="text-xs text-muted-foreground truncate">{p.display_name}</p>
            )}
          </div>
          <AddButton profile={p} />
          <button
            aria-label={`Dismiss @${p.username}`}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              dismissSuggestion(p.id);
              setDismissed((d) => [...d, p.id]);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
