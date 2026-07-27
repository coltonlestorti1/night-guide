# Map Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive the map's pin tiers from the heat engine instead of a raw check-in count, so the 46 venues that currently sit permanently gray come alive.

**Architecture:** A pure adapter turns today's `venue_activity()` shape into `LiveSignals`; a pure `heatTier()` maps a `HeatResult` to a ring; a `useVenueHeat` hook joins live activity, static baseline, friends and a minute tick into a per-venue `HeatResult` map. `Map.tsx` consumes tiers rather than counts. The legend does not change.

**Tech Stack:** TypeScript, React, React Query, Vitest, maplibre-gl.

**Spec:** `docs/superpowers/specs/2026-07-27-activity-heat-system-design.md`
**Depends on:** `docs/superpowers/plans/2026-07-27-heat-engine.md` (slice 1, complete)

## Global Constraints

- **The legend at `Map.tsx:584-585` must not change.** Quiet / Trending / Hot / Selected, exactly as shipped.
- **Line Likely renders as Hot on the map.** No fourth ring colour.
- **No raw score reaches the DOM.** The pin badge keeps showing the *people count*, which is a headcount and not a score.
- **The engine stays pure.** Hooks and adapters live outside `src/lib/heat/` where they need React, except `signals.ts` and `tier.ts` which are pure and belong with the engine.
- **Bucketed counts do not exist yet.** `venue_activity()` returns `{ active_count, latest_vibe }` until slice 4. The adapter must degrade honestly, not pretend to know check-in ages.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`.
- Commit after every task. Stage named paths only, never `git add -A`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/heat/signals.ts` | Adapt the current RPC shape to `LiveSignals`. Pure. |
| `src/lib/heat/tier.ts` | `HeatResult` → map ring tier. Pure. |
| `src/hooks/useVenueHeat.ts` | Join live activity + baseline + friends + tick into `Record<id, HeatResult>` |
| `src/components/Map.tsx` | Consume tiers instead of counts |
| `src/pages/MapPage.tsx` | Provide heat to the map; switch the Hot filter to heat |

---

### Task 1: Signals adapter

**Files:**
- Create: `src/lib/heat/signals.ts`
- Create: `src/lib/heat/signals.test.ts`

**Interfaces:**
- Consumes: `LiveSignals`, `Vibe5` from `@/lib/heat/types`
- Produces: `signalsFromActivity(entry: ActivityEntry | undefined, friendCount: number): LiveSignals`, and `type ActivityEntry = { count: number; vibe: string | null }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/signals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signalsFromActivity } from "./signals";
import { effectiveCheckIns } from "./live";

describe("signalsFromActivity", () => {
  it("returns empty signals for a venue with no activity", () => {
    const s = signalsFromActivity(undefined, 0);
    expect(s.count15).toBe(0);
    expect(s.count45).toBe(0);
    expect(s.count90).toBe(0);
    expect(s.vibeTally).toEqual({});
  });

  it("treats active check-ins as mid-age, never as fresh", () => {
    // The current RPC only knows "active" (within the 3h expiry), so claiming
    // these are 15 minutes old would overstate the evidence.
    const s = signalsFromActivity({ count: 4, vibe: null }, 0);
    expect(s.count15).toBe(0);
    expect(s.count45).toBe(4);
    expect(s.count90).toBe(4);
    expect(effectiveCheckIns(s)).toBeLessThan(4);
    expect(effectiveCheckIns(s)).toBeGreaterThan(0);
  });

  it("carries the friend count through", () => {
    expect(signalsFromActivity({ count: 3, vibe: null }, 2).friendCount).toBe(2);
  });

  it("maps a known vibe into the tally", () => {
    expect(signalsFromActivity({ count: 2, vibe: "packed" }, 0).vibeTally).toEqual({ packed: 1 });
  });

  it("ignores an unknown vibe rather than guessing", () => {
    expect(signalsFromActivity({ count: 2, vibe: "nonsense" }, 0).vibeTally).toEqual({});
  });

  it("accepts the two vibes that only exist after the slice 4 migration", () => {
    expect(signalsFromActivity({ count: 1, vibe: "dead" }, 0).vibeTally).toEqual({ dead: 1 });
    expect(signalsFromActivity({ count: 1, vibe: "line_outside" }, 0).vibeTally)
      .toEqual({ line_outside: 1 });
  });

  it("never reports more friends than check-ins", () => {
    expect(signalsFromActivity({ count: 1, vibe: null }, 5).friendCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- heat/signals`
Expected: FAIL — cannot resolve `./signals`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/signals.ts`:

```ts
/**
 * Adapts the shape venue_activity() returns today into LiveSignals.
 *
 * The current RPC gives one number — how many check-ins are unexpired — and the
 * single latest vibe. It does NOT expose check-in ages, so this adapter
 * deliberately files every check-in as mid-age rather than fresh: claiming a
 * check-in is 15 minutes old when it could be two hours old would overstate
 * the evidence, and freshness is the heaviest-weighted input in the engine.
 *
 * Slice 4 replaces venue_activity() with bucketed counts, at which point this
 * adapter passes the real buckets through and the guesswork disappears.
 */
import { EMPTY_SIGNALS, LiveSignals, Vibe5 } from "@/lib/heat/types";

export type ActivityEntry = { count: number; vibe: string | null };

const KNOWN_VIBES: Vibe5[] = ["dead", "chill", "building", "packed", "line_outside"];

function asVibe(v: string | null): Vibe5 | null {
  return KNOWN_VIBES.includes(v as Vibe5) ? (v as Vibe5) : null;
}

export function signalsFromActivity(
  entry: ActivityEntry | undefined,
  friendCount: number,
): LiveSignals {
  if (!entry || entry.count <= 0) return { ...EMPTY_SIGNALS, vibeTally: {}, recommendTally: {} };

  const vibe = asVibe(entry.vibe);
  return {
    count15: 0,
    count45: entry.count,
    count90: entry.count,
    // A friend cannot be present without being one of the check-ins.
    friendCount: Math.min(friendCount, entry.count),
    vibeTally: vibe ? { [vibe]: 1 } : {},
    recommendTally: {},
    minutesSinceLastReport: vibe ? 0 : null,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- heat/signals`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/signals.ts src/lib/heat/signals.test.ts
git commit -m "feat(heat): adapt current venue_activity shape to LiveSignals"
```

---

### Task 2: Map tier

**Files:**
- Create: `src/lib/heat/tier.ts`
- Create: `src/lib/heat/tier.test.ts`

**Interfaces:**
- Consumes: `HeatResult` from `@/lib/heat/types`
- Produces: `type MapTier = "selected" | "hot" | "trending" | "quiet"`, and `heatTier(heat: HeatResult | undefined, isSelected: boolean): MapTier`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/tier.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { heatTier } from "./tier";
import { HeatResult } from "./types";

const heat = (o: Partial<HeatResult>): HeatResult => ({
  score: 0, label: "Quiet", lineRisk: 0, lineLikely: false,
  pastPeak: false, confidence: 0, liveWeight: 0, baselineScore: 0, ...o,
});

describe("heatTier", () => {
  it("selection always wins", () => {
    expect(heatTier(heat({ label: "Hot Now" }), true)).toBe("selected");
    expect(heatTier(undefined, true)).toBe("selected");
  });

  it("maps the four score labels onto three rings", () => {
    expect(heatTier(heat({ label: "Quiet" }), false)).toBe("quiet");
    expect(heatTier(heat({ label: "Building" }), false)).toBe("trending");
    expect(heatTier(heat({ label: "Busy" }), false)).toBe("trending");
    expect(heatTier(heat({ label: "Hot Now" }), false)).toBe("hot");
  });

  it("renders a closed venue as quiet", () => {
    expect(heatTier(heat({ label: "Closed" }), false)).toBe("quiet");
  });

  it("renders Line Likely as hot, never as its own tier", () => {
    const t = heatTier(heat({ label: "Hot Now", lineLikely: true }), false);
    expect(t).toBe("hot");
  });

  it("falls back to quiet when heat is unknown", () => {
    expect(heatTier(undefined, false)).toBe("quiet");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- heat/tier`
Expected: FAIL — cannot resolve `./tier`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/tier.ts`:

```ts
/**
 * Maps a HeatResult onto the map's three-tier legend. The legend is
 * deliberately simpler than the score labels: the map answers "where is
 * something happening", the venue card explains why.
 *
 * Line Likely has no ring of its own — it renders as Hot, so the shipped
 * legend (Quiet / Trending / Hot / Selected) stays exactly as it is.
 */
import { HeatResult } from "@/lib/heat/types";

export type MapTier = "selected" | "hot" | "trending" | "quiet";

export function heatTier(heat: HeatResult | undefined, isSelected: boolean): MapTier {
  if (isSelected) return "selected";
  if (!heat) return "quiet";
  if (heat.label === "Hot Now") return "hot";
  if (heat.label === "Busy" || heat.label === "Building") return "trending";
  return "quiet";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- heat/tier`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/tier.ts src/lib/heat/tier.test.ts
git commit -m "feat(heat): map tier derivation from heat label"
```

---

### Task 3: useVenueHeat hook

**Files:**
- Create: `src/hooks/useVenueHeat.ts`

**Interfaces:**
- Consumes: `computeHeat` from `@/lib/heat`, `signalsFromActivity` from `@/lib/heat/signals`, `getBaseline`/`getEvents` from `@/data/activity`, `getEnrichment` from `@/data/enrichment`, `useVenueActivity` from `@/hooks/useCheckIns`, `useMinuteTick` from `@/hooks/useMinuteTick`
- Produces: `useVenueHeat(venues: Venue[], friendsByVenue?: Record<string, unknown[]>): Record<string, HeatResult>`

- [ ] **Step 1: Implement the hook**

There is no test step here: this hook is a thin join over pieces that are each already tested, and testing it would require a React renderer the project does not have configured. The logic worth testing lives in `signals.ts`, `tier.ts` and the engine.

Create `src/hooks/useVenueHeat.ts`:

```ts
import { useMemo } from "react";
import { Venue } from "@/data/types";
import { getBaseline, getEvents } from "@/data/activity";
import { getEnrichment } from "@/data/enrichment";
import { computeHeat } from "@/lib/heat";
import { signalsFromActivity } from "@/lib/heat/signals";
import { HeatResult } from "@/lib/heat/types";
import { useVenueActivity } from "@/hooks/useCheckIns";
import { useMinuteTick } from "@/hooks/useMinuteTick";

/**
 * Per-venue heat for the current moment.
 *
 * Recomputes on the minute tick so venues cross Quiet/Building/Hot boundaries
 * without a reload, the same way open-state already flips.
 */
export function useVenueHeat(
  venues: Venue[],
  friendsByVenue?: Record<string, unknown[]>,
): Record<string, HeatResult> {
  const { data: activity } = useVenueActivity();
  const tick = useMinuteTick();

  return useMemo(() => {
    const now = new Date();
    const out: Record<string, HeatResult> = {};
    for (const v of venues) {
      const baseline = getBaseline(v.id);
      if (!baseline) continue; // no activity record — venue stays unstyled
      const friendCount = friendsByVenue?.[v.id]?.length ?? 0;
      out[v.id] = computeHeat({
        baseline,
        events: getEvents(v.id),
        signals: signalsFromActivity(activity?.[v.id], friendCount),
        now,
        hours: getEnrichment(v.title)?.hours,
      });
    }
    return out;
    // `tick` is intentionally a dependency: it is the clock.
  }, [venues, activity, friendsByVenue, tick]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVenueHeat.ts
git commit -m "feat(heat): useVenueHeat hook joining live activity and baseline"
```

---

### Task 4: Wire the map

**Files:**
- Modify: `src/components/Map.tsx` (props, and the tier logic around lines 173-190 and 245)
- Modify: `src/pages/MapPage.tsx` (around lines 310-345 and 440)

**Interfaces:**
- Consumes: `heatTier` from `@/lib/heat/tier`, `useVenueHeat` from `@/hooks/useVenueHeat`
- Produces: nothing new — this is the integration task.

- [ ] **Step 1: Add the heat prop to Map**

In `src/components/Map.tsx`, add to `MapProps`, directly after the `activity` prop:

```ts
  /** venueId -> computed heat; drives pin tiers. Falls back to `activity` when absent. */
  heat?: Record<string, HeatResult>;
```

Add the imports at the top of the file:

```ts
import { HeatResult } from "@/lib/heat/types";
import { heatTier } from "@/lib/heat/tier";
```

And add `heat` to the destructured props in the component signature, after `activity`.

- [ ] **Step 2: Replace the count-based tier logic**

In `addMarkers`, replace this block:

```ts
      const isSelected = v.id === selectedId;
      const count = activity?.[v.id] ?? 0;
      const hh = happyHour?.has(v.id) ?? false;
      // Activity tiers: 0-2 = category ring, 3-5 = trending (orange), 6+ = hot (pink).
      const trending = count >= 3 && count < 6;
      const hot = count >= 6;
      const scale = count >= 3 ? 1.1 : 1;
```

with:

```ts
      const isSelected = v.id === selectedId;
      const count = activity?.[v.id] ?? 0;
      const hh = happyHour?.has(v.id) ?? false;
      // Tiers come from the heat engine: baseline activity plus live check-ins,
      // so a venue reads as busy when it usually is, not only when someone has
      // checked in. See src/lib/heat/tier.ts.
      const tier = heatTier(heat?.[v.id], isSelected);
      const trending = tier === "trending";
      const hot = tier === "hot";
      const scale = tier === "hot" || tier === "trending" ? 1.1 : 1;
```

- [ ] **Step 3: Update the `active` and `ring` derivation**

Immediately below, replace:

```ts
      const active = isSelected || hot || trending;
      const ring = isSelected
        ? SELECTED_RING
        : hot
        ? HOT_RING
        : trending
        ? TRENDING_RING
        : NORMAL_RING;
```

with:

```ts
      const active = tier !== "quiet";
      const ring =
        tier === "selected" ? SELECTED_RING
        : tier === "hot" ? HOT_RING
        : tier === "trending" ? TRENDING_RING
        : NORMAL_RING;
```

- [ ] **Step 4: Add `heat` to the addMarkers dependency array**

Find the `useCallback` dependency array for `addMarkers` (currently ending `..., activity, happyHourKey, friendsKey, plansKey]`) and add `heat`:

```ts
  }, [venues, selectedId, onSelect, clearMarkers, activity, heat, happyHourKey, friendsKey, plansKey]);
```

- [ ] **Step 5: Provide heat from MapPage**

In `src/pages/MapPage.tsx`, add the import:

```ts
import { useVenueHeat } from "@/hooks/useVenueHeat";
```

Directly after the existing `const { data: activityData } = useVenueActivity();` line, add:

```ts
  // Heat drives pin tiers; activityData still drives the headcount badge.
  const venueHeat = useVenueHeat(venues, friendsByVenue);
```

If `friendsByVenue` is declared below that point in the file, move this line to just after `friendsByVenue` is defined instead — it must not be referenced before declaration.

- [ ] **Step 6: Switch the Hot filter to heat**

Replace the `hotIds` memo:

```ts
  const hotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [venueId, a] of Object.entries(activityData ?? {})) {
      if (a.count >= HOT_MIN_ACTIVITY) ids.add(venueId);
    }
    return ids;
  }, [activityData]);
```

with:

```ts
  // Hot now means the heat engine says so, not a bare check-in count — which
  // never fired before there were users.
  const hotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [venueId, h] of Object.entries(venueHeat)) {
      if (h.label === "Hot Now") ids.add(venueId);
    }
    return ids;
  }, [venueHeat]);
```

- [ ] **Step 7: Pass heat to the Map**

Find the `<Map ... />` usage that receives `activity={activityCounts}` and add, on the following line:

```tsx
            heat={venueHeat}
```

- [ ] **Step 8: Remove the now-unused constant if the linter flags it**

Run: `npm run lint`

If `HOT_MIN_ACTIVITY` is reported as unused, delete its declaration in `src/pages/MapPage.tsx`. If it is still used elsewhere in the file, leave it.

- [ ] **Step 9: Verify**

Run: `npm test`
Expected: PASS, all tests.

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 10: Confirm the legend is untouched**

Run: `git diff src/components/Map.tsx | grep -c "Trending\|Hot<\|legend"`
Expected: `0` — the legend markup must not appear in the diff.

- [ ] **Step 11: Commit**

```bash
git add src/components/Map.tsx src/pages/MapPage.tsx
git commit -m "feat(map): drive pin tiers from the heat engine"
```

---

## Definition of done

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit -p tsconfig.app.json` reports no errors
- [ ] `npm run build` succeeds
- [ ] The legend markup in `Map.tsx` is unchanged
- [ ] Pin tiers reflect baseline heat, so venues are styled with zero check-ins present
- [ ] The pin badge still shows a headcount, never a score
- [ ] The Hot filter chip is driven by the heat label

## What comes next

Slice 3: the venue card Activity section, the copy state machine, and removing
the raw `buzz_score` exposures at `BarCard.tsx:100` and `VenueStatTiles.tsx:17`.
Slice 4: the feedback prompt and the additive DDL.
