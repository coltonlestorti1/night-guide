/**
 * Recent-impression cooldown for Find the Move (§3).
 *
 * The tracker's rule is not "show different things" — it is "stop showing the
 * SAME three when other qualified options exist, but allow repetition when the
 * venue remains clearly superior, and explain why". So this is a decaying
 * penalty with an explicit superiority escape hatch, never a hard exclusion.
 *
 * Per-device on purpose: the durable version is a `venue_impressions` table,
 * and schema changes need Colton to paste DDL by hand. localStorage ships
 * tonight and degrades to a no-op where it is unavailable (Safari private
 * mode), exactly like getDismissedSuggestions().
 */

const KEY = "endz:move-impressions";
/** Full penalty below this age, decaying to zero at COOL_END_H. */
const COOL_START_H = 6;
const COOL_END_H = 24;
const MAX_PENALTY = 1.0;
/** Bounded so a heavy user's log cannot grow without limit. */
const MAX_ENTRIES = 100;

export type ImpressionLog = Record<string, string>;

export function readImpressions(now: Date = new Date()): ImpressionLog {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ImpressionLog = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof id !== "string" || typeof at !== "string") continue;
      const t = Date.parse(at);
      // Drop anything unparseable or already past the decay window — a log
      // that keeps dead entries is just a slow memory leak.
      if (Number.isNaN(t) || hoursSince(t, now) >= COOL_END_H) continue;
      out[id] = at;
    }
    return out;
  } catch {
    return {};
  }
}

export function recordImpressions(venueIds: string[], now: Date = new Date()): void {
  try {
    const log = readImpressions(now);
    for (const id of venueIds) log[id] = now.toISOString();
    const trimmed = Object.entries(log)
      .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    /* no storage, no cooldown — the feature still works, it just repeats */
  }
}

const hoursSince = (t: number, now: Date) => (now.getTime() - t) / 3_600_000;

/**
 * Penalty (a positive number to SUBTRACT) for a venue shown recently.
 * Full strength for the first 6h, then straight-line decay to zero at 24h.
 */
export function cooldownPenalty(
  venueId: string,
  log: ImpressionLog,
  now: Date = new Date(),
): number {
  const at = log[venueId];
  if (!at) return 0;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return 0;
  const age = hoursSince(t, now);
  if (age < 0) return 0; // clock skew — never penalise on a future timestamp
  if (age >= COOL_END_H) return 0;
  if (age <= COOL_START_H) return MAX_PENALTY;
  return MAX_PENALTY * (1 - (age - COOL_START_H) / (COOL_END_H - COOL_START_H));
}

/**
 * How far a venue must beat the next candidate by, after its penalty, to earn
 * a repeat. §3: repetition is allowed when the venue is still clearly better —
 * and when it happens the UI must say so.
 */
export const SUPERIORITY_MARGIN = 2.0;
export const REPEAT_REASON = "Still your best match tonight";

export const COOLDOWN_INTERNALS = { COOL_START_H, COOL_END_H, MAX_PENALTY, MAX_ENTRIES, KEY };
