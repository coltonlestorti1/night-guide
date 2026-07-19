/**
 * "Sam and 2 friends are here" on the venue sheet. Renders only when ≥1
 * friend is visibly checked in — visibility is whatever RLS returned, the
 * row never filters anyone in. Tap expands the names inline.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFriendsOutTonight } from "@/hooks/useFriends";
import AvatarCluster from "@/components/ui/avatar-cluster";

function firstName(p: { display_name: string | null; username: string }): string {
  return p.display_name?.split(" ")[0] || `@${p.username}`;
}

export default function FriendsHereRow({ venueId }: { venueId: string }) {
  const { data: out } = useFriendsOutTonight();
  const [expanded, setExpanded] = useState(false);

  const here = useMemo(() => (out ?? []).filter((f) => f.venueId === venueId), [out, venueId]);
  if (here.length === 0) return null;

  const label =
    here.length === 1
      ? `${firstName(here[0].profile)} is here`
      : here.length === 2
      ? `${firstName(here[0].profile)} and ${firstName(here[1].profile)} are here`
      : `${firstName(here[0].profile)} and ${here.length - 1} friends are here`;

  return (
    <div className="w-full mt-3 rounded-2xl border border-border bg-card animate-fade-in">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
      >
        <AvatarCluster
          people={here.map((f) => ({
            id: f.profile.id,
            name: f.profile.display_name || f.profile.username,
            avatarUrl: f.profile.avatar_url,
          }))}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{label}</span>
        </span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
          {here.map((f) => (
            <Link
              key={f.profile.id}
              to={`/u/${f.profile.username}`}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary/70"
            >
              {f.profile.display_name || `@${f.profile.username}`}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
