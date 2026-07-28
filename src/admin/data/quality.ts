/**
 * Venue data-quality scoring.
 *
 * Answers "what do we actually know about this venue, and how much of it is a
 * guess." Three independent sources, deliberately kept separate in the output
 * because the fix for each is different:
 *
 *   DB fields    -> edit in the Venues tab
 *   Enrichment   -> re-run scripts/enrich-venues.mjs refresh
 *   Heat baseline-> research it and hand-edit src/data/activity/baseline.json
 *
 * Pure functions over injected data so the whole thing is testable without a
 * Supabase client or the bundled JSON.
 */
import type { VenueBaseline } from "@/lib/heat/types";
import type { AdminVenueRow } from "./venues";

/** Google's terms cap the cache at 30 days; flag before we get there. */
export const ENRICHMENT_WARN_DAYS = 25;
export const ENRICHMENT_MAX_DAYS = 30;
/** A baseline nobody has looked at in a season is worth re-checking. */
export const BASELINE_STALE_DAYS = 90;

/** The DB columns that count toward completeness. lat/lng are validated
 *  rather than presence-checked: 0,0 is a populated column and a broken pin. */
export const SCORED_DB_FIELDS = [
  "description",
  "music",
  "age_range",
  "price",
  "neighborhood",
] as const;

export type EnrichmentFacts = {
  fetchedAt: string;
  rating?: number | null;
  hours?: unknown;
};

export type VenueQuality = {
  id: string;
  title: string;
  isActive: boolean;
  /** 0-100 across SCORED_DB_FIELDS plus a valid coordinate. */
  dbScore: number;
  missingDbFields: string[];
  hasValidCoords: boolean;
  enrichment: {
    present: boolean;
    ageDays: number | null;
    stale: boolean;
    expired: boolean;
    hasHours: boolean;
    hasRating: boolean;
  };
  baseline: {
    present: boolean;
    sourceType: VenueBaseline["source_type"] | null;
    confidence: VenueBaseline["confidence_base"] | null;
    /** A researched busy window, not just an archetype default curve. */
    hasWindow: boolean;
    reviewedAgeDays: number | null;
    stale: boolean;
  };
  /** 0-100 across all three sources. Sort key for the worklist. */
  score: number;
  grade: QualityGrade;
};

export type QualityGrade = "solid" | "thin" | "guessed";

function daysBetween(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

/** East Village sits near 40.72, -73.98. A 0/0 or NaN coordinate is a bug,
 *  not a blank field, so it is checked rather than counted as "filled". */
export function hasValidCoords(row: Pick<AdminVenueRow, "lat" | "lng">): boolean {
  const { lat, lng } = row;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function scoreVenue(
  row: AdminVenueRow,
  enrichment: EnrichmentFacts | undefined,
  baseline: VenueBaseline | undefined,
  now: number = Date.now(),
): VenueQuality {
  const missingDbFields = SCORED_DB_FIELDS.filter((f) => {
    const v = row[f];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });
  const coordsOk = hasValidCoords(row);

  // +1 slot for coordinates, so a venue with a broken pin can never read 100%.
  const dbSlots = SCORED_DB_FIELDS.length + 1;
  const dbFilled = SCORED_DB_FIELDS.length - missingDbFields.length + (coordsOk ? 1 : 0);
  const dbScore = Math.round((dbFilled / dbSlots) * 100);

  const enrichAge = daysBetween(enrichment?.fetchedAt, now);
  const enrichmentFacts = {
    present: Boolean(enrichment),
    ageDays: enrichAge,
    stale: enrichAge !== null && enrichAge >= ENRICHMENT_WARN_DAYS,
    expired: enrichAge !== null && enrichAge > ENRICHMENT_MAX_DAYS,
    hasHours: Boolean(enrichment?.hours),
    hasRating: enrichment?.rating !== null && enrichment?.rating !== undefined,
  };

  const reviewedAge = daysBetween(baseline?.last_reviewed, now);
  const baselineFacts = {
    present: Boolean(baseline),
    sourceType: baseline?.source_type ?? null,
    confidence: baseline?.confidence_base ?? null,
    hasWindow: baseline?.busy_start !== undefined && baseline?.busy_end !== undefined,
    reviewedAgeDays: reviewedAge,
    stale: reviewedAge !== null && reviewedAge >= BASELINE_STALE_DAYS,
  };

  // Weighting: the DB fields are what the app renders, so they carry the most.
  // Enrichment is a refresh command away. A baseline is the hardest to fix
  // (it needs real research) but affects only the heat curve, not the card.
  const enrichScore = !enrichmentFacts.present
    ? 0
    : enrichmentFacts.expired
      ? 40
      : enrichmentFacts.stale
        ? 70
        : 100;

  const baselineScore = !baselineFacts.present
    ? 0
    : baselineFacts.sourceType === "first_hand"
      ? 100
      : baselineFacts.sourceType === "research_estimate"
        ? baselineFacts.hasWindow
          ? 85
          : 65
        : // archetype_default: a guess derived from the venue type
          25;

  const score = Math.round(dbScore * 0.5 + enrichScore * 0.2 + baselineScore * 0.3);

  return {
    id: row.id,
    title: row.name,
    isActive: row.is_active,
    dbScore,
    missingDbFields: [...missingDbFields],
    hasValidCoords: coordsOk,
    enrichment: enrichmentFacts,
    baseline: baselineFacts,
    score,
    grade: gradeFor(score),
  };
}

export function gradeFor(score: number): QualityGrade {
  if (score >= 75) return "solid";
  if (score >= 50) return "thin";
  return "guessed";
}

export type QualitySummary = {
  total: number;
  solid: number;
  thin: number;
  guessed: number;
  /** The headline number: venues whose heat curve is an archetype guess. */
  archetypeDefaults: number;
  researchedWindows: number;
  missingBaseline: number;
  missingEnrichment: number;
  staleEnrichment: number;
  brokenCoords: number;
  averageScore: number;
};

export function summarize(rows: VenueQuality[]): QualitySummary {
  const n = rows.length;
  const count = (p: (r: VenueQuality) => boolean) => rows.filter(p).length;
  return {
    total: n,
    solid: count((r) => r.grade === "solid"),
    thin: count((r) => r.grade === "thin"),
    guessed: count((r) => r.grade === "guessed"),
    archetypeDefaults: count((r) => r.baseline.sourceType === "archetype_default"),
    researchedWindows: count((r) => r.baseline.hasWindow),
    missingBaseline: count((r) => !r.baseline.present),
    missingEnrichment: count((r) => !r.enrichment.present),
    staleEnrichment: count((r) => r.enrichment.stale),
    brokenCoords: count((r) => !r.hasValidCoords),
    averageScore: n === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.score, 0) / n),
  };
}
