/**
 * Friend signals for Find the Move — approved 2026-08-09 (Colton: "yes it can
 * name your friends").
 *
 * HARD RULE: a friend may only be named from a signal that user could ALREADY
 * see. Both inputs come from existing hooks whose queries are already filtered
 * to accepted friends and already pass through RLS — `useFriendsOutTonight()`
 * (the "checkins visible per rules" policy excludes ghost mode, 'nobody' and
 * non-friends server-side) and `useFriendSaves()` (accepted friends only, on
 * top of the save-visibility policy). Nothing here may widen either query, and
 * a private save must never reach a reason string.
 *
 * This module therefore does NO fetching on purpose. It formats what the
 * caller was already allowed to hold.
 */
import type { FriendOutTonight, FriendProfile } from "@/lib/friends";
import type { VenueSaveFriends } from "@/lib/saves";

export const FRIEND_HERE_BOOST = 1.5;
/** Once, not per friend — three friends saving is not three times the evidence. */
export const FRIEND_SAVED_BOOST = 0.75;

export type FriendSignals = {
  /** Friends checked in right now, from useFriendsOutTonight(). */
  out?: FriendOutTonight[];
  /** Friends who saved each venue, from useFriendSaves(). */
  saves?: VenueSaveFriends;
};

/** First name where we have one, else the handle. Short reads better in a chip. */
function shortName(p: FriendProfile): string {
  const display = p.display_name?.trim();
  if (display) return display.split(/\s+/)[0];
  return p.username;
}

/**
 * "Maya" · "Maya and Dev" · "Maya, Dev and 2 more" — capped at two names so a
 * reason string stays one line on a phone.
 */
export function nameList(profiles: FriendProfile[]): string {
  const names = profiles.map(shortName);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export type FriendVerdict = { delta: number; reason: string | null };

/**
 * What friends say about one venue. "Here now" outranks "saved" as the reason
 * even when both are true: it is the more urgent fact, and only one friend
 * reason may occupy a slot in the three-reason cap.
 */
export function friendVerdict(venueId: string, signals: FriendSignals | undefined): FriendVerdict {
  if (!signals) return { delta: 0, reason: null };

  const here = (signals.out ?? []).filter((f) => f.venueId === venueId);
  const savers = signals.saves?.[venueId] ?? [];

  let delta = 0;
  if (here.length) delta += FRIEND_HERE_BOOST;
  if (savers.length) delta += FRIEND_SAVED_BOOST;

  if (here.length) {
    const who = nameList(here.map((f) => f.profile));
    return { delta, reason: `${who} ${here.length === 1 ? "is" : "are"} here now` };
  }
  if (savers.length) {
    return { delta, reason: `${nameList(savers)} saved this` };
  }
  return { delta: 0, reason: null };
}

/** Does any friend signal touch this venue? Drives the `friends` character. */
export function hasFriendSignal(venueId: string, signals: FriendSignals | undefined): boolean {
  if (!signals) return false;
  return (
    (signals.out ?? []).some((f) => f.venueId === venueId) ||
    (signals.saves?.[venueId]?.length ?? 0) > 0
  );
}
