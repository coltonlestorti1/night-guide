/**
 * Pure decisions behind logging a night.
 *
 * These live here rather than in the sheet because they are the parts worth
 * testing: this repo has no component-test toolchain (vitest runs in `node`
 * with no jsdom), so anything that encodes a rule belongs in lib/ where it can
 * actually be asserted on.
 */
import type { Bucket } from "@/lib/night/ranking";
import {
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  lastCompletedNightDate,
  nightDateOf,
} from "@/lib/night/window";

/** Local-time YYYY-MM-DD. Never toISOString() — that shifts the day for
 *  anyone west of UTC, which is everyone using this app. */
const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/**
 * Quick night choices, newest first. Value is a night-date.
 *
 * Moved out of AddNightSheet unchanged. "Tonight" is only offered while a night
 * is actually in progress — offering it at 11am would invite logging a night
 * that has not happened yet.
 */
export function nightChoices(now: Date = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];

  const hour = now.getHours();
  if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) {
    out.push({ value: nightDateOf(now), label: "Tonight" });
  }

  const last = lastCompletedNightDate(now);
  out.push({ value: last, label: "Last night" });

  const [y, m, d] = last.split("-").map(Number);
  for (let back = 1; back <= 3; back++) {
    const prev = new Date(y, m - 1, d - back);
    out.push({
      value: isoDate(prev),
      label: prev.toLocaleDateString(undefined, { weekday: "long" }),
    });
  }
  return out;
}

/** Friendly copy for the circles. The STORED bucket names are unchanged —
 *  BUCKET_LABELS still drives lists, badges and every existing test. */
export const PICKER_LABELS: Record<Bucket, string> = {
  great: "Loved it",
  good: "It was ok",
  not_great: "Not for me",
};

/**
 * What Post should do about the rating.
 *
 * "skip" — publish and stop. Either nothing was selected, or the selection
 * matches what the venue is already rated: a second night at a place you
 * already ranked must not make you re-answer the head-to-heads.
 * "rank" — run the comparisons. A first rating, or a deliberate change of
 * bucket (useSaveRating reindexes the old bucket in that case).
 */
export function ratingAction(
  selected: Bucket | null,
  existing: Bucket | undefined,
): "skip" | "rank" {
  if (!selected) return "skip";
  return selected === existing ? "skip" : "rank";
}

/** The label for a night-date, if it is one of the quick choices. */
export function nightLabelFor(value: string, now: Date = new Date()): string | null {
  return nightChoices(now).find((c) => c.value === value)?.label ?? null;
}
