# Night Feed — Slice 1: rating engine + private recap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user opens ENDZ the morning after and sees where they went last night, and can rate each venue Great / Good / Not great — with head-to-head comparisons once a bucket has company — producing a durable ranked list in `venue_ratings`.

**Architecture:** All grouping and ranking logic lives in pure, dependency-free functions under `src/lib/night/` so it is unit-testable without a database. The data layer mirrors `src/lib/saves.ts` — plain async functions, RLS as the only privacy boundary, reads through React Query hooks. Nothing in this slice is visible to any other user.

**Tech Stack:** TypeScript, React, React Query, Supabase (Postgres + RLS), vitest, Tailwind + shadcn/ui.

## Scope

This is **slice 1 of 3** from `docs/superpowers/specs/2026-08-06-night-feed-design.md`. It was split because the spec covers three separately shippable subsystems:

| Slice | Contents | Status |
|---|---|---|
| **1 — this plan** | Night grouping, `venue_ratings`, bucket + comparison engine, private recap UI | Ready |
| 2 | `night_posts`, the feed, school-scoped visibility, moderation | Not yet planned |
| 3 | Photos (`night_post_photos`, storage bucket, EXIF-safe upload) | Not yet planned |

Slice 1 produces working, independently valuable software: it **banks the rating signal** that §3 will later read, which was the reason for building this before the scorer.

## Global Constraints

- **Nothing in this slice is readable by another user.** No policy on any new table may grant SELECT to anyone but the owner. Slice 2 introduces sharing.
- **Do not modify `check_ins` policies.** The 2026-08-05 RLS time-bound fix is a launch gate; this slice reads own rows only, which existing policy already permits (`auth.uid() = user_id`).
- **Do not widen `CheckinVisibility`.** It keeps its three values. Post visibility is a separate union introduced in slice 2.
- **Night window:** 18:00–06:00, dated to the evening it began.
- **Score bands, fixed:** Great `6.7–10.0`, Good `3.4–6.6`, Not great `0.0–3.3`.
- **Bucket labels, exact user-facing copy:** `Great`, `Good`, `Not great`.
- **Timestamps set by trigger, never client-written** — matches the existing `vibe_at` rule.
- **DDL is never applied by an engineer.** It goes to `scripts/`, Colton pastes it into the Supabase SQL editor, and is recorded in `~/Documents/endz/endz-schema.sql`.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op).
- Tests: `npm test` (`vitest run`).

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/night/window.ts` | Night boundaries and night-date derivation. Pure. |
| `src/lib/night/window.test.ts` | Tests for the above. |
| `src/lib/night/ranking.ts` | Buckets, score bands, comparison insertion, score derivation. Pure. |
| `src/lib/night/ranking.test.ts` | Tests for the above. |
| `src/lib/night/ratings.ts` | `venue_ratings` data layer. Supabase only. |
| `src/lib/night/recap.ts` | Reads the signed-in user's own check-ins for one night. |
| `src/hooks/useNightRecap.ts` | React Query wrapper for the recap. |
| `src/hooks/useMyRatings.ts` | React Query wrapper for the ranked list + mutation. |
| `src/components/night/RateSheet.tsx` | Bucket pick → comparison loop → save. |
| `src/components/night/RecapCard.tsx` | "Last night · N spots" entry point. |
| `scripts/2026-08-06-night-ratings-ddl.sql` | `venue_ratings` table, RLS, trigger. |

Pure logic is split from the data layer so the ranking engine — the part with real edge cases — is testable with no network and no mocks, matching how `src/lib/heat/` is organised.

---

### Task 1: Night window

**Files:**
- Create: `src/lib/night/window.ts`
- Test: `src/lib/night/window.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `nightDateOf(d: Date): string` returning `YYYY-MM-DD`; `nightRange(nightDate: string): { start: Date; end: Date }`; `NIGHT_START_HOUR = 18`, `NIGHT_END_HOUR = 6`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { nightDateOf, nightRange } from "./window";

describe("nightDateOf", () => {
  it("dates an evening check-in to that same day", () => {
    expect(nightDateOf(new Date("2026-08-03T22:15:00"))).toBe("2026-08-03");
  });

  it("dates an after-midnight check-in to the evening it began", () => {
    expect(nightDateOf(new Date("2026-08-04T01:30:00"))).toBe("2026-08-03");
  });

  it("treats 6am as the end of the night, not the start of one", () => {
    expect(nightDateOf(new Date("2026-08-04T05:59:00"))).toBe("2026-08-03");
    expect(nightDateOf(new Date("2026-08-04T06:00:00"))).toBe("2026-08-04");
  });

  it("dates a daytime check-in to that day", () => {
    expect(nightDateOf(new Date("2026-08-04T13:00:00"))).toBe("2026-08-04");
  });

  it("rolls a month boundary backwards correctly", () => {
    expect(nightDateOf(new Date("2026-09-01T02:00:00"))).toBe("2026-08-31");
  });
});

describe("nightRange", () => {
  it("spans 6pm to 6am the following morning", () => {
    const { start, end } = nightRange("2026-08-03");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(3);
    expect(start.getHours()).toBe(18);
    expect(end.getDate()).toBe(4);
    expect(end.getHours()).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/night/window.test.ts`
Expected: FAIL — cannot resolve `./window`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Night boundaries. A "night" runs 18:00 → 06:00 and is dated to the evening
 * it began, so a 01:30 Tuesday check-in belongs to Monday night.
 *
 * Pure and local-time by design: a night is a human thing, anchored to where
 * the user physically is, not to UTC.
 */
export const NIGHT_START_HOUR = 18;
export const NIGHT_END_HOUR = 6;

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** The night-date a moment belongs to, as YYYY-MM-DD. */
export function nightDateOf(d: Date): string {
  if (d.getHours() < NIGHT_END_HOUR) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return iso(prev);
  }
  return iso(d);
}

/** The half-open [start, end) window covered by a night-date. */
export function nightRange(nightDate: string): { start: Date; end: Date } {
  const [y, m, day] = nightDate.split("-").map(Number);
  const start = new Date(y, m - 1, day, NIGHT_START_HOUR, 0, 0, 0);
  const end = new Date(y, m - 1, day + 1, NIGHT_END_HOUR, 0, 0, 0);
  return { start, end };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/night/window.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/night/window.ts src/lib/night/window.test.ts
git commit -m "feat(night): night-window grouping, 6pm-6am dated to the evening"
```

---

### Task 2: Ranking engine

**Files:**
- Create: `src/lib/night/ranking.ts`
- Test: `src/lib/night/ranking.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Bucket = "great" | "good" | "not_great"`
  - `BUCKET_LABELS: Record<Bucket, string>` — exact user-facing copy
  - `BANDS: Record<Bucket, { lo: number; hi: number }>`
  - `scoreFor(bucket: Bucket, rankPosition: number, bucketSize: number): number`
  - `nextComparison(sorted: string[], lo: number, hi: number): { venueId: string; lo: number; hi: number } | null`
  - `insertAt(sorted: string[], venueId: string, index: number): string[]`

**Comparison rule (resolves a spec ambiguity):** comparisons run when the chosen bucket already contains **at least one other** venue. A bucket's first entry takes the band midpoint. This is what "your first few ratings are simple" means in practice — the spec's "from the 4th rating" phrasing breaks when a 4th rating is the first in its bucket.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { scoreFor, nextComparison, insertAt, BANDS, BUCKET_LABELS } from "./ranking";

describe("BUCKET_LABELS", () => {
  it("uses Colton's exact copy", () => {
    expect(BUCKET_LABELS.great).toBe("Great");
    expect(BUCKET_LABELS.good).toBe("Good");
    expect(BUCKET_LABELS.not_great).toBe("Not great");
  });
});

describe("scoreFor", () => {
  it("puts a lone entry at the band midpoint", () => {
    expect(scoreFor("great", 0, 1)).toBe(8.4);
    expect(scoreFor("good", 0, 1)).toBeCloseTo(5.0, 1);
    expect(scoreFor("not_great", 0, 1)).toBeCloseTo(1.7, 1);
  });

  it("spreads entries evenly, best first", () => {
    const top = scoreFor("great", 0, 2);
    const bottom = scoreFor("great", 1, 2);
    expect(top).toBeGreaterThan(bottom);
  });

  it("never leaves its band", () => {
    for (const size of [1, 2, 5, 20]) {
      for (let i = 0; i < size; i++) {
        const s = scoreFor("good", i, size);
        expect(s).toBeGreaterThanOrEqual(BANDS.good.lo);
        expect(s).toBeLessThanOrEqual(BANDS.good.hi);
      }
    }
  });

  it("keeps buckets from overlapping", () => {
    expect(scoreFor("good", 0, 5)).toBeLessThan(scoreFor("great", 4, 5));
    expect(scoreFor("not_great", 0, 5)).toBeLessThan(scoreFor("good", 4, 5));
  });
});

describe("nextComparison", () => {
  it("returns null for an empty bucket — nothing to compare against", () => {
    expect(nextComparison([], 0, 0)).toBeNull();
  });

  it("asks about the midpoint of the live range", () => {
    const c = nextComparison(["a", "b", "c"], 0, 3);
    expect(c?.venueId).toBe("b");
  });

  it("terminates once the range collapses", () => {
    expect(nextComparison(["a"], 1, 1)).toBeNull();
  });

  it("converges in at most ceil(log2(n)) + 1 questions", () => {
    const list = Array.from({ length: 16 }, (_, i) => `v${i}`);
    let lo = 0;
    let hi = list.length;
    let asked = 0;

    // Always answer "the new one is worse", which takes the lower half of the
    // ranking each time: lo moves past the midpoint, hi is unchanged.
    for (let c = nextComparison(list, lo, hi); c && asked < 20; c = nextComparison(list, lo, hi)) {
      asked++;
      lo = list.indexOf(c.venueId) + 1;
    }

    expect(asked).toBeLessThanOrEqual(5);
    expect(lo).toBe(list.length); // worse than everything -> last position
  });
});

describe("insertAt", () => {
  it("inserts without dropping anything", () => {
    expect(insertAt(["a", "c"], "b", 1)).toEqual(["a", "b", "c"]);
  });

  it("inserts at the head and the tail", () => {
    expect(insertAt(["a"], "z", 0)).toEqual(["z", "a"]);
    expect(insertAt(["a"], "z", 1)).toEqual(["a", "z"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/night/ranking.test.ts`
Expected: FAIL — cannot resolve `./ranking`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Rating buckets, in-bucket ranking, and the 0-10 score derived from them.
 *
 * The RANKING is the truth; the score is a rendering of it. Scores therefore
 * move as a bucket grows, which is expected and is why nothing persists a
 * score as an independent fact.
 *
 * Bands are fixed per bucket so a score can never migrate across a boundary
 * when a list is re-ranked. Comparisons only ever run inside one bucket, so a
 * venue you loved is never weighed against one you disliked.
 */
export type Bucket = "great" | "good" | "not_great";

export const BUCKET_LABELS: Record<Bucket, string> = {
  great: "Great",
  good: "Good",
  not_great: "Not great",
};

export const BANDS: Record<Bucket, { lo: number; hi: number }> = {
  great: { lo: 6.7, hi: 10.0 },
  good: { lo: 3.4, hi: 6.6 },
  not_great: { lo: 0.0, hi: 3.3 },
};

/**
 * Score for the entry at `rankPosition` (0 = best) among `bucketSize` entries.
 * A lone entry lands on the band midpoint; larger buckets spread evenly.
 */
export function scoreFor(bucket: Bucket, rankPosition: number, bucketSize: number): number {
  const { lo, hi } = BANDS[bucket];
  const n = Math.max(bucketSize, 1);
  const raw = hi - ((rankPosition + 0.5) * (hi - lo)) / n;
  return Math.round(raw * 10) / 10;
}

/**
 * Next head-to-head question for a binary insertion into `sorted` (best first),
 * over the half-open range [lo, hi). Returns null when the position is settled
 * or the bucket has nothing to compare against.
 */
export function nextComparison(
  sorted: string[],
  lo: number,
  hi: number,
): { venueId: string; lo: number; hi: number } | null {
  if (sorted.length === 0 || lo >= hi) return null;
  const mid = Math.floor((lo + hi) / 2);
  return { venueId: sorted[mid], lo, hi };
}

/** Insert `venueId` at `index`, leaving the rest of the order intact. */
export function insertAt(sorted: string[], venueId: string, index: number): string[] {
  const next = sorted.slice();
  next.splice(index, 0, venueId);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/night/ranking.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/night/ranking.ts src/lib/night/ranking.test.ts
git commit -m "feat(night): bucket bands, in-bucket comparison insertion, score derivation"
```

---

### Task 3: DDL for `venue_ratings` — **STOPS FOR COLTON**

**Files:**
- Create: `scripts/2026-08-06-night-ratings-ddl.sql`

**Interfaces:**
- Consumes: nothing
- Produces: table `venue_ratings (user_id, venue_id, bucket, rank_position, score, rated_at)`, owner-only RLS, `rated_at` trigger

- [ ] **Step 1: Write the DDL**

```sql
-- ============================================================================
-- 2026-08-06 — night feed slice 1: venue ratings
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-06-night-feed-design.md
--
-- PRIVATE BY DESIGN. No policy here grants SELECT to anyone but the owner.
-- Sharing arrives in slice 2 via night_posts, which is a different table with
-- a different audience. Do not add a friend or school policy to this table.
-- ============================================================================

create table if not exists venue_ratings (
  user_id       uuid not null references profiles (id) on delete cascade,
  venue_id      uuid not null references venues (id) on delete cascade,
  bucket        text not null check (bucket in ('great','good','not_great')),
  rank_position int  not null check (rank_position >= 0),
  score         numeric(3,1) not null check (score >= 0 and score <= 10),
  rated_at      timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create index if not exists venue_ratings_user_bucket_idx
  on venue_ratings (user_id, bucket, rank_position);

alter table venue_ratings enable row level security;

drop policy if exists "own ratings readable" on venue_ratings;
create policy "own ratings readable"
  on venue_ratings for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own ratings insert" on venue_ratings;
create policy "own ratings insert"
  on venue_ratings for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own ratings update" on venue_ratings;
create policy "own ratings update"
  on venue_ratings for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own ratings delete" on venue_ratings;
create policy "own ratings delete"
  on venue_ratings for delete to authenticated using (auth.uid() = user_id);

-- rated_at is set server-side only, so a client cannot backdate a rating.
-- Same rule as check_ins.vibe_at.
create or replace function public.touch_venue_rating()
returns trigger language plpgsql as $$
begin
  new.rated_at := now();
  return new;
end $$;

drop trigger if exists venue_ratings_touch on venue_ratings;
create trigger venue_ratings_touch
  before insert or update on venue_ratings
  for each row execute function public.touch_venue_rating();

-- ---------- verification ----------
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'venue_ratings' order by cmd;

-- Expect true.
select relrowsecurity from pg_class where relname = 'venue_ratings';
```

- [ ] **Step 2: Commit the file**

```bash
git add scripts/2026-08-06-night-ratings-ddl.sql
git commit -m "feat(night): DDL for venue_ratings (owner-only RLS, trigger-set rated_at)"
```

- [ ] **Step 3: STOP. Copy to Colton's clipboard and wait.**

```bash
pbcopy < scripts/2026-08-06-night-ratings-ddl.sql
```

Tell Colton it is on his clipboard, that it is additive and idempotent, and that the last select should return `true`. **Do not proceed to Task 4 until he confirms he has applied it** — every task after this reads or writes the table. Record the DDL in `~/Documents/endz/endz-schema.sql` once applied.

---

### Task 4: Recap and ratings data layer

**Files:**
- Create: `src/lib/night/recap.ts`
- Create: `src/lib/night/ratings.ts`

**Interfaces:**
- Consumes: `nightRange`, `nightDateOf` (Task 1); `Bucket`, `scoreFor`, `insertAt` (Task 2)
- Produces:
  - `listMyNight(userId: string, nightDate: string): Promise<NightVisit[]>` where `NightVisit = { checkInId: string; venueId: string }`
  - `listMyRatings(userId: string): Promise<RatingRow[]>` where `RatingRow = { venueId: string; bucket: Bucket; rankPosition: number; score: number }`
  - `saveRating(userId: string, venueId: string, bucket: Bucket, index: number, currentOrder: string[]): Promise<void>`

- [ ] **Step 1: Write `recap.ts`**

```ts
/**
 * The signed-in user's own night history.
 *
 * PRIVATE. Every read here is own-rows-only, which the existing check_ins
 * SELECT policy already permits via `auth.uid() = user_id`. This module must
 * never be used to read another user's history — the 2026-08-05 RLS fix
 * deliberately limits other users to live rows, and that stays.
 */
import { getSupabase } from "@/lib/supabase";
import { nightRange } from "@/lib/night/window";

export type NightVisit = { checkInId: string; venueId: string };

/** Venues the user checked into during one night, in arrival order. */
export async function listMyNight(userId: string, nightDate: string): Promise<NightVisit[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { start, end } = nightRange(nightDate);
  const { data, error } = await supabase
    .from("check_ins")
    .select("id, venue_id, created_at")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  // One row per venue: revisiting the same bar in a night is one thing to rate.
  const seen = new Set<string>();
  const out: NightVisit[] = [];
  for (const r of (data ?? []) as { id: string; venue_id: string }[]) {
    if (seen.has(r.venue_id)) continue;
    seen.add(r.venue_id);
    out.push({ checkInId: r.id, venueId: r.venue_id });
  }
  return out;
}
```

- [ ] **Step 2: Write `ratings.ts`**

```ts
/**
 * venue_ratings data layer — the user's own ranked list.
 *
 * PRIVATE in slice 1: RLS grants the owner and nobody else. Slice 2 shares
 * scores through night_posts, not by widening this table's policies.
 *
 * Writes rewrite the whole bucket's rank_position/score, because a score is a
 * rendering of the ranking and every sibling shifts when one is inserted.
 */
import { getSupabase } from "@/lib/supabase";
import { Bucket, scoreFor, insertAt } from "@/lib/night/ranking";

export type RatingRow = {
  venueId: string;
  bucket: Bucket;
  rankPosition: number;
  score: number;
};

type DbRow = { venue_id: string; bucket: Bucket; rank_position: number; score: number };

/** The signed-in user's full ranked list, best first within each bucket. */
export async function listMyRatings(userId: string): Promise<RatingRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("venue_ratings")
    .select("venue_id, bucket, rank_position, score")
    .eq("user_id", userId)
    .order("rank_position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbRow[]).map((r) => ({
    venueId: r.venue_id,
    bucket: r.bucket,
    rankPosition: r.rank_position,
    score: Number(r.score),
  }));
}

/**
 * Place `venueId` into `bucket` at `index` within `currentOrder` (that bucket's
 * existing venue ids, best first), then rewrite the bucket.
 */
export async function saveRating(
  userId: string,
  venueId: string,
  bucket: Bucket,
  index: number,
  currentOrder: string[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  const order = insertAt(
    currentOrder.filter((id) => id !== venueId),
    venueId,
    index,
  );
  const rows = order.map((id, i) => ({
    user_id: userId,
    venue_id: id,
    bucket,
    rank_position: i,
    score: scoreFor(bucket, i, order.length),
  }));

  const { data, error } = await supabase
    .from("venue_ratings")
    .upsert(rows, { onConflict: "user_id,venue_id" })
    .select("venue_id");
  if (error) throw error;
  // Same zero-row silence as setVibe(): an RLS-blocked write returns no error.
  if (!data?.length) throw new Error("Rating write matched no rows");
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/night/recap.ts src/lib/night/ratings.ts
git commit -m "feat(night): recap and venue_ratings data layer"
```

---

### Task 5: React Query hooks

**Files:**
- Create: `src/hooks/useNightRecap.ts`
- Create: `src/hooks/useMyRatings.ts`

**Interfaces:**
- Consumes: `listMyNight` (Task 4), `listMyRatings`, `saveRating` (Task 4), `nightDateOf` (Task 1)
- Produces: `useNightRecap(nightDate?: string)` → `{ data: NightVisit[] }`; `useMyRatings()` → `{ data: RatingRow[] }`; `useSaveRating()` → mutation taking `{ venueId, bucket, index, currentOrder }`

- [ ] **Step 1: Write `useNightRecap.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/store/auth";
import { listMyNight, NightVisit } from "@/lib/night/recap";
import { nightDateOf } from "@/lib/night/window";

/** Last night by default; pass a night-date to look further back. */
export function useNightRecap(nightDate?: string) {
  const userId = useAuth((s) => s.user?.id);
  const target = nightDate ?? nightDateOf(new Date(Date.now() - 12 * 60 * 60 * 1000));
  return useQuery<NightVisit[]>({
    queryKey: ["night-recap", userId, target],
    queryFn: () => (userId ? listMyNight(userId, target) : Promise.resolve([])),
    enabled: !!userId,
  });
}
```

**Note for the implementer:** confirm the auth store's actual export and selector shape before writing this — check how `src/hooks/useSaves.ts` reads the signed-in user and copy that exactly rather than the sketch above.

- [ ] **Step 2: Write `useMyRatings.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/store/auth";
import { listMyRatings, saveRating, RatingRow } from "@/lib/night/ratings";
import { Bucket } from "@/lib/night/ranking";

export function useMyRatings() {
  const userId = useAuth((s) => s.user?.id);
  return useQuery<RatingRow[]>({
    queryKey: ["my-ratings", userId],
    queryFn: () => (userId ? listMyRatings(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useSaveRating() {
  const userId = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { venueId: string; bucket: Bucket; index: number; currentOrder: string[] }) => {
      if (!userId) throw new Error("Not signed in");
      return saveRating(userId, v.venueId, v.bucket, v.index, v.currentOrder);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
    },
  });
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json`

```bash
git add src/hooks/useNightRecap.ts src/hooks/useMyRatings.ts
git commit -m "feat(night): hooks for the recap and the ranked list"
```

---

### Task 6: RateSheet — bucket pick and comparison loop

**Files:**
- Create: `src/components/night/RateSheet.tsx`

**Interfaces:**
- Consumes: `BUCKET_LABELS`, `nextComparison`, `Bucket` (Task 2); `useMyRatings`, `useSaveRating` (Task 5)
- Produces: `<RateSheet venue={Venue} open onOpenChange onRated />`

Behaviour, exactly:
1. Three buttons — **Great / Good / Not great**.
2. On pick, read that bucket's current order from `useMyRatings()`, excluding this venue.
3. If the bucket is **empty**, save at index 0 and close. No comparison.
4. Otherwise run `nextComparison` over `[lo, hi)` starting at `[0, order.length)`. Each question shows the two venue names — "Which was better?". Answering "this one" sets `hi = mid`; "the other one" sets `lo = mid + 1`. Loop until `nextComparison` returns null, then save at `lo`.
5. Below the buttons, a light, clearly optional line: **"Add a photo or a note"**. In slice 1 the note field is present and saved to nothing yet — **omit it entirely rather than shipping a control that silently discards input.** Photos arrive in slice 3.

- [ ] **Step 1: Build the component** following `src/components/VibeFinder.tsx` for Drawer usage, chip styling, and the `logEvent` call convention.

- [ ] **Step 2: Verify by hand on the dev server** — rate a first venue (no comparison), then a second in the same bucket (one comparison), then a third (at most two).

- [ ] **Step 3: Typecheck, test, commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test
git add src/components/night/RateSheet.tsx
git commit -m "feat(night): RateSheet - bucket pick then in-bucket comparisons"
```

---

### Task 7: RecapCard and wire into `/social`

**Files:**
- Create: `src/components/night/RecapCard.tsx`
- Modify: `src/pages/Social.tsx`

**Interfaces:**
- Consumes: `useNightRecap` (Task 5), `RateSheet` (Task 6)
- Produces: `<RecapCard />`

Behaviour:
- Renders **nothing at all** when the recap is empty. A user who stayed in must not see an empty-state card.
- With visits: "Last night · N spots", each venue a row with its rating if already rated, or a Rate button.
- Mounts at the **top** of `/social`. The full feed-vs-friend-management restructure is slice 2 — this slice only adds the card.

- [ ] **Step 1: Build `RecapCard.tsx`.**

- [ ] **Step 2: Mount it at the top of the `Social.tsx` section body.**

- [ ] **Step 3: Verify by hand** — check in to two venues, wait for them to land, confirm the card lists both and that a signed-in account with no check-ins sees no card.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/night/RecapCard.tsx src/pages/Social.tsx
git commit -m "feat(night): last-night recap card on /social"
```

---

## Acceptance criteria for slice 1

- A user who checked in last night sees an accurate recap; one who did not sees **no card**
- The first venue rated into a bucket triggers **no** comparison
- A second venue in the same bucket triggers exactly one; comparisons never cross buckets
- Scores stay inside their band, and no `good` score ever exceeds a `great` score
- `venue_ratings` is readable **only** by its owner — verify by querying it while signed in as a second account
- `check_ins` policies are unchanged from 2026-08-05
- `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build` are all clean

## Deferred to later slices

`night_posts` · the feed · school-scoped visibility · moderation and reporting · photos and the storage bucket · §3 reading `venue_ratings`
