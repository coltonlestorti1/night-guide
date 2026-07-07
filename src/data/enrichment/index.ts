/**
 * Bundled Google-enrichment data (see scripts/enrich-venues.mjs and the
 * 2026-07-06 enrichment spec). Synchronous by design — no network at runtime.
 * Open/closed is computed here from weekly periods; Google's stale openNow
 * boolean is never stored or shown.
 */
import type { Special } from "@/data/types";
import type { VenueEnrichment, WeeklyPeriod } from "./types";
import enrichmentJson from "./enrichment.json";
import specialsJson from "./specials.json";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // Google ToS caching limit
const WEEK_MIN = 7 * 24 * 60;

const enrichment = enrichmentJson as Record<string, VenueEnrichment>;
const specials = specialsJson as Record<string, Special[]>;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isExpired(e: VenueEnrichment): boolean {
  return Date.now() - Date.parse(e.fetchedAt) > MAX_AGE_MS;
}

export function getEnrichment(title: string): VenueEnrichment | undefined {
  const e = enrichment[title];
  if (!e) return undefined;
  if (isExpired(e)) {
    if (import.meta.env.DEV) console.warn(`enrichment for "${title}" is >30d old — rerun scripts/enrich-venues.mjs refresh`);
    return undefined;
  }
  return e;
}

export function getSpecials(title: string): Special[] {
  return specials[title] ?? [];
}

export function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h}${m} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatPeriodRange(p: WeeklyPeriod): string {
  const open = formatTime(p.openHour, p.openMinute);
  const close = formatTime(p.closeHour, p.closeMinute);
  const [oT, oM] = open.split(" ");
  const [cT, cM] = close.split(" ");
  return oM === cM ? `${oT}–${cT} ${cM}` : `${open}–${close}`;
}

/** Group identical time ranges over runs of days: [Mon..Fri 4–7 PM] -> "Mon–Fri 4–7 PM". */
export function describeWeeklyPeriods(ps: WeeklyPeriod[]): string[] {
  const ordered = [...ps].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)); // Monday-first
  const groups: { days: number[]; range: string }[] = [];
  for (const p of ordered) {
    const range = formatPeriodRange(p);
    const last = groups[groups.length - 1];
    const lastDay = last?.days[last.days.length - 1];
    if (last && last.range === range && lastDay !== undefined && (lastDay + 1) % 7 === p.day) last.days.push(p.day);
    else groups.push({ days: [p.day], range });
  }
  return groups.map((g) =>
    g.days.length === 1
      ? `${DAY_SHORT[g.days[0]]} ${g.range}`
      : `${DAY_SHORT[g.days[0]]}–${DAY_SHORT[g.days[g.days.length - 1]]} ${g.range}`,
  );
}

/** True when `now` falls inside any weekly period (same math as computeOpenState). */
export function isWithinPeriods(periods: WeeklyPeriod[] | undefined, now: Date = new Date()): boolean {
  if (!periods || periods.length === 0) return false;
  const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  return periods.some((p) => {
    const start = p.day * 1440 + p.openHour * 60 + p.openMinute;
    const end = (p.day + p.closeDayOffset) * 1440 + p.closeHour * 60 + p.closeMinute;
    return (start <= nowMin && nowMin < end) || (end > WEEK_MIN && nowMin < end - WEEK_MIN);
  });
}

export type OpenState = { open: boolean; closesAt?: string; opensAt?: string };

export function computeOpenState(hours: WeeklyPeriod[] | undefined, now: Date = new Date()): OpenState | null {
  if (!hours || hours.length === 0) return null;
  const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  let nextOpen: { at: number; p: WeeklyPeriod } | null = null;
  for (const p of hours) {
    const start = p.day * 1440 + p.openHour * 60 + p.openMinute;
    const end = (p.day + p.closeDayOffset) * 1440 + p.closeHour * 60 + p.closeMinute;
    const inWindow = (start <= nowMin && nowMin < end) || (end > WEEK_MIN && nowMin < end - WEEK_MIN);
    if (inWindow) return { open: true, closesAt: formatTime(p.closeHour, p.closeMinute) };
    const wait = (start - nowMin + WEEK_MIN) % WEEK_MIN;
    if (!nextOpen || wait < (nextOpen.at - nowMin + WEEK_MIN) % WEEK_MIN) nextOpen = { at: start, p };
  }
  if (!nextOpen) return null;
  const sameDay = nextOpen.p.day === now.getDay();
  const t = formatTime(nextOpen.p.openHour, nextOpen.p.openMinute);
  return { open: false, opensAt: sameDay ? t : `${DAY_SHORT[nextOpen.p.day]} ${t}` };
}
