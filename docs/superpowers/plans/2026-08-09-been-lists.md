# Been & Want to Try Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the existing rating engine a surface — a `/lists` page with Been (ranked, scored) and Want to Try (saves) tabs, rate/re-rank/remove from any venue, and a Beli-shaped profile header with Friends · Been · Want to Try.

**Architecture:** No new tables and no RLS changes. One pure module (`src/lib/night/lists.ts`) turns `RatingRow[]` + `Venue[]` into a ranked list, and every surface reads it so positions can never disagree. One shared row component replaces the markup currently living inside `SavedSpotsList`. The profile header is extracted from `Profile.tsx` and reused on `/u/:username`.

**Tech Stack:** React 18 + TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind + shadcn/ui, Supabase (PostgREST), Vitest (node environment).

## Global Constraints

- **Worktree:** all work happens in `/Users/colton.lestorti/Documents/night-guide/.claude/worktrees/been-lists` on branch `feat/been-lists`. Use absolute paths — several sessions share this checkout.
- **No schema changes.** No DDL, no RLS edits, no new tables. `venue_ratings` stays owner-only.
- **Ratings stay private** in this slice. Nothing may render another user's ratings or scores.
- **Tests are `.test.ts` only**, `environment: "node"` (`vite.config.ts:71-78`). There is no component-testing setup — do not add one. Logic that needs a test gets extracted into a pure function, which is the pattern already used by `computeCanComment` (`src/hooks/useComments.ts`).
- **Every Supabase write must read rows back and throw on zero rows.** An RLS-blocked write returns no error; see the comment in `saveRating` (`src/lib/night/ratings.ts:84-88`).
- **Baseline:** 417 tests in 42 files pass on `main` at `d789d49`. The suite must stay green after every task.
- **Copy style:** college-aged but professional. No exclamation marks, no hype.
- Run `npm run test`, `npx tsc --noEmit`, and `npm run build` before the final commit. `npm run check:schema` is required in Task 8 because that task changes a `.select()` list.

---

### Task 1: The ranked-list model

**Files:**
- Create: `src/lib/night/lists.ts`
- Test: `src/lib/night/lists.test.ts`

**Interfaces:**
- Consumes: `RatingRow` from `src/lib/night/ratings.ts`, `Bucket` from `src/lib/night/ranking.ts`, `Venue` from `src/data/types.ts`.
- Produces: `type ListEntry = { venue: Venue; bucket: Bucket; score: number; position: number }` and `beenList(ratings: RatingRow[] | undefined, venues: Venue[]): ListEntry[]`. Tasks 5, 6 and 9 call `beenList`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/night/lists.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { beenList } from "./lists";
import type { RatingRow } from "@/lib/night/ratings";
import type { Venue } from "@/data/types";

const rating = (
  venueId: string,
  bucket: RatingRow["bucket"],
  rankPosition: number,
  score: number,
): RatingRow => ({ venueId, bucket, rankPosition, score });

const venue = (id: string): Venue =>
  ({ id, title: `Venue ${id}`, category: "bar" }) as Venue;

describe("beenList", () => {
  it("orders best first across buckets, because the bands never overlap", () => {
    const venues = [venue("a"), venue("b"), venue("c")];
    const rows = [
      rating("b", "good", 0, 5.0),
      rating("c", "not_great", 0, 1.7),
      rating("a", "great", 0, 8.4),
    ];
    expect(beenList(rows, venues).map((e) => e.venue.id)).toEqual(["a", "b", "c"]);
  });

  it("numbers positions from 1 across the whole list, not per bucket", () => {
    const venues = [venue("a"), venue("b"), venue("c")];
    const rows = [
      rating("a", "great", 0, 8.4),
      rating("b", "great", 1, 7.0),
      rating("c", "good", 0, 5.0),
    ];
    expect(beenList(rows, venues).map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("breaks a rounded-score tie by rank position, so a big bucket stays ordered", () => {
    // scoreFor rounds to one decimal, so neighbours in a large bucket can
    // render the same score. The stored ranking is the truth.
    const venues = [venue("a"), venue("b")];
    const rows = [rating("b", "great", 1, 9.1), rating("a", "great", 0, 9.1)];
    expect(beenList(rows, venues).map((e) => e.venue.id)).toEqual(["a", "b"]);
  });

  it("drops a rating whose venue no longer resolves", () => {
    const rows = [rating("a", "great", 0, 8.4), rating("gone", "great", 1, 7.0)];
    const out = beenList(rows, [venue("a")]);
    expect(out.map((e) => e.venue.id)).toEqual(["a"]);
    expect(out[0].position).toBe(1);
  });

  it("returns an empty list for no ratings, and for undefined", () => {
    expect(beenList([], [venue("a")])).toEqual([]);
    expect(beenList(undefined, [venue("a")])).toEqual([]);
  });

  it("carries the bucket through, so the badge can style a weak rating differently", () => {
    const out = beenList([rating("a", "not_great", 0, 1.7)], [venue("a")]);
    expect(out[0].bucket).toBe("not_great");
    expect(out[0].score).toBe(1.7);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/lib/night/lists.test.ts`
Expected: FAIL — `Failed to resolve import "./lists"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/night/lists.ts`:

```ts
/**
 * The user's ranked list, rendered from their ratings.
 *
 * One function, read by both /lists and the venue card, so "#3 on your list"
 * and the third row of the list can never disagree — they were separate
 * derivations in the first sketch of this feature and immediately drifted.
 *
 * Ordering is a flat sort by score. That IS the bucket order: the bands in
 * ranking.ts do not overlap, so every `great` outranks every `good`. Ties are
 * possible WITHIN a bucket because scores round to one decimal, so the stored
 * rank_position breaks them — the ranking is the truth, the score is a
 * rendering of it.
 *
 * Pure and dependency-free, so it is testable without a database.
 */
import type { Venue } from "@/data/types";
import type { RatingRow } from "@/lib/night/ratings";
import type { Bucket } from "@/lib/night/ranking";

export type ListEntry = {
  venue: Venue;
  bucket: Bucket;
  score: number;
  /** 1-based rank across the whole list, not within the bucket. */
  position: number;
};

export function beenList(
  ratings: RatingRow[] | undefined,
  venues: Venue[],
): ListEntry[] {
  if (!ratings?.length) return [];

  const byId = new Map(venues.map((v) => [v.id, v]));

  return ratings
    // A rating whose venue was deactivated must not hold a rank, the same way
    // inferTaste drops it before counting toward the taste floor.
    .flatMap((r) => {
      const venue = byId.get(r.venueId);
      return venue ? [{ row: r, venue }] : [];
    })
    .sort((a, b) =>
      b.row.score - a.row.score || a.row.rankPosition - b.row.rankPosition,
    )
    .map(({ row, venue }, i) => ({
      venue,
      bucket: row.bucket,
      score: row.score,
      position: i + 1,
    }));
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/lib/night/lists.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/night/lists.ts src/lib/night/lists.test.ts
git commit -m "feat(lists): derive the ranked Been list from ratings"
```

---

### Task 2: Deleting a rating

**Files:**
- Modify: `src/lib/night/ratings.ts`
- Test: `src/lib/night/ratings.test.ts` (create)

**Interfaces:**
- Produces: `bucketRows(userId: string, bucket: Bucket, order: string[]): DbWriteRow[]` (pure, exported for tests) and `deleteRating(userId: string, venueId: string, bucket: Bucket, currentOrder: string[]): Promise<void>`. Task 3 wraps `deleteRating` in a hook.

- [ ] **Step 1: Write the failing test**

Create `src/lib/night/ratings.test.ts`. Only the pure row-builder is tested — there is no Supabase mock in this repo, and inventing one for three call sites is not worth it. The reindex arithmetic is the part that can be wrong.

```ts
import { describe, it, expect } from "vitest";
import { bucketRows } from "./ratings";
import { scoreFor } from "./ranking";

describe("bucketRows", () => {
  it("numbers rank_position from 0 in list order", () => {
    const rows = bucketRows("u1", "great", ["a", "b", "c"]);
    expect(rows.map((r) => r.venue_id)).toEqual(["a", "b", "c"]);
    expect(rows.map((r) => r.rank_position)).toEqual([0, 1, 2]);
  });

  it("scores every row for the bucket size it is actually in", () => {
    const rows = bucketRows("u1", "great", ["a", "b"]);
    expect(rows.map((r) => r.score)).toEqual([
      scoreFor("great", 0, 2),
      scoreFor("great", 1, 2),
    ]);
  });

  it("re-spreads the survivors after a removal, rather than leaving a gap", () => {
    // Removing the middle of three must not leave "c" scored as if there were
    // still three — that is the whole reason a delete reindexes.
    const before = bucketRows("u1", "great", ["a", "b", "c"]);
    const after = bucketRows("u1", "great", ["a", "c"]);
    expect(after[1].score).not.toBe(before[2].score);
    expect(after[1].score).toBe(scoreFor("great", 1, 2));
  });

  it("stamps the user and bucket onto every row", () => {
    const rows = bucketRows("u1", "not_great", ["a", "b"]);
    expect(rows.every((r) => r.user_id === "u1")).toBe(true);
    expect(rows.every((r) => r.bucket === "not_great")).toBe(true);
  });

  it("returns nothing for an empty order", () => {
    expect(bucketRows("u1", "great", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/lib/night/ratings.test.ts`
Expected: FAIL — `bucketRows` is not exported.

- [ ] **Step 3: Extract the pure row builder**

In `src/lib/night/ratings.ts`, add this above `listMyRatings`:

```ts
type DbWriteRow = {
  user_id: string;
  venue_id: string;
  bucket: Bucket;
  rank_position: number;
  score: number;
};

/**
 * The full rewrite of one bucket, best first. Pure, and exported so the
 * reindex arithmetic is testable without a database — it appeared inline in
 * three places before this and had to stay identical in all of them.
 */
export function bucketRows(userId: string, bucket: Bucket, order: string[]): DbWriteRow[] {
  return order.map((id, i) => ({
    user_id: userId,
    venue_id: id,
    bucket,
    rank_position: i,
    score: scoreFor(bucket, i, order.length),
  }));
}
```

Then replace the three inline `order.map(...)` blocks in `saveRating` and `removeFromBucket` with `bucketRows(userId, bucket, order)`. Behaviour must not change: `saveRating` still builds `order` with `insertAt` first, and `removeFromBucket` still returns early when `order.length === 0`.

- [ ] **Step 4: Run the full suite to prove the extraction changed nothing**

Run: `npm run test`
Expected: PASS — 422 tests (417 baseline + 5 new). No failures in `ranking.test.ts`.

- [ ] **Step 5: Add `deleteRating`**

Append to `src/lib/night/ratings.ts`:

```ts
/**
 * Remove a rating entirely, then close the ranks behind it.
 *
 * The delete goes first on purpose. If the reindex then fails, the survivors
 * carry stale SCORES but their ORDER is still correct, and the next write to
 * this bucket repairs them. The other order would leave the deleted venue
 * holding a live rank, which is a wrong list rather than a slightly stale one.
 */
export async function deleteRating(
  userId: string,
  venueId: string,
  bucket: Bucket,
  currentOrder: string[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  const { data, error } = await supabase
    .from("venue_ratings")
    .delete()
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .select("venue_id");
  if (error) throw error;
  // Same zero-row silence as saveRating(): an RLS-blocked delete reports no
  // error, and the UI would show the row vanishing from a list it is still in.
  if (!data?.length) throw new Error("Rating delete matched no rows");

  const order = currentOrder.filter((id) => id !== venueId);
  if (order.length === 0) return;

  const { error: reindexError } = await supabase
    .from("venue_ratings")
    .upsert(bucketRows(userId, bucket, order), { onConflict: "user_id,venue_id" });
  if (reindexError) throw reindexError;
}
```

- [ ] **Step 6: Verify types and tests**

Run: `npx tsc --noEmit && npm run test`
Expected: no type errors; 422 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/night/ratings.ts src/lib/night/ratings.test.ts
git commit -m "feat(ratings): delete a rating and close the ranks behind it"
```

---

### Task 3: Rating hooks — delete, and Want to Try → Been

**Files:**
- Modify: `src/hooks/useMyRatings.ts`

**Interfaces:**
- Consumes: `deleteRating` from Task 2, `removeSave` from `src/lib/saves.ts`.
- Produces: `useDeleteRating()` — a mutation taking `{ venueId: string; bucket: Bucket; allRows: RatingRow[] }`. Task 6 calls it.

- [ ] **Step 1: Move the save out of Want to Try when a rating lands**

In `src/hooks/useMyRatings.ts`, inside `useSaveRating`'s `mutationFn`, after the `saveRating(...)` await and the existing bucket-change block, add:

```ts
      // Rating it means you have been — it belongs in Been, not Want to Try.
      // Unconditional: the delete is a no-op when it was never saved, which is
      // cheaper than threading the saved-id list through this mutation.
      // Bookkeeping, so a failure here must never fail the rating itself.
      try {
        await removeSave(userId, v.venueId);
      } catch {
        /* the rating is the user's intent; the save can be tidied later */
      }
```

Add `import { removeSave } from "@/lib/saves";` to the imports, and extend `onSuccess`:

```ts
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
      qc.invalidateQueries({ queryKey: ["my-saves", userId] });
    },
```

Note for the implementer: `useSaves` reads `serverIds` for a signed-in user, so invalidating `["my-saves", userId]` is what updates the UI. The local Zustand mirror is only read when signed out and is deliberately left alone.

- [ ] **Step 2: Add the delete hook**

Append to `src/hooks/useMyRatings.ts`:

```ts
export function useDeleteRating() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (v: { venueId: string; bucket: Bucket; allRows: RatingRow[] }) => {
      if (!userId) throw new Error("Not signed in");
      await deleteRating(userId, v.venueId, v.bucket, orderOf(v.allRows, v.bucket));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-ratings", userId] });
    },
  });
}
```

Add `deleteRating` to the existing import from `@/lib/night/ratings`.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit && npm run test`
Expected: no type errors; 422 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useMyRatings.ts
git commit -m "feat(ratings): delete hook, and rating moves a venue out of Want to Try"
```

---

### Task 4: The score badge and the shared list row

**Files:**
- Create: `src/components/lists/ScoreBadge.tsx`
- Create: `src/components/lists/VenueListRow.tsx`
- Modify: `src/components/SavedSpotsList.tsx`

**Interfaces:**
- Consumes: `Bucket` from `src/lib/night/ranking.ts`, `Venue` from `src/data/types.ts`, the image helpers from `src/lib/venueImages`.
- Produces:
  - `<ScoreBadge score={number} bucket={Bucket} />`
  - `<VenueListRow venue={Venue} rank?={number} score?={number} bucket?={Bucket} trailing?={ReactNode} onPhotoClick?={(url: string, alt: string) => void} />`
  Task 5 and Task 6 render both.

- [ ] **Step 1: Write the score badge**

Create `src/components/lists/ScoreBadge.tsx`:

```tsx
/**
 * The 0-10 score in a circle. Colour carries the bucket, because the number
 * alone reads as a grade out of ten and a 2.1 looks like a failure rather than
 * "I did not rate this highly".
 *
 * `not_great` is deliberately muted rather than red: this is the user's own
 * list about a real business, and a red badge editorialises.
 */
import { cn } from "@/lib/utils";
import type { Bucket } from "@/lib/night/ranking";

const TONE: Record<Bucket, string> = {
  great: "border-primary/40 text-primary",
  good: "border-border text-foreground",
  not_great: "border-border text-muted-foreground",
};

export default function ScoreBadge({ score, bucket }: { score: number; bucket: Bucket }) {
  return (
    <span
      className={cn(
        "shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-card text-sm font-bold tabular-nums",
        TONE[bucket],
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}
```

- [ ] **Step 2: Extract the row**

Create `src/components/lists/VenueListRow.tsx` by lifting the `<li>` body out of `src/components/SavedSpotsList.tsx:63-115` unchanged — the photo button, the lightbox trigger, the fallback image, the title/neighbourhood block, the chevron and both focus rings — and adding the optional rank, score and trailing slot:

```tsx
/**
 * One venue row, shared by every list surface. Extracted from SavedSpotsList so
 * Been and Want to Try cannot drift apart in padding, focus ring or fallback
 * image behaviour.
 *
 * The lightbox itself stays with the parent list: one lightbox per list, not
 * one per row.
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Venue } from "@/data/types";
import type { Bucket } from "@/lib/night/ranking";
import { venueImageSrc, PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
import ScoreBadge from "@/components/lists/ScoreBadge";

export default function VenueListRow({
  venue,
  rank,
  score,
  bucket,
  trailing,
  onPhotoClick,
}: {
  venue: Venue;
  /** 1-based position, shown only on a ranked list. */
  rank?: number;
  score?: number;
  bucket?: Bucket;
  /** Replaces the chevron — the overflow menu on Been rows. */
  trailing?: ReactNode;
  onPhotoClick?: (url: string, alt: string) => void;
}) {
  const navigate = useNavigate();
  const thumb = (
    <img
      src={venueImageSrc(venue)}
      alt=""
      className="h-11 w-11 rounded-xl object-cover shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
      }}
    />
  );

  return (
    <li className="flex w-full p-0 transition-colors hover:bg-secondary/40">
      {rank !== undefined && (
        <span className="w-7 shrink-0 self-center pl-3 text-sm font-semibold tabular-nums text-muted-foreground">
          {rank}
        </span>
      )}

      {hasRealPhoto(venue) && onPhotoClick && (
        <button
          type="button"
          onClick={() => onPhotoClick(venue.image_url!, venue.title)}
          className="shrink-0 rounded-xl py-3 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`View photo of ${venue.title}`}
        >
          {thumb}
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate(`/venue/${venue.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {!(hasRealPhoto(venue) && onPhotoClick) && thumb}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{venue.title}</span>
          {venue.neighborhood && (
            <span className="block truncate text-xs text-muted-foreground">
              {venue.neighborhood}
            </span>
          )}
        </span>
        {score !== undefined && bucket && <ScoreBadge score={score} bucket={bucket} />}
        {!trailing && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>

      {trailing}
    </li>
  );
}
```

- [ ] **Step 3: Refactor `SavedSpotsList` onto it**

In `src/components/SavedSpotsList.tsx`, replace the whole `saved.map(...)` `<li>` body with:

```tsx
        {saved.map((venue) => (
          <VenueListRow
            key={venue.id}
            venue={venue}
            onPhotoClick={(url, alt) => {
              setLightboxUrl(url);
              setLightboxAlt(alt);
            }}
          />
        ))}
```

Remove the now-unused `useNavigate`, `ChevronRight`, `venueImageSrc`, `PLACEHOLDER` and `hasRealPhoto` imports (keep `hasRealPhoto` only if still referenced). Add `import VenueListRow from "@/components/lists/VenueListRow";`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: no type errors, 422 tests pass, build succeeds. `tsc` catching an unused import here is the point of running it.

- [ ] **Step 5: Commit**

```bash
git add src/components/lists src/components/SavedSpotsList.tsx
git commit -m "feat(lists): shared venue row and score badge"
```

---

### Task 5: The `/lists` page

**Files:**
- Create: `src/pages/Lists.tsx`
- Modify: `src/App.tsx` (add the route beside `profile`, inside the same layout route)

**Interfaces:**
- Consumes: `beenList` (Task 1), `VenueListRow` (Task 4), `useMyRatings`, `useSaves`, `useVenues`.
- Produces: the route `/lists`, honouring `?tab=been` and `?tab=saved`. Task 7's stat row links to both.

- [ ] **Step 1: Build the page**

Create `src/pages/Lists.tsx`:

```tsx
/**
 * Your lists — Been (ranked, scored) and Want to Try (saved).
 *
 * Reached from the profile stat row, not from the bottom bar: four tabs is
 * already the right number for a phone. The active tab lives in the URL so the
 * stat row can deep-link to either one and back behaves.
 *
 * Been is a flat list ordered best-first. It is not grouped by bucket — the
 * bands guarantee the order already, and headers would turn one ranking into
 * three short ones.
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Star } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings } from "@/hooks/useMyRatings";
import { useSaves } from "@/hooks/useSaves";
import { beenList } from "@/lib/night/lists";
import { searchMatch } from "@/lib/searchMatch";
import VenueListRow from "@/components/lists/VenueListRow";
import BeenRowMenu from "@/components/lists/BeenRowMenu";
import PhotoLightbox from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "been" | "saved";

const Empty = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="glass rounded-2xl p-6 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
      {icon}
    </div>
    <p className="font-display font-bold text-sm">{title}</p>
    <p className="text-xs text-muted-foreground mt-1">{body}</p>
  </div>
);

const Lists = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "saved" ? "saved" : "been";
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  const { data: ratings, isLoading: ratingsLoading } = useMyRatings();
  const { data: venues, isLoading: venuesLoading, isError } = useVenues({});
  const savedIds = useSaves().ids;

  const [q, setQ] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const been = useMemo(() => beenList(ratings, venues ?? []), [ratings, venues]);
  const saved = useMemo(() => {
    const byId = new Map((venues ?? []).map((v) => [v.id, v]));
    return savedIds.map((id) => byId.get(id)).filter((v) => v !== undefined);
  }, [savedIds, venues]);

  const shownBeen = been.filter((e) => searchMatch(e.venue, q));
  const shownSaved = saved.filter((v) => searchMatch(v, q));
  const loading = venuesLoading || (tab === "been" && ratingsLoading);

  const onPhotoClick = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 rounded-xl text-muted-foreground"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}
      >
        <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
      </Button>

      <h1 className="font-display text-3xl font-bold tracking-tight mb-4">Your lists</h1>

      <div role="tablist" className="mb-4 grid grid-cols-2 gap-2">
        {(["been", "saved"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams({ tab: t }, { replace: true })}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
            )}
          >
            {t === "been" ? `Been${been.length ? ` · ${been.length}` : ""}` : `Want to try${saved.length ? ` · ${saved.length}` : ""}`}
          </button>
        ))}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your list"
        className="mb-4 h-11 rounded-xl"
        aria-label="Search your list"
      />

      {isError ? (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your spots. Check your connection and try again.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : tab === "been" ? (
        !signedIn ? (
          <Empty
            icon={<Star className="h-5 w-5 text-primary" aria-hidden="true" />}
            title="Sign in to see your rankings."
            body="Your list is private to you."
          />
        ) : shownBeen.length === 0 ? (
          <Empty
            icon={<Star className="h-5 w-5 text-primary" aria-hidden="true" />}
            title={q ? "Nothing matches that." : "You haven't ranked anywhere yet."}
            body={q ? "Try a different name." : "Open a spot you've been to and rate it — it lands here."}
          />
        ) : (
          <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
            {shownBeen.map((e) => (
              <VenueListRow
                key={e.venue.id}
                venue={e.venue}
                rank={e.position}
                score={e.score}
                bucket={e.bucket}
                onPhotoClick={onPhotoClick}
                trailing={<BeenRowMenu venue={e.venue} bucket={e.bucket} allRows={ratings ?? []} />}
              />
            ))}
          </ul>
        )
      ) : shownSaved.length === 0 ? (
        <Empty
          icon={<Bookmark className="h-5 w-5 text-primary" aria-hidden="true" />}
          title={q ? "Nothing matches that." : "No saved spots yet."}
          body={q ? "Try a different name." : "Tap the bookmark on any venue to save it for later."}
        />
      ) : (
        <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
          {shownSaved.map((venue) => (
            <VenueListRow key={venue.id} venue={venue} onPhotoClick={onPhotoClick} />
          ))}
        </ul>
      )}

      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} alt={lightboxAlt} />
    </section>
  );
};

export default Lists;
```

Before writing this, open `src/lib/searchMatch.ts` and confirm the exported signature. If it is not `searchMatch(venue: Venue, query: string): boolean`, adapt the two `.filter(...)` calls to the real signature rather than changing `searchMatch`.

- [ ] **Step 2: Register the route**

In `src/App.tsx`, beside `<Route path="profile" element={<Profile />} />`, add:

```tsx
                <Route path="lists" element={<Lists />} />
```

Import it the same way the sibling pages are imported (match the existing lazy/eager pattern in that file exactly).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: `BeenRowMenu` does not exist yet — this task's build will fail on that import. Create `src/components/lists/BeenRowMenu.tsx` as part of Task 6 and run the verification at the end of Task 6. If you are executing tasks strictly one at a time, temporarily omit the `trailing` prop and its import here, then restore both in Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Lists.tsx src/App.tsx
git commit -m "feat(lists): /lists page with Been and Want to Try tabs"
```

---

### Task 6: Rank again and Remove, on a Been row

**Files:**
- Create: `src/components/lists/BeenRowMenu.tsx`
- Modify: `src/pages/Lists.tsx` (restore the `trailing` prop if Task 5 omitted it)

**Interfaces:**
- Consumes: `useDeleteRating` (Task 3), `RateSheet` (`src/components/night/RateSheet.tsx`), the shadcn `dropdown-menu` and `alert-dialog` primitives in `src/components/ui/`.
- Produces: `<BeenRowMenu venue={Venue} bucket={Bucket} allRows={RatingRow[]} />`.

- [ ] **Step 1: Confirm the primitives exist**

Run: `ls src/components/ui/ | grep -E "dropdown-menu|alert-dialog"`
Expected: both files listed. If `alert-dialog` is missing, use the `Dialog` primitive with the same two buttons rather than adding a dependency.

- [ ] **Step 2: Build the menu**

Create `src/components/lists/BeenRowMenu.tsx`:

```tsx
/**
 * Per-row actions on the Been list: re-rank, or remove.
 *
 * Removing is confirmed because it throws away the comparisons that produced
 * the position, and re-earning them means answering the head-to-heads again.
 */
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { Venue } from "@/data/types";
import type { Bucket } from "@/lib/night/ranking";
import type { RatingRow } from "@/lib/night/ratings";
import { useDeleteRating } from "@/hooks/useMyRatings";
import RateSheet from "@/components/night/RateSheet";
import { logEvent } from "@/lib/analytics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BeenRowMenu({
  venue,
  bucket,
  allRows,
}: {
  venue: Venue;
  bucket: Bucket;
  allRows: RatingRow[];
}) {
  const [rateOpen, setRateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remove = useDeleteRating();

  const onConfirmRemove = async () => {
    try {
      await remove.mutateAsync({ venueId: venue.id, bucket, allRows });
      logEvent("rating_removed", { venue_id: venue.id, bucket });
      setConfirmOpen(false);
    } catch {
      toast.error("Couldn't remove that. Try again.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="shrink-0 self-center h-11 w-10 flex items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Options for ${venue.title}`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRateOpen(true)}>Rank again</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>Remove from Been</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RateSheet venue={venue} open={rateOpen} onOpenChange={setRateOpen} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {venue.title} from your list?</AlertDialogTitle>
            <AlertDialogDescription>
              Its ranking goes with it. You can always rate it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} onClick={onConfirmRemove}>
              {remove.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

Check `src/lib/analytics.ts` for the `logEvent` signature and the existing event-name convention (`venue_rated` is logged in `RateSteps.tsx:56`); match it. If events are enumerated in a union type, add `rating_removed` to it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: no type errors, 422 tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/lists/BeenRowMenu.tsx src/pages/Lists.tsx
git commit -m "feat(lists): rank again and remove from a Been row"
```

---

### Task 7: Member-since formatting

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts` (create if absent; otherwise append)

**Interfaces:**
- Produces: `formatMemberSince(iso: string | null | undefined): string | null` returning `"June 2025"`. Task 8 renders it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatMemberSince } from "./format";

describe("formatMemberSince", () => {
  it("renders the month and year of the join date", () => {
    expect(formatMemberSince("2025-06-14T18:04:00Z")).toBe("June 2025");
  });

  it("returns null for missing or unparseable input, so the line is simply omitted", () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince(undefined)).toBeNull();
    expect(formatMemberSince("not a date")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `formatMemberSince` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/format.ts`:

```ts
/**
 * "June 2025" for a profile's join date. Returns null rather than a fallback
 * string when the date is missing or unparseable — an absent line reads better
 * than "Member since Invalid Date".
 *
 * Deliberately UTC-independent at the month level: the exact day is not shown,
 * so a timezone boundary can at worst shift the month for someone who joined
 * within hours of midnight on the 1st. Not worth a dependency.
 */
export function formatMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(profile): member-since formatting"
```

---

### Task 8: Fetch `created_at`

**Files:**
- Modify: `src/lib/friends.ts:54` (`PROFILE_COLS`) and the `FriendProfile` type
- Modify: `src/store/auth.ts:75-90` (both selects in `refreshProfile`)

**Interfaces:**
- Produces: `created_at?: string` on `FriendProfile`, and `created_at` present on the auth store's profile object. Task 9 reads both.

- [ ] **Step 1: Widen `PROFILE_COLS`**

In `src/lib/friends.ts`, change:

```ts
const PROFILE_COLS = "id, username, display_name, avatar_url, created_at";
```

and add to `FriendProfile`:

```ts
  /** Join date, for the "Member since" line. Always present — created_at has
   *  existed since the first schema, so unlike bio/college it survives the
   *  42703 fallback in getProfileByUsername. */
  created_at?: string;
```

It goes in the lean `PROFILE_COLS` rather than only on the profile-page select precisely so it survives that fallback. One timestamp on the list queries is not a payload concern.

- [ ] **Step 2: Widen the auth store selects**

In `src/store/auth.ts`, add `created_at` to **both** select strings in `refreshProfile` — the primary one and the 42703 fallback. Then check `src/store/auth.ts` for the profile type (it may be inferred or declared near the top of the file) and add `created_at?: string` if it is declared explicitly. Search the file for other `.from("profiles").select(` calls (there are several around lines 120 and 156) and add `created_at` to any that populate the same store field, so the line does not disappear after a profile edit.

- [ ] **Step 3: Verify against the live schema**

Run: `npm run test && npx tsc --noEmit && npm run check:schema`
Expected: 424 tests pass, no type errors, and the schema guard reports no drift. This step is why the guard exists — it validates every changed `.select()` against the real database.

- [ ] **Step 4: Commit**

```bash
git add src/lib/friends.ts src/store/auth.ts
git commit -m "feat(profile): fetch created_at for the member-since line"
```

---

### Task 9: The profile header

**Files:**
- Create: `src/components/ProfileHeader.tsx`
- Modify: `src/pages/Profile.tsx` (replace the inline header; drop the Saved spots section)
- Modify: `src/pages/UserProfile.tsx` (use the shared header)

**Interfaces:**
- Consumes: `formatMemberSince` (Task 7), `created_at` (Task 8), `collegeLabel` from `src/data/colleges`, `useMyRatings`, `useSaves`, `useMyFriendships`.
- Produces: `<ProfileHeader ... />` as specified below.

- [ ] **Step 1: Build the header**

Create `src/components/ProfileHeader.tsx`. It is presentational — counts are passed in, so the other-user page cannot accidentally render the signed-in user's private numbers:

```tsx
/**
 * The identity card at the top of /profile and /u/:username.
 *
 * Stats are PASSED IN, never fetched here. The own-profile page passes
 * Friends / Been / Want to Try; the public page passes none. If this component
 * fetched them itself it would render the viewer's private counts on someone
 * else's page — venue_ratings is owner-only, so the numbers it could get are
 * always the viewer's own.
 */
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMemberSince } from "@/lib/format";

export type ProfileStat = { label: string; value: number; to: string };

export default function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  createdAt,
  collegeLine,
  stats = [],
  action,
}: {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  collegeLine?: string | null;
  stats?: ProfileStat[];
  /** Edit Profile on your own page, the relationship button on someone else's. */
  action?: ReactNode;
}) {
  const memberSince = formatMemberSince(createdAt);

  return (
    <div className="relative glass rounded-3xl overflow-hidden animate-slide-up">
      <div className="relative h-20 bg-gradient-to-r from-primary to-rose-400">
        <span
          className="absolute right-4 top-3 font-display font-bold tracking-tight text-white/30 select-none"
          aria-hidden="true"
        >
          ENDZ
        </span>
      </div>
      <div className="p-6 pt-0">
        <div className="flex items-end justify-between">
          <Avatar className="h-20 w-20 -mt-10 ring-4 ring-card shadow-float">
            <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="text-xl font-semibold bg-primary-soft text-primary">
              {(displayName || "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {action}
        </div>

        <div className="min-w-0 mt-3">
          <div className="font-display text-xl font-bold truncate">{displayName || "You"}</div>
          {username && <div className="text-sm text-muted-foreground truncate">@{username}</div>}
          {memberSince && (
            <div className="text-sm text-muted-foreground">Member since {memberSince}</div>
          )}
          {collegeLine && (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{collegeLine}</span>
            </div>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/60 pt-4">
            {stats.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="rounded-xl py-1 text-center transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="font-display text-lg font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it on `/profile`**

In `src/pages/Profile.tsx`, replace the whole signed-in header block (`src/pages/Profile.tsx:161-206`, the `<div className="relative glass rounded-3xl overflow-hidden animate-slide-up">` through its closing tag) with:

```tsx
          <ProfileHeader
            displayName={displayName}
            username={profile?.username}
            avatarUrl={avatarUrl}
            createdAt={profile?.created_at}
            collegeLine={collegeLabel(profile?.college_slug, profile?.class_year)}
            stats={[
              { label: "Friends", value: friendCount, to: "/social" },
              { label: "Been", value: beenCount, to: "/lists?tab=been" },
              { label: "Want to try", value: savedCount, to: "/lists?tab=saved" },
            ]}
            action={
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Edit Profile
              </Button>
            }
          />
```

Add above the return, near the other hooks:

```tsx
  const { data: friendships } = useMyFriendships();
  const { data: myRatings } = useMyRatings();
  const savedCount = useSaves().ids.length;
  const friendCount = (friendships ?? []).filter((r) => r.status === "accepted").length;
  const beenCount = (myRatings ?? []).length;
```

Then delete the `Saved spots` `SectionLabel` and `<SavedSpotsList />` (`src/pages/Profile.tsx:214-215`) — that list is now the Want to Try tab — and remove the `SavedSpotsList` import. Leave `MyActivity`, Preferences, Privacy and Account untouched. Remove any imports the header extraction orphaned (`Avatar*`, possibly `GraduationCap`); `tsc` will name them.

Note: `SavedSpotsList.tsx` stays in the tree — it is still the component the Want to Try tab's markup was derived from. If nothing imports it after this change, delete the file and its now-dead imports rather than leaving an orphan.

- [ ] **Step 3: Use it on `/u/:username`**

In `src/pages/UserProfile.tsx`, replace the identity-card block with `<ProfileHeader />`, passing `stats={[]}` — no counts on someone else's page in this slice — and `action={<AddButton ... />}` exactly as that page renders it today. Keep everything below the card (out-tonight line, `ProfilePosts`, `ReportDialog`) unchanged.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: no type errors, 424 tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfileHeader.tsx src/pages/Profile.tsx src/pages/UserProfile.tsx
git commit -m "feat(profile): shared header with member-since and list stats"
```

---

### Task 10: Rating from the venue card

**Files:**
- Create: `src/components/lists/VenueRatingRow.tsx`
- Modify: `src/components/VenuePreview.tsx` (insert below `<VenueQuickInfo venue={venue} />`, around line 167)

**Interfaces:**
- Consumes: `beenList` (Task 1), `useMyRatings`, `RateSheet`.
- Produces: `<VenueRatingRow venue={Venue} />`.

- [ ] **Step 1: Build the row**

Create `src/components/lists/VenueRatingRow.tsx`:

```tsx
/**
 * "Your rating · 8.4 · #3 on your list", or a Rate it button.
 *
 * This is the only place a venue can be rated outside the night recap. Before
 * it existed a spot could only be rated if it happened to surface in a recap,
 * which is why the Been list had nothing in it.
 *
 * Position comes from beenList — the same function /lists renders — so the
 * number here always names the row you would actually find there.
 */
import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { Venue } from "@/data/types";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings } from "@/hooks/useMyRatings";
import { beenList } from "@/lib/night/lists";
import RateSheet from "@/components/night/RateSheet";
import ScoreBadge from "@/components/lists/ScoreBadge";
import { Button } from "@/components/ui/button";

export default function VenueRatingRow({ venue }: { venue: Venue }) {
  const signedIn = useAuthStore((s) => s.status) === "signedIn";
  const { data: ratings } = useMyRatings();
  const { data: venues } = useVenues({});
  const [open, setOpen] = useState(false);

  const entry = useMemo(
    () => beenList(ratings, venues ?? []).find((e) => e.venue.id === venue.id),
    [ratings, venues, venue.id],
  );

  if (!signedIn) return null;

  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/50 px-3 py-2">
        {entry ? (
          <>
            <ScoreBadge score={entry.score} bucket={entry.bucket} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Your rating</p>
              <p className="text-xs text-muted-foreground">#{entry.position} on your list</p>
            </div>
            <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
              Rank again
            </Button>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Star className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Been here?</p>
              <p className="text-xs text-muted-foreground">Rate it — only you can see this.</p>
            </div>
            <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
              Rate it
            </Button>
          </>
        )}
      </div>
      <RateSheet venue={venue} open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 2: Mount it**

In `src/components/VenuePreview.tsx`, add the import and render `<VenueRatingRow venue={venue} />` immediately after `<VenueQuickInfo venue={venue} />` (line 167) and before the `ActivitySection` comment. It sits above Activity deliberately: it is about the user's own history with the venue, and Activity onward answers "should I go".

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: no type errors, 424 tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/lists/VenueRatingRow.tsx src/components/VenuePreview.tsx
git commit -m "feat(ratings): rate or re-rank from the venue card"
```

---

### Task 11: Full verification

**Files:** none — this task changes no code unless it finds a defect.

- [ ] **Step 1: Run everything**

```bash
npm run test && npx tsc --noEmit && npm run build && npm run check:schema
```

Expected: 424 tests in 44 files, no type errors, a clean production build, no schema drift. Record the real numbers — do not assume them.

- [ ] **Step 2: Manual pass in the browser**

Run `npm run dev` and, signed in, verify each of these. A failure here is a bug to fix, not a note to file.

1. Profile shows Friends / Been / Want to try, and the counts match the lists.
2. "Member since <Month Year>" appears under the handle.
3. Tapping Been opens `/lists?tab=been`; tapping Want to try opens the saved tab.
4. Open a venue you have not rated → "Been here? Rate it" → rate it → it appears in Been at the expected position with the expected score.
5. Save a venue → it appears in Want to try.
6. Rate a venue that was saved → it leaves Want to try and appears in Been.
7. Rank again on a Been row → the position changes and the venue card's "#N on your list" agrees with the list.
8. Remove from Been → the confirm appears; confirming removes it and the neighbouring scores re-spread.
9. Search filters the visible tab.
10. `/u/:username` for another account shows the header with member-since and **no** stat row, and no scores anywhere.
11. Sign out → `/lists` Been shows the sign-in empty state and never a score.

- [ ] **Step 3: Commit any fixes, then report**

```bash
git add -A
git commit -m "fix(lists): <what the manual pass found>"
```

If the manual pass finds nothing, skip the commit and say so plainly rather than inventing a change.

---

## Self-Review

Checked against `docs/superpowers/specs/2026-08-09-been-lists-design.md`:

- **Data layer** — `deleteRating` (Task 2), delete-before-reindex with the stated rationale, zero-row check present. Auto-move in `useSaveRating` (Task 3), in the hook, not the UI. ✅
- **Shared list model** — `lists.ts`, pure, both surfaces read it (Tasks 1, 5, 10). ✅
- **Components** — `Lists.tsx`, `VenueListRow`, `ScoreBadge`, `ProfileHeader` all created; `SavedSpotsList` refactored onto the shared row (Task 4); tab in the URL, search box, overflow menu, signed-out and empty states (Tasks 5, 6). ✅
- **Profile header** — member-since, three-stat row, Saved-spots section removed, `created_at` in the selects, `/u/:username` reuse with no stats (Tasks 7, 8, 9). ✅
- **Venue detail** — the rating row lands in `VenuePreview`, which is what `VenueDetail` renders, so it appears on the page *and* in the map sheet (Task 10). ✅
- **Testing** — `lists.test.ts`, `ratings.test.ts`, `format.test.ts`, plus the full manual pass (Task 11). The spec's "deleting the last member of a bucket leaves nothing behind" is covered by `bucketRows("u1","great",[])` returning `[]` plus `deleteRating`'s early return. ✅
- **Non-goals** — no friend visibility, no filter chips, no map view, no gamification, no other-user counts. Nothing in these tasks touches RLS or adds a table. ✅

Type consistency: `ListEntry` fields (`venue`, `bucket`, `score`, `position`) are used identically in Tasks 5 and 10; `bucketRows(userId, bucket, order)` has one signature across Tasks 2 and 3; `ProfileStat` is `{ label, value, to }` in both the component and its two call sites.

Known sequencing wrinkle, called out in Task 5 Step 3: `Lists.tsx` imports `BeenRowMenu` before Task 6 creates it. Either build Tasks 5 and 6 together, or omit the `trailing` prop in Task 5 and restore it in Task 6.
