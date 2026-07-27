/**
 * Typed access to the static activity layer. Keyed by venue `id` — never by
 * title, because the dataset contains Niagara/Niagara Bar and
 * Downtown Social/13th Step name mismatches.
 *
 * Editing this data by hand is expected: it is checked-in editorial content,
 * not generated output. See docs/superpowers/specs/2026-07-27-activity-heat-system-design.md
 */
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";
import baselineJson from "./baseline.json";
import eventsJson from "./events.json";

const BASELINE = baselineJson as Record<string, VenueBaseline>;

export const ALL_EVENTS = eventsJson as WeeklyEvent[];

const EVENTS_BY_VENUE = ALL_EVENTS.reduce<Record<string, WeeklyEvent[]>>((acc, e) => {
  (acc[e.venue_id] ||= []).push(e);
  return acc;
}, {});

export const ALL_BASELINE_IDS = Object.keys(BASELINE);

export function getBaseline(venueId: string): VenueBaseline | undefined {
  return BASELINE[venueId];
}

export function getEvents(venueId: string): WeeklyEvent[] {
  return EVENTS_BY_VENUE[venueId] ?? [];
}
