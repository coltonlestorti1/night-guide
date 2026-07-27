# Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the loop — let people say how a place actually is, and feed that back into the heat score.

**Architecture:** Extend the existing `check_ins.vibe` from three options to five (the spec's feedback prompt *is* the vibe question), add `would_recommend`, and replace `venue_activity()` with age-bucketed aggregates so the decay curve gets real check-in ages instead of the mid-age guess the adapter makes today.

**Tech Stack:** TypeScript, React, Supabase/Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-27-activity-heat-system-design.md`
**Depends on:** slices 1–3 (complete).

## Global Constraints

- **Reads must tolerate both schema versions.** `SupabaseDataSource.ts:18` records that code ships before the DDL is pasted. Every read path degrades to today's shape when the new columns are absent — no crash, no blank map.
- **`vibe_at` is set by a database trigger, never by the client.** Freshness is the heaviest-weighted input in the engine; a client-writable timestamp lets anyone backdate a report to look fresh.
- **`venue_activity()` returns aggregates only** — no identities, no per-row timestamps. This preserves the properties verified in the 2026-07-14 audit.
- **`building` keeps its stored value and displays as "Good crowd"** — five options, zero data migration.
- **DDL goes clipboard → Colton pastes.** Only the anon key exists locally; nothing here writes schema.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. Commit per task, named paths only.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/2026-07-27-feedback-ddl.sql` | Paste-ready DDL |
| `src/lib/checkins.ts` | Five vibes, labels, `setRecommend` |
| `src/hooks/useCheckIns.ts` | Tolerant mapping of the RPC shape |
| `src/lib/heat/signals.ts` | Use real buckets when present |
| `src/components/CheckInCard.tsx` | Five options plus the recommend question |

---

### Task 1: The DDL

**Files:**
- Create: `scripts/2026-07-27-feedback-ddl.sql`

- [ ] **Step 1: Write it**

Create `scripts/2026-07-27-feedback-ddl.sql`:

```sql
-- ============================================================================
-- 2026-07-27 — feedback loop (activity/heat system, slice 4)
--
-- Additive and idempotent. Nothing existing breaks: `building` keeps its
-- stored value and simply DISPLAYS as "Good crowd", so there is no data
-- migration.
--
-- Postgres requires enum values to be committed before they are used, so the
-- ALTER TYPE statements are first and must be run on their own.
-- ============================================================================

-- ---------- 1. two new vibe options ----------
alter type vibe_level add value if not exists 'dead';
alter type vibe_level add value if not exists 'line_outside';

-- ---------- 2. recommendation quality ----------
do $$ begin
  create type recommend_level as enum ('yes', 'maybe', 'no');
exception when duplicate_object then null;
end $$;

alter table check_ins add column if not exists would_recommend recommend_level;

-- ---------- 3. vibe freshness, set by trigger only ----------
-- A check-in created two hours ago whose vibe was updated a minute ago is
-- FRESH evidence. Without this column there is no way to tell. It is written
-- by a trigger and never by the client: freshness is the heaviest-weighted
-- input in the scoring engine, so a client-writable timestamp would let anyone
-- backdate a report to look current.
alter table check_ins add column if not exists vibe_at timestamptz;

create or replace function set_vibe_at() returns trigger
language plpgsql
as $$
begin
  if new.vibe is distinct from old.vibe and new.vibe is not null then
    new.vibe_at := now();
  end if;
  return new;
end $$;

drop trigger if exists check_ins_vibe_at on check_ins;
create trigger check_ins_vibe_at
  before update on check_ins
  for each row execute function set_vibe_at();

-- Insert path too, for a check-in that arrives with a vibe already set.
create or replace function set_vibe_at_insert() returns trigger
language plpgsql
as $$
begin
  if new.vibe is not null then new.vibe_at := now(); end if;
  return new;
end $$;

drop trigger if exists check_ins_vibe_at_ins on check_ins;
create trigger check_ins_vibe_at_ins
  before insert on check_ins
  for each row execute function set_vibe_at_insert();

-- ---------- 4. bucketed venue_activity() ----------
-- Buckets, not per-row timestamps. The decay curve needs check-in AGE, but
-- returning timestamps would leak "someone arrived at 11:42" and break the
-- identity guarantees verified in the 2026-07-14 audit. Aggregates preserve
-- them. Bucket edges are 15/45/90 minutes to match the decay curve; a check-in
-- stops counting at 90 minutes even though the row lives to the 3-hour expiry.
--
-- SECURITY DEFINER with a pinned search_path, exactly as the previous version.
drop function if exists venue_activity();

create or replace function venue_activity()
returns table (
  venue_id uuid,
  active_count bigint,
  count_15m bigint,
  count_45m bigint,
  count_90m bigint,
  latest_vibe vibe_level,
  vibe_dead bigint,
  vibe_chill bigint,
  vibe_building bigint,
  vibe_packed bigint,
  vibe_line_outside bigint,
  rec_yes bigint,
  rec_maybe bigint,
  rec_no bigint
)
language sql
security definer
set search_path = public
as $$
  select
    c.venue_id,
    count(*)                                                             as active_count,
    count(*) filter (where c.created_at > now() - interval '15 minutes') as count_15m,
    count(*) filter (where c.created_at > now() - interval '45 minutes') as count_45m,
    count(*) filter (where c.created_at > now() - interval '90 minutes') as count_90m,
    (array_agg(c.vibe order by coalesce(c.vibe_at, c.created_at) desc)
       filter (where c.vibe is not null))[1]                             as latest_vibe,
    count(*) filter (where c.vibe = 'dead'         and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_dead,
    count(*) filter (where c.vibe = 'chill'        and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_chill,
    count(*) filter (where c.vibe = 'building'     and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_building,
    count(*) filter (where c.vibe = 'packed'       and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_packed,
    count(*) filter (where c.vibe = 'line_outside' and coalesce(c.vibe_at, c.created_at) > now() - interval '60 minutes') as vibe_line_outside,
    count(*) filter (where c.would_recommend = 'yes')   as rec_yes,
    count(*) filter (where c.would_recommend = 'maybe') as rec_maybe,
    count(*) filter (where c.would_recommend = 'no')    as rec_no
  from check_ins c
  where c.expires_at > now()
  group by c.venue_id;
$$;

grant execute on function venue_activity() to anon, authenticated;

-- ---------- verification ----------
select * from venue_activity() limit 5;
select enumlabel from pg_enum
  where enumtypid = 'vibe_level'::regtype order by enumsortorder;
```

- [ ] **Step 2: Commit**

```bash
git add scripts/2026-07-27-feedback-ddl.sql
git commit -m "chore(db): feedback loop DDL — five vibes, would_recommend, bucketed activity"
```

---

### Task 2: Five vibes in the client

**Files:**
- Modify: `src/lib/checkins.ts`

- [ ] **Step 1: Widen the type and labels**

In `src/lib/checkins.ts`, replace the `Vibe` type and `VIBE_LABELS`:

```ts
/**
 * `building` keeps its stored value and displays as "Good crowd" — that gives
 * all five options with zero data migration on the existing rows.
 * Order matters: this is the order the buttons render in, dead → line outside.
 */
export type Vibe = "dead" | "chill" | "building" | "packed" | "line_outside";

export const VIBE_LABELS: Record<Vibe, string> = {
  dead: "💤 Dead",
  chill: "😌 Chill",
  building: "👌 Good crowd",
  packed: "🔥 Packed",
  line_outside: "🚧 Line outside",
};

export type Recommend = "yes" | "maybe" | "no";

export const RECOMMEND_LABELS: Record<Recommend, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};
```

- [ ] **Step 2: Add the recommend write**

Append to `src/lib/checkins.ts`:

```ts
/**
 * "Would you send friends here right now?" — recommendation quality, kept
 * deliberately separate from crowd level. A packed room is not automatically
 * a good recommendation.
 */
export async function setRecommend(checkInId: string, value: Recommend): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("check_ins")
    .update({ would_recommend: value })
    .eq("id", checkInId);
  if (error) throw error;
}
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.

```bash
git add src/lib/checkins.ts
git commit -m "feat(checkins): five vibe options and would_recommend"
```

---

### Task 3: Tolerant activity mapping

**Files:**
- Modify: `src/hooks/useCheckIns.ts`
- Modify: `src/lib/heat/signals.ts`
- Modify: `src/lib/heat/signals.test.ts`

- [ ] **Step 1: Widen `VenueActivity` and map defensively**

In `src/hooks/useCheckIns.ts`, replace the `VenueActivity` type and the row loop inside `useVenueActivity`:

```ts
export type VenueActivity = Record<string, {
  count: number;
  vibe: Vibe | null;
  /** Age buckets. Absent until the slice-4 DDL is applied. */
  count15?: number;
  count45?: number;
  count90?: number;
  vibeTally?: Partial<Record<Vibe, number>>;
  recommendTally?: Partial<Record<"yes" | "maybe" | "no", number>>;
}>;
```

and inside `queryFn`, replace the loop body with:

```ts
      const map: VenueActivity = {};
      type Row = Record<string, unknown>;
      for (const row of (data ?? []) as Row[]) {
        const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : undefined);
        const tally: Partial<Record<Vibe, number>> = {};
        for (const v of ["dead", "chill", "building", "packed", "line_outside"] as Vibe[]) {
          const n = num(`vibe_${v}`);
          if (n) tally[v] = n;
        }
        const rec: Partial<Record<"yes" | "maybe" | "no", number>> = {};
        for (const r of ["yes", "maybe", "no"] as const) {
          const n = num(`rec_${r}`);
          if (n) rec[r] = n;
        }
        map[String(row.venue_id)] = {
          count: Number(row.active_count ?? 0),
          vibe: (row.latest_vibe as Vibe) ?? null,
          // These stay undefined on the pre-DDL schema, and the adapter falls
          // back to treating check-ins as mid-age.
          count15: num("count_15m"),
          count45: num("count_45m"),
          count90: num("count_90m"),
          vibeTally: Object.keys(tally).length ? tally : undefined,
          recommendTally: Object.keys(rec).length ? rec : undefined,
        };
      }
      return map;
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/heat/signals.test.ts`:

```ts
describe("signalsFromActivity with real buckets", () => {
  it("uses the buckets when the DDL has been applied", () => {
    const s = signalsFromActivity(
      { count: 9, vibe: "packed", count15: 2, count45: 5, count90: 9 }, 0,
    );
    expect(s.count15).toBe(2);
    expect(s.count45).toBe(5);
    expect(s.count90).toBe(9);
  });

  it("uses the real vibe tally when present", () => {
    const s = signalsFromActivity(
      { count: 4, vibe: "packed", vibeTally: { packed: 3, chill: 1 } }, 0,
    );
    expect(s.vibeTally).toEqual({ packed: 3, chill: 1 });
  });

  it("still degrades to mid-age on the pre-DDL schema", () => {
    const s = signalsFromActivity({ count: 4, vibe: null }, 0);
    expect(s.count15).toBe(0);
    expect(s.count45).toBe(4);
    expect(s.count90).toBe(4);
  });

  it("carries the recommend tally through", () => {
    const s = signalsFromActivity(
      { count: 3, vibe: null, recommendTally: { yes: 2, no: 1 } }, 0,
    );
    expect(s.recommendTally).toEqual({ yes: 2, no: 1 });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- heat/signals` — expect FAIL on the bucket tests.

- [ ] **Step 4: Teach the adapter to prefer real buckets**

In `src/lib/heat/signals.ts`, widen `ActivityEntry` and use the buckets when present:

```ts
export type ActivityEntry = {
  count: number;
  vibe: string | null;
  count15?: number;
  count45?: number;
  count90?: number;
  vibeTally?: Partial<Record<Vibe5, number>>;
  recommendTally?: Partial<Record<"yes" | "maybe" | "no", number>>;
};
```

and replace the returned object:

```ts
  const vibe = asVibe(entry.vibe);
  const hasBuckets = entry.count15 != null || entry.count45 != null || entry.count90 != null;
  return {
    // Real buckets when the DDL is applied; otherwise file everything as
    // mid-age rather than claiming a freshness we cannot know.
    count15: hasBuckets ? entry.count15 ?? 0 : 0,
    count45: hasBuckets ? entry.count45 ?? 0 : entry.count,
    count90: hasBuckets ? entry.count90 ?? 0 : entry.count,
    friendCount: Math.min(friendCount, entry.count),
    vibeTally: entry.vibeTally ?? (vibe ? { [vibe]: 1 } : {}),
    recommendTally: entry.recommendTally ?? {},
    minutesSinceLastReport: vibe ? 0 : null,
  };
```

- [ ] **Step 5: Verify and commit**

Run: `npm test` — expect PASS.
Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.

```bash
git add src/hooks/useCheckIns.ts src/lib/heat/signals.ts src/lib/heat/signals.test.ts
git commit -m "feat(heat): consume bucketed activity, degrading to the old shape"
```

---

### Task 4: The feedback prompt

**Files:**
- Modify: `src/components/CheckInCard.tsx`

- [ ] **Step 1: Add the prompt**

In `src/components/CheckInCard.tsx`:

Extend the import from `@/lib/checkins` to include `setRecommend`, `Recommend` and `RECOMMEND_LABELS`.

Add state beside the existing `useState` calls:

```ts
  const [recommend, setRecommendState] = useState<Recommend | null>(null);
```

Add the write handler beside `doVibe`:

```ts
  const doRecommend = async (value: Recommend) => {
    if (!mine || mine.id === "optimistic") return;
    setRecommendState(value);
    try {
      await setRecommend(mine.id, value);
      logEvent("recommend_set", { venue_id: venueId, value });
    } catch {
      setRecommendState(null);
      setError("That didn't save — try again.");
    }
  };
```

Then, immediately after the closing `</div>` of the existing vibe button row, add the second question. It appears only once a vibe has been given, so the two questions never land at once:

```tsx
          {mine?.vibe && (
            <div className="mt-3 animate-fade-in">
              <p className="text-xs text-muted-foreground mb-1.5">
                Would you send friends here right now?
              </p>
              <div className="flex gap-2">
                {(Object.keys(RECOMMEND_LABELS) as Recommend[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => doRecommend(r)}
                    aria-pressed={recommend === r}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      recommend === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-accent/30",
                    )}
                  >
                    {RECOMMEND_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Let the vibe row wrap**

The row now holds five buttons instead of three. Find the vibe row's container `className` (currently `"flex gap-2 mt-2"`) and change it to `"flex flex-wrap gap-2 mt-2"` so it does not overflow on a phone.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json` — expect no errors.
Run: `npm run build` — expect a clean build.
Run: `npm test` — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CheckInCard.tsx
git commit -m "feat(checkins): how-is-it-now prompt with five options and recommend"
```

---

## Definition of done

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit -p tsconfig.app.json` reports no errors
- [ ] `npm run build` succeeds
- [ ] The app still works against the OLD schema — reads degrade, nothing crashes
- [ ] `vibe_at` appears in no client write path
- [ ] The DDL is committed for Colton to paste

## Ordering note

The client is safe to merge before the DDL is pasted: every read degrades. But
the two new vibe options (`dead`, `line_outside`) cannot be *written* until the
enum is extended, so those two buttons will error until Colton runs the SQL.
Paste the DDL first if the branch is going live the same day.
