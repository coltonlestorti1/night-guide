import { describe, it, expect } from "vitest";
import type { VenueBaseline } from "@/lib/heat/types";
import type { AdminVenueRow } from "./venues";
import {
  scoreVenue,
  summarize,
  hasValidCoords,
  gradeFor,
  ENRICHMENT_WARN_DAYS,
  ENRICHMENT_MAX_DAYS,
  BASELINE_STALE_DAYS,
} from "./quality";

const NOW = Date.parse("2026-07-28T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function row(over: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "v1",
    name: "The Grafton",
    type: "bar",
    price: "$$",
    description: "Irish pub on 1st Ave",
    music: "mixed",
    age_range: "21-25",
    lat: 40.7276,
    lng: -73.9857,
    neighborhood: "East Village",
    is_college_scene: true,
    has_rooftop: false,
    has_outdoor: true,
    is_active: true,
    ...over,
  };
}

function baseline(over: Partial<VenueBaseline> = {}): VenueBaseline {
  return {
    archetype: "pub",
    line_pattern: "occasion",
    confidence_base: "medium",
    source_type: "research_estimate",
    last_reviewed: daysAgo(1),
    ...over,
  };
}

describe("hasValidCoords", () => {
  it("accepts a real East Village coordinate", () => {
    expect(hasValidCoords({ lat: 40.7276, lng: -73.9857 })).toBe(true);
  });

  it("rejects 0,0 — a populated column but a broken pin", () => {
    expect(hasValidCoords({ lat: 0, lng: 0 })).toBe(false);
  });

  it("rejects NaN and out-of-range values", () => {
    expect(hasValidCoords({ lat: NaN, lng: -73.9 })).toBe(false);
    expect(hasValidCoords({ lat: 91, lng: -73.9 })).toBe(false);
    expect(hasValidCoords({ lat: 40.7, lng: 181 })).toBe(false);
  });
});

describe("scoreVenue — DB completeness", () => {
  it("scores a fully filled row at 100", () => {
    const q = scoreVenue(row(), undefined, undefined, NOW);
    expect(q.dbScore).toBe(100);
    expect(q.missingDbFields).toEqual([]);
  });

  it("counts a null field as missing", () => {
    const q = scoreVenue(row({ music: null }), undefined, undefined, NOW);
    expect(q.missingDbFields).toEqual(["music"]);
    expect(q.dbScore).toBe(83); // 5 of 6 slots
  });

  it("treats a whitespace-only string as missing, not filled", () => {
    const q = scoreVenue(row({ description: "   " }), undefined, undefined, NOW);
    expect(q.missingDbFields).toContain("description");
  });

  it("never reaches 100 when the coordinate is broken", () => {
    const q = scoreVenue(row({ lat: 0, lng: 0 }), undefined, undefined, NOW);
    expect(q.hasValidCoords).toBe(false);
    expect(q.dbScore).toBeLessThan(100);
  });
});

describe("scoreVenue — enrichment freshness", () => {
  it("reports absent enrichment", () => {
    const q = scoreVenue(row(), undefined, undefined, NOW);
    expect(q.enrichment.present).toBe(false);
    expect(q.enrichment.ageDays).toBeNull();
  });

  it("fresh enrichment is neither stale nor expired", () => {
    const q = scoreVenue(row(), { fetchedAt: daysAgo(2) }, undefined, NOW);
    expect(q.enrichment.stale).toBe(false);
    expect(q.enrichment.expired).toBe(false);
    expect(q.enrichment.ageDays).toBe(2);
  });

  it("flags stale at the warn threshold, before Google's 30-day cap", () => {
    const q = scoreVenue(row(), { fetchedAt: daysAgo(ENRICHMENT_WARN_DAYS) }, undefined, NOW);
    expect(q.enrichment.stale).toBe(true);
    expect(q.enrichment.expired).toBe(false);
  });

  it("flags expired past the 30-day cap", () => {
    const q = scoreVenue(row(), { fetchedAt: daysAgo(ENRICHMENT_MAX_DAYS + 1) }, undefined, NOW);
    expect(q.enrichment.expired).toBe(true);
  });

  it("distinguishes a present-but-empty rating from a real one", () => {
    expect(scoreVenue(row(), { fetchedAt: daysAgo(1), rating: null }, undefined, NOW).enrichment.hasRating).toBe(false);
    expect(scoreVenue(row(), { fetchedAt: daysAgo(1), rating: 4.2 }, undefined, NOW).enrichment.hasRating).toBe(true);
  });
});

describe("scoreVenue — baseline quality", () => {
  it("detects a researched busy window", () => {
    const q = scoreVenue(row(), undefined, baseline({ busy_start: 1290, busy_end: 1590 }), NOW);
    expect(q.baseline.hasWindow).toBe(true);
  });

  it("does not count a half-specified window", () => {
    const q = scoreVenue(row(), undefined, baseline({ busy_start: 1290 }), NOW);
    expect(q.baseline.hasWindow).toBe(false);
  });

  it("scores an archetype_default guess far below a researched estimate", () => {
    const guessed = scoreVenue(row(), undefined, baseline({ source_type: "archetype_default" }), NOW);
    const researched = scoreVenue(row(), undefined, baseline({ busy_start: 1, busy_end: 2 }), NOW);
    expect(guessed.score).toBeLessThan(researched.score);
  });

  it("ranks first_hand above research_estimate", () => {
    const firstHand = scoreVenue(row(), undefined, baseline({ source_type: "first_hand" }), NOW);
    const estimate = scoreVenue(row(), undefined, baseline({ source_type: "research_estimate" }), NOW);
    expect(firstHand.score).toBeGreaterThan(estimate.score);
  });

  it("flags a baseline nobody has reviewed in a season", () => {
    const q = scoreVenue(row(), undefined, baseline({ last_reviewed: daysAgo(BASELINE_STALE_DAYS) }), NOW);
    expect(q.baseline.stale).toBe(true);
  });
});

describe("gradeFor", () => {
  it("maps score bands to grades", () => {
    expect(gradeFor(90)).toBe("solid");
    expect(gradeFor(75)).toBe("solid");
    expect(gradeFor(74)).toBe("thin");
    expect(gradeFor(50)).toBe("thin");
    expect(gradeFor(49)).toBe("guessed");
    expect(gradeFor(0)).toBe("guessed");
  });
});

describe("summarize", () => {
  it("counts archetype defaults and researched windows separately", () => {
    const rows = [
      scoreVenue(row({ id: "a" }), { fetchedAt: daysAgo(1) }, baseline({ source_type: "archetype_default" }), NOW),
      scoreVenue(row({ id: "b" }), { fetchedAt: daysAgo(1) }, baseline({ source_type: "archetype_default" }), NOW),
      scoreVenue(row({ id: "c" }), { fetchedAt: daysAgo(1) }, baseline({ busy_start: 1, busy_end: 2 }), NOW),
    ];
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.archetypeDefaults).toBe(2);
    expect(s.researchedWindows).toBe(1);
  });

  it("counts missing sources", () => {
    const rows = [
      scoreVenue(row({ id: "a" }), undefined, undefined, NOW),
      scoreVenue(row({ id: "b" }), { fetchedAt: daysAgo(1) }, baseline(), NOW),
    ];
    const s = summarize(rows);
    expect(s.missingEnrichment).toBe(1);
    expect(s.missingBaseline).toBe(1);
  });

  it("returns zeros for an empty set rather than dividing by zero", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.averageScore).toBe(0);
  });
});
