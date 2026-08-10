/**
 * The identity card at the top of /profile and /u/:username.
 *
 * Stats are PASSED IN, never fetched here. The own-profile page passes
 * Friends / Been / Want to try; the public page passes none. If this component
 * fetched them itself it would render the VIEWER's counts on someone else's
 * page — venue_ratings and venue_saves are owner-scoped, so the only numbers it
 * could ever read are the viewer's own, and they would silently be attributed
 * to whoever's profile was open.
 */
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMemberSince } from "@/lib/format";

export type ProfileStat = { label: string; value: number; to: string };

export default function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  createdAt,
  collegeLine,
  bio,
  stats = [],
  action,
}: {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  collegeLine?: string | null;
  /** Only the public profile has one; /profile edits it in the dialog. */
  bio?: string | null;
  stats?: ProfileStat[];
  /** Edit Profile on your own page, the relationship button on someone else's. */
  action?: ReactNode;
}) {
  const memberSince = formatMemberSince(createdAt);

  return (
    <div className="relative glass rounded-3xl overflow-hidden animate-slide-up">
      {/* Cover band — the ENDZ wordmark gradient */}
      <div className="relative h-20 bg-gradient-to-r from-primary to-rose-400">
        <span
          className="absolute right-4 top-3 font-display font-bold tracking-tight text-white/30 select-none"
          aria-hidden="true"
        >
          ENDZ
        </span>
      </div>
      <div className="p-6 pt-0">
        <div className="flex items-end justify-between gap-3">
          <Avatar className="h-20 w-20 -mt-10 ring-4 ring-card shadow-float">
            <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="text-xl font-semibold bg-primary-soft text-primary">
              {(displayName || "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {action}
        </div>

        <div className="min-w-0 mt-3">
          <div className="font-display text-xl font-bold truncate">{displayName || "You"}</div>
          {username && <div className="text-sm text-muted-foreground truncate">@{username}</div>}
          {memberSince && (
            <div className="text-sm text-muted-foreground">Member since {memberSince}</div>
          )}
          {collegeLine && (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{collegeLine}</span>
            </div>
          )}
          {bio && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/80 break-words">{bio}</p>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/60 pt-4">
            {stats.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="rounded-xl py-1 text-center transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="font-display text-lg font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
