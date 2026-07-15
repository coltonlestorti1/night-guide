/**
 * Category-slotted Weekend Favorites — approach A from the 2026-07-14 prep doc.
 * Five slots (first stop / dancing / late-night / value / overall), each scored
 * only over data we actually have: Google rating + review count, weekly hours,
 * happy-hour windows, and seeded category/music/price fields. Every pick carries
 * a one-line reason built from that data; a slot with no qualified venue is
 * dropped, never faked. Fully deterministic — no randomness anywhere, all ties
 * break on rating → review count → venue name. Thu/Fri/Sat only differ through
 * real per-day data (hours and happy-hour windows).
 */
import { Venue } from "@/data/types";
import { getEnrichment, getHappyHourPeriodsForDay, formatTime } from "@/data/enrichment";
import type { WeeklyPeriod } from "@/data/enrichment/types";

export type SlotId = "first-stop" | "dancing" | "late-night" | "value" | "overall";

export type SlotPick = { slot: SlotId; label: string; venue: Venue; reason: string };

export type WeekendPicks = { picks: SlotPick[]; favorites: Venue[] };

type Candidate = { venue: Venue; reason: string };

/** A happy hour only counts as a "first stop" deal if it runs into the evening. */
const EVENING_MIN = 17 * 60; // 5 PM
/** "Late-night" means still pouring at 2 AM or later (26h past that day's midnight). */
const LATE_NIGHT_MIN = 26 * 60;
/** Danceable music types — matched against the seeded music_type field. */
const DANCE_MUSIC = /dance|edm|house|hip[\s-]?hop|disco|latin|top\s?40|\bdj\b/i;

const ratingOf = (v: Venue) => getEnrichment(v.title)?.rating ?? 0;
const reviewsOf = (v: Venue) => getEnrichment(v.title)?.userRatingCount ?? 0;

/** Shared deterministic tiebreak: rating, then review count, then name. */
const byQuality = (a: Venue, b: Venue) =>
  ratingOf(b) - ratingOf(a) || reviewsOf(b) - reviewsOf(a) || a.title.localeCompare(b.title);

/** Same convention as before: unknown hours are kept, never punished. */
const openThatNight = (v: Venue, day: number) => {
  const hours = getEnrichment(v.title)?.hours;
  return !hours || hours.some((p) => p.day === day);
};

/** Minutes past that day's midnight when a period ends (a 4 AM close = 28h = 1680). */
const closeAbs = (p: WeeklyPeriod) => (p.closeDayOffset * 24 + p.closeHour) * 60 + p.closeMinute;

/** Latest close among that night's periods, or null when hours are unknown/closed. */
function latestCloseThatNight(hours: WeeklyPeriod[] | undefined, day: number): number | null {
  const periods = (hours ?? []).filter((p) => p.day === day);
  return periods.length ? Math.max(...periods.map(closeAbs)) : null;
}

/** Earliest opening that day, or null when hours are unknown/closed. */
function earliestOpenThatDay(hours: WeeklyPeriod[] | undefined, day: number): number | null {
  const periods = (hours ?? []).filter((p) => p.day === day);
  return periods.length ? Math.min(...periods.map((p) => p.openHour * 60 + p.openMinute)) : null;
}

/** Format minutes-past-midnight (may exceed 24h) as a clock time, e.g. 1680 → "4 AM". */
const formatAbs = (min: number) => formatTime(Math.floor(min / 60) % 24, min % 60);

/**
 * Best first stop — has a happy hour that runs into that evening. Ranked by
 * latest happy-hour end (most runway to start the night on a deal), then
 * earliest opening time that day, then the shared quality tiebreak.
 */
function rankFirstStop(venues: Venue[], day: number): Candidate[] {
  const rows: { venue: Venue; hhEnd: number; opens: number; reason: string }[] = [];
  for (const venue of venues) {
    if (!openThatNight(venue, day)) continue;
    const e = getEnrichment(venue.title);
    const hh = getHappyHourPeriodsForDay(e?.happyHour, day);
    if (hh.length === 0) continue;
    const hhEnd = Math.max(...hh.map(closeAbs));
    if (hhEnd < EVENING_MIN) continue; // deal is over before the evening starts
    rows.push({
      venue,
      hhEnd,
      opens: earliestOpenThatDay(e?.hours, day) ?? Infinity,
      reason: `Happy hour til ${formatAbs(hhEnd)}`,
    });
  }
  return rows.sort((a, b) => b.hhEnd - a.hhEnd || a.opens - b.opens || byQuality(a.venue, b.venue));
}

/**
 * Best for dancing — clubs first, then venues whose seeded music type reads
 * danceable; rating breaks ties. Reasons only state what the data says
 * (category, that night's closing time, the seeded music type).
 */
function rankDancing(venues: Venue[], day: number): Candidate[] {
  const rows: { venue: Venue; isClub: boolean; reason: string }[] = [];
  for (const venue of venues) {
    if (!openThatNight(venue, day)) continue;
    const isClub = venue.category === "club";
    if (!isClub && !DANCE_MUSIC.test(venue.music_type ?? "")) continue;
    const closes = latestCloseThatNight(getEnrichment(venue.title)?.hours, day);
    const reason = isClub
      ? closes != null
        ? `Proper club, goes til ${formatAbs(closes)}`
        : "Proper club"
      : `Plays ${venue.music_type}`;
    rows.push({ venue, isClub, reason });
  }
  return rows.sort((a, b) => Number(b.isClub) - Number(a.isClub) || byQuality(a.venue, b.venue));
}

/** Best late-night — closes latest that night; must still be open at 2 AM. */
function rankLateNight(venues: Venue[], day: number): Candidate[] {
  const rows: { venue: Venue; closes: number }[] = [];
  for (const venue of venues) {
    const closes = latestCloseThatNight(getEnrichment(venue.title)?.hours, day);
    if (closes == null || closes < LATE_NIGHT_MIN) continue;
    rows.push({ venue, closes });
  }
  return rows
    .sort((a, b) => b.closes - a.closes || byQuality(a.venue, b.venue))
    .map(({ venue, closes }) => ({ venue, reason: `Open til ${formatAbs(closes)}` }));
}

/**
 * Best value — cheap ($ or $$) but still well-rated. Score = rating plus a
 * small nudge for the cheaper tier (+0.5 for $, +0.25 for $$), so a $ 3.8 dive
 * doesn't beat a $$ 4.6 just on price.
 */
function rankValue(venues: Venue[], day: number): Candidate[] {
  const rows: { venue: Venue; score: number; reason: string }[] = [];
  for (const venue of venues) {
    if (!openThatNight(venue, day)) continue;
    const price = venue.avg_price_level;
    const rating = ratingOf(venue);
    if (!price || price > 2 || rating === 0) continue;
    rows.push({
      venue,
      score: rating + (3 - price) * 0.25,
      reason: price === 1 ? `Cheap drinks, still ★ ${rating.toFixed(1)}` : `Fair prices, ★ ${rating.toFixed(1)}`,
    });
  }
  return rows.sort((a, b) => b.score - a.score || byQuality(a.venue, b.venue));
}

/** Best overall — the old top-of-list rating sort, demoted to one slot. */
function rankOverall(venues: Venue[], day: number): Candidate[] {
  return venues
    .filter((v) => ratingOf(v) > 0 && openThatNight(v, day))
    .sort(byQuality)
    .map((venue) => {
      const reviews = reviewsOf(venue);
      return {
        venue,
        reason: reviews
          ? `★ ${ratingOf(venue).toFixed(1)} · ${reviews.toLocaleString()} reviews`
          : `★ ${ratingOf(venue).toFixed(1)}`,
      };
    });
}

/** Assignment priority — a venue can win at most one slot, earlier slots claim first. */
const SLOTS: { slot: SlotId; label: string; rank: (venues: Venue[], day: number) => Candidate[] }[] = [
  { slot: "first-stop", label: "Best first stop", rank: rankFirstStop },
  { slot: "dancing", label: "Best for dancing", rank: rankDancing },
  { slot: "late-night", label: "Best late-night", rank: rankLateNight },
  { slot: "value", label: "Best value", rank: rankValue },
  { slot: "overall", label: "Best overall", rank: rankOverall },
];

const FAVORITES_COUNT = 6;

/**
 * Pick the slot winners plus a rating-sorted "Overall favorites" tail for a
 * given weekend night (0 = Sunday … 6 = Saturday).
 */
export function pickWeekendSlots(venues: Venue[], day: number): WeekendPicks {
  const taken = new Set<string>();
  const picks: SlotPick[] = [];
  for (const { slot, label, rank } of SLOTS) {
    const winner = rank(venues, day).find((c) => !taken.has(c.venue.id));
    if (!winner) continue; // thin data → drop the slot, never fake a pick
    taken.add(winner.venue.id);
    picks.push({ slot, label, venue: winner.venue, reason: winner.reason });
  }
  const favorites = venues
    .filter((v) => !taken.has(v.id) && ratingOf(v) > 0 && openThatNight(v, day))
    .sort(byQuality)
    .slice(0, FAVORITES_COUNT);
  return { picks, favorites };
}
