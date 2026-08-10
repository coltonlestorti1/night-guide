/**
 * "Line reported" — the first live-user signal to reach Find the Move (§3).
 *
 * Colton, 2026-08-10: "use live data to inform where to go... line reported,
 * your friends here, lively now, based off check-ins and reports."
 *
 * ## Where the data comes from
 *
 * `line_outside` has been one of the five check-in vibes all along
 * (`src/lib/checkins.ts`), and `venue_activity()` returns a per-vibe tally.
 * Nothing consumed it: `vibeScore` used the vibe for exactly one thing — a +1
 * when it EQUALLED the user's chosen chill/lively/packed — and `line_outside`
 * can never equal any of those three, so every line report reached the scorer
 * and was dropped.
 *
 * **Proved against production 2026-08-10** (`?select=<col>` on the RPC: real
 * columns 200, a control column 42703) that `venue_activity()` really does
 * return `vibe_line_outside` and the age buckets. The comment in
 * `useCheckIns.ts` claiming these are absent until "the slice-4 DDL" is stale.
 *
 * ## What this may and may not claim
 *
 * The tally counts ACTIVE check-ins, and a check-in stays active for 3 hours.
 * The RPC exposes age buckets for the venue's total headcount but NOT per vibe,
 * so **there is no way to date an individual line report.** Therefore the copy
 * is "Line reported" — attributed, past tense, no time claim — and never "20
 * min wait" or "there's a line right now". `wait_minutes` exists in the types
 * and is populated by nothing; do not reach for it.
 *
 * The upgrade that removes this limitation (age-bucketed vibe tallies) is DDL,
 * and is parked in the tracker rather than applied.
 */
import type { VenueActivityEntry } from "./activity";

/**
 * How many people must report a line before the app repeats it.
 *
 * ONE, deliberately, and this is the dial to turn first if it misbehaves.
 * The reasoning: the string says "Line reported", which is literally true of a
 * single report — it is attributed, not asserted, so it stays honest at n=1 in
 * a way "Long line" would not. With ~12 users a floor of 3 (the
 * TASTE_MIN_RATINGS precedent) would mean this feature never fires at all.
 *
 * The troll case is handled by separating LABEL from SCORE below rather than by
 * raising this: one person can put a label on a venue, but one person cannot
 * push a real business down the rankings.
 */
export const LINE_MIN_REPORTS = 1;

/**
 * Reports required before a line actually moves a venue's rank. Two, so a
 * single malicious or mistaken report cannot demote a real business.
 */
export const LINE_MIN_TO_SCORE = 2;

/** Capped so a busy venue's line cannot dominate everything else. */
export const LINE_MAX_PENALTY = 1.5;

export const LINE_REASON = "Line reported";

export type LineSignal = {
  /** How many active check-ins here reported a line. */
  reports: number;
  /** Enough to say so out loud. */
  reported: boolean;
  /** Enough to move the ranking. */
  corroborated: boolean;
};

const EMPTY: LineSignal = { reports: 0, reported: false, corroborated: false };

export function lineSignal(activity: VenueActivityEntry | undefined): LineSignal {
  if (!activity) return EMPTY;
  // Prefer the tally. Fall back to latest_vibe so the feature still works if a
  // deployment ever serves the older venue_activity() shape — one report, which
  // is exactly what latest_vibe represents.
  const tallied = activity.vibeTally?.line_outside;
  const reports =
    typeof tallied === "number" && tallied > 0
      ? tallied
      : activity.vibe === "line_outside"
        ? 1
        : 0;
  if (reports <= 0) return EMPTY;
  return {
    reports,
    reported: reports >= LINE_MIN_REPORTS,
    corroborated: reports >= LINE_MIN_TO_SCORE,
  };
}

/**
 * How much a line should hurt — which depends entirely on what the user asked
 * for, and is zero unless corroborated.
 *
 * **A stated preference beats an inference** (Colton's rule from the
 * 2026-08-09 build, and it governs here too). Someone who asked for a PACKED
 * room is not disappointed by a line; it is evidence they are in the right
 * place, so it must never be a penalty for them. It only counts against people
 * who said they want it chill, or who are trying to move six people.
 */
export function linePenalty(
  signal: LineSignal,
  prefs: { vibe?: "chill" | "lively" | "packed"; groupSize?: "solo" | "two" | "small" | "big" },
): number {
  if (!signal.corroborated) return 0;
  if (prefs.vibe === "packed") return 0; // they came for this
  let penalty = 0;
  if (prefs.vibe === "chill") penalty += 1;
  // Six people and a door queue is the worst version of this. Only applies
  // where the user did NOT state a vibe — same precedence rule as above.
  if (prefs.groupSize === "big" && !prefs.vibe) penalty += 1;
  if (prefs.groupSize === "big" && prefs.vibe === "chill") penalty += 0.5;
  return Math.min(penalty, LINE_MAX_PENALTY);
}
