# Venue Card Activity Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the venue card an Activity section that explains *why* a place is active, and remove the raw score numbers currently leaking to users.

**Architecture:** A pure copy state machine turns a `HeatResult` plus its baseline into display strings, with confidence gating how specific those strings may be. A presentational `ActivitySection` renders them. `BarCard` and `VenueStatTiles` swap the raw `buzz_score` number for the heat label.

**Tech Stack:** TypeScript, React, Vitest, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-27-activity-heat-system-design.md`
**Depends on:** slices 1 and 2 (complete).

## Global Constraints

- **No raw score, confidence value, percentage, or hedging language reaches the DOM.** Uncertainty is expressed by saying less.
- **Low confidence never emits a specific time string.**
- **Every line below the status is optional and omitted entirely when absent** — no "Unknown", no empty labels.
- **Closed short-circuits everything:** status "Closed" and nothing else.
- Copy strings come from the spec's copy table verbatim.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`.
- Commit after every task. Stage named paths only.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/heat/copy.ts` | Copy state machine. Pure. |
| `src/components/ActivitySection.tsx` | Renders the copy. Presentational only. |
| `src/hooks/useVenueHeat.ts` | Gains a single-venue variant |
| `src/components/VenuePreview.tsx` | Hosts the Activity section |
| `src/components/BarCard.tsx` | Drops the raw buzz number |
| `src/components/VenueStatTiles.tsx` | Drops the Buzz tile |

---

### Task 1: Add `rising` to the heat result

The copy machine needs to distinguish "Starting to pick up" from "Still active, but past peak", which requires knowing which way the curve is heading.

**Files:**
- Modify: `src/lib/heat/types.ts`
- Modify: `src/lib/heat/index.ts`
- Modify: `src/lib/heat/tier.test.ts`
- Modify: `src/lib/heat/golden.test.ts`

- [ ] **Step 1: Add the field to `HeatResult`**

In `src/lib/heat/types.ts`, add to `HeatResult` after `pastPeak`:

```ts
  /** Baseline is higher 45 minutes from now than it is right now. */
  rising: boolean;
```

- [ ] **Step 2: Compute it in `computeHeat`**

In `src/lib/heat/index.ts`, add `rising: false` to the `CLOSED` constant, then before the return statement add:

```ts
  const soon = new Date(now.getTime() + 45 * 60_000);
  const rising = baselineScore(baseline, events, soon) > base;
```

and add `rising,` to the returned object.

- [ ] **Step 3: Add a failing test**

Append to `src/lib/heat/golden.test.ts`:

```ts
describe("rising", () => {
  it("is true while the curve is climbing", () => {
    const r = computeHeat({
      baseline: base({ archetype: "party_bar" }), events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 25, 20, 0), hours: OPEN_ALWAYS,
    });
    expect(r.rising).toBe(true);
  });

  it("is false once the curve is falling", () => {
    const r = computeHeat({
      baseline: base({ archetype: "party_bar" }), events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 26, 2, 0), hours: OPEN_ALWAYS,
    });
    expect(r.rising).toBe(false);
  });

  it("is false when closed", () => {
    const r = computeHeat({
      baseline: base({}), events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 25, 10, 0),
      hours: [{ day: 6, openHour: 18, openMinute: 0, closeHour: 2, closeMinute: 0, closeDayOffset: 1 }],
    });
    expect(r.rising).toBe(false);
  });
});
```

- [ ] **Step 4: Fix the tier test helper**

In `src/lib/heat/tier.test.ts`, add `rising: false,` to the `heat()` helper's default object.

- [ ] **Step 5: Verify**

Run: `npm test` — expect PASS.
Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/heat/types.ts src/lib/heat/index.ts src/lib/heat/golden.test.ts src/lib/heat/tier.test.ts
git commit -m "feat(heat): expose whether the curve is rising"
```

---

### Task 2: The copy state machine

**Files:**
- Create: `src/lib/heat/copy.ts`
- Create: `src/lib/heat/copy.test.ts`

**Interfaces:**
- Consumes: `HeatResult`, `VenueBaseline`, `LiveSignals` from `@/lib/heat/types`; `mayStateExactTimes` from `@/lib/heat/confidence`
- Produces: `type ActivityCopy = { status: string; lineNote: string | null; peakNote: string | null; bestNightsNote: string | null; signalNote: string | null }` and `activityCopy(heat, baseline, signals): ActivityCopy`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activityCopy } from "./copy";
import { EMPTY_SIGNALS, HeatResult, LiveSignals, VenueBaseline } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

const base = (o: Partial<VenueBaseline>): VenueBaseline => ({
  archetype: "dive", line_pattern: "none", confidence_base: "low",
  source_type: "archetype_default", last_reviewed: "2026-07-27", ...o,
});

const heat = (o: Partial<HeatResult>): HeatResult => ({
  score: 0, label: "Quiet", lineRisk: 0, lineLikely: false, pastPeak: false,
  rising: false, confidence: 80, liveWeight: 0, baselineScore: 0, ...o,
});

const RESEARCHED = base({
  confidence_base: "high", source_type: "first_hand",
  peak_start: 23 * 60, peak_end: 26 * 60, best_nights: [4, 5, 6],
});

describe("closed", () => {
  it("says Closed and nothing else", () => {
    const c = activityCopy(heat({ label: "Closed" }), RESEARCHED, EMPTY_SIGNALS);
    expect(c.status).toBe("Closed");
    expect(c.peakNote).toBeNull();
    expect(c.bestNightsNote).toBeNull();
    expect(c.lineNote).toBeNull();
    expect(c.signalNote).toBeNull();
  });
});

describe("status wording", () => {
  it("quiet", () => {
    expect(activityCopy(heat({ label: "Quiet" }), RESEARCHED, EMPTY_SIGNALS).status)
      .toBe("Quiet right now");
  });

  it("building and rising", () => {
    expect(activityCopy(heat({ label: "Building", rising: true }), base({}), EMPTY_SIGNALS).status)
      .toBe("Starting to pick up");
  });

  it("building with a known peak still ahead", () => {
    const c = activityCopy(
      heat({ label: "Building", rising: true, score: 40 }),
      RESEARCHED, EMPTY_SIGNALS,
    );
    expect(c.status).toBe("Good time to go before it fills up");
  });

  it("busy on baseline reads as a prediction", () => {
    expect(activityCopy(heat({ label: "Busy", liveWeight: 0 }), base({}), EMPTY_SIGNALS).status)
      .toBe("Usually busy around this time");
  });

  it("busy on live signal reads as an observation", () => {
    const c = activityCopy(
      heat({ label: "Busy", liveWeight: 0.6 }), base({}),
      sig({ count15: 5, count45: 5, count90: 5 }),
    );
    expect(c.status).toBe("Likely busy now");
  });

  it("hot", () => {
    expect(activityCopy(heat({ label: "Hot Now" }), base({}), EMPTY_SIGNALS).status).toBe("Hot Now");
  });

  it("past peak", () => {
    expect(activityCopy(heat({ label: "Busy", pastPeak: true }), RESEARCHED, EMPTY_SIGNALS).status)
      .toBe("Still active, but past peak");
  });
});

describe("line note", () => {
  it("names a time at high confidence", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "door_pick", peak_start: 23 * 60, peak_end: 26 * 60 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Line likely after 11 PM");
  });

  it("stays vague at medium confidence", () => {
    const c = activityCopy(
      heat({ label: "Hot Now", lineLikely: true, confidence: 55 }),
      base({ line_pattern: "door_pick", peak_start: 23 * 60, peak_end: 26 * 60 }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Line likely");
  });

  it("tells a capacity_wait venue to come later", () => {
    const c = activityCopy(
      heat({ label: "Busy", lineLikely: true, confidence: 85 }),
      base({ line_pattern: "capacity_wait" }),
      EMPTY_SIGNALS,
    );
    expect(c.lineNote).toBe("Better later tonight");
  });

  it("is null when no line is likely", () => {
    expect(activityCopy(heat({ label: "Hot Now" }), base({}), EMPTY_SIGNALS).lineNote).toBeNull();
  });
});

describe("confidence gating", () => {
  it("emits exact peak times at high confidence", () => {
    expect(activityCopy(heat({ label: "Busy", confidence: 85 }), RESEARCHED, EMPTY_SIGNALS).peakNote)
      .toBe("Usually peaks 11 PM – 2 AM");
  });

  it("suppresses every specific claim at low confidence", () => {
    const c = activityCopy(heat({ label: "Busy", confidence: 30, lineLikely: true }), RESEARCHED, EMPTY_SIGNALS);
    expect(c.peakNote).toBeNull();
    expect(c.bestNightsNote).toBeNull();
    expect(c.lineNote).toBeNull();
    expect(c.status).toBeTruthy();
  });

  it("never emits a time string when confidence is low", () => {
    const c = activityCopy(heat({ label: "Hot Now", confidence: 20, lineLikely: true }), RESEARCHED, EMPTY_SIGNALS);
    const all = [c.status, c.lineNote, c.peakNote, c.bestNightsNote, c.signalNote].join(" ");
    expect(all).not.toMatch(/\d\s?(AM|PM)/);
  });
});

describe("best nights", () => {
  it("lists them at sufficient confidence", () => {
    expect(activityCopy(heat({ label: "Busy", confidence: 85 }), RESEARCHED, EMPTY_SIGNALS).bestNightsNote)
      .toBe("Best nights: Thu, Fri, Sat");
  });

  it("is null when unknown", () => {
    expect(activityCopy(heat({ label: "Busy", confidence: 85 }), base({}), EMPTY_SIGNALS).bestNightsNote)
      .toBeNull();
  });
});

describe("live signal note", () => {
  it("is null with no reports", () => {
    expect(activityCopy(heat({ label: "Busy" }), base({}), EMPTY_SIGNALS).signalNote).toBeNull();
  });

  it("stays singular for one report", () => {
    const c = activityCopy(heat({ label: "Busy" }), base({}), sig({ vibeTally: { packed: 1 } }));
    expect(c.signalNote).toBe("Recently reported busy");
  });

  it("goes plural only at two or more", () => {
    const c = activityCopy(heat({ label: "Busy" }), base({}), sig({ vibeTally: { packed: 3 } }));
    expect(c.signalNote).toBe("Multiple people reported it packed");
  });

  it("does not claim packed when reports say it is dead", () => {
    const c = activityCopy(heat({ label: "Quiet" }), base({}), sig({ vibeTally: { dead: 3 } }));
    expect(c.signalNote).not.toMatch(/packed/i);
  });
});

describe("never leaks internals", () => {
  it("emits no numbers, percentages or hedging", () => {
    for (const label of ["Quiet", "Building", "Busy", "Hot Now"] as const) {
      for (const confidence of [10, 50, 90]) {
        const c = activityCopy(
          heat({ label, confidence, lineLikely: true, pastPeak: false }),
          RESEARCHED,
          sig({ vibeTally: { packed: 2 } }),
        );
        const all = [c.status, c.lineNote, c.peakNote, c.bestNightsNote, c.signalNote]
          .filter(Boolean).join(" ");
        expect(all).not.toMatch(/%|score|confidence|estimate|approximately|probably/i);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- heat/copy`
Expected: FAIL — cannot resolve `./copy`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/copy.ts`:

```ts
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
    if (n > topCount) { top = vibe as Vibe5; topCount = n; }
  }
  if (!top || total === 0) return null;
  const word = REPORT_WORD[top];
  // "dead" and "chill" get no note: a quiet room needs no announcement, and
  // saying so reads as a warning we have not earned from one or two reports.
  if (!word) return null;
  // Two independent reports required before speaking in the plural.
  return total >= 2 ? `Multiple people reported it ${word}` : "Recently reported busy";
}

export function activityCopy(
  heat: HeatResult,
  baseline: VenueBaseline,
  signals: LiveSignals,
): ActivityCopy {
  if (heat.label === "Closed") {
    return { status: "Closed", lineNote: null, peakNote: null, bestNightsNote: null, signalNote: null };
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
    status = mayClaim && baseline.peak_start != null && heat.rising
      ? "Good time to go before it fills up"
      : "Starting to pick up";
  } else {
    status = "Quiet right now";
  }

  // ---- line ---------------------------------------------------------------
  let lineNote: string | null = null;
  if (heat.lineLikely && mayClaim) {
    if (baseline.line_pattern === "capacity_wait") {
      // The whole point of this pattern: it eases as the night goes on.
      lineNote = "Better later tonight";
    } else if (exact && baseline.peak_start != null) {
      lineNote = `Line likely after ${displayTime(baseline.peak_start)}`;
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

  return { status, lineNote, peakNote, bestNightsNote, signalNote: signalNote(signals) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- heat/copy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/copy.ts src/lib/heat/copy.test.ts
git commit -m "feat(heat): copy state machine with confidence gating"
```

---

### Task 3: Single-venue heat hook

**Files:**
- Modify: `src/hooks/useVenueHeat.ts`

- [ ] **Step 1: Add the variant**

Append to `src/hooks/useVenueHeat.ts`:

```ts
/** Heat for one venue, with the live signals that produced it. */
export function useOneVenueHeat(venue: Venue | undefined): {
  heat: HeatResult | undefined;
  baseline: VenueBaseline | undefined;
  signals: LiveSignals;
} {
  const { data: activity } = useVenueActivity();
  const tick = useMinuteTick();
  const title = venue?.title;
  const id = venue?.id;

  return useMemo(() => {
    if (!title || !id) return { heat: undefined, baseline: undefined, signals: EMPTY_SIGNALS };
    const baseline = getBaseline(title);
    const signals = signalsFromActivity(activity?.[id], 0);
    if (!baseline) return { heat: undefined, baseline: undefined, signals };
    return {
      heat: computeHeat({
        baseline,
        events: getEvents(title),
        signals,
        now: new Date(),
        hours: getEnrichment(title)?.hours,
      }),
      baseline,
      signals,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, id, activity, tick]);
}
```

Extend the imports at the top of the file to include `EMPTY_SIGNALS`, `LiveSignals` and `VenueBaseline` from `@/lib/heat/types`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVenueHeat.ts
git commit -m "feat(heat): single-venue heat hook for the venue card"
```

---

### Task 4: ActivitySection component

**Files:**
- Create: `src/components/ActivitySection.tsx`
- Modify: `src/components/VenuePreview.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ActivitySection.tsx`:

```tsx
/**
 * The Activity block on the venue card: what it is doing now, when it peaks,
 * and whether a line is likely.
 *
 * Purely presentational — every string is decided by src/lib/heat/copy.ts.
 * Lines are omitted entirely when their data is absent: no "Unknown", no empty
 * labels, so a low-confidence venue looks deliberate rather than broken.
 */
import { Flame, Clock, CalendarDays, Users } from "lucide-react";
import { Venue } from "@/data/types";
import { activityCopy } from "@/lib/heat/copy";
import { useOneVenueHeat } from "@/hooks/useVenueHeat";
import { cn } from "@/lib/utils";

export default function ActivitySection({ venue }: { venue: Venue }) {
  const { heat, baseline, signals } = useOneVenueHeat(venue);
  if (!heat || !baseline) return null;

  const copy = activityCopy(heat, baseline, signals);
  const hot = heat.label === "Hot Now";

  return (
    <section className="mt-3 rounded-2xl bg-secondary/60 p-3" aria-label="Activity">
      <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Activity</h3>

      <p className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("text-sm font-semibold", hot && "text-[hsl(var(--hot))]")}>
          {hot && <Flame className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />}
          {copy.status}
        </span>
        {copy.lineNote && (
          <span className="text-xs font-medium text-[hsl(var(--trending))]">· {copy.lineNote}</span>
        )}
      </p>

      {copy.peakNote && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" /> {copy.peakNote}
        </p>
      )}

      {copy.bestNightsNote && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3 shrink-0" /> {copy.bestNightsNote}
        </p>
      )}

      {copy.signalNote && (
        <p className="mt-1 text-xs text-foreground/80 flex items-center gap-1.5">
          <Users className="h-3 w-3 shrink-0" /> {copy.signalNote}
        </p>
      )}

      {venue.description && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{venue.description}</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount it in the venue card**

In `src/components/VenuePreview.tsx`, add the import beside the other component imports:

```ts
import ActivitySection from "@/components/ActivitySection";
```

Then place it directly after `<VenueQuickInfo venue={venue} />` and before `<FriendsHereRow ... />`:

```tsx
      <ActivitySection venue={venue} />
```

Activity goes above the friends and plans rows because it answers "should I go", which is the question the card exists to settle.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.
Run: `npm run build` — expect a clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/ActivitySection.tsx src/components/VenuePreview.tsx
git commit -m "feat(card): Activity section on the venue card"
```

---

### Task 5: Remove the raw score exposures

**Files:**
- Modify: `src/components/BarCard.tsx`
- Modify: `src/components/VenueStatTiles.tsx`

- [ ] **Step 1: Drop the buzz number from BarCard**

In `src/components/BarCard.tsx`, delete:

```tsx
            {typeof venue.buzz_score === "number" && (
              <span className="text-primary font-medium">⚡ {venue.buzz_score}</span>
            )}
```

- [ ] **Step 2: Drop the Buzz tile**

In `src/components/VenueStatTiles.tsx`, delete this line from `tilesFor`:

```tsx
  if (v.buzz_score != null) tiles.push({ label: "Buzz", icon: <Zap className="h-3 w-3" />, value: String(v.buzz_score), accent: true });
```

Then remove `Zap` from the lucide-react import on the same file, and update the file's header comment: the "Buzz/Cover slots resurface automatically once real check-in data starts populating those fields" sentence should read "Cover resurfaces automatically once that field is populated. Buzz moved to the Activity section, which shows a label rather than a number."

- [ ] **Step 3: Confirm no raw score remains anywhere in the UI**

Run:

```bash
grep -rn "buzz_score" src/components src/pages
```

Expected: no matches.

- [ ] **Step 4: Verify**

Run: `npm test` — expect PASS.
Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.
Run: `npm run build` — expect a clean build.

- [ ] **Step 5: Commit**

```bash
git add src/components/BarCard.tsx src/components/VenueStatTiles.tsx
git commit -m "fix(card): stop rendering the raw buzz score"
```

---

## Definition of done

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit -p tsconfig.app.json` reports no errors
- [ ] `npm run build` succeeds
- [ ] `grep -rn "buzz_score" src/components src/pages` returns nothing
- [ ] A low-confidence venue renders a status line and nothing else
- [ ] No time string appears for a low-confidence venue
- [ ] A closed venue renders "Closed" alone

## What comes next

Slice 4: the feedback prompt ("How is it right now?" / "Would you send friends
here right now?") and the additive DDL — two enum values, `vibe_at` set by
trigger, `would_recommend`, and the bucketed `venue_activity()` replacement.
