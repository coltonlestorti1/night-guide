/**
 * How a night is named in the feed.
 *
 * Always a night, never a time. night_posts stores a DATE and has no link back
 * to check_ins, so there is no clock reading available here to leak — but the
 * copy is also written to make that obvious to a reader.
 */
import { lastCompletedNightDate } from "@/lib/night/window";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * "Last night" while it is the most recent night, then the weekday for the past
 * week, then a plain date once a weekday name would be ambiguous.
 */
export function nightLabel(nightDate: string, now: Date = new Date()): string {
  const lastNight = lastCompletedNightDate(now);
  if (nightDate === lastNight) return "Last night";

  const [y, m, d] = nightDate.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const days = Math.round((now.getTime() - then.getTime()) / 86_400_000);
  if (days < 7) return WEEKDAYS[then.getDay()];
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
