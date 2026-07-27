/**
 * The copy state machine: turns a HeatResult into the exact strings the venue
 * card shows. Wording comes verbatim from the spec's copy table.
 *
 * Two rules drive everything here:
 *   1. Uncertainty is expressed by SAYING LESS, never by hedging. There is no
 *      "probably" or "approximately" in this file, and no number ever escapes.
 *   2. Confidence gates specificity. A venue running on an archetype default
 *      may say it is busy; it may not say a line starts at 11:15.
 */
import { mayStateExactTimes } from "@/lib/heat/confidence";
import { HeatResult, LiveSignals, VenueBaseline, Vibe5 } from "@/lib/heat/types";

export type ActivityCopy = {
  status: string;
  lineNote: string | null;
  peakNote: string | null;
  bestNightsNote: string | null;
  signalNote: string | null;
  /**
   * A short "so what" clause that shifts with the moment — what to DO about the
   * current state, rather than a restatement of it. Rendered ahead of the
   * venue's own description, which stays fixed and describes its character.
   */
  momentNote: string | null;
};

/** Below this, only the status renders — no windows, no line claims. */
const SOFT_CLAIM_THRESHOLD = 45;

/** Above this, the score is being driven by real people rather than the curve. */
const LIVE_DOMINANT = 0.4;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Minutes-from-night-midnight to a display time. Wraps past midnight. */
function displayTime(min: number): string {
  const total = ((min % 1440) + 1440) % 1440;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h}${m} ${hour < 12 ? "AM" : "PM"}`;
}

const REPORT_WORD: Partial<Record<Vibe5, string>> = {
  packed: "packed",
  line_outside: "a line outside",
  building: "a good crowd",
};

function signalNote(signals: LiveSignals): string | null {
  let top: Vibe5 | null = null;
  let topCount = 0;
  let total = 0;
  for (const [vibe, count] of Object.entries(signals.vibeTally)) {
    const n = count ?? 0;
    total += n;
    if (n > topCount) {
      top = vibe as Vibe5;
      topCount = n;
    }
  }
  if (!top || total === 0) return null;
  const word = REPORT_WORD[top];
  // "dead" and "chill" get no note: a quiet room needs no announcement, and
  // saying so reads as a warning we have not earned from one or two reports.
  if (!word) return null;
  // Two independent reports required before speaking in the plural.
  return total >= 2 ? `Multiple people reported it ${word}` : "Recently reported busy";
}

/**
 * The advice clause. Deliberately never repeats the status: "Hot Now" already
 * says it is busy, so this says what that means for you.
 */
function momentNote(heat: HeatResult, baseline: VenueBaseline, exact: boolean): string | null {
  if (heat.pastPeak) return "Winding down now.";

  if (heat.label === "Hot Now") {
    if (heat.lineLikely && baseline.line_pattern === "capacity_wait") return "Easier later tonight.";
    if (heat.lineLikely) return "Expect a wait at the door.";
    return "About as busy as it gets.";
  }

  if (heat.label === "Busy") {
    return heat.rising ? "Still filling up." : "Steady right now.";
  }

  if (heat.label === "Building") {
    return heat.rising ? "Good time to arrive before it fills." : "Picking up slowly.";
  }

  // Quiet: the useful thing is when to come instead.
  if (heat.rising && baseline.peak_start != null) {
    return exact
      ? `Worth coming back around ${displayTime(baseline.peak_start)}.`
      : "Worth coming back later tonight.";
  }
  return null;
}

export function activityCopy(
  heat: HeatResult,
  baseline: VenueBaseline,
  signals: LiveSignals,
): ActivityCopy {
  if (heat.label === "Closed") {
    return {
      status: "Closed", lineNote: null, peakNote: null,
      bestNightsNote: null, signalNote: null, momentNote: null,
    };
  }

  const exact = mayStateExactTimes(heat.confidence);
  const mayClaim = heat.confidence >= SOFT_CLAIM_THRESHOLD;

  // ---- status -------------------------------------------------------------
  let status: string;
  if (heat.pastPeak) {
    status = "Still active, but past peak";
  } else if (heat.label === "Hot Now") {
    status = "Hot Now";
  } else if (heat.label === "Busy") {
    status = heat.liveWeight >= LIVE_DOMINANT ? "Likely busy now" : "Usually busy around this time";
  } else if (heat.label === "Building") {
    status =
      mayClaim && baseline.peak_start != null && heat.rising
        ? "Good time to go before it fills up"
        : "Starting to pick up";
  } else {
    status = "Quiet right now";
  }

  // ---- line ---------------------------------------------------------------
  let lineNote: string | null = null;
  if (heat.lineLikely && mayClaim && baseline.line_pattern !== "none") {
    if (baseline.line_pattern === "capacity_wait") {
      // The whole point of this pattern: it eases as the night goes on.
      lineNote = "Better later tonight";
    } else if (exact && (baseline.line_likely_after ?? baseline.peak_start) != null) {
      // Researched line time wins; peak start is only the fallback.
      lineNote = `Line likely after ${displayTime(baseline.line_likely_after ?? baseline.peak_start!)}`;
    } else {
      lineNote = "Line likely";
    }
  }

  // ---- windows ------------------------------------------------------------
  const peakNote =
    exact && baseline.peak_start != null && baseline.peak_end != null
      ? `Usually peaks ${displayTime(baseline.peak_start)} – ${displayTime(baseline.peak_end)}`
      : null;

  const bestNightsNote =
    mayClaim && baseline.best_nights?.length
      ? `Best nights: ${baseline.best_nights.map((d) => DAY_NAMES[d]).join(", ")}`
      : null;

  return {
    status,
    lineNote,
    peakNote,
    bestNightsNote,
    signalNote: signalNote(signals),
    momentNote: mayClaim ? momentNote(heat, baseline, exact) : null,
  };
}
