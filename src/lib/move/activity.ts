/**
 * The live activity shape Find the Move reads — the ONE definition.
 *
 * `vibeScore.ts`, `VibeFinder.tsx` and `move/character.ts` each declared their
 * own `Record<string, {count, vibe?}>`, and every one of them silently dropped
 * `vibeTally`. `useVenueActivity()` has been returning that tally the whole
 * time, so the narrowing — not the data — is why no line report ever reached
 * the UI. Widening one type here fixes all three at once and stops them
 * drifting apart again.
 *
 * Deliberately structural rather than importing `VenueActivity` from the hook:
 * these are pure scoring modules and must stay testable without pulling in
 * React Query. Fields stay optional so a caller holding only counts still type
 * checks.
 */
import type { Vibe } from "@/lib/checkins";

export type VenueActivityEntry = {
  count: number;
  /** Most recent check-in's vibe. */
  vibe?: Vibe | string | null;
  /** Per-vibe counts across ACTIVE check-ins. Includes `line_outside`. */
  vibeTally?: Partial<Record<string, number>>;
};

export type ActivityMap = Record<string, VenueActivityEntry> | undefined;
