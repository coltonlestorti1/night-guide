/**
 * Birthday maths for onboarding. Kept separate from agePref.ts because that
 * module is the on-device band store; this is the derivation from a real date.
 *
 * MIN_AGE is a COPPA data-protection floor for collecting a birthday and
 * gender, NOT an alcohol gate. ENDZ shows public information about bars and
 * deliberately does not restrict by drinking age (Colton, 2026-08-05).
 */
import type { AgeBand } from "@/lib/agePref";

export const MIN_AGE = 13;

/** Whole years old, or null if the date is unparseable or in the future. */
export function ageFromBirthday(iso: string, now: Date = new Date()): number | null {
  const b = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (b.getTime() > ref.getTime()) return null;
  let age = ref.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/** Fails closed: anything we cannot read counts as under the minimum. */
export function isUnderMinimum(iso: string, now: Date = new Date()): boolean {
  const age = ageFromBirthday(iso, now);
  return age === null || age < MIN_AGE;
}

/**
 * Back-compat with the localStorage band. The bands start at 21, so under-21s
 * have no band — callers should prefer ageFromBirthday() with ageAffinity().
 */
export function bandFromBirthday(iso: string, now: Date = new Date()): AgeBand | null {
  const age = ageFromBirthday(iso, now);
  if (age === null || age < 21) return null;
  if (age <= 23) return "21-23";
  if (age <= 26) return "24-26";
  if (age <= 30) return "27-30";
  return "31+";
}
