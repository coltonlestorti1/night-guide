# LogNightSheet Implementation Plan (§34)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Beli-shaped sheet behind every night-logging entry point, so ranking a spot from the map finally asks which night you went and produces a real post.

**Architecture:** Decision logic is extracted into a pure, unit-tested module (`src/lib/night/logNight.ts`); the sheet is a row-stack UI built from a small presentational row primitive and a bucket-circle picker. `PublishForm` becomes the sheet body. `RateSteps` is narrowed to comparisons only, and its bucket picker moves out into the shared `BucketCircles` component that both the sheet and `RateSheet` render.

**Tech Stack:** React 18, TypeScript, Tailwind, shadcn/ui, vaul drawers, TanStack Query, Supabase, Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-12-log-night-sheet-design.md`. It is the authority; this plan implements it.
- **Worktree:** `~/Documents/night-guide/.claude/worktrees/log-night`, branch `feat/log-night-sheet`. **`cd` to that absolute path inside every Bash call.** Never touch `~/Documents/night-guide` itself — other sessions share it.
- **No DDL, no schema changes, no new columns, no policy changes.** If a task seems to need one, stop and report.
- **Tests are `src/**/*.test.ts` only.** vitest runs `environment: "node"` with no jsdom and no testing-library. **Do not add a component-test toolchain.** Logic worth testing goes in `src/lib/night/`; components stay thin.
- **Stored bucket names and `BUCKET_LABELS` do not change.** `Bucket` stays `"great" | "good" | "not_great"`. Friendly copy is picker-only.
- **`not_great` is never red.** Muted fill + dashed border, per the decision documented at the top of `src/components/lists/ScoreBadge.tsx`.
- **Touch targets ≥ 44px** on anything tappable.
- **One vaul drawer alive per flow.** `AddNightSheet` and `PublishSheet` document why; do not introduce a second nested drawer.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- Commit after every task. Do not push until the final verification task.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/night/logNight.ts` **(new)** | Pure logic: night chips, the re-rate decision, picker copy. |
| `src/lib/night/logNight.test.ts` **(new)** | Its tests. |
| `src/components/night/BucketCircles.tsx` **(new)** | The three how-was-it circles. Controlled, presentational. |
| `src/components/night/LogRow.tsx` **(new)** | One collapsible row: icon, label, chevron, inline summary, expands in place. |
| `src/components/night/RateSteps.tsx` | Narrowed to comparisons only; takes a required `bucket`. |
| `src/components/night/RateSheet.tsx` | Owns bucket state, renders `BucketCircles` + `RateSteps`. Still the "Rank again" path. |
| `src/components/night/PublishForm.tsx` | Becomes the sheet body: circles + row stack + Post. |
| `src/components/night/AddNightSheet.tsx` | Loses its night step; step 1 becomes spot search only. |
| `src/components/lists/VenueRatingRow.tsx` | "Been here? / Log the night" and "Log another night". |

---

### Task 1: Pure logic module

**Files:**
- Create: `src/lib/night/logNight.ts`
- Create: `src/lib/night/logNight.test.ts`

**Interfaces:**
- Consumes: `Bucket` from `@/lib/night/ranking`, `nightDateOf`/`lastCompletedNightDate` from `@/lib/night/window`.
- Produces:
  - `nightChoices(now?: Date): { value: string; label: string }[]`
  - `ratingAction(selected: Bucket | null, existing: Bucket | undefined): "skip" | "rank"`
  - `PICKER_LABELS: Record<Bucket, string>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/night/logNight.test.ts
import { describe, it, expect } from "vitest";
import { nightChoices, ratingAction, PICKER_LABELS } from "./logNight";
import { lastCompletedNightDate, nightDateOf } from "./window";

describe("nightChoices", () => {
  it("offers Tonight during the night window", () => {
    const at11pm = new Date(2026, 7, 12, 23, 0);
    const labels = nightChoices(at11pm).map((c) => c.label);
    expect(labels[0]).toBe("Tonight");
    expect(nightChoices(at11pm)[0].value).toBe(nightDateOf(at11pm));
  });

  it("offers Tonight in the small hours, which are still that night", () => {
    const at2am = new Date(2026, 7, 12, 2, 0);
    expect(nightChoices(at2am)[0].label).toBe("Tonight");
  });

  it("does NOT offer Tonight at midday — that night has not happened", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    expect(nightChoices(atNoon).map((c) => c.label)).not.toContain("Tonight");
  });

  it("always offers Last night, and it is the last completed night", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    const first = nightChoices(atNoon)[0];
    expect(first.label).toBe("Last night");
    expect(first.value).toBe(lastCompletedNightDate(atNoon));
  });

  it("adds three earlier weekdays, newest first, with no duplicate dates", () => {
    const atNoon = new Date(2026, 7, 12, 12, 0);
    const values = nightChoices(atNoon).map((c) => c.value);
    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(values.length);
    expect([...values]).toEqual([...values].sort().reverse());
  });

  it("never offers a future night", () => {
    const at11pm = new Date(2026, 7, 12, 23, 0);
    const today = nightDateOf(at11pm);
    for (const c of nightChoices(at11pm)) expect(c.value <= today).toBe(true);
  });
});

describe("ratingAction", () => {
  it("skips when no bucket was selected", () => {
    expect(ratingAction(null, undefined)).toBe("skip");
    expect(ratingAction(null, "great")).toBe("skip");
  });

  it("ranks a bucket chosen on a venue that has never been rated", () => {
    expect(ratingAction("great", undefined)).toBe("rank");
  });

  it("skips when the chosen bucket matches the existing rating", () => {
    // Logging a second night at a place you already love must not cost you
    // the head-to-heads again.
    expect(ratingAction("great", "great")).toBe("skip");
    expect(ratingAction("not_great", "not_great")).toBe("skip");
  });

  it("ranks when the chosen bucket differs — that is a deliberate re-rate", () => {
    expect(ratingAction("great", "good")).toBe("rank");
    expect(ratingAction("not_great", "great")).toBe("rank");
  });
});

describe("PICKER_LABELS", () => {
  it("covers every bucket and does not restate the stored names", () => {
    expect(PICKER_LABELS.great).toBe("Loved it");
    expect(PICKER_LABELS.good).toBe("It was ok");
    expect(PICKER_LABELS.not_great).toBe("Not for me");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx vitest run src/lib/night/logNight.test.ts`
Expected: FAIL — cannot resolve `./logNight`.

- [ ] **Step 3: Write the implementation**

`nightChoices` is **moved verbatim** from `AddNightSheet.tsx` (its `nightChoices` + `isoDate` helpers), not rewritten — it is existing shipped behaviour that simply had no home where it could be tested.

```ts
// src/lib/night/logNight.ts
/**
 * Pure decisions behind logging a night.
 *
 * These live here rather than in the sheet because they are the parts worth
 * testing: this repo has no component-test toolchain (vitest runs in `node`
 * with no jsdom), so anything that encodes a rule belongs in lib/ where it can
 * actually be asserted on.
 */
import type { Bucket } from "@/lib/night/ranking";
import { lastCompletedNightDate, nightDateOf, NIGHT_START_HOUR, NIGHT_END_HOUR } from "@/lib/night/window";

/** Local-time YYYY-MM-DD. Never toISOString() — that shifts the day for
 *  anyone west of UTC, which is everyone using this app. */
const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Quick night choices, newest first. Value is a night-date.
 *
 * Moved out of AddNightSheet unchanged. "Tonight" is only offered while a night
 * is actually in progress — offering it at 11am would invite logging a night
 * that has not happened yet.
 */
export function nightChoices(now: Date = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];

  const hour = now.getHours();
  if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) {
    out.push({ value: nightDateOf(now), label: "Tonight" });
  }

  const last = lastCompletedNightDate(now);
  out.push({ value: last, label: "Last night" });

  const [y, m, d] = last.split("-").map(Number);
  for (let back = 1; back <= 3; back++) {
    const prev = new Date(y, m - 1, d - back);
    out.push({
      value: isoDate(prev),
      label: prev.toLocaleDateString(undefined, { weekday: "long" }),
    });
  }
  return out;
}

/** Friendly copy for the circles. The STORED bucket names are unchanged —
 *  BUCKET_LABELS still drives lists, badges and every existing test. */
export const PICKER_LABELS: Record<Bucket, string> = {
  great: "Loved it",
  good: "It was ok",
  not_great: "Not for me",
};

/**
 * What Post should do about the rating.
 *
 * "skip" — publish and stop. Either nothing was selected, or the selection
 * matches what the venue is already rated: a second night at a place you
 * already ranked must not make you re-answer the head-to-heads.
 * "rank" — run the comparisons. A first rating, or a deliberate change of
 * bucket (useSaveRating reindexes the old bucket in that case).
 */
export function ratingAction(
  selected: Bucket | null,
  existing: Bucket | undefined,
): "skip" | "rank" {
  if (!selected) return "skip";
  return selected === existing ? "skip" : "rank";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx vitest run src/lib/night/logNight.test.ts`
Expected: PASS, 12 tests.

Note: `nightChoices` at 4 entries assumes `lastCompletedNightDate` returns yesterday's night-date at midday. If the "no duplicate dates" or length assertion fails, read `src/lib/night/window.ts` and fix the **test's** expectation to match shipped behaviour — do not change `window.ts`.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/night-guide/.claude/worktrees/log-night
git add src/lib/night/logNight.ts src/lib/night/logNight.test.ts
git commit -m "Extract the night-logging decisions into a testable module"
```

---

### Task 2: `BucketCircles` and the narrowed `RateSteps`

**Files:**
- Create: `src/components/night/BucketCircles.tsx`
- Modify: `src/components/night/RateSteps.tsx` (remove the bucket picker; require a `bucket` prop)
- Modify: `src/components/night/RateSheet.tsx` (own the bucket state; render both)

**Interfaces:**
- Consumes: `PICKER_LABELS` from Task 1.
- Produces:
  - `<BucketCircles value={Bucket | null} onChange={(b: Bucket) => void} disabled?: boolean />`
  - `<RateSteps venue={Venue} bucket={Bucket} onDone={(rated: boolean) => void} />` — **`bucket` is now required and `prompt`/`compact` are gone.**

- [ ] **Step 1: Write `BucketCircles`**

```tsx
// src/components/night/BucketCircles.tsx
/**
 * "How was it?" — three circles, Beli's form in ENDZ's tones.
 *
 * not_great is muted with a dashed border and NEVER red: this is the user's own
 * private ranking of a real business, and a red option editorialises. That is
 * the same decision ScoreBadge documents, and the two must not drift.
 *
 * Selecting does not advance a step. It selects, and stays re-tappable until
 * Post — the comparisons run afterwards.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUCKET_LABELS, type Bucket } from "@/lib/night/ranking";
import { PICKER_LABELS } from "@/lib/night/logNight";

const BUCKETS: Bucket[] = ["great", "good", "not_great"];

const TONE: Record<Bucket, { on: string; off: string }> = {
  great: {
    on: "bg-primary border-primary text-primary-foreground",
    off: "bg-primary/15 border-primary/40 text-primary",
  },
  good: {
    on: "bg-amber-400 border-amber-400 text-[#121212]",
    off: "bg-amber-400/15 border-amber-400/40 text-amber-300",
  },
  not_great: {
    on: "bg-muted border-dashed border-muted-foreground text-foreground",
    off: "bg-muted/40 border-dashed border-border text-muted-foreground",
  },
};

export default function BucketCircles({
  value,
  onChange,
  disabled = false,
}: {
  value: Bucket | null;
  onChange: (b: Bucket) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-around gap-2 py-1">
      {BUCKETS.map((b) => {
        const on = value === b;
        return (
          <button
            key={b}
            type="button"
            disabled={disabled}
            onClick={() => onChange(b)}
            aria-pressed={on}
            aria-label={BUCKET_LABELS[b]}
            className="flex min-w-0 flex-1 flex-col items-center gap-2 disabled:opacity-50"
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all",
                on ? TONE[b].on : TONE[b].off,
                on && "scale-105",
              )}
            >
              {on && <Check className="h-6 w-6" aria-hidden="true" />}
            </span>
            <span
              className={cn(
                "text-center text-xs leading-tight",
                on ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {PICKER_LABELS[b]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Narrow `RateSteps` to comparisons only**

Replace `src/components/night/RateSteps.tsx` entirely:

```tsx
/**
 * The head-to-head comparisons, and nothing else.
 *
 * The bucket picker used to live here and now lives in BucketCircles, because
 * two callers need the bucket BEFORE this runs: the log sheet collects it with
 * the rest of the night, and RateSheet asks for it on its own screen. A bucket
 * is therefore a required input here, not something this component discovers.
 *
 * People are bad at absolute ratings and good at comparisons, which is why a
 * score is never asked for directly. Comparisons never cross buckets, so a
 * venue you loved is never weighed against one you disliked.
 */
import { useMemo, useState } from "react";
import { Venue } from "@/data/types";
import { Button } from "@/components/ui/button";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings, useSaveRating } from "@/hooks/useMyRatings";
import { orderOf } from "@/lib/night/ratings";
import { nextComparison, type Bucket } from "@/lib/night/ranking";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";

export default function RateSteps({
  venue,
  bucket,
  onDone,
}: {
  venue: Venue;
  bucket: Bucket;
  /** Called once a rating is saved. */
  onDone: (rated: boolean) => void;
}) {
  const { data: rows } = useMyRatings();
  const { data: venues } = useVenues({});
  const save = useSaveRating();

  const order = useMemo(
    () => orderOf(rows ?? [], bucket).filter((id) => id !== venue.id),
    [rows, bucket, venue.id],
  );

  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(() => order.length);

  const nameOf = (id: string) => venues?.find((v) => v.id === id)?.title ?? "that spot";

  const commit = async (index: number) => {
    try {
      await save.mutateAsync({ venueId: venue.id, bucket, index, allRows: rows ?? [] });
      logEvent("venue_rated", { venue_id: venue.id, bucket, position: index });
      onDone(true);
    } catch {
      toast.error("Couldn't save that rating. Try again.");
    }
  };

  const comparison = nextComparison(order, lo, hi);

  /**
   * Narrow the range, and commit the moment it collapses. Deliberately not an
   * effect watching `comparison`: an effect would re-fire on any render while
   * the save was in flight, and the second commit could land against a
   * refetched list with a different index.
   */
  const answer = (newOneIsBetter: boolean) => {
    if (!comparison) return;
    const at = order.indexOf(comparison.venueId);
    const nextLo = newOneIsBetter ? lo : at + 1;
    const nextHi = newOneIsBetter ? at : hi;

    if (!nextComparison(order, nextLo, nextHi)) {
      void commit(nextLo);
      return;
    }
    setLo(nextLo);
    setHi(nextHi);
  };

  // First in this bucket: nothing to compare against, so it lands at the band
  // midpoint. Rendered as a single confirm rather than auto-committing on
  // mount — an effect here would fire twice under StrictMode.
  if (!comparison) {
    return (
      <>
        <p className="text-sm font-semibold mb-1">First one in this group.</p>
        <p className="text-sm text-muted-foreground mb-3">
          Nothing to compare it against yet — we&apos;ll place it for now.
        </p>
        <Button
          className="w-full h-12 rounded-xl text-base"
          disabled={save.isPending}
          onClick={() => void commit(0)}
        >
          Save it
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="text-sm font-semibold mb-1">Which was better?</p>
      <p className="text-sm text-muted-foreground mb-3">
        A couple of these and we&apos;ll know where it sits.
      </p>
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="w-full h-12 rounded-xl text-base"
          disabled={save.isPending}
          onClick={() => answer(true)}
        >
          {venue.title}
        </Button>
        <Button
          variant="secondary"
          className="w-full h-12 rounded-xl text-base"
          disabled={save.isPending}
          onClick={() => answer(false)}
        >
          {nameOf(comparison.venueId)}
        </Button>
      </div>
    </>
  );
}
```

**Watch this:** `hi` is seeded from `order.length` via a lazy initialiser, which only runs on first render. `order` is empty until `useMyRatings` resolves. Guard it — if `order.length > 0` and `hi === 0` and `lo === 0`, seed `hi` to `order.length` on the fly rather than trusting mount order. Add this line directly above `const comparison = ...`:

```tsx
  // useMyRatings may resolve AFTER first paint, so the lazy initialiser above
  // can have seeded hi from an empty list. Re-seed the moment the real order
  // arrives, before any comparison is derived from it.
  const effectiveHi = hi === 0 && lo === 0 && order.length > 0 ? order.length : hi;
```

then use `effectiveHi` in place of `hi` in both `nextComparison(order, lo, ...)` calls and in `answer`'s `nextHi` default.

- [ ] **Step 3: Rewire `RateSheet` to own the bucket**

```tsx
// src/components/night/RateSheet.tsx
/**
 * RateSheet — rank a spot and nothing else. Reached from "Rank again" on a list
 * row and from the recap.
 *
 * This is deliberately NOT the log sheet: re-ranking is not a new night, and it
 * must not produce a post. The log sheet (PublishForm) is the other path.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import BucketCircles from "@/components/night/BucketCircles";
import RateSteps from "@/components/night/RateSteps";
import { type Bucket } from "@/lib/night/ranking";

export default function RateSheet({
  venue,
  open,
  onOpenChange,
}: {
  venue: Venue;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [bucket, setBucket] = useState<Bucket | null>(null);

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) setBucket(null);
        onOpenChange(o);
      }}
    >
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">Rate {venue.title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick how it was, then compare it against places you've already rated.
        </DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <h2 className="text-lg font-display font-bold">How was {venue.title}?</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Just your take — only you can see this.
          </p>
          {bucket ? (
            <RateSteps venue={venue} bucket={bucket} onDone={() => onOpenChange(false)} />
          ) : (
            <BucketCircles value={null} onChange={setBucket} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 4: Fix the one remaining caller and typecheck**

`PublishForm.tsx:246` still calls `<RateSteps venue={venue} prompt="" onDone={...} />`. Task 4 rewrites that file; for now make it compile by passing a bucket held in local state there. Then:

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
Expected: no type errors; all existing tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/night-guide/.claude/worktrees/log-night
git add src/components/night/BucketCircles.tsx src/components/night/RateSteps.tsx src/components/night/RateSheet.tsx src/components/night/PublishForm.tsx
git commit -m "Split the bucket picker out of the comparison steps"
```

---

### Task 3: The `LogRow` primitive

**Files:**
- Create: `src/components/night/LogRow.tsx`

**Interfaces:**
- Produces: `<LogRow icon={LucideIcon} label={string} summary?: ReactNode open={boolean} onToggle={() => void}>{children}</LogRow>`

- [ ] **Step 1: Write it**

```tsx
// src/components/night/LogRow.tsx
/**
 * One row of the log sheet: a tappable header that expands its content in
 * place, with an inline summary of what is already filled in.
 *
 * The summary is what makes the collapsed sheet readable as a preview of the
 * post you are about to make — a row with a value shows the value, not the
 * prompt. Everything here is optional, which is why nothing is a required step.
 */
import { type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LogRow({
  icon: Icon,
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Rendered under the label when collapsed. Chips, a date, an audience. */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3 text-left min-h-11"
      >
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {!open && summary && (
            <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx tsc --noEmit -p tsconfig.app.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd ~/Documents/night-guide/.claude/worktrees/log-night
git add src/components/night/LogRow.tsx
git commit -m "Add the collapsible row primitive for the log sheet"
```

---

### Task 4: Rebuild `PublishForm` as the log sheet body

**Files:**
- Modify: `src/components/night/PublishForm.tsx` (the bulk of the work)

**Interfaces:**
- Consumes: `BucketCircles`, `LogRow`, `RateSteps` (Task 2/3), `nightChoices` + `ratingAction` (Task 1), `NightDateField`.
- Produces: `<PublishForm venue nightDate onNightDateChange? nightEditable? onDone onBack? onPickingChange? />`

**Preserve exactly, do not rewrite:** the pending-photo upload/orphan-cleanup logic and its `pendingRef` unmount cleanup, `beginPick`'s focus guard, the `Promise.allSettled` tag writes, the link check, the 280-char cap, `doDelete`, and the `useEffect` that re-seeds note/audience/tags per venue. These carry hard-won bug fixes; the comments on them explain why.

**Required changes:**

1. **New props:** `nightEditable?: boolean` (default `false`) and `onNightDateChange?: (d: string) => void`. When `nightEditable` is false the night row is not rendered — the recap and the edit path both fix the night, because the upsert key is `(user_id, venue_id, night_date)` and changing it would silently create a second post.
2. **Bucket state:** `const [bucket, setBucket] = useState<Bucket | null>(null)`, seeded from the venue's existing rating: `ratingFor(ratings, venue.id)?.bucket ?? null`. Seed it in the same `useEffect` that re-seeds note and audience, keyed on `[venue.id, nightDate]`.
3. **Re-seed on night change:** that effect's dependency array **already** includes `nightDate`, and `useMyPostsForNight(nightDate)` already refetches. Confirm the note/audience/photos actually clear when the night row changes to a night with no post — this is the trap called out in spec §6.
4. **Layout:** replace the current stacked form with the sheet layout —
   - header: `venue.title`, then `CATEGORY · neighborhood` (reuse the pill styling from `VenuePreview.tsx:147-157`);
   - `<BucketCircles value={bucket} onChange={setBucket} />` under a centered "How was it?";
   - a `<LogRow>` stack, in this order: **Who were you with?** (the existing friend chips), **Add a note** (the existing textarea + counter + link warning), **Add photos** (the existing photo grid), **Which night?** (only when `nightEditable`: the `nightChoices` chips + `NightDateField`), **Who can see this?** (the existing audience chips);
   - the existing Back/Post buttons and the Delete post button.
   - Row summaries: names of tagged friends, the note's first line, "N photos", the night's label, the audience's `AUDIENCE_SHORT`.
5. **`doPublish` ending:** replace the `if (myScore === null) setRateAfterPost(true)` branch with:

```tsx
      // Comparisons run AFTER the post, not on the bucket tap. Same bucket as
      // the existing rating means nothing to re-rank — see ratingAction.
      if (ratingAction(bucket, existingBucket) === "rank") setRateAfterPost(true);
      else onDone();
```
   where `existingBucket = ratingFor(ratings, venue.id)?.bucket`.
6. **The `rateAfterPost` screen** renders `<RateSteps venue={venue} bucket={bucket!} onDone={() => onDone()} />` under "Posted. Where does it sit?", keeping the existing Skip button.
7. **`score` passed to `publish.mutateAsync`** stays `myScore` (the rating as it stands *now*). A rating created by the comparisons that follow updates the post through the existing `sync_night_post_score` trigger plus `useSaveRating`'s cache invalidation — do not try to pass a score that does not exist yet.

- [ ] **Step 1: Make the changes above**
- [ ] **Step 2: Typecheck and test**

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
cd ~/Documents/night-guide/.claude/worktrees/log-night
git add src/components/night/PublishForm.tsx
git commit -m "Rebuild the publish form as the Beli-shaped log sheet"
```

---

### Task 5: Entry points

**Files:**
- Modify: `src/components/night/AddNightSheet.tsx`
- Modify: `src/components/night/PublishSheet.tsx`
- Modify: `src/components/lists/VenueRatingRow.tsx`

- [ ] **Step 1: `AddNightSheet` — drop the night step**

Delete its local `nightChoices` and `isoDate` (now in `logNight.ts`), delete the "Which night?" chips and the `NightDateField` from step 1, and keep `nightDate` state so it can be passed down and changed from inside the sheet:

```tsx
<PublishForm
  onPickingChange={setPicking}
  venue={venue}
  nightDate={nightDate}
  nightEditable
  onNightDateChange={setNightDate}
  onDone={close}
  onBack={() => setVenue(null)}
/>
```

Step 1's heading becomes "Add a night" / "Where did you go?" with just the search field and results.

- [ ] **Step 2: `PublishSheet` — allow the map entry to edit the night**

Add a `nightEditable?: boolean` prop, defaulting to `false`, forwarded to `PublishForm` along with an internal `nightDate` state seeded from the `nightDate` prop so the map path can change it. `PostCard`'s edit call and `RecapCard`'s call pass nothing, so both stay locked — which is what their existing comments require.

- [ ] **Step 3: `VenueRatingRow` — new copy and two intentions**

- Unrated: title **"Been here?"**, subtitle **"Log the night — you choose who sees it."**, button **"Log the night"**. Delete the "only you can see this" line: it is no longer true of what the button does.
- Rated: keep the `ScoreBadge` and "#N on your list"; primary button becomes **"Log another night"**.
- Both open `<PublishSheet venue={venue} nightDate={lastCompletedNightDate()} nightEditable open onOpenChange={setOpen} />` instead of `RateSheet`.
- `ListRowMenu`'s "Rank again" keeps opening `RateSheet` — unchanged, and now the only thing that means re-rank.

- [ ] **Step 4: Typecheck, lint, full test run**

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/night-guide/.claude/worktrees/log-night
git add src/components/night/AddNightSheet.tsx src/components/night/PublishSheet.tsx src/components/lists/VenueRatingRow.tsx
git commit -m "Point every logging entry point at the one sheet"
```

---

### Task 6: Verification

**Files:** none — this task proves the work.

- [ ] **Step 1: The full gate**

Run: `cd ~/Documents/night-guide/.claude/worktrees/log-night && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build && npm run check:schema`
Expected: all green. Record the test count.

- [ ] **Step 2: Look at it, at phone size**

`npm run dev`, then drive Chrome with chrome-devtools-mcp. **`emulate` with `390x844x3, mobile, touch`** — macOS will not size a real Chrome window below ~500px, so window resizing cannot find phone-width bugs.

Walk and screenshot: map → a venue → **Log the night** → the sheet. Confirm: all five rows present and expanding in place; the night row **exists and is changeable** (the reported bug); no horizontal scroll on the page; the three circles are distinguishable from each other when unselected; `not_great` is not red.

- [ ] **Step 3: Prove the actual bug is fixed**

Sign in on the dev server, log a night from the map with a night that is **not** today, then check Profile → Activity shows the post against that night. This is acceptance criteria 1 and 2 and cannot be proved by unit tests.

- [ ] **Step 4: Commit any fixes, then push**

```bash
cd ~/Documents/night-guide/.claude/worktrees/log-night
git fetch
git rev-list --left-right --count origin/main...HEAD   # confirm 0 behind
git push -u origin feat/log-night-sheet
```

---

## Self-Review

**Spec coverage:** §1 sheet → Tasks 3+4. §2 circles → Task 2. §3 flow/entry points → Tasks 4+5. §4 audience default and copy → Task 5 step 3. §5 two intentions → Task 5 step 3 + `ListRowMenu` unchanged. §6 data model + the upsert re-seed trap → Task 4 items 1 and 3. §7 tests → Task 1 (the testable rules) and Task 6 (everything a node-environment test cannot reach). §8 acceptance → Task 6.

**Known gap, stated rather than hidden:** spec §7 lists behavioural assertions ("post with no bucket writes no rating", "edit mode locks the night") that would need component tests. This repo has no toolchain for those, and adding one is out of scope. They are covered by `ratingAction`'s unit tests where the rule is pure, and by manual verification in Task 6 where it is not.
