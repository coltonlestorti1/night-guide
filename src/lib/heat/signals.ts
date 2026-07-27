/**
 * Adapts the shape venue_activity() returns today into LiveSignals.
 *
 * The current RPC gives one number — how many check-ins are unexpired — and the
 * single latest vibe. It does NOT expose check-in ages, so this adapter
 * deliberately files every check-in as mid-age rather than fresh: claiming a
 * check-in is 15 minutes old when it could be two hours old would overstate
 * the evidence, and freshness is the heaviest-weighted input in the engine.
 *
 * Slice 4 replaces venue_activity() with bucketed counts, at which point this
 * adapter passes the real buckets through and the guesswork disappears.
 */
import { EMPTY_SIGNALS, LiveSignals, Vibe5 } from "@/lib/heat/types";

export type ActivityEntry = { count: number; vibe: string | null };

const KNOWN_VIBES: Vibe5[] = ["dead", "chill", "building", "packed", "line_outside"];

function asVibe(v: string | null): Vibe5 | null {
  return KNOWN_VIBES.includes(v as Vibe5) ? (v as Vibe5) : null;
}

export function signalsFromActivity(
  entry: ActivityEntry | undefined,
  friendCount: number,
): LiveSignals {
  if (!entry || entry.count <= 0) return { ...EMPTY_SIGNALS, vibeTally: {}, recommendTally: {} };

  const vibe = asVibe(entry.vibe);
  return {
    count15: 0,
    count45: entry.count,
    count90: entry.count,
    // A friend cannot be present without being one of the check-ins.
    friendCount: Math.min(friendCount, entry.count),
    vibeTally: vibe ? { [vibe]: 1 } : {},
    recommendTally: {},
    minutesSinceLastReport: vibe ? 0 : null,
  };
}
