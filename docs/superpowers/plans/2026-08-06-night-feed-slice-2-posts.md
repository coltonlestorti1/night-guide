# Night Feed — Slice 2: posts, feed, school scope, moderation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the private recap into a published feed — the user picks which of last night's venues to post, with an optional note and an audience, and sees a feed of posts they're allowed to see.

**Architecture:** Audience resolution is a pure function so the rules are testable without a database, but **RLS is the only real boundary** — the client never filters posts it shouldn't have received. `/social` becomes the feed; friend management moves behind a header control. Moderation extends the existing `reports` flow rather than inventing one.

**Tech Stack:** TypeScript, React, React Query, Supabase (Postgres + RLS), vitest, Tailwind + shadcn/ui.

## Scope

Slice 2 of 3 from `docs/superpowers/specs/2026-08-06-night-feed-design.md`. Slice 1 (rating engine + private recap) shipped in `3ae433c`. Slice 3 is photos and is **not** in this plan.

## What the 2026-08-06 coverage check changed

The spec defaulted posts to `school` on a cold-start argument. Measured against real data, that argument does not hold yet:

| Finding | Consequence |
|---|---|
| 7 of 11 profiles have a `college_slug` (64%), and nulls are still being created **today** | A `school` post from a null-college user matches **nobody** — a silent black hole |
| Largest school cohort is **2 people** (hws 2, elon 2, then singletons) | School scope reaches ~1 person. It does not solve cold start. |

**Three changes, approved by Colton 2026-08-06:**

1. Keep the four-tier union — it is cheap and grows into the autumn HWS beachhead.
2. **Default to `friends` when `college_slug` is null**, `school` otherwise. Never silently post to an empty audience.
3. Drop the cold-start justification for school. It is the right *eventual* default, not a fix for a thin feed. Nothing in this slice makes the feed feel alive — only users do.

## Global Constraints

- **RLS is the only privacy boundary.** Render exactly what the query returns; never filter posts client-side. Same rule as `src/lib/saves.ts`.
- **A post never exposes a check-in timestamp.** `night_posts.night_date` is a `date`, not a `timestamptz`. No foreign key to `check_ins`.
- **Do not widen `CheckinVisibility`** — live presence keeps its three values. Post audience is a separate union.
- **Do not touch `check_ins` policies.** The 2026-08-05 time-bound fix is a launch gate.
- **`create or replace view` drops `security_invoker` and grants.** No view in this slice; if one is added, carry those lines with it — see `scripts/2026-08-06-fix-active-check-ins-view.sql`.
- Typecheck: `npx tsc --noEmit -p tsconfig.app.json`. Tests: `npm test`. Schema guard: `npm run check:schema` (runs on push).

## Two decisions the spec did not cover — CONFIRM BEFORE TASK 2

Both affect the DDL, so they must be settled before the schema exists.

**A. Blocking must cut across every tier.** A blocked user can currently still match `everyone` and `school`. Blocking that only works for `friends` is not blocking. **This plan excludes blocked pairs in both directions from every tier**, which is a correctness requirement, not a preference.

**B. Ghost mode does NOT hide posts.** `ghost_mode` suppresses *presence* — being seen out right now. A post is authored, opt-in, and published the next day; hiding it would make the publish button lie. **This plan treats them as independent** and surfaces the choice here because a user may reasonably expect ghost mode to cover everything. If Colton disagrees, it is one clause in the SELECT policy.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/night/audience.ts` | Audience union, default resolution, labels. Pure. |
| `src/lib/night/audience.test.ts` | Tests for the above. |
| `src/lib/night/posts.ts` | `night_posts` data layer. |
| `src/hooks/useNightFeed.ts` | Feed query. |
| `src/hooks/usePublishPost.ts` | Publish + delete mutations. |
| `src/components/night/PublishSheet.tsx` | Note + audience picker, publish or skip. |
| `src/components/night/FeedList.tsx` | The feed itself. |
| `src/components/night/PostCard.tsx` | One post: author, venue, score, note, overflow menu. |
| `src/pages/Social.tsx` | Restructured — feed first, friend management behind a control. |
| `src/components/social/FriendsSheet.tsx` | The four existing SectionCards, moved. |
| `src/lib/reports.ts` | `ReportContext` gains `"post"`. |
| `scripts/2026-08-06-night-posts-ddl.sql` | Table, RLS, indexes. |

`Social.tsx` is 265 lines with four `SectionCard`s. Moving them into `FriendsSheet.tsx` is not gold-plating — the feed cannot become the page while they occupy it.

---

### Task 1: Audience rules (pure)

**Files:**
- Create: `src/lib/night/audience.ts`
- Test: `src/lib/night/audience.test.ts`

**Interfaces:**
- Produces: `type Audience = "everyone" | "school" | "friends" | "nobody"`; `AUDIENCE_LABELS`; `defaultAudience(collegeSlug: string | null | undefined): Audience`; `audienceOptions(collegeSlug): Audience[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { defaultAudience, audienceOptions, AUDIENCE_LABELS } from "./audience";

describe("defaultAudience", () => {
  it("is school when the user has a college", () => {
    expect(defaultAudience("hws")).toBe("school");
  });

  it("falls back to friends when the college is missing", () => {
    // A school post from a null-college user matches nobody. Never publish
    // into an empty audience while the UI implies one.
    expect(defaultAudience(null)).toBe("friends");
    expect(defaultAudience(undefined)).toBe("friends");
    expect(defaultAudience("")).toBe("friends");
  });

  it("never defaults to everyone", () => {
    for (const slug of ["hws", null, undefined, ""]) {
      expect(defaultAudience(slug)).not.toBe("everyone");
    }
  });
});

describe("audienceOptions", () => {
  it("omits school when there is no college to scope to", () => {
    expect(audienceOptions(null)).not.toContain("school");
    expect(audienceOptions("hws")).toContain("school");
  });

  it("always offers everyone, friends and nobody", () => {
    for (const slug of ["hws", null]) {
      const opts = audienceOptions(slug);
      expect(opts).toEqual(expect.arrayContaining(["everyone", "friends", "nobody"]));
    }
  });

  it("orders widest to narrowest", () => {
    expect(audienceOptions("hws")).toEqual(["everyone", "school", "friends", "nobody"]);
  });
});

describe("AUDIENCE_LABELS", () => {
  it("describes the audience, not the setting name", () => {
    expect(AUDIENCE_LABELS.everyone).toBe("Everyone on ENDZ");
    expect(AUDIENCE_LABELS.school).toBe("People at my school");
    expect(AUDIENCE_LABELS.friends).toBe("Friends only");
    expect(AUDIENCE_LABELS.nobody).toBe("Just me");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/night/audience.test.ts` — FAIL, module missing.

- [ ] **Step 3: Implement**

```ts
/**
 * Who a night post is published to.
 *
 * Separate from CheckinVisibility on purpose: a live location and a next-day
 * post are different disclosures and must not share a default. Do not merge
 * these unions.
 */
export type Audience = "everyone" | "school" | "friends" | "nobody";

export const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: "Everyone on ENDZ",
  school: "People at my school",
  friends: "Friends only",
  nobody: "Just me",
};

/**
 * School unless there is no school to scope to.
 *
 * Measured 2026-08-06: 36% of profiles had a null college_slug, and nulls were
 * still being created. A `school` post from such a user matches nobody, so the
 * UI would promise an audience that does not exist.
 */
export function defaultAudience(collegeSlug: string | null | undefined): Audience {
  return collegeSlug ? "school" : "friends";
}

/** Offered audiences, widest first. School is hidden when it cannot apply. */
export function audienceOptions(collegeSlug: string | null | undefined): Audience[] {
  return collegeSlug
    ? ["everyone", "school", "friends", "nobody"]
    : ["everyone", "friends", "nobody"];
}
```

- [ ] **Step 4: Run and confirm pass** — `npx vitest run src/lib/night/audience.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/night/audience.ts src/lib/night/audience.test.ts
git commit -m "feat(night): post audience rules, friends-default when school is unknown"
```

---

### Task 2: DDL for `night_posts` — **STOPS FOR COLTON**

**Files:**
- Create: `scripts/2026-08-06-night-posts-ddl.sql`

- [ ] **Step 1: Write the DDL**

```sql
-- ============================================================================
-- 2026-08-06 — night feed slice 2: night_posts
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-06-night-feed-design.md
--
-- night_date is a DATE, deliberately. A post says "Monday night", never
-- "12:41am". There is no foreign key to check_ins, so no reader can walk from a
-- post back to a timestamped visit. The 2026-08-05 time-bound policy on
-- check_ins is untouched by this file.
-- ============================================================================

create table if not exists night_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  venue_id   uuid not null references venues (id) on delete cascade,
  night_date date not null,
  note       text check (note is null or char_length(note) <= 280),
  visibility text not null default 'friends'
               check (visibility in ('everyone','school','friends','nobody')),
  created_at timestamptz not null default now(),
  unique (user_id, venue_id, night_date)   -- one post per venue per night
);

create index if not exists night_posts_feed_idx on night_posts (created_at desc);
create index if not exists night_posts_author_idx on night_posts (user_id, night_date desc);

alter table night_posts enable row level security;

-- READ. Blocking is checked FIRST and applies to every tier: blocking that only
-- works for the friends tier is not blocking.
drop policy if exists "night posts visible per audience" on night_posts;
create policy "night posts visible per audience"
  on night_posts for select to authenticated
  using (
    auth.uid() = user_id
    or (
      not exists (
        select 1 from friendships f
        where f.status = 'blocked'
          and (
            (f.user_id = auth.uid() and f.friend_id = night_posts.user_id) or
            (f.friend_id = auth.uid() and f.user_id = night_posts.user_id)
          )
      )
      and (
        visibility = 'everyone'
        or (
          visibility = 'school'
          and exists (
            select 1 from profiles me
            join profiles them on them.id = night_posts.user_id
            where me.id = auth.uid()
              and me.college_slug is not null      -- null = null is not a match,
              and me.college_slug = them.college_slug  -- but be explicit
          )
        )
        or (
          visibility = 'friends'
          and exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and (
                (f.user_id = auth.uid() and f.friend_id = night_posts.user_id) or
                (f.friend_id = auth.uid() and f.user_id = night_posts.user_id)
              )
          )
        )
      )
    )
  );
-- Note: 'nobody' is absent by design — it matches only the author clause above.
-- Note: ghost_mode is deliberately NOT consulted. It suppresses presence; a post
-- is authored and opt-in. See the plan's decision B.

drop policy if exists "users create own posts" on night_posts;
create policy "users create own posts"
  on night_posts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update own posts" on night_posts;
create policy "users update own posts"
  on night_posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own posts" on night_posts;
create policy "users delete own posts"
  on night_posts for delete to authenticated using (auth.uid() = user_id);

-- ---------- verification ----------
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'night_posts' order by cmd;

select
  (select relrowsecurity from pg_class where relname = 'night_posts') as rls_on,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='night_posts') as policy_count;
```

- [ ] **Step 2: Commit the file, copy to clipboard, STOP**

```bash
git add scripts/2026-08-06-night-posts-ddl.sql
git commit -m "feat(night): DDL for night_posts with audience-scoped RLS"
pbcopy < scripts/2026-08-06-night-posts-ddl.sql
```

Expect `rls_on: true, policy_count: 4`. **Do not start Task 3 until Colton confirms.** Record in `~/Documents/endz/endz-schema.sql` once applied.

- [ ] **Step 3: After it is applied, prove the policy — do not assume it**

Use the SQL role-impersonation pattern from slice 1 (`set local role authenticated` + `set local request.jwt.claims`, every block in a rolled-back transaction). Prove all four: a stranger cannot see a `friends` post; a same-school stranger **can** see a `school` post; a **blocked** same-school user **cannot**; and a `nobody` post is invisible to everyone but the author.

---

### Task 3: Posts data layer

**Files:**
- Create: `src/lib/night/posts.ts`

**Interfaces:**
- Consumes: `Audience` (Task 1)
- Produces: `publishPost`, `deletePost`, `listFeed`, `listMyPostsForNight`, `type FeedPost`

- [ ] **Step 1: Implement**

```ts
/**
 * night_posts data layer.
 *
 * RLS is the boundary. listFeed() asks for everything and renders what comes
 * back — there is no client-side audience filtering, because a filter here
 * would be a second, weaker copy of the policy that can silently disagree with
 * it. Same rule as src/lib/saves.ts.
 */
import { getSupabase } from "@/lib/supabase";
import type { Audience } from "@/lib/night/audience";
import type { FriendProfile } from "@/lib/friends";

const AUTHOR_COLS = "id, username, display_name, avatar_url";

export type FeedPost = {
  id: string;
  venueId: string;
  nightDate: string;
  note: string | null;
  visibility: Audience;
  createdAt: string;
  author: FriendProfile;
};

type DbPost = {
  id: string;
  venue_id: string;
  night_date: string;
  note: string | null;
  visibility: Audience;
  created_at: string;
  author: FriendProfile;
};

const toFeedPost = (r: DbPost): FeedPost => ({
  id: r.id,
  venueId: r.venue_id,
  nightDate: r.night_date,
  note: r.note,
  visibility: r.visibility,
  createdAt: r.created_at,
  author: r.author,
});

/** Everything the caller is allowed to see, newest first. */
export async function listFeed(limit = 50): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_posts")
    .select(
      `id, venue_id, night_date, note, visibility, created_at,
       author:profiles!night_posts_user_id_fkey(${AUTHOR_COLS})`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as DbPost[]).map(toFeedPost);
}

/** The caller's own posts for one night, to show what is already published. */
export async function listMyPostsForNight(
  userId: string,
  nightDate: string,
): Promise<FeedPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_posts")
    .select(
      `id, venue_id, night_date, note, visibility, created_at,
       author:profiles!night_posts_user_id_fkey(${AUTHOR_COLS})`,
    )
    .eq("user_id", userId)
    .eq("night_date", nightDate);
  if (error) throw error;
  return ((data ?? []) as unknown as DbPost[]).map(toFeedPost);
}

export async function publishPost(input: {
  userId: string;
  venueId: string;
  nightDate: string;
  note: string | null;
  visibility: Audience;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("night_posts")
    .upsert(
      {
        user_id: input.userId,
        venue_id: input.venueId,
        night_date: input.nightDate,
        note: input.note?.trim() || null,
        visibility: input.visibility,
      },
      { onConflict: "user_id,venue_id,night_date" },
    )
    .select("id");
  if (error) throw error;
  // Zero rows with no error means RLS refused it — the same silence that hid
  // the 2026-07-14 vibe bug. Read it back and fail loudly.
  if (!data?.length) throw new Error("Post write matched no rows");
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("night_posts").delete().eq("id", postId);
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck, run the schema guard, commit**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run check:schema
git add src/lib/night/posts.ts
git commit -m "feat(night): night_posts data layer"
```

`check:schema` matters here — the embedded `author:profiles!...` select is exactly the shape that drifts.

---

### Task 4: Hooks

**Files:**
- Create: `src/hooks/useNightFeed.ts`, `src/hooks/usePublishPost.ts`

**Interfaces:**
- Consumes: Task 3; `useAuthStore((s) => s.session?.user.id)` — the shape used by `useSaves.ts`, confirmed
- Produces: `useNightFeed()`, `useMyPostsForNight(nightDate)`, `usePublishPost()`, `useDeletePost()`

- [ ] **Step 1: Implement both**, following `src/hooks/useMyRatings.ts` exactly for query-key and invalidation shape. Feed key `["night-feed"]`; own-posts key `["my-posts", userId, nightDate]`. Both mutations invalidate both keys — a publish changes the feed *and* the recap's published state.

- [ ] **Step 2: Typecheck and commit.**

---

### Task 5: PublishSheet

**Files:**
- Create: `src/components/night/PublishSheet.tsx`

Behaviour, exactly:
1. Opens per venue from the recap, after rating (rating stays independent — a user may rate without posting).
2. Optional note, **280 max**, live remaining count, **no links** — strip or reject `http(s)://`.
3. Audience picker seeded from `defaultAudience(profile.college_slug)`, options from `audienceOptions(...)`.
4. **Publish** and **Skip**. Skip writes nothing.
5. If a post already exists for this venue+night, the sheet opens in edit mode with the existing note and audience, and offers **Delete post**.

- [ ] **Step 1: Build it**, following `RateSheet.tsx` for Drawer/Button/toast conventions and its synchronous-commit pattern — do not commit from an effect.
- [ ] **Step 2: Verify by hand** — publish, reopen (edit mode, values preserved), change audience, delete.
- [ ] **Step 3: `npx tsc --noEmit -p tsconfig.app.json && npm test`, commit.**

---

### Task 6: PostCard and FeedList

**Files:**
- Create: `src/components/night/PostCard.tsx`, `src/components/night/FeedList.tsx`

`PostCard` shows author avatar + username, venue name, the author's score if they have one, the note, and a relative night ("Last night", "Friday"). **Never a time.** Overflow menu: **Report** for others' posts, **Delete** for your own.

`FeedList` renders newest first with an empty state that does not scold — *"Nothing from your people yet."* plus a nudge to add friends. Per the coverage finding, expect this empty state to be the common case until the beachhead lands; it should read as calm, not broken.

- [ ] Build, verify by hand, typecheck, commit.

---

### Task 7: Restructure `/social`

**Files:**
- Create: `src/components/social/FriendsSheet.tsx`
- Modify: `src/pages/Social.tsx`

- [ ] **Step 1:** Move the four existing `SectionCard`s (Requests, Plans, Out tonight, Find friends) into `FriendsSheet.tsx` **unchanged** — a pure move, no behaviour edits, so any regression is obviously a wiring bug.
- [ ] **Step 2:** `Social.tsx` becomes: header (with a friends icon button opening the sheet, badged with pending request count) → `RecapCard` → `FeedList`.
- [ ] **Step 3:** Verify the pending-request badge still surfaces incoming requests — that signal must not get buried by this move.
- [ ] **Step 4:** Typecheck, test, build, commit.

---

### Task 8: Moderation

**Files:**
- Modify: `src/lib/reports.ts`, `src/components/night/PostCard.tsx`

**No DDL required** — `reports.context` is `text not null default 'profile'` with no CHECK constraint, and the existing partial unique index on `(reporter_id, reported_user_id, context, context_id)` already covers non-null `context_id`, which a post report uses.

- [ ] **Step 1:** Add `"post"` to `ReportContext` (`src/lib/reports.ts:34`).
- [ ] **Step 2:** Wire PostCard's Report action to `submitReport({ context: "post", contextId: post.id, reportedUserId: post.author.id })`, reusing the existing reason list and dialog.
- [ ] **Step 3:** Verify a second report of the same post is rejected by the unique index and surfaces as "already reported", not an error.
- [ ] **Step 4:** Typecheck, test, commit.

---

## Acceptance criteria

- A null-college user's publish sheet defaults to **Friends only** and offers no School option
- A post set to `school` is visible to a same-school account and **not** to a different-school account
- A **blocked** user cannot see the poster's posts at **any** audience, including `everyone`
- A `nobody` post is visible only to its author
- No feed query returns a check-in timestamp, and no client code filters posts by audience
- Publishing is opt-in per venue; skipping writes no row
- A post can be reported once and deleted by its author
- `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, and `npm run check:schema` all clean

## Out of scope

Photos (slice 3) · comments or likes · notifications · `venue_ratings` feeding §3

## Honest note on this plan

Tasks 1–4 carry complete, runnable code. Tasks 5–8 carry exact behavioural contracts but not full component source — the same gap slice 1's plan had. Building them will need judgment rather than transcription, and the RLS proof in Task 2 Step 3 is the single most important step in this plan: it is the one thing no unit test can cover, and it is where the privacy claims live.
