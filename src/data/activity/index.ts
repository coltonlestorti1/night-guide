/**
 * Typed access to the static activity layer.
 *
 * Keyed by venue TITLE, matching src/data/enrichment. This is not a stylistic
 * choice: live venues come from Supabase where `id` is a uuid, while the demo
 * dataset in src/data/venues.ts uses slugs. Those are different id spaces, so
 * keying on `id` silently misses every venue in production. Title is the only
 * key both sources share, and it is what getEnrichment() already uses.
 *
 * The cost is that renaming a venue in Supabase orphans its activity record.
 * getBaseline() warns in dev when that happens rather than failing silently.
 *
 * Editing this data by hand is expected: it is checked-in editorial content.
 * See docs/superpowers/specs/2026-07-27-activity-heat-system-design.md
 */
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";
import baselineJson from "./baseline.json";
import eventsJson from "./events.json";

const BASELINE = baselineJson as Record<string, VenueBaseline>;

export const ALL_EVENTS = eventsJson as WeeklyEvent[];

const EVENTS_BY_VENUE = ALL_EVENTS.reduce<Record<string, WeeklyEvent[]>>((acc, e) => {
  (acc[e.venue] ||= []).push(e);
  return acc;
}, {});

export const ALL_BASELINE_TITLES = Object.keys(BASELINE);

export function getBaseline(title: string): VenueBaseline | undefined {
  const rec = BASELINE[title];
  if (!rec && import.meta.env?.DEV) {
    console.warn(
      `no activity baseline for "${title}" — its pin will read Quiet. ` +
        `Add it to src/data/activity/baseline.json.`,
    );
  }
  return rec;
}

export function getEvents(title: string): WeeklyEvent[] {
  return EVENTS_BY_VENUE[title] ?? [];
}
