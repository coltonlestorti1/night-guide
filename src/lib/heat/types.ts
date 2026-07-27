/**
 * Shared types for the heat engine. No logic lives here.
 * See docs/superpowers/specs/2026-07-27-activity-heat-system-design.md
 */

export type Archetype =
  | "dive"
  | "party_bar"
  | "dance_club"
  | "cocktail_room"
  | "rooftop"
  | "pub"
  | "music_venue"
  | "karaoke"
  | "activity_bar";

export type LinePattern = "door_pick" | "capacity_wait" | "occasion" | "none";

export type ConfidenceBase = "high" | "medium" | "low";

export type SourceType = "first_hand" | "research_estimate" | "archetype_default";

/** Which of the four curve shapes applies to a given night. */
export type DayShape = "midweek" | "thu" | "weekend" | "sun";

/** The five feedback options. `building` is stored; it DISPLAYS as "Good crowd". */
export type Vibe5 = "dead" | "chill" | "building" | "packed" | "line_outside";

export type Recommend = "yes" | "maybe" | "no";

/**
 * Times are minutes from midnight of the venue's *night*, so a 2 AM close is
 * 1560, not 120. This keeps windows that cross midnight monotonic.
 */
export type VenueBaseline = {
  archetype: Archetype;
  line_pattern: LinePattern;
  busy_start?: number;
  busy_end?: number;
  peak_start?: number;
  peak_end?: number;
  /** 0 = Sunday … 6 = Saturday */
  best_nights?: number[];
  capacity?: number;
  confidence_base: ConfidenceBase;
  source_type: SourceType;
  last_reviewed: string;
  evidence_url?: string;
};

export type WeeklyEvent = {
  /** Venue title — the same key the enrichment layer uses. */
  venue: string;
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  name: string;
  /** Minutes from midnight of the venue's night, or null when unposted. */
  start_min: number | null;
  source_url: string;
};

/** Anonymous aggregates from venue_activity(). No identities, no timestamps. */
export type LiveSignals = {
  count15: number;
  count45: number;
  count90: number;
  /** Friends among the checked-in, known only client-side. */
  friendCount: number;
  vibeTally: Partial<Record<Vibe5, number>>;
  recommendTally: Partial<Record<Recommend, number>>;
  minutesSinceLastReport: number | null;
};

export const EMPTY_SIGNALS: LiveSignals = {
  count15: 0,
  count45: 0,
  count90: 0,
  friendCount: 0,
  vibeTally: {},
  recommendTally: {},
  minutesSinceLastReport: null,
};

export type HeatLabel = "Closed" | "Quiet" | "Building" | "Busy" | "Hot Now";

export type HeatResult = {
  /** 0–100. Always exactly 0 when closed. */
  score: number;
  label: HeatLabel;
  /** 0–100. Always 0 when line_pattern is "none". */
  lineRisk: number;
  lineLikely: boolean;
  pastPeak: boolean;
  /** The next hour's baseline is higher than this hour's. */
  rising: boolean;
  /** 0–100. Gates how specific the copy may be. */
  confidence: number;
  /** 0–0.75. How much of the score came from live signals. */
  liveWeight: number;
  baselineScore: number;
};
