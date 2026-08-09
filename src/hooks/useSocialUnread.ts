/**
 * Drives the unread badge on the Social tab.
 *
 * Runs app-wide, because the whole point is seeing "3 new" while you are on the
 * map. A badge you only see once you are already on Social tells you nothing.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveIncoming } from "@/lib/friends";
import { badgeCount, countNewPosts, getLastSeen, markSocialSeen } from "@/lib/social/unread";

/** The number on the tab. 0 means render nothing. */
export function useSocialUnread(): number {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();

  const { data: newPosts } = useQuery<number>({
    queryKey: ["social-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const seen = await getLastSeen(userId!);
      return countNewPosts(userId!, seen);
    },
    // A badge that is a minute stale is fine; polling harder would cost a
    // request per user per interval for a number nobody is watching change.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const friendRequests = rows && userId ? deriveIncoming(rows, userId).length : 0;

  return badgeCount({
    newPosts: newPosts ?? 0,
    friendRequests,
    // Plan alerts are counted on the Social page itself, where the plan data
    // is already loaded. Pulling plans app-wide just to badge them would add a
    // query to every screen for a number that is usually zero.
    planAlerts: 0,
  });
}

/**
 * Stamps the watermark when Social is opened, then refreshes the badge so it
 * clears without a reload.
 *
 * Called from the Social page rather than from a route listener: mounting the
 * page IS the definition of "seen" that Colton chose.
 */
export function useMarkSocialSeen(): string | null {
  const userId = useAuthStore((s) => s.session?.user.id);
  const qc = useQueryClient();
  // The watermark AS IT WAS when this page mounted. Held for the life of the
  // mount, because the stamp below immediately overwrites it — without this,
  // opening Activity would find lastSeen === now and nothing would ever be
  // marked new.
  const [previous, setPrevious] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!userId || done.current) return;
    done.current = true;
    (async () => {
      try {
        setPrevious(await getLastSeen(userId));
      } catch {
        // Fall through to stamping anyway — a missing watermark costs a
        // highlight, not correctness.
      }
      try {
        await markSocialSeen(userId);
        qc.invalidateQueries({ queryKey: ["social-unread", userId] });
      } catch {
        // Silent on purpose: failing to stamp leaves a badge up, which is a
        // far better outcome than an error toast nobody asked for.
      }
    })();
  }, [userId, qc]);

  return previous;
}
