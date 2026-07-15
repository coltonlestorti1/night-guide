/**
 * On-device age preference — the ask-once age band that tailors weekend picks
 * (and later other surfaces) toward venues whose crowd matches the user's age.
 * Same pattern as the stored check-in visibility: localStorage, no backend.
 * A real birthday field in profiles is a separate, gated onboarding project.
 */
export type AgeBand = "21-23" | "24-26" | "27-30" | "31+";

export const AGE_BANDS: AgeBand[] = ["21-23", "24-26", "27-30", "31+"];

/** Representative age used for range math. */
const MIDPOINT: Record<AgeBand, number> = {
  "21-23": 22,
  "24-26": 25,
  "27-30": 28.5,
  "31+": 33,
};

const AGE_KEY = "endz:age-band";

export function getStoredAgeBand(): AgeBand | null {
  const v = localStorage.getItem(AGE_KEY);
  return (AGE_BANDS as string[]).includes(v ?? "") ? (v as AgeBand) : null;
}

export function storeAgeBand(band: AgeBand): void {
  localStorage.setItem(AGE_KEY, band);
}

export function ageOf(band: AgeBand): number {
  return MIDPOINT[band];
}

/**
 * Scoring nudge for a venue's seeded age range vs the user's age. Within the
 * range (±2 years of slack, "within a few years" per the 2026-07-15 decision)
 * earns a small boost; outside or missing data is neutral — the seeded ranges
 * are editorial guesses, so they may nudge an ordering but never punish a
 * venue or fabricate a reason.
 */
export function ageAffinity(
  userAge: number | null,
  min: number | undefined,
  max: number | undefined
): number {
  if (userAge == null || min == null || max == null) return 0;
  return userAge >= min - 2 && userAge <= max + 2 ? 0.15 : 0;
}
