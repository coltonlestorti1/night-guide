/**
 * Night boundaries. A "night" runs 18:00 → 06:00 and is dated to the evening
 * it began, so a 01:30 Tuesday check-in belongs to Monday night.
 *
 * Local time by design: a night is a human thing, anchored to where the user
 * physically is, not to UTC. Deriving it in UTC would put anyone on the US east
 * coast into the wrong night for the entire second half of every evening.
 *
 * Pure — no I/O, no clock reads except what the caller passes in.
 */
export const NIGHT_START_HOUR = 18;
export const NIGHT_END_HOUR = 6;

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/**
 * The night-date a moment belongs to, as YYYY-MM-DD.
 * Anything before 06:00 belongs to the previous evening.
 */
export function nightDateOf(d: Date): string {
  if (d.getHours() < NIGHT_END_HOUR) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1); // Date handles month/year/leap rollover
    return iso(prev);
  }
  return iso(d);
}

/**
 * The night-date of the most recently COMPLETED night.
 *
 * A night runs 18:00 → 06:00, so between those hours you are inside a night
 * that has not finished yet, and the last completed one is the night before.
 * Outside them, the night that ended this morning is the answer.
 *
 * The earlier `nightDateOf(now - 12h)` shortcut got the daytime case right and
 * the evening case wrong: at 23:00 Friday it returned Friday, so the recap card
 * said "Last night" about the night the user was currently out in, from 18:00
 * until 06:00 — exactly the hours the app is used.
 */
export function lastCompletedNightDate(now: Date = new Date()): string {
  const hour = now.getHours();
  const insideANight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;

  if (insideANight) {
    // nightDateOf(now) is the night in progress; step back one.
    const [y, m, d] = nightDateOf(now).split("-").map(Number);
    const prev = new Date(y, m - 1, d - 1);
    return iso(prev);
  }
  // Daytime: 12 hours back lands in the night that ended this morning.
  return nightDateOf(new Date(now.getTime() - 12 * 60 * 60 * 1000));
}

/**
 * The half-open window [start, end) covered by a night-date: 18:00 that day
 * through 06:00 the next. `end` is exclusive, so a 06:00 check-in belongs to
 * the following night, matching nightDateOf.
 */
export function nightRange(nightDate: string): { start: Date; end: Date } {
  const [y, m, day] = nightDate.split("-").map(Number);
  const start = new Date(y, m - 1, day, NIGHT_START_HOUR, 0, 0, 0);
  // Day + 1 is safe past a month end: the Date constructor normalises it.
  const end = new Date(y, m - 1, day + 1, NIGHT_END_HOUR, 0, 0, 0);
  return { start, end };
}
