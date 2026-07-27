/**
 * Live signal processing: decay check-ins by age, turn feedback into a crowd
 * reading. All inputs are anonymous aggregates from venue_activity() — no
 * identities and no per-row timestamps ever reach the client.
 */
import { LiveSignals, Vibe5 } from "@/lib/heat/types";

/** ~35 minute half-life, gone by 90. Buckets are cumulative. */
const W15 = 1.0;
const W45 = 0.45;
const W90 = 0.12;

/** A friend being somewhere is a much stronger signal than a stranger. */
const FRIEND_MULTIPLIER = 3;

/** Effective check-ins at which the live crowd reading saturates. */
const SATURATION = 6;

const VIBE_CROWD: Record<Vibe5, number> = {
  dead: 5,
  chill: 30,
  building: 60,
  packed: 85,
  line_outside: 95,
};

export function effectiveCheckIns(s: LiveSignals): number {
  const fresh = s.count15;
  const mid = Math.max(0, s.count45 - s.count15);
  const old = Math.max(0, s.count90 - s.count45);
  const base = fresh * W15 + mid * W45 + old * W90;
  // Friends are already counted once in the buckets; add only the extra weight.
  return base + s.friendCount * (FRIEND_MULTIPLIER - 1) * W15;
}

export function crowdFromCheckIns(effective: number): number {
  if (effective <= 0) return 0;
  return Math.min(100, Math.round(100 * (effective / (effective + SATURATION / 3))));
}

export function crowdFromFeedback(s: LiveSignals): number | null {
  let total = 0;
  let weight = 0;
  for (const [vibe, count] of Object.entries(s.vibeTally)) {
    const n = count ?? 0;
    if (n <= 0) continue;
    total += VIBE_CROWD[vibe as Vibe5] * n;
    weight += n;
  }
  if (weight === 0) return null;
  return Math.round(total / weight);
}

/**
 * People saying what a room is like beats counting who walked in, so feedback
 * dominates when it exists. Check-ins fill in when nobody has reported.
 */
export function liveCrowd(s: LiveSignals): number | null {
  const feedback = crowdFromFeedback(s);
  const checkins = crowdFromCheckIns(effectiveCheckIns(s));
  if (feedback == null) return checkins > 0 ? checkins : null;
  return Math.round(feedback * 0.7 + checkins * 0.3);
}

export function hasLineReport(s: LiveSignals): boolean {
  return (s.vibeTally.line_outside ?? 0) > 0;
}
