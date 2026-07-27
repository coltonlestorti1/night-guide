/**
 * Line risk emerges from heat, never from the clock alone. Each line_pattern is
 * a different transfer function, because the evidence shows at least three
 * distinct mechanics and a single time-of-night curve models one of them
 * backwards — see the spec's Background section.
 *
 *   door_pick     volume rooms queue LATE  (The Cock: midnight-3 AM)
 *   capacity_wait small rooms queue EARLY  (Death & Co: 2hr wait from opening)
 *   occasion      queues track an external calendar, not the hour
 *   none          confirmed not to queue   (Amor y Amargo: "always easy")
 */
import { hasLineReport } from "@/lib/heat/live";
import { nightMinutes } from "@/lib/heat/baseline";
import { LiveSignals, VenueBaseline } from "@/lib/heat/types";

const DOOR_PICK_THRESHOLD = 70;
const CAPACITY_WAIT_THRESHOLD = 60;
const REPORTED_LINE_RISK = 90;

const LATE_START = 22 * 60 + 30; // 10:30 PM
const LATE_END = 26 * 60;        // 2:00 AM
const EARLY_START = 18 * 60;     // 6:00 PM
const EARLY_END = 24 * 60;       // midnight

/** Small rooms queue sooner. Unknown capacity is neutral, never a penalty. */
function capacityFactor(capacity?: number): number {
  if (capacity == null) return 1;
  if (capacity <= 75) return 1.25;
  if (capacity <= 150) return 1.1;
  if (capacity >= 500) return 0.7;
  return 1;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function lineRisk(
  baseline: VenueBaseline,
  score: number,
  signals: LiveSignals,
  now: Date,
): number {
  // A venue we know does not queue never queues, whatever anyone reports.
  if (baseline.line_pattern === "none") return 0;

  // Someone standing in the line beats any model we could write.
  if (hasLineReport(signals)) return REPORTED_LINE_RISK;

  const min = nightMinutes(now);
  const cap = capacityFactor(baseline.capacity);

  if (baseline.line_pattern === "door_pick") {
    if (score < DOOR_PICK_THRESHOLD) return 0;
    if (min < LATE_START || min >= LATE_END) return 0;
    return clamp((score - DOOR_PICK_THRESHOLD) * 3 * cap);
  }

  if (baseline.line_pattern === "capacity_wait") {
    if (score < CAPACITY_WAIT_THRESHOLD) return 0;
    if (min < EARLY_START || min >= EARLY_END) return 0;
    // Risk falls as the night goes on: worst at the start of the window.
    // The slope is steeper than door_pick's because in a small capped room,
    // busy IS waiting — a big room absorbs the same crowd without a queue.
    // Calibrated against Death & Co, the best-evidenced case in the dataset:
    // "showed up 15m after they opened, the wait was 2hrs" (2022).
    const progress = (min - EARLY_START) / (EARLY_END - EARLY_START);
    return clamp((score - CAPACITY_WAIT_THRESHOLD) * 4 * cap * (1 - progress));
  }

  // occasion: inert until a sports/holiday calendar exists. See spec, Open questions.
  return 0;
}
