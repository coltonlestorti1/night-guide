# Heat Engine & Baseline Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested heat scoring engine and its baseline data layer for the 56 live East Village venues — no UI changes.

**Architecture:** A set of pure functions in `src/lib/heat/` that take venue baseline data, live signals, and an injected `now`, and return a heat score, label, line risk and confidence. Baseline data ships as static files in `src/data/activity/` keyed by venue `id`. No React, no network, no clock reads inside the engine — every function is deterministic given its arguments.

**Tech Stack:** TypeScript, Vitest (added by Task 1), existing `@/` path alias to `src/`.

**Spec:** `docs/superpowers/specs/2026-07-27-activity-heat-system-design.md`

## Scope

This plan covers **slice 1 of 4** from the spec: the engine and its data. Slices 2 (map wiring), 3 (venue card Activity section), and 4 (feedback prompt + DDL) get their own plans, written after this one passes its golden cases — their interfaces depend on the concrete shape of `computeHeat()`, so writing them now would mean guessing at signatures this plan is still free to change.

## Global Constraints

- **Engine purity:** no React imports, no network calls, no `new Date()` inside `src/lib/heat/`. Time is always an argument.
- **Data keys on venue `id`, never `title`.** The dataset contains `Niagara`/`Niagara Bar` and `Downtown Social`/`13th Step` mismatches.
- **Score is always 0–100 inclusive.** Closed venues always score exactly 0.
- **`line_pattern: "none"` produces line risk 0 at any heat.** No exceptions.
- **Low confidence never emits a specific time string.**
- **Typecheck with `npx tsc --noEmit -p tsconfig.app.json`** — bare `npx tsc` is a silent no-op in this repo.
- **Decay buckets are 15 / 45 / 90 minutes.** A check-in stops counting at 90 minutes.
- **Blend:** `liveWeight = min(0.75, signals / (signals + 4))`.
- **Score bands:** 0–29 Quiet, 30–54 Building, 55–74 Busy, 75–100 Hot Now. "Line Likely" is an overlay, not a band.
- Commit after every task. Never use `git add -A` or `git add .` — stage named paths only.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/heat/types.ts` | All shared types. No logic. |
| `src/lib/heat/curves.ts` | Archetype base curves + day-shape factors + curve lookup |
| `src/lib/heat/baseline.ts` | Baseline score: curve, researched overrides, event bumps, closed check |
| `src/lib/heat/live.ts` | Check-in decay and feedback aggregation |
| `src/lib/heat/blend.ts` | `liveWeight` and final score composition |
| `src/lib/heat/line.ts` | Line risk model, per `line_pattern` |
| `src/lib/heat/labels.ts` | Score → label, and the copy state machine |
| `src/lib/heat/confidence.ts` | `confidence_score` from base + live volume |
| `src/lib/heat/index.ts` | `computeHeat()` orchestrator — the only public entry point |
| `src/data/activity/baseline.json` | Per-venue baseline records for all 56 venues |
| `src/data/activity/events.json` | Researched weekly events |
| `src/data/activity/index.ts` | Typed accessors over the two JSON files |

Tests are colocated: `src/lib/heat/<name>.test.ts`.

---

### Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/heat/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` command; all later tasks depend on it.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^2.1.8 --cache ./.npm-cache
rm -rf .npm-cache
```

The `--cache` flag is required: the shared npm cache at `~/.npm` is not writable in this environment and a plain `npm install` fails with EACCES.

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure the test environment**

In `vite.config.ts`, add a `test` key to the config object returned by `defineConfig`, as a sibling of `resolve`:

```ts
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
```

`environment: "node"` is correct — the heat engine is pure and touches no DOM. Later plans that test components will change this.

- [ ] **Step 4: Write a smoke test**

Create `src/lib/heat/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/heat/smoke.test.ts
git commit -m "test: add vitest harness"
```

---

### Task 2: Types

**Files:**
- Create: `src/lib/heat/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: every type used by later tasks. Exact names below — later tasks import from `@/lib/heat/types`.

- [ ] **Step 1: Write the types**

Create `src/lib/heat/types.ts`:

```ts
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
  venue_id: string;
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
  /** 0–100. Gates how specific the copy may be. */
  confidence: number;
  /** 0–0.75. How much of the score came from live signals. */
  liveWeight: number;
  baselineScore: number;
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/heat/types.ts
git commit -m "feat(heat): shared engine types"
```

---

### Task 3: Archetype curves

**Files:**
- Create: `src/lib/heat/curves.ts`
- Create: `src/lib/heat/curves.test.ts`

**Interfaces:**
- Consumes: `Archetype`, `DayShape` from `@/lib/heat/types`
- Produces:
  - `nightlifeDay(now: Date): number` — the day whose *night* we are in
  - `dayShape(day: number): DayShape`
  - `curveValue(archetype: Archetype, hour: number): number` — 0–100 base shape
  - `DAY_SHAPE_FACTOR: Record<DayShape, number>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/curves.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nightlifeDay, dayShape, curveValue, DAY_SHAPE_FACTOR } from "./curves";

describe("nightlifeDay", () => {
  it("returns the calendar day during the evening", () => {
    // Saturday 2026-07-25 at 11 PM
    expect(nightlifeDay(new Date(2026, 6, 25, 23, 0))).toBe(6);
  });

  it("returns the PREVIOUS day in the small hours", () => {
    // Sunday 2026-07-26 at 1 AM is still Saturday night
    expect(nightlifeDay(new Date(2026, 6, 26, 1, 0))).toBe(6);
  });

  it("rolls Sunday 3 AM back to Saturday", () => {
    expect(nightlifeDay(new Date(2026, 6, 26, 3, 0))).toBe(6);
  });

  it("treats 5 AM as the new day", () => {
    expect(nightlifeDay(new Date(2026, 6, 26, 5, 0))).toBe(0);
  });
});

describe("dayShape", () => {
  it("maps days to shapes", () => {
    expect(dayShape(1)).toBe("midweek");
    expect(dayShape(3)).toBe("midweek");
    expect(dayShape(4)).toBe("thu");
    expect(dayShape(5)).toBe("weekend");
    expect(dayShape(6)).toBe("weekend");
    expect(dayShape(0)).toBe("sun");
  });
});

describe("curveValue", () => {
  it("is zero for every archetype at 6 AM", () => {
    expect(curveValue("dive", 6)).toBe(0);
    expect(curveValue("dance_club", 6)).toBe(0);
  });

  it("peaks later for a dance club than for a rooftop", () => {
    expect(curveValue("dance_club", 1)).toBeGreaterThan(curveValue("rooftop", 1));
    expect(curveValue("rooftop", 19)).toBeGreaterThan(curveValue("dance_club", 19));
  });

  it("stays within 0-100 for every archetype and hour", () => {
    const types = [
      "dive", "party_bar", "dance_club", "cocktail_room", "rooftop",
      "pub", "music_venue", "karaoke", "activity_bar",
    ] as const;
    for (const t of types) {
      for (let h = 0; h < 24; h++) {
        const v = curveValue(t, h);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("DAY_SHAPE_FACTOR", () => {
  it("ranks weekend highest and midweek lowest", () => {
    expect(DAY_SHAPE_FACTOR.weekend).toBeGreaterThan(DAY_SHAPE_FACTOR.thu);
    expect(DAY_SHAPE_FACTOR.thu).toBeGreaterThan(DAY_SHAPE_FACTOR.sun);
    expect(DAY_SHAPE_FACTOR.sun).toBeGreaterThan(DAY_SHAPE_FACTOR.midweek);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- curves`
Expected: FAIL — cannot resolve `./curves`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/curves.ts`:

```ts
/**
 * Archetype curves. Each archetype has one 24-hour base shape (its weekend
 * shape, 0-100), scaled by a day-shape factor. Storing one shape plus four
 * factors rather than nine shapes x four days keeps the data hand-editable.
 */
import { Archetype, DayShape } from "@/lib/heat/types";

/** Hours before this belong to the previous night. */
const NIGHT_ROLLOVER_HOUR = 5;

/** The day whose *night* we are in: 1 AM Sunday is still Saturday night. */
export function nightlifeDay(now: Date): number {
  const d = now.getDay();
  return now.getHours() < NIGHT_ROLLOVER_HOUR ? (d + 6) % 7 : d;
}

export function dayShape(day: number): DayShape {
  if (day === 5 || day === 6) return "weekend";
  if (day === 4) return "thu";
  if (day === 0) return "sun";
  return "midweek";
}

export const DAY_SHAPE_FACTOR: Record<DayShape, number> = {
  weekend: 1.0,
  thu: 0.8,
  sun: 0.6,
  midweek: 0.5,
};

/**
 * Base curves, indexed by hour 0-23. Index 0-4 are the small hours of that
 * same night, so a dance club is still high at index 1 (1 AM).
 */
const CURVES: Record<Archetype, number[]> = {
  //         0   1   2   3  4  5-11(0)          12 13 14 15 16 17 18 19 20 21 22 23
  dive:         [58, 45, 22, 5, 0, 0,0,0,0,0,0,0, 5, 5, 8,10,15,25,32,42,52,64,74,80],
  party_bar:    [62, 42, 18, 4, 0, 0,0,0,0,0,0,0, 4, 4, 6,10,18,30,42,55,68,80,88,84],
  dance_club:   [88, 92, 70, 30, 6, 0,0,0,0,0,0,0, 0, 0, 0, 0, 4, 8,14,22,34,52,72,84],
  cocktail_room:[35, 20, 8, 2, 0, 0,0,0,0,0,0,0, 6, 8,10,14,24,40,58,72,80,82,72,56],
  rooftop:      [10, 4, 0, 0, 0, 0,0,0,0,0,0,0,14,20,28,38,52,68,82,88,80,64,40,22],
  pub:          [28, 14, 4, 0, 0, 0,0,0,0,0,0,0,12,14,18,24,34,46,58,68,76,80,70,50],
  music_venue:  [48, 30, 12, 3, 0, 0,0,0,0,0,0,0, 0, 0, 0, 4, 8,14,26,44,64,80,84,70],
  karaoke:      [66, 50, 26, 6, 0, 0,0,0,0,0,0,0, 0, 0, 4, 6,10,18,30,44,60,76,86,80],
  activity_bar: [30, 16, 5, 0, 0, 0,0,0,0,0,0,0, 8,10,14,20,30,44,58,70,78,80,68, 48],
};

export function curveValue(archetype: Archetype, hour: number): number {
  const curve = CURVES[archetype];
  return curve[((hour % 24) + 24) % 24];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- curves`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/curves.ts src/lib/heat/curves.test.ts
git commit -m "feat(heat): archetype curves and night-day rollover"
```

---

### Task 4: Baseline data files

**Files:**
- Create: `src/data/activity/baseline.json`
- Create: `src/data/activity/events.json`
- Create: `src/data/activity/index.ts`
- Create: `src/data/activity/index.test.ts`

**Interfaces:**
- Consumes: `VenueBaseline`, `WeeklyEvent` from `@/lib/heat/types`
- Produces:
  - `getBaseline(venueId: string): VenueBaseline | undefined`
  - `getEvents(venueId: string): WeeklyEvent[]`
  - `ALL_BASELINE_IDS: string[]`

- [ ] **Step 1: Generate the baseline file**

Run this script from the repo root. It derives an archetype and `line_pattern` for all 56 live venues from data already in the repo, per the spec's derivation rules.

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("src/data/venues.ts", "utf8");
const enr = JSON.parse(readFileSync("src/data/enrichment/enrichment.json", "utf8"));

const blocks = src.split(/\n  \{\n/).slice(1);
const venues = [];
for (const b of blocks) {
  const g = (re) => { const m = b.match(re); return m ? m[1] : null; };
  const id = g(/id: "([^"]+)"/);
  const title = g(/title: "([^"]+)"/);
  if (!id || !title) continue;
  venues.push({ id, title, category: g(/category: "([^"]+)"/) });
}

// Archetype by title. Anything unlisted falls back to the category default.
const ARCH = {
  "phebes-tavern":"party_bar","downtown-social":"party_bar","coyote-ugly-saloon":"party_bar",
  "wiggle-room":"dance_club","deluxx-fluxx":"dance_club","berlin":"dance_club","solas":"dance_club",
  "joyface":"dance_club","romeos":"cocktail_room","holiday-cocktail-lounge":"cocktail_room",
  "death-co":"cocktail_room","please-dont-tell":"cocktail_room","superbueno":"cocktail_room",
  "paradise-lost":"cocktail_room","the-summit-bar":"cocktail_room","goodnight-sonny":"cocktail_room",
  "sweet-linda":"cocktail_room","the-headless-widow":"cocktail_room","wonderland-bar":"cocktail_room",
  "lovers-of-today":"cocktail_room","big-bar":"cocktail_room","amor-y-amargo":"cocktail_room",
  "the-ready-rooftop":"rooftop",
  "niagara-bar":"dive","doc-hollidays":"dive","the-library":"dive","lucys-bar":"dive",
  "international-bar":"dive","double-down-saloon":"dive","blue-gold-tavern":"dive",
  "the-spotted-owl-tavern":"dive","96-tears":"dive","mona-s":"dive","monas":"dive",
  "lucky":"dive","the-york":"dive","juke-bar":"dive","ten-degrees":"dive","little-rebel":"dive",
  "nublu-151":"music_venue","otto-s-shrunken-head":"music_venue","ottos-shrunken-head":"music_venue",
  "the-wayland":"music_venue","kgb-bar":"music_venue","beauty-bar":"party_bar",
  "barcade":"activity_bar","standings":"pub","mcsorleys-old-ale-house":"pub",
  "the-grafton":"pub","st-dymphnas":"pub","bua":"pub","solas-":"pub","banshee":"pub",
  "alphabet-city-beer-co":"pub","d-b-a":"pub","dba":"pub","two-perrys":"pub",
  "accidental-bar":"cocktail_room","sake-bar-decibel":"cocktail_room","motel-no-tell":"party_bar",
  "club-cumming":"music_venue","the-grafton-":"pub",
};

const CATEGORY_DEFAULT = { bar: "dive", club: "dance_club", lounge: "cocktail_room" };

// line_pattern per the spec: door_pick for late party/dance rooms,
// capacity_wait for small cocktail rooms, occasion for sports/holiday venues.
const DOOR_PICK = new Set(["party_bar","dance_club","karaoke"]);
const CAPACITY_WAIT = new Set(["death-co","please-dont-tell","amor-y-amargo","superbueno","lovers-of-today"]);
const OCCASION = new Set(["mcsorleys-old-ale-house","the-grafton","standings"]);

function closesAt2AmOrLater(title) {
  const e = enr[title];
  if (!e?.hours?.length) return false;
  return e.hours.some((p) => p.closeDayOffset === 1 && p.closeHour >= 2 || p.closeHour === 0 && p.closeDayOffset === 1);
}

const out = {};
for (const v of venues) {
  const archetype = ARCH[v.id] || CATEGORY_DEFAULT[v.category] || "dive";
  let line_pattern = "none";
  if (OCCASION.has(v.id)) line_pattern = "occasion";
  else if (CAPACITY_WAIT.has(v.id)) line_pattern = "capacity_wait";
  else if (DOOR_PICK.has(archetype) && closesAt2AmOrLater(v.title)) line_pattern = "door_pick";

  out[v.id] = {
    archetype,
    line_pattern,
    confidence_base: "low",
    source_type: "archetype_default",
    last_reviewed: "2026-07-27",
  };
}

mkdirSync("src/data/activity", { recursive: true });
writeFileSync("src/data/activity/baseline.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote", Object.keys(out).length, "venues");
const counts = {};
for (const r of Object.values(out)) counts[r.line_pattern] = (counts[r.line_pattern]||0)+1;
console.log("line_pattern:", counts);
'
```

Expected: `wrote 56 venues`, and a `line_pattern` breakdown with a non-zero `door_pick` count.

- [ ] **Step 2: Verify the generated data by eye**

Run:

```bash
node -e '
const b=require("./src/data/activity/baseline.json");
for (const p of ["door_pick","capacity_wait","occasion"])
  console.log(p+":", Object.keys(b).filter(k=>b[k].line_pattern===p).join(", "));
'
```

Confirm `door_pick` contains the party and dance rooms (Phebe's, Downtown Social, Wiggle Room, Deluxx Fluxx, Berlin, Joyface, Solas, Coyote Ugly, Beauty Bar, Motel No Tell), `capacity_wait` contains the cocktail rooms, and `occasion` contains McSorley's, The Grafton, Standings. If a venue is obviously misfiled, hand-edit `baseline.json` — it is checked-in data, meant to be edited.

- [ ] **Step 3: Write the events file**

Create `src/data/activity/events.json` with the researched weekly events from `docs/research/2026-07-26-signals-merged.md`. Only venues in the live 56 are included; times are minutes from midnight of the venue's night.

```json
[
  { "venue_id": "berlin", "day": 5, "name": "Berlin Dance Party", "start_min": 1380, "source_url": "https://www.berlinundera.com/" },
  { "venue_id": "berlin", "day": 6, "name": "Berlin Dance Party", "start_min": 1380, "source_url": "https://www.berlinundera.com/" },
  { "venue_id": "club-cumming", "day": 1, "name": "Mondays in the Club with Lance", "start_min": 1290, "source_url": "https://www.clubcummingnyc.com/events" },
  { "venue_id": "club-cumming", "day": 0, "name": "Burlesque Open Stage", "start_min": 1290, "source_url": "https://www.clubcummingnyc.com/events" },
  { "venue_id": "club-cumming", "day": 2, "name": "Make It with Brini Maxwell", "start_min": 1080, "source_url": "https://www.clubcummingnyc.com/events" },
  { "venue_id": "club-cumming", "day": 0, "name": "The Anatomy Lesson: Drink & Draw", "start_min": 1020, "source_url": "https://www.clubcummingnyc.com/events" },
  { "venue_id": "the-wayland", "day": 3, "name": "Live Music", "start_min": 1260, "source_url": "https://www.thewaylandnyc.com/" },
  { "venue_id": "beauty-bar", "day": 0, "name": "Secret Sauce comedy", "start_min": 1200, "source_url": "https://beautybar.com/nyc" },
  { "venue_id": "motel-no-tell", "day": 1, "name": "Trivia", "start_min": 1140, "source_url": "https://www.motelnotell.com/" },
  { "venue_id": "motel-no-tell", "day": 2, "name": "Mixtape Bingo", "start_min": 1140, "source_url": "https://www.motelnotell.com/" },
  { "venue_id": "motel-no-tell", "day": 3, "name": "Live Music", "start_min": 1140, "source_url": "https://www.motelnotell.com/" },
  { "venue_id": "solas", "day": 0, "name": "Tango", "start_min": null, "source_url": "https://www.solasbar.com/events" },
  { "venue_id": "solas", "day": 2, "name": "Zouk", "start_min": null, "source_url": "https://www.solasbar.com/events" },
  { "venue_id": "solas", "day": 3, "name": "Salsa", "start_min": null, "source_url": "https://www.solasbar.com/events" },
  { "venue_id": "solas", "day": 4, "name": "Bachata", "start_min": null, "source_url": "https://www.solasbar.com/events" }
]
```

Note: `start_min` 1380 = 11:00 PM, 1290 = 9:30 PM, 1260 = 9:00 PM, 1200 = 8:00 PM, 1140 = 7:00 PM, 1080 = 6:00 PM, 1020 = 5:00 PM.

- [ ] **Step 4: Write the failing test**

Create `src/data/activity/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getBaseline, getEvents, ALL_BASELINE_IDS } from "./index";

describe("activity data", () => {
  it("covers all 56 live venues", () => {
    expect(ALL_BASELINE_IDS.length).toBe(56);
  });

  it("gives every venue an archetype and a line_pattern", () => {
    for (const id of ALL_BASELINE_IDS) {
      const b = getBaseline(id)!;
      expect(b.archetype).toBeTruthy();
      expect(["door_pick", "capacity_wait", "occasion", "none"]).toContain(b.line_pattern);
    }
  });

  it("returns undefined for an unknown venue", () => {
    expect(getBaseline("not-a-venue")).toBeUndefined();
  });

  it("returns events for a venue that has them", () => {
    const events = getEvents("berlin");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.venue_id === "berlin")).toBe(true);
  });

  it("returns an empty array for a venue with no events", () => {
    expect(getEvents("not-a-venue")).toEqual([]);
  });

  it("only references venues that exist in the baseline", () => {
    for (const id of ALL_BASELINE_IDS) expect(getBaseline(id)).toBeDefined();
    const eventIds = new Set(getEvents("berlin").map((e) => e.venue_id));
    for (const id of eventIds) expect(getBaseline(id)).toBeDefined();
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm test -- activity`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 6: Implement the accessors**

Create `src/data/activity/index.ts`:

```ts
/**
 * Typed access to the static activity layer. Keyed by venue `id` — never by
 * title, because the dataset contains Niagara/Niagara Bar and
 * Downtown Social/13th Step name mismatches.
 */
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";
import baselineJson from "./baseline.json";
import eventsJson from "./events.json";

const BASELINE = baselineJson as Record<string, VenueBaseline>;
const EVENTS = eventsJson as WeeklyEvent[];

const EVENTS_BY_VENUE = EVENTS.reduce<Record<string, WeeklyEvent[]>>((acc, e) => {
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
```

- [ ] **Step 7: Enable JSON imports if the typecheck complains**

Run: `npx tsc --noEmit -p tsconfig.app.json`

If it errors on the JSON imports, add `"resolveJsonModule": true` to `compilerOptions` in `tsconfig.app.json`, then re-run. Expected: no errors.

- [ ] **Step 8: Run the tests**

Run: `npm test -- activity`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/data/activity/baseline.json src/data/activity/events.json src/data/activity/index.ts src/data/activity/index.test.ts tsconfig.app.json
git commit -m "feat(heat): static activity baseline and events for 56 venues"
```

---

### Task 5: Baseline score

**Files:**
- Create: `src/lib/heat/baseline.ts`
- Create: `src/lib/heat/baseline.test.ts`

**Interfaces:**
- Consumes: `curveValue`, `nightlifeDay`, `dayShape`, `DAY_SHAPE_FACTOR` from `@/lib/heat/curves`; types from `@/lib/heat/types`
- Produces: `baselineScore(baseline: VenueBaseline, events: WeeklyEvent[], now: Date): number`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/baseline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { baselineScore } from "./baseline";
import { VenueBaseline, WeeklyEvent } from "./types";

const dive: VenueBaseline = {
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
};

const SAT_11PM = new Date(2026, 6, 25, 23, 0);
const MON_11PM = new Date(2026, 6, 27, 23, 0);
const MON_10PM = new Date(2026, 6, 27, 22, 0);

describe("baselineScore", () => {
  it("scores a weekend night higher than a midweek night", () => {
    expect(baselineScore(dive, [], SAT_11PM)).toBeGreaterThan(
      baselineScore(dive, [], MON_11PM),
    );
  });

  it("stays within 0-100", () => {
    for (let h = 0; h < 24; h++) {
      const s = baselineScore(dive, [], new Date(2026, 6, 25, h, 0));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("lifts a best-night above a non-best-night", () => {
    const withBest: VenueBaseline = { ...dive, best_nights: [1] };
    expect(baselineScore(withBest, [], MON_11PM)).toBeGreaterThan(
      baselineScore(dive, [], MON_11PM),
    );
  });

  it("an event bump can make a Monday busy", () => {
    const event: WeeklyEvent = {
      venue_id: "x", day: 1, name: "Macho Monday",
      start_min: 22 * 60, source_url: "https://example.com",
    };
    const without = baselineScore(dive, [], MON_10PM);
    const withEvent = baselineScore(dive, [event], MON_10PM);
    expect(withEvent).toBeGreaterThan(without);
    // The spec's acceptance case: the bump must be able to invert a day-shape.
    expect(withEvent).toBeGreaterThanOrEqual(55);
  });

  it("ignores an event on a different day", () => {
    const event: WeeklyEvent = {
      venue_id: "x", day: 6, name: "Saturday thing",
      start_min: 22 * 60, source_url: "https://example.com",
    };
    expect(baselineScore(dive, [event], MON_10PM)).toBe(baselineScore(dive, [], MON_10PM));
  });

  it("ignores an event with no posted time", () => {
    const event: WeeklyEvent = {
      venue_id: "x", day: 1, name: "Untimed",
      start_min: null, source_url: "https://example.com",
    };
    expect(baselineScore(dive, [event], MON_10PM)).toBe(baselineScore(dive, [], MON_10PM));
  });

  it("uses researched peak windows when present", () => {
    const researched: VenueBaseline = {
      ...dive,
      peak_start: 23 * 60,
      peak_end: 25 * 60,
      busy_start: 21 * 60,
      busy_end: 26 * 60,
    };
    expect(baselineScore(researched, [], SAT_11PM)).toBeGreaterThanOrEqual(75);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- baseline`
Expected: FAIL — cannot resolve `./baseline`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/baseline.ts`:

```ts
/**
 * Baseline heat: the archetype curve, reshaped by any researched windows, then
 * lifted by posted events. Pure — `now` is always an argument.
 */
import { curveValue, dayShape, nightlifeDay, DAY_SHAPE_FACTOR } from "@/lib/heat/curves";
import { VenueBaseline, WeeklyEvent } from "@/lib/heat/types";

/** Best nights get most of the way to a weekend shape. */
const BEST_NIGHT_FACTOR = 0.92;

/** Big enough to invert a day-shape — see the spec's Nowhere/Macho Monday case. */
const EVENT_BUMP = 30;
const EVENT_LEAD_MIN = 30;
const EVENT_TAIL_MIN = 180;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Minutes from midnight of the venue's night: 1 AM reads as 1500, not 60. */
function nightMinutes(now: Date): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < 5 ? m + 1440 : m;
}

function inWindow(min: number, start?: number, end?: number): boolean {
  return start != null && end != null && min >= start && min < end;
}

export function baselineScore(
  baseline: VenueBaseline,
  events: WeeklyEvent[],
  now: Date,
): number {
  const day = nightlifeDay(now);
  const min = nightMinutes(now);

  const shape = dayShape(day);
  const isBestNight = baseline.best_nights?.includes(day) ?? false;
  const factor = isBestNight
    ? Math.max(DAY_SHAPE_FACTOR[shape], BEST_NIGHT_FACTOR)
    : DAY_SHAPE_FACTOR[shape];

  let score = curveValue(baseline.archetype, now.getHours()) * factor;

  // Researched windows override the curve where we actually know the answer.
  if (inWindow(min, baseline.peak_start, baseline.peak_end)) {
    score = Math.max(score, 85 * factor + 15);
  } else if (inWindow(min, baseline.busy_start, baseline.busy_end)) {
    score = Math.max(score, 60 * factor + 10);
  } else if (baseline.busy_start != null && baseline.busy_end != null) {
    // Outside a known busy window, the venue is genuinely quiet.
    score = Math.min(score, 25);
  }

  for (const e of events) {
    if (e.day !== day || e.start_min == null) continue;
    if (min >= e.start_min - EVENT_LEAD_MIN && min < e.start_min + EVENT_TAIL_MIN) {
      score += EVENT_BUMP;
    }
  }

  return clamp(Math.round(score));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- baseline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/baseline.ts src/lib/heat/baseline.test.ts
git commit -m "feat(heat): baseline score from curves, windows and events"
```

---

### Task 6: Live signals

**Files:**
- Create: `src/lib/heat/live.ts`
- Create: `src/lib/heat/live.test.ts`

**Interfaces:**
- Consumes: `LiveSignals`, `Vibe5` from `@/lib/heat/types`
- Produces:
  - `effectiveCheckIns(s: LiveSignals): number`
  - `crowdFromCheckIns(effective: number): number`
  - `crowdFromFeedback(s: LiveSignals): number | null`
  - `liveCrowd(s: LiveSignals): number | null`
  - `hasLineReport(s: LiveSignals): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/live.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  effectiveCheckIns, crowdFromCheckIns, crowdFromFeedback, liveCrowd, hasLineReport,
} from "./live";
import { EMPTY_SIGNALS, LiveSignals } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

describe("effectiveCheckIns", () => {
  it("is zero with no signals", () => {
    expect(effectiveCheckIns(EMPTY_SIGNALS)).toBe(0);
  });

  it("weights a fresh check-in fully", () => {
    expect(effectiveCheckIns(sig({ count15: 1, count45: 1, count90: 1 }))).toBeCloseTo(1, 5);
  });

  it("discounts an older check-in", () => {
    const old = effectiveCheckIns(sig({ count15: 0, count45: 0, count90: 1 }));
    expect(old).toBeGreaterThan(0);
    expect(old).toBeLessThan(0.2);
  });

  it("weights friends more heavily than strangers", () => {
    const strangers = effectiveCheckIns(sig({ count15: 2, count45: 2, count90: 2 }));
    const friends = effectiveCheckIns(sig({ count15: 2, count45: 2, count90: 2, friendCount: 2 }));
    expect(friends).toBeGreaterThan(strangers);
  });
});

describe("crowdFromCheckIns", () => {
  it("saturates around six effective check-ins", () => {
    expect(crowdFromCheckIns(6)).toBeGreaterThanOrEqual(75);
    expect(crowdFromCheckIns(0)).toBe(0);
    expect(crowdFromCheckIns(100)).toBeLessThanOrEqual(100);
  });

  it("is monotonic", () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = crowdFromCheckIns(i);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("crowdFromFeedback", () => {
  it("is null with no reports", () => {
    expect(crowdFromFeedback(EMPTY_SIGNALS)).toBeNull();
  });

  it("maps packed higher than chill", () => {
    const packed = crowdFromFeedback(sig({ vibeTally: { packed: 1 } }))!;
    const chill = crowdFromFeedback(sig({ vibeTally: { chill: 1 } }))!;
    expect(packed).toBeGreaterThan(chill);
  });

  it("averages mixed reports", () => {
    const mixed = crowdFromFeedback(sig({ vibeTally: { dead: 1, packed: 1 } }))!;
    expect(mixed).toBeGreaterThan(5);
    expect(mixed).toBeLessThan(85);
  });
});

describe("liveCrowd", () => {
  it("is null when there is nothing to go on", () => {
    expect(liveCrowd(EMPTY_SIGNALS)).toBeNull();
  });

  it("prefers feedback when both exist", () => {
    const s = sig({ count15: 1, count45: 1, count90: 1, vibeTally: { packed: 3 } });
    expect(liveCrowd(s)!).toBeGreaterThan(crowdFromCheckIns(effectiveCheckIns(s)));
  });
});

describe("hasLineReport", () => {
  it("detects a line_outside report", () => {
    expect(hasLineReport(sig({ vibeTally: { line_outside: 1 } }))).toBe(true);
  });

  it("is false otherwise", () => {
    expect(hasLineReport(sig({ vibeTally: { packed: 5 } }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- live`
Expected: FAIL — cannot resolve `./live`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/live.ts`:

```ts
/**
 * Live signal processing: decay check-ins by age, turn feedback into a crowd
 * reading. All inputs are anonymous aggregates from venue_activity().
 */
import { LiveSignals, Vibe5 } from "@/lib/heat/types";

/** ~35 minute half-life, gone by 90. Buckets are cumulative. */
const W15 = 1.0;
const W45 = 0.45;
const W90 = 0.12;

/** A friend being somewhere is a much stronger signal than a stranger. */
const FRIEND_MULTIPLIER = 3;

/** Effective check-ins at which the live crowd reading saturates. */
const SATURATION = 6;

const VIBE_CROWD: Record<Vibe5, number> = {
  dead: 5,
  chill: 30,
  building: 60,
  packed: 85,
  line_outside: 95,
};

export function effectiveCheckIns(s: LiveSignals): number {
  const fresh = s.count15;
  const mid = Math.max(0, s.count45 - s.count15);
  const old = Math.max(0, s.count90 - s.count45);
  const base = fresh * W15 + mid * W45 + old * W90;
  // Friends are counted once in the buckets already; add the extra weight.
  return base + s.friendCount * (FRIEND_MULTIPLIER - 1) * W15;
}

export function crowdFromCheckIns(effective: number): number {
  if (effective <= 0) return 0;
  return Math.min(100, Math.round(100 * (effective / (effective + SATURATION / 3))));
}

export function crowdFromFeedback(s: LiveSignals): number | null {
  let total = 0;
  let weight = 0;
  for (const [vibe, count] of Object.entries(s.vibeTally)) {
    const n = count ?? 0;
    if (n <= 0) continue;
    total += VIBE_CROWD[vibe as Vibe5] * n;
    weight += n;
  }
  if (weight === 0) return null;
  return Math.round(total / weight);
}

/**
 * People saying what a room is like beats counting who walked in, so feedback
 * dominates when it exists. Check-ins fill in when nobody has reported.
 */
export function liveCrowd(s: LiveSignals): number | null {
  const feedback = crowdFromFeedback(s);
  const checkins = crowdFromCheckIns(effectiveCheckIns(s));
  if (feedback == null) return checkins > 0 ? checkins : null;
  return Math.round(feedback * 0.7 + checkins * 0.3);
}

export function hasLineReport(s: LiveSignals): boolean {
  return (s.vibeTally.line_outside ?? 0) > 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- live`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/live.ts src/lib/heat/live.test.ts
git commit -m "feat(heat): check-in decay and feedback aggregation"
```

---

### Task 7: Blend and labels

**Files:**
- Create: `src/lib/heat/blend.ts`
- Create: `src/lib/heat/blend.test.ts`
- Create: `src/lib/heat/labels.ts`
- Create: `src/lib/heat/labels.test.ts`

**Interfaces:**
- Consumes: `effectiveCheckIns`, `liveCrowd` from `@/lib/heat/live`; types
- Produces:
  - `liveWeight(s: LiveSignals): number`
  - `blendScore(baseline: number, s: LiveSignals): { score: number; liveWeight: number }`
  - `scoreLabel(score: number): HeatLabel`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/heat/blend.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { liveWeight, blendScore } from "./blend";
import { EMPTY_SIGNALS, LiveSignals } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

describe("liveWeight", () => {
  it("is zero with no signals", () => {
    expect(liveWeight(EMPTY_SIGNALS)).toBe(0);
  });

  it("never exceeds the 0.75 cap", () => {
    expect(liveWeight(sig({ count15: 100, count45: 100, count90: 100 }))).toBeLessThanOrEqual(0.75);
  });

  it("rises with signal volume", () => {
    const few = liveWeight(sig({ count15: 2, count45: 2, count90: 2 }));
    const many = liveWeight(sig({ count15: 8, count45: 8, count90: 8 }));
    expect(many).toBeGreaterThan(few);
  });
});

describe("blendScore", () => {
  it("returns the baseline unchanged with no signals", () => {
    expect(blendScore(40, EMPTY_SIGNALS).score).toBe(40);
  });

  it("moves toward the live reading when signals exist", () => {
    const { score } = blendScore(20, sig({ count15: 8, count45: 8, count90: 8, vibeTally: { packed: 4 } }));
    expect(score).toBeGreaterThan(20);
  });

  it("stays within 0-100", () => {
    const { score } = blendScore(100, sig({ count15: 50, count45: 50, count90: 50, vibeTally: { line_outside: 9 } }));
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
```

Create `src/lib/heat/labels.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreLabel } from "./labels";

describe("scoreLabel", () => {
  it("maps the spec's bands", () => {
    expect(scoreLabel(0)).toBe("Quiet");
    expect(scoreLabel(29)).toBe("Quiet");
    expect(scoreLabel(30)).toBe("Building");
    expect(scoreLabel(54)).toBe("Building");
    expect(scoreLabel(55)).toBe("Busy");
    expect(scoreLabel(74)).toBe("Busy");
    expect(scoreLabel(75)).toBe("Hot Now");
    expect(scoreLabel(100)).toBe("Hot Now");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- blend labels`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 3: Implement the blend**

Create `src/lib/heat/blend.ts`:

```ts
/**
 * Blends baseline and live readings. The weight is a function of evidence
 * volume AT THIS VENUE, which reproduces the launch -> traction -> network
 * phases automatically and per venue, instead of by a global switch.
 */
import { effectiveCheckIns, liveCrowd } from "@/lib/heat/live";
import { LiveSignals } from "@/lib/heat/types";

const LIVE_WEIGHT_CAP = 0.75;
const HALF_SIGNAL = 4;

export function liveWeight(s: LiveSignals): number {
  const reports = Object.values(s.vibeTally).reduce<number>((a, b) => a + (b ?? 0), 0);
  const signals = effectiveCheckIns(s) + reports;
  if (signals <= 0) return 0;
  return Math.min(LIVE_WEIGHT_CAP, signals / (signals + HALF_SIGNAL));
}

export function blendScore(
  baseline: number,
  s: LiveSignals,
): { score: number; liveWeight: number } {
  const live = liveCrowd(s);
  const w = live == null ? 0 : liveWeight(s);
  const score = Math.round(baseline * (1 - w) + (live ?? 0) * w);
  return { score: Math.max(0, Math.min(100, score)), liveWeight: w };
}
```

- [ ] **Step 4: Implement the labels**

Create `src/lib/heat/labels.ts`:

```ts
import { HeatLabel } from "@/lib/heat/types";

/** "Line Likely" is deliberately absent: it is an overlay, not a band. */
export function scoreLabel(score: number): HeatLabel {
  if (score >= 75) return "Hot Now";
  if (score >= 55) return "Busy";
  if (score >= 30) return "Building";
  return "Quiet";
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npm test -- blend labels`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/heat/blend.ts src/lib/heat/blend.test.ts src/lib/heat/labels.ts src/lib/heat/labels.test.ts
git commit -m "feat(heat): per-venue blend weighting and score labels"
```

---

### Task 8: Line risk

**Files:**
- Create: `src/lib/heat/line.ts`
- Create: `src/lib/heat/line.test.ts`

**Interfaces:**
- Consumes: `hasLineReport` from `@/lib/heat/live`; `nightlifeDay` from `@/lib/heat/curves`; types
- Produces: `lineRisk(baseline: VenueBaseline, score: number, s: LiveSignals, now: Date): number`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/line.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lineRisk } from "./line";
import { EMPTY_SIGNALS, LiveSignals, VenueBaseline } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

const base = (o: Partial<VenueBaseline>): VenueBaseline => ({
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
  ...o,
});

const SAT_8PM = new Date(2026, 6, 25, 20, 0);
const SAT_1AM = new Date(2026, 6, 26, 1, 0);
const SAT_MIDNIGHT = new Date(2026, 6, 26, 0, 30);

describe("lineRisk", () => {
  it("is always zero for line_pattern none, at any heat", () => {
    for (const score of [0, 50, 90, 100]) {
      expect(lineRisk(base({ line_pattern: "none" }), score, EMPTY_SIGNALS, SAT_MIDNIGHT)).toBe(0);
    }
  });

  it("door_pick fires late at high heat", () => {
    expect(lineRisk(base({ line_pattern: "door_pick" }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT))
      .toBeGreaterThan(0);
  });

  it("door_pick stays quiet at low heat even when late", () => {
    expect(lineRisk(base({ line_pattern: "door_pick" }), 40, EMPTY_SIGNALS, SAT_MIDNIGHT)).toBe(0);
  });

  it("door_pick stays quiet early even at high heat", () => {
    expect(lineRisk(base({ line_pattern: "door_pick" }), 85, EMPTY_SIGNALS, SAT_8PM)).toBe(0);
  });

  it("capacity_wait fires EARLY, not late", () => {
    const b = base({ line_pattern: "capacity_wait" });
    const early = lineRisk(b, 70, EMPTY_SIGNALS, SAT_8PM);
    const late = lineRisk(b, 70, EMPTY_SIGNALS, SAT_1AM);
    expect(early).toBeGreaterThan(0);
    expect(late).toBeLessThan(early);
  });

  it("a line_outside report forces high risk regardless of pattern", () => {
    const reported = sig({ vibeTally: { line_outside: 1 } });
    expect(lineRisk(base({ line_pattern: "capacity_wait" }), 10, reported, SAT_1AM))
      .toBeGreaterThanOrEqual(80);
  });

  it("but a line_outside report still cannot override pattern none", () => {
    const reported = sig({ vibeTally: { line_outside: 3 } });
    expect(lineRisk(base({ line_pattern: "none" }), 90, reported, SAT_MIDNIGHT)).toBe(0);
  });

  it("occasion produces nothing without a calendar", () => {
    expect(lineRisk(base({ line_pattern: "occasion" }), 90, EMPTY_SIGNALS, SAT_MIDNIGHT)).toBe(0);
  });

  it("small capacity raises door_pick risk", () => {
    const small = lineRisk(base({ line_pattern: "door_pick", capacity: 60 }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    const big = lineRisk(base({ line_pattern: "door_pick", capacity: 900 }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    expect(small).toBeGreaterThan(big);
  });

  it("missing capacity is neutral, never a penalty", () => {
    const none = lineRisk(base({ line_pattern: "door_pick" }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    const big = lineRisk(base({ line_pattern: "door_pick", capacity: 900 }), 85, EMPTY_SIGNALS, SAT_MIDNIGHT);
    expect(none).toBeGreaterThanOrEqual(big);
  });

  it("stays within 0-100", () => {
    const v = lineRisk(base({ line_pattern: "door_pick", capacity: 30 }), 100,
      sig({ vibeTally: { line_outside: 5 } }), SAT_MIDNIGHT);
    expect(v).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- line`
Expected: FAIL — cannot resolve `./line`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/line.ts`:

```ts
/**
 * Line risk emerges from heat, never from the clock alone. Each line_pattern is
 * a different transfer function, because the evidence shows at least three
 * distinct mechanics — see the spec's Background section.
 */
import { hasLineReport } from "@/lib/heat/live";
import { LiveSignals, VenueBaseline } from "@/lib/heat/types";

const DOOR_PICK_THRESHOLD = 70;
const CAPACITY_WAIT_THRESHOLD = 60;
const REPORTED_LINE_RISK = 90;

/** Minutes from midnight of the venue's night. */
function nightMinutes(now: Date): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < 5 ? m + 1440 : m;
}

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
    const progress = (min - EARLY_START) / (EARLY_END - EARLY_START);
    return clamp((score - CAPACITY_WAIT_THRESHOLD) * 2.5 * cap * (1 - progress));
  }

  // occasion: inert until a sports/holiday calendar exists. See spec, Open questions.
  return 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- line`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/line.ts src/lib/heat/line.test.ts
git commit -m "feat(heat): line risk model with per-pattern transfer functions"
```

---

### Task 9: Confidence

**Files:**
- Create: `src/lib/heat/confidence.ts`
- Create: `src/lib/heat/confidence.test.ts`

**Interfaces:**
- Consumes: `effectiveCheckIns` from `@/lib/heat/live`; types
- Produces:
  - `confidenceScore(baseline: VenueBaseline, s: LiveSignals): number`
  - `mayStateExactTimes(confidence: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/heat/confidence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { confidenceScore, mayStateExactTimes } from "./confidence";
import { EMPTY_SIGNALS, LiveSignals, VenueBaseline } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

const base = (o: Partial<VenueBaseline>): VenueBaseline => ({
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
  ...o,
});

describe("confidenceScore", () => {
  it("is low for an archetype default with no signals", () => {
    expect(confidenceScore(base({}), EMPTY_SIGNALS)).toBeLessThan(50);
  });

  it("is high for a first-hand venue with researched windows", () => {
    const b = base({
      confidence_base: "high",
      source_type: "first_hand",
      busy_start: 1260, busy_end: 1560, peak_start: 1380, peak_end: 1500,
    });
    expect(confidenceScore(b, EMPTY_SIGNALS)).toBeGreaterThanOrEqual(70);
  });

  it("rises with live signal volume even on an archetype default", () => {
    const quiet = confidenceScore(base({}), EMPTY_SIGNALS);
    const busy = confidenceScore(base({}), sig({
      count15: 6, count45: 6, count90: 6, vibeTally: { packed: 3 },
    }));
    expect(busy).toBeGreaterThan(quiet);
  });

  it("stays within 0-100", () => {
    const v = confidenceScore(
      base({ confidence_base: "high", source_type: "first_hand", busy_start: 1, busy_end: 2, peak_start: 1, peak_end: 2 }),
      sig({ count15: 99, count45: 99, count90: 99, vibeTally: { packed: 99 } }),
    );
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe("mayStateExactTimes", () => {
  it("permits exact times only at high confidence", () => {
    expect(mayStateExactTimes(90)).toBe(true);
    expect(mayStateExactTimes(40)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- confidence`
Expected: FAIL — cannot resolve `./confidence`.

- [ ] **Step 3: Implement**

Create `src/lib/heat/confidence.ts`:

```ts
/**
 * confidence_base is stored editorial judgement; confidence_score is computed
 * per read and rises with live evidence. A venue on an archetype default can
 * still speak confidently right now if enough people are there reporting.
 */
import { effectiveCheckIns } from "@/lib/heat/live";
import { LiveSignals, VenueBaseline } from "@/lib/heat/types";

const BASE_POINTS = { high: 60, medium: 40, low: 20 } as const;
const SOURCE_POINTS = { first_hand: 20, research_estimate: 10, archetype_default: 0 } as const;

/** Above this, copy may state exact times. */
export const EXACT_TIME_THRESHOLD = 70;

export function confidenceScore(baseline: VenueBaseline, s: LiveSignals): number {
  let score = BASE_POINTS[baseline.confidence_base] + SOURCE_POINTS[baseline.source_type];

  if (baseline.busy_start != null && baseline.busy_end != null) score += 5;
  if (baseline.peak_start != null && baseline.peak_end != null) score += 5;

  const reports = Object.values(s.vibeTally).reduce<number>((a, b) => a + (b ?? 0), 0);
  const liveEvidence = effectiveCheckIns(s) + reports * 2;
  score += Math.min(25, liveEvidence * 3);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function mayStateExactTimes(confidence: number): boolean {
  return confidence >= EXACT_TIME_THRESHOLD;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- confidence`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/heat/confidence.ts src/lib/heat/confidence.test.ts
git commit -m "feat(heat): confidence score gating copy specificity"
```

---

### Task 10: The orchestrator and golden cases

**Files:**
- Create: `src/lib/heat/index.ts`
- Create: `src/lib/heat/golden.test.ts`
- Delete: `src/lib/heat/smoke.test.ts`

**Interfaces:**
- Consumes: everything above; `computeOpenState`, `getEnrichment` from `@/data/enrichment`
- Produces: `computeHeat(input: HeatInput): HeatResult` — the single public entry point that slices 2–4 consume.

- [ ] **Step 1: Write the failing golden tests**

Create `src/lib/heat/golden.test.ts`. These encode the spec's acceptance cases, drawn from sourced evidence:

```ts
import { describe, it, expect } from "vitest";
import { computeHeat } from "./index";
import { EMPTY_SIGNALS, LiveSignals, VenueBaseline } from "./types";

const sig = (o: Partial<LiveSignals>): LiveSignals => ({ ...EMPTY_SIGNALS, ...o });

const base = (o: Partial<VenueBaseline>): VenueBaseline => ({
  archetype: "dive",
  line_pattern: "none",
  confidence_base: "low",
  source_type: "archetype_default",
  last_reviewed: "2026-07-27",
  ...o,
});

const OPEN_ALWAYS = undefined; // no hours data => treated as open, see computeHeat

describe("golden: Death & Co queues early and eases late", () => {
  const deathAndCo = base({
    archetype: "cocktail_room",
    line_pattern: "capacity_wait",
    capacity: 50,
    confidence_base: "medium",
    source_type: "research_estimate",
  });

  it("has line risk at 8 PM Friday", () => {
    const r = computeHeat({
      baseline: deathAndCo, events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 24, 20, 0), hours: OPEN_ALWAYS,
    });
    expect(r.lineRisk).toBeGreaterThan(0);
  });

  it("has less line risk at 1 AM than at 8 PM", () => {
    const early = computeHeat({
      baseline: deathAndCo, events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 24, 20, 0), hours: OPEN_ALWAYS,
    });
    const late = computeHeat({
      baseline: deathAndCo, events: [], signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 25, 1, 0), hours: OPEN_ALWAYS,
    });
    expect(late.lineRisk).toBeLessThan(early.lineRisk);
  });
});

describe("golden: Amor y Amargo never claims a line", () => {
  const amor = base({ archetype: "cocktail_room", line_pattern: "none" });

  it("has no line risk even at peak with reports", () => {
    const r = computeHeat({
      baseline: amor, events: [],
      signals: sig({ count15: 9, count45: 9, count90: 9, vibeTally: { packed: 5 } }),
      now: new Date(2026, 6, 25, 23, 0), hours: OPEN_ALWAYS,
    });
    expect(r.lineRisk).toBe(0);
    expect(r.lineLikely).toBe(false);
  });
});

describe("golden: Nowhere is busy on a Monday because of programming", () => {
  it("reaches Busy or better at 10 PM Monday", () => {
    const r = computeHeat({
      baseline: base({ archetype: "dive", line_pattern: "none" }),
      events: [{ venue_id: "nowhere", day: 1, name: "Macho Monday", start_min: 22 * 60, source_url: "https://example.com" }],
      signals: EMPTY_SIGNALS,
      now: new Date(2026, 6, 27, 22, 0), hours: OPEN_ALWAYS,
    });
    expect(r.score).toBeGreaterThanOrEqual(55);
  });
});

describe("golden: a closed venue always scores zero", () => {
  it("scores 0 and reads Closed outside opening hours", () => {
    const r = computeHeat({
      baseline: base({ archetype: "party_bar", line_pattern: "door_pick" }),
      events: [], signals: sig({ count15: 9, count45: 9, count90: 9 }),
      now: new Date(2026, 6, 25, 10, 0),
      // Open Saturdays 6 PM to 2 AM only.
      hours: [{ day: 6, openHour: 18, openMinute: 0, closeHour: 2, closeMinute: 0, closeDayOffset: 1 }],
    });
    expect(r.score).toBe(0);
    expect(r.label).toBe("Closed");
    expect(r.lineRisk).toBe(0);
  });
});

describe("golden: a line_outside report forces line risk", () => {
  it("fires even when the score is low", () => {
    const r = computeHeat({
      baseline: base({ line_pattern: "door_pick" }), events: [],
      signals: sig({ vibeTally: { line_outside: 1 } }),
      now: new Date(2026, 6, 25, 23, 30), hours: OPEN_ALWAYS,
    });
    expect(r.lineRisk).toBeGreaterThanOrEqual(80);
    expect(r.lineLikely).toBe(true);
  });
});

describe("properties", () => {
  const archetypes = [
    "dive", "party_bar", "dance_club", "cocktail_room", "rooftop",
    "pub", "music_venue", "karaoke", "activity_bar",
  ] as const;
  const patterns = ["door_pick", "capacity_wait", "occasion", "none"] as const;

  it("score is always 0-100 across every archetype, pattern and hour", () => {
    for (const archetype of archetypes) {
      for (const line_pattern of patterns) {
        for (let h = 0; h < 24; h++) {
          const r = computeHeat({
            baseline: base({ archetype, line_pattern }), events: [],
            signals: sig({ count15: 3, count45: 5, count90: 7, vibeTally: { packed: 2 } }),
            now: new Date(2026, 6, 25, h, 0), hours: OPEN_ALWAYS,
          });
          expect(r.score).toBeGreaterThanOrEqual(0);
          expect(r.score).toBeLessThanOrEqual(100);
          expect(r.lineRisk).toBeGreaterThanOrEqual(0);
          expect(r.lineRisk).toBeLessThanOrEqual(100);
          expect(r.confidence).toBeGreaterThanOrEqual(0);
          expect(r.confidence).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("pattern none never produces line risk at any hour or heat", () => {
    for (let h = 0; h < 24; h++) {
      const r = computeHeat({
        baseline: base({ line_pattern: "none" }), events: [],
        signals: sig({ count15: 20, count45: 20, count90: 20, vibeTally: { line_outside: 9 } }),
        now: new Date(2026, 6, 25, h, 0), hours: OPEN_ALWAYS,
      });
      expect(r.lineRisk).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- golden`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement the orchestrator**

Create `src/lib/heat/index.ts`:

```ts
/**
 * The heat engine's only public entry point.
 *
 * Pure: no network, no React, no clock reads. `now` is always supplied by the
 * caller, which is what makes every golden case reproducible.
 */
import { computeOpenState } from "@/data/enrichment";
import { WeeklyPeriod } from "@/data/enrichment/types";
import { baselineScore } from "@/lib/heat/baseline";
import { blendScore } from "@/lib/heat/blend";
import { confidenceScore } from "@/lib/heat/confidence";
import { lineRisk } from "@/lib/heat/line";
import { scoreLabel } from "@/lib/heat/labels";
import { HeatResult, LiveSignals, VenueBaseline, WeeklyEvent } from "@/lib/heat/types";

export type HeatInput = {
  baseline: VenueBaseline;
  events: WeeklyEvent[];
  signals: LiveSignals;
  now: Date;
  /** Google hours. Undefined means "unknown", which is treated as open. */
  hours: WeeklyPeriod[] | undefined;
};

/** Above this, the card shows "Line likely". */
const LINE_LIKELY_THRESHOLD = 50;

const CLOSED: HeatResult = {
  score: 0,
  label: "Closed",
  lineRisk: 0,
  lineLikely: false,
  pastPeak: false,
  confidence: 0,
  liveWeight: 0,
  baselineScore: 0,
};

function nightMinutes(now: Date): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < 5 ? m + 1440 : m;
}

export function computeHeat(input: HeatInput): HeatResult {
  const { baseline, events, signals, now, hours } = input;

  // Closed check runs first and short-circuits everything. A heat score on a
  // shut bar is the most visible possible bug.
  const openState = computeOpenState(hours, now);
  if (openState && !openState.open) return { ...CLOSED };

  const base = baselineScore(baseline, events, now);
  const { score, liveWeight } = blendScore(base, signals);
  const risk = lineRisk(baseline, score, signals, now);
  const confidence = confidenceScore(baseline, signals);

  const min = nightMinutes(now);
  const pastPeak =
    baseline.peak_end != null && min >= baseline.peak_end && score >= 30;

  return {
    score,
    label: scoreLabel(score),
    lineRisk: risk,
    lineLikely: risk >= LINE_LIKELY_THRESHOLD,
    pastPeak,
    confidence,
    liveWeight,
    baselineScore: base,
  };
}

export type { HeatResult, LiveSignals, VenueBaseline, WeeklyEvent } from "@/lib/heat/types";
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- golden`
Expected: PASS. If the Nowhere case fails, raise `EVENT_BUMP` in `baseline.ts` until it passes — that case is the spec's stated acceptance criterion for event bumps being able to invert a day-shape.

- [ ] **Step 5: Remove the smoke test**

```bash
rm src/lib/heat/smoke.test.ts
```

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test`
Expected: PASS, all files.

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: builds clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/heat/index.ts src/lib/heat/golden.test.ts
git rm --cached src/lib/heat/smoke.test.ts 2>/dev/null || true
git commit -m "feat(heat): computeHeat orchestrator with golden cases"
```

---

## Definition of done

- [ ] `npm test` passes with every test above green
- [ ] `npx tsc --noEmit -p tsconfig.app.json` reports no errors
- [ ] `npm run build` succeeds
- [ ] All 56 live venues have a baseline record with an archetype and a line_pattern
- [ ] No file in `src/lib/heat/` imports React, calls `fetch`, or constructs `new Date()` without an argument
- [ ] No UI file has been modified — this plan touches no components

## What comes next

Slice 2 (map wiring), slice 3 (card Activity section, copy state machine, removing the raw `buzz_score` exposures at `BarCard.tsx:100` and `VenueStatTiles.tsx:17`), and slice 4 (feedback prompt and the additive DDL) each get their own plan, written against the `computeHeat()` signature this plan establishes.
