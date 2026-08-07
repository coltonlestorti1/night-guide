# Comments on Night Posts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comment thread to night posts — friends of the post's author can write, anyone who can see the post can read.

**Architecture:** A new `night_comments` table whose read policy inherits `night_posts`' audience rule rather than restating it, plus a new block gate on the viewer-vs-commenter axis that post visibility does not cover. A new `src/lib/night/comments.ts` data layer following `posts.ts` conventions exactly (RLS is the boundary; no client-side audience filtering). UI is a preview row inside `PostCard` and a `vaul` drawer for the full thread.

**Tech Stack:** React 18 + TypeScript, Vite, TanStack Query, Supabase (Postgres + RLS), Tailwind, `vaul` drawers, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-07-night-comments-design.md` — design approved by Colton 2026-08-07.

## Global Constraints

- **Work in a worktree, never in `~/Documents/night-guide` directly.** `cd <abs-path> &&` inside every Bash call; several sessions share this repo. See `night-guide/CLAUDE.md` → Multi-session safety.
- **Typecheck with `npx tsc --noEmit -p tsconfig.app.json`.** Bare `npx tsc` is a silent no-op.
- **DDL goes clipboard → Colton pastes into the Supabase SQL editor.** Only the anon key exists locally; you cannot apply migrations yourself. Record every applied DDL in `~/Documents/endz/endz-schema.sql`.
- **RLS is the boundary. Never add client-side audience filtering** — a filter in the client is a second copy of the policy that can silently disagree with it.
- **Never write a comment that restates the `night_posts` audience rule** unless Task 1 proves inheritance does not work. A second copy of the rule is a second thing that can disagree with the first.
- **A zero-rows-no-error write is a failure, not a success.** Read it back and throw. This is how the 2026-07-14 vibe bug hid for weeks.
- **Comment body limit: 280 characters**, matching `night_posts.note`.
- **All user text needs `break-words`.** A missing one shipped a whole-page horizontal scroll bug on 2026-08-07 (`12cfeab`). Display names have no length limit.
- **The test suite is structurally blind to this app's real failures.** Green tests are not evidence. Every acceptance criterion that says "in a browser" means in a browser, by hand.
- **Delete all test data you create.**

---

### Task 1: Settle whether an RLS subquery inherits the referenced table's policy

**This task writes no application code, and no later task may start until it returns.** The DDL shape in Task 2 depends on the answer. The photo policies sidestepped this question rather than answering it.

**Files:**
- Create: `scripts/2026-08-07-rls-inheritance-probe.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a yes/no answer, recorded verbatim in the header comment of `scripts/2026-08-07-night-comments-ddl.sql` (Task 2).

- [ ] **Step 1: Write the probe**

Create `scripts/2026-08-07-rls-inheritance-probe.sql`:

```sql
-- ============================================================================
-- PROBE — does a subquery inside an RLS policy inherit the referenced table's
-- own SELECT policy?
--
-- SAFE: one transaction, always ROLLS BACK. Nothing persists.
--
-- Why this matters: the comments read policy wants to be
--   exists (select 1 from night_posts p where p.id = post_id)
-- which is a single source of truth ONLY if night_posts' own policy applies to
-- that subquery. If it does not, a comment on a 'nobody' post is readable by
-- anyone and the audience predicate has to be restated in full.
-- ============================================================================

begin;

do $$
declare
  v_author uuid;
  v_other  uuid;
  v_venue  uuid;
  v_post   uuid;
  v_seen   boolean;
  v_admin  text := current_user;
begin
  select id into v_author from profiles order by created_at limit 1;
  select id into v_other  from profiles where id <> v_author limit 1;
  select id into v_venue  from venues limit 1;

  if v_other is null then
    raise notice 'SETUP FAILED: need two profiles';
    return;
  end if;

  -- A post only its author may read.
  insert into night_posts (user_id, venue_id, night_date, visibility)
  values (v_author, v_venue, current_date - 1, 'nobody')
  returning id into v_post;

  -- Become someone else entirely.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_other::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';

  -- THE QUESTION: the same shape the comments policy wants to use.
  select exists (select 1 from night_posts p where p.id = v_post) into v_seen;

  execute format('set local role %I', v_admin);

  raise notice '=========================================================';
  raise notice 'subquery saw the nobody post: %', v_seen;
  if v_seen then
    raise notice 'RESULT: INHERITANCE DOES NOT HOLD -> restate the predicate';
  else
    raise notice 'RESULT: INHERITANCE HOLDS -> the DRY policy is safe';
  end if;
  raise notice '=========================================================';
end $$;

rollback;
```

- [ ] **Step 2: Hand it to Colton and get the result**

You cannot run this — only the anon key exists locally. Copy the file to the clipboard:

```bash
cd <worktree-abs-path> && pbcopy < scripts/2026-08-07-rls-inheritance-probe.sql
```

Ask Colton to paste it into the Supabase SQL editor and report the `RESULT:` line from the notices.

- [ ] **Step 3: Record the answer and pick the branch**

Write the exact result into your notes for Task 2:
- `INHERITANCE HOLDS` → **Task 2 Branch A** (the DRY policy).
- `INHERITANCE DOES NOT HOLD` → **Task 2 Branch B** (restate the predicate).

Do not guess. Do not proceed on "probably".

- [ ] **Step 4: Commit**

```bash
cd <worktree-abs-path> && git add scripts/2026-08-07-rls-inheritance-probe.sql
git commit -m "chore(sql): probe whether an RLS subquery inherits the referenced table's policy

The comments read policy wants to inherit night_posts' audience rule rather
than restate it. That is a single source of truth only if Postgres applies
night_posts' own policy to a subquery inside another table's policy. The
photo policies sidestepped this question; this answers it."
```

---

### Task 2: `night_comments` table and RLS

**Files:**
- Create: `scripts/2026-08-07-night-comments-ddl.sql`
- Modify: `~/Documents/endz/endz-schema.sql` (append the applied DDL)

**Interfaces:**
- Consumes: the Task 1 result.
- Produces: table `night_comments (id uuid, post_id uuid, user_id uuid, body text, created_at timestamptz)` with a FK named `night_comments_user_id_fkey` — Task 3's PostgREST embed depends on that exact constraint name.

- [ ] **Step 1: Write the DDL**

Create `scripts/2026-08-07-night-comments-ddl.sql`. Replace `<PASTE TASK 1 RESULT HERE>` with the literal probe output, then keep **only** the branch it selected — delete the other one entirely rather than leaving it commented out.

```sql
-- ============================================================================
-- 2026-08-07 — comments on night posts.
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-07-night-comments-design.md
--
-- RLS SUBQUERY INHERITANCE PROBE RESULT: <PASTE TASK 1 RESULT HERE>
-- (scripts/2026-08-07-rls-inheritance-probe.sql — rerun it if you doubt this)
--
-- Friends of the post's author may WRITE, including on 'school' and 'everyone'
-- posts. Anyone who can see the post may READ. Those are different gates on
-- purpose: narrow->wide is reversible, wide->narrow is a trust event.
-- ============================================================================

create table if not exists night_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references night_posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

-- Ordered by (post_id, created_at) because both reads want a thread oldest
-- first, and the feed preview asks for many post_ids at once.
create index if not exists night_comments_post_idx
  on night_comments (post_id, created_at);

alter table night_comments enable row level security;

-- ---------- READ ----------
-- Two gates, and the second one is the easy one to forget.
--
-- Gate 1 — can you see the post at all. Inherited from night_posts, NOT
-- restated: a second copy of the audience rule is a second thing that can
-- disagree with the first.
--
-- Gate 2 — the viewer-vs-COMMENTER axis. night_posts' policy gates viewer vs.
-- post AUTHOR and says nothing about who wrote a comment underneath. Without
-- this, someone you blocked reaches you through a mutual friend's post.
drop policy if exists "comments visible with their post" on night_comments;

-- ======================= BRANCH A — inheritance holds ========================
create policy "comments visible with their post"
  on night_comments for select to authenticated
  using (
    exists (select 1 from night_posts p where p.id = night_comments.post_id)
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_comments.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_comments.user_id))
    )
  );

-- ================ BRANCH B — inheritance does NOT hold =======================
-- Restates night_posts' audience predicate in full, the same way the photo
-- policies do. If you use this branch, note in endz-schema.sql that TWO copies
-- of the rule now exist and must be changed together.
create policy "comments visible with their post"
  on night_comments for select to authenticated
  using (
    exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id
        and (
          p.user_id = auth.uid()
          or (
            not exists (
              select 1 from friendships f
              where f.status = 'blocked'
                and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
                  or (f.friend_id = auth.uid() and f.user_id   = p.user_id))
            )
            and (
              p.visibility = 'everyone'
              or (p.visibility = 'school' and exists (
                    select 1 from profiles me
                      join profiles them on them.id = p.user_id
                     where me.id = auth.uid()
                       and me.college_slug is not null
                       and me.college_slug = them.college_slug))
              or (p.visibility = 'friends' and exists (
                    select 1 from friendships f
                     where f.status = 'accepted'
                       and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
                         or (f.friend_id = auth.uid() and f.user_id   = p.user_id))))
            )
          )
        )
    )
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_comments.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_comments.user_id))
    )
  );
-- ============================ END BRANCHES ===================================

-- ---------- WRITE ----------
-- Friends of the AUTHOR, not "anyone who can see it". A friend commenting on
-- an 'everyone' post is still a friend, so visibility is not consulted here.
drop policy if exists "friends of the author comment" on night_comments;
create policy "friends of the author comment"
  on night_comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
                or (f.friend_id = auth.uid() and f.user_id   = p.user_id))
          )
        )
    )
    -- Belt and braces. blockUser() deletes the pair's row before inserting the
    -- block, so 'accepted' and 'blocked' should never coexist — but that
    -- invariant lives in client code, not in a constraint.
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_comments.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_comments.user_id))
    )
  );

-- ---------- DELETE ----------
-- Your own comment, or ANY comment on your own post. The person whose night it
-- is owns the thread; that is the moderation lever that works with no staff.
drop policy if exists "author or post owner deletes" on night_comments;
create policy "author or post owner deletes"
  on night_comments for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id and p.user_id = auth.uid()
    )
  );

-- ---------- NO UPDATE POLICY, DELIBERATELY ----------
-- Absent policy = denied. "No editing" is a database rule, not a UI promise.
-- Editing would mean either an edit history or silent rewrites underneath
-- someone else's reply. Do not add one without a decision from Colton.

-- ---------- verification ----------
-- Expect exactly three: DELETE, INSERT, SELECT. NO UPDATE row.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'night_comments'
 order by cmd;

-- Expect: rls_on true, policy_count 3.
select
  (select relrowsecurity from pg_class where relname = 'night_comments') as rls_on,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'night_comments') as policy_count;

-- The embed in src/lib/night/comments.ts names this constraint. If it is
-- missing, PostgREST returns an error instead of an author, and the feed shows
-- comments with no name. Expect one row.
select conname from pg_constraint where conname = 'night_comments_user_id_fkey';
```

- [ ] **Step 2: Get it applied**

```bash
cd <worktree-abs-path> && pbcopy < scripts/2026-08-07-night-comments-ddl.sql
```

Ask Colton to paste and run it. Expected: `rls_on true`, `policy_count 3`, one `night_comments_user_id_fkey` row, and **no UPDATE row** in the policy list.

- [ ] **Step 3: Record it in the schema file**

Append the applied DDL to `~/Documents/endz/endz-schema.sql` under a `night_comments` heading. Include the Task 1 probe result in the comment.

- [ ] **Step 4: Commit**

```bash
cd <worktree-abs-path> && git add scripts/2026-08-07-night-comments-ddl.sql
git commit -m "feat(sql): night_comments table and RLS

Friends of the post's author may write, including on school and everyone
posts. Anyone who can see the post may read, gated additionally on the
viewer-vs-commenter block axis that night_posts' policy does not cover.

No UPDATE policy: absent policy means denied, so 'no editing' is enforced
by the database rather than promised by the UI."
```

---

### Task 3: `comments.ts` data layer and the preview reducer

**Files:**
- Create: `src/lib/night/comments.ts`
- Test: `src/lib/night/comments.test.ts`

**Interfaces:**
- Consumes: `night_comments` from Task 2; `FriendProfile` from `@/lib/friends`.
- Produces:
  - `type NightComment = { id: string; postId: string; body: string; createdAt: string; author: FriendProfile }`
  - `type CommentPreview = { count: number; latest: NightComment }`
  - `reduceCommentPreviews(comments: NightComment[]): Map<string, CommentPreview>`
  - `canCommentOn(authorId: string, myId: string | undefined, friendIds: Set<string>): boolean`
  - `listCommentPreviews(postIds: string[]): Promise<NightComment[]>`
  - `listComments(postId: string): Promise<NightComment[]>`
  - `addComment(input: { postId: string; userId: string; body: string }): Promise<NightComment>`
  - `deleteComment(commentId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/night/comments.test.ts`. These cover the two pure functions — the network functions are not unit-tested, because mocking Supabase would only prove the mock matches itself. RLS gets proved for real in Task 8.

```ts
import { describe, it, expect } from "vitest";
import { reduceCommentPreviews, canCommentOn, type NightComment } from "./comments";

const profile = (id: string) => ({
  id,
  username: `u_${id}`,
  display_name: null,
  avatar_url: null,
});

const c = (id: string, postId: string, createdAt: string): NightComment => ({
  id,
  postId,
  body: `body ${id}`,
  createdAt,
  author: profile(`author_${id}`),
});

describe("reduceCommentPreviews", () => {
  it("counts per post and keeps the NEWEST comment as the preview", () => {
    const out = reduceCommentPreviews([
      c("a", "p1", "2026-08-01T00:00:00Z"),
      c("b", "p1", "2026-08-03T00:00:00Z"),
      c("c", "p1", "2026-08-02T00:00:00Z"),
    ]);
    expect(out.get("p1")!.count).toBe(3);
    expect(out.get("p1")!.latest.id).toBe("b");
  });

  it("keeps posts separate", () => {
    const out = reduceCommentPreviews([
      c("a", "p1", "2026-08-01T00:00:00Z"),
      c("b", "p2", "2026-08-02T00:00:00Z"),
    ]);
    expect(out.get("p1")!.count).toBe(1);
    expect(out.get("p2")!.latest.id).toBe("b");
    expect(out.size).toBe(2);
  });

  it("does not invent an entry for a post with no comments", () => {
    const out = reduceCommentPreviews([]);
    expect(out.get("p1")).toBeUndefined();
    expect(out.size).toBe(0);
  });

  it("is order-independent — the caller must not have to pre-sort", () => {
    const ascending = reduceCommentPreviews([
      c("a", "p1", "2026-08-01T00:00:00Z"),
      c("b", "p1", "2026-08-02T00:00:00Z"),
    ]);
    const descending = reduceCommentPreviews([
      c("b", "p1", "2026-08-02T00:00:00Z"),
      c("a", "p1", "2026-08-01T00:00:00Z"),
    ]);
    expect(ascending.get("p1")!.latest.id).toBe("b");
    expect(descending.get("p1")!.latest.id).toBe("b");
  });
});

describe("canCommentOn", () => {
  const friends = new Set(["f1", "f2"]);

  it("lets a friend of the author comment", () => {
    expect(canCommentOn("f1", "me", friends)).toBe(true);
  });

  it("lets the author comment on their own post", () => {
    expect(canCommentOn("me", "me", friends)).toBe(true);
  });

  it("refuses a non-friend, even though they can SEE the post", () => {
    // The whole point of decision 1: reading and writing are different gates.
    expect(canCommentOn("stranger", "me", friends)).toBe(false);
  });

  it("refuses a signed-out viewer", () => {
    expect(canCommentOn("f1", undefined, friends)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd <worktree-abs-path> && npx vitest run src/lib/night/comments.test.ts
```

Expected: FAIL — `Failed to resolve import "./comments"`.

- [ ] **Step 3: Write `comments.ts`**

Create `src/lib/night/comments.ts`:

```ts
/**
 * night_comments data layer.
 *
 * Same boundary rule as posts.ts: RLS decides who sees what, and there is
 * deliberately NO client-side audience filtering here. A filter in this file
 * would be a second, weaker copy of the policy that can silently disagree
 * with it.
 *
 * canCommentOn() below is NOT that filter. It decides whether to render a
 * composer, and the database refuses the insert regardless of what it returns
 * — it exists so a non-friend sees an explanation instead of a submit button
 * that fails.
 */
import { getSupabase } from "@/lib/supabase";
import type { FriendProfile } from "@/lib/friends";

const AUTHOR_COLS = "id, username, display_name, avatar_url";

/** Shared so the thread read and the preview read cannot drift apart. */
const COMMENT_SELECT = `id, post_id, body, created_at,
   author:profiles!night_comments_user_id_fkey(${AUTHOR_COLS})`;

export const COMMENT_MAX = 280;

export type NightComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: FriendProfile;
};

export type CommentPreview = {
  count: number;
  /** The newest comment — what the feed row shows. */
  latest: NightComment;
};

type DbComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author: FriendProfile;
};

const toComment = (r: DbComment): NightComment => ({
  id: r.id,
  postId: r.post_id,
  body: r.body,
  createdAt: r.created_at,
  author: r.author,
});

/**
 * Count + newest comment per post. Pure, so it is testable without a network:
 * the ordering guarantee lives here rather than depending on the query's ORDER
 * BY, because a caller that re-sorts should not change what the feed shows.
 */
export function reduceCommentPreviews(comments: NightComment[]): Map<string, CommentPreview> {
  const out = new Map<string, CommentPreview>();
  for (const c of comments) {
    const existing = out.get(c.postId);
    if (!existing) {
      out.set(c.postId, { count: 1, latest: c });
      continue;
    }
    existing.count += 1;
    if (c.createdAt > existing.latest.createdAt) existing.latest = c;
  }
  return out;
}

/**
 * Whether to show a composer. Friends of the author, or the author themselves.
 * Deliberately does NOT consult the post's visibility — a friend commenting on
 * an 'everyone' post is still a friend.
 */
export function canCommentOn(
  authorId: string,
  myId: string | undefined,
  friendIds: Set<string>,
): boolean {
  if (!myId) return false;
  return authorId === myId || friendIds.has(authorId);
}

/**
 * Every comment on the given posts, in one round trip. The feed reduces these
 * with reduceCommentPreviews(). Batched rather than per-card: one query for
 * the whole feed instead of one per post.
 */
export async function listCommentPreviews(postIds: string[]): Promise<NightComment[]> {
  const supabase = getSupabase();
  if (!supabase || postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("night_comments")
    .select(COMMENT_SELECT)
    .in("post_id", postIds);
  if (error) throw error;
  return ((data ?? []) as unknown as DbComment[]).map(toComment);
}

/** One thread, oldest first — a conversation reads top to bottom. */
export async function listComments(postId: string): Promise<NightComment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("night_comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as DbComment[]).map(toComment);
}

export async function addComment(input: {
  postId: string;
  userId: string;
  body: string;
}): Promise<NightComment> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const body = input.body.trim();
  if (!body) throw new Error("Comment is empty");
  const { data, error } = await supabase
    .from("night_comments")
    .insert({ post_id: input.postId, user_id: input.userId, body })
    .select(COMMENT_SELECT);
  if (error) throw error;
  // Zero rows with no error means RLS refused the write — the same silence
  // that hid the 2026-07-14 vibe bug for weeks. Fail loudly.
  if (!data?.length) throw new Error("Comment write matched no rows");
  return toComment(data[0] as unknown as DbComment);
}

export async function deleteComment(commentId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("night_comments").delete().eq("id", commentId);
  if (error) throw error;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd <worktree-abs-path> && npx vitest run src/lib/night/comments.test.ts && npx tsc --noEmit -p tsconfig.app.json
```

Expected: 8 tests PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd <worktree-abs-path> && git add src/lib/night/comments.ts src/lib/night/comments.test.ts
git commit -m "feat(comments): night_comments data layer

reduceCommentPreviews and canCommentOn are pure and tested; the network
functions are not unit-tested because mocking Supabase would only prove the
mock matches itself. RLS is proved for real by role-impersonation.

canCommentOn decides whether to render a composer, not what the user may do
— the database refuses the insert regardless."
```

---

### Task 4: React Query hooks

**Files:**
- Create: `src/hooks/useComments.ts`

**Interfaces:**
- Consumes: everything Task 3 produced.
- Produces:
  - `useCommentPreviews(postIds: string[])` → `UseQueryResult<NightComment[]>`
  - `useCommentThread(postId: string | null)` → `UseQueryResult<NightComment[]>`
  - `useAddComment()` → mutation taking `{ postId: string; body: string }`
  - `useDeleteComment()` → mutation taking `{ commentId: string; postId: string }`

- [ ] **Step 1: Write the hooks**

Create `src/hooks/useComments.ts`. Follow `usePostPhotos.ts` for the sorted-key pattern and `usePublishPost.ts` for the invalidation pattern.

```ts
/**
 * Comment reads and writes.
 *
 * Both mutations invalidate the thread AND the feed previews: a new comment
 * changes the count under the card as well as the open thread, and leaving
 * either stale shows the user a state they did not leave the app in.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  addComment,
  deleteComment,
  listComments,
  listCommentPreviews,
  type NightComment,
} from "@/lib/night/comments";

/** Every comment on the posts currently on screen, in one query. */
export function useCommentPreviews(postIds: string[]) {
  // Sorted so the key is stable regardless of feed ordering churn — same
  // reason as usePostPhotos.
  const key = [...postIds].sort();
  return useQuery<NightComment[]>({
    queryKey: ["comment-previews", key],
    queryFn: () => listCommentPreviews(key),
    enabled: key.length > 0,
  });
}

export function useCommentThread(postId: string | null) {
  return useQuery<NightComment[]>({
    queryKey: ["comment-thread", postId],
    queryFn: () => listComments(postId!),
    enabled: !!postId,
  });
}

function useInvalidateComments() {
  const qc = useQueryClient();
  return (postId: string) => {
    qc.invalidateQueries({ queryKey: ["comment-thread", postId] });
    // Prefix match: the preview key carries the whole sorted id list, so an
    // exact key is not knowable from here.
    qc.invalidateQueries({ queryKey: ["comment-previews"] });
  };
}

export function useAddComment() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidateComments();
  return useMutation({
    mutationFn: (v: { postId: string; body: string }) => {
      if (!userId) throw new Error("Not signed in");
      return addComment({ postId: v.postId, userId, body: v.body });
    },
    onSuccess: (_data, v) => invalidate(v.postId),
  });
}

export function useDeleteComment() {
  const invalidate = useInvalidateComments();
  return useMutation({
    mutationFn: (v: { commentId: string; postId: string }) => deleteComment(v.commentId),
    onSuccess: (_data, v) => invalidate(v.postId),
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd <worktree-abs-path> && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd <worktree-abs-path> && git add src/hooks/useComments.ts
git commit -m "feat(comments): query hooks for threads, previews and writes"
```

---

### Task 5: Let a comment be reported

**Files:**
- Modify: `src/lib/reports.ts:41`

**Interfaces:**
- Consumes: nothing.
- Produces: `ReportContext` widened to `"profile" | "plan" | "post" | "comment"`.

No DDL. `reports.context` is plain `text` with no CHECK constraint, and the partial unique index on `(reporter_id, reported_user_id, context, context_id)` already dedupes correctly because comment reports always carry a `context_id`.

- [ ] **Step 1: Widen the union**

In `src/lib/reports.ts`, change the type and extend the comment above it:

```ts
/** Where the report was filed from. Not a foreign key — a report has to
 *  outlive the thing it points at.
 *
 *  `post` (night-feed posts, slice 2) and `comment` (2026-08-07) needed no
 *  DDL: reports.context is plain text with no CHECK constraint, and the
 *  partial unique index on
 *  (reporter_id, reported_user_id, context, context_id) already dedupes
 *  reports that carry a context_id. */
export type ReportContext = "profile" | "plan" | "post" | "comment";
```

- [ ] **Step 2: Typecheck**

```bash
cd <worktree-abs-path> && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean. `ReportDialog` already accepts `context?: ReportContext`, so nothing else changes.

- [ ] **Step 3: Commit**

```bash
cd <worktree-abs-path> && git add src/lib/reports.ts
git commit -m "feat(comments): allow a comment to be reported

No DDL needed — reports.context is free text and the dedupe index already
keys on (reporter, reported, context, context_id)."
```

---

### Task 6: `CommentSheet` — the full thread

Built before the preview row because the preview's tap target needs somewhere to go.

**Files:**
- Create: `src/components/night/CommentSheet.tsx`

**Interfaces:**
- Consumes: Task 4 hooks; `canCommentOn`, `COMMENT_MAX` from Task 3.
- Produces: default export `CommentSheet({ post, open, onOpenChange })` where `post: FeedPost`.

- [ ] **Step 1: Write the component**

Create `src/components/night/CommentSheet.tsx`. Match the existing `vaul` drawer usage — read `src/components/night/AddNightSheet.tsx` first for the project's Drawer import path and structure, and mirror it.

```tsx
/**
 * One post's comment thread.
 *
 * Non-friends get the thread read-only with a stated reason rather than a
 * composer that fails on submit — the database refuses their insert either
 * way, so the only question is whether they learn that before or after typing.
 */
import { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FeedPost } from "@/lib/night/posts";
import { canCommentOn, COMMENT_MAX, type NightComment } from "@/lib/night/comments";
import { useAddComment, useCommentThread, useDeleteComment } from "@/hooks/useComments";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
import { useAuthStore } from "@/store/auth";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import ReportDialog from "@/components/social/ReportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function CommentRow({
  comment,
  postAuthorId,
  onDeleted,
}: {
  comment: NightComment;
  postAuthorId: string;
  onDeleted: (c: NightComment) => void;
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
  // Your own comment, or any comment on your own post. Mirrors the DELETE
  // policy — the database is still the enforcer.
  const canDelete = myId === comment.author.id || myId === postAuthorId;
  const mine = comment.author.id === myId;

  return (
    <li className="flex items-start gap-3">
      <ProfileAvatar profile={comment.author} className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        {/* break-words on BOTH the name and the body. Display names have no
            length limit, and a missing one here shipped a whole-page
            horizontal scroll bug on 2026-08-07. */}
        <p className="text-sm leading-snug break-words">
          <span className="font-semibold">
            {comment.author.display_name || comment.author.username}
          </span>{" "}
          <span className="whitespace-pre-wrap">{comment.body}</span>
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Comment options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canDelete && (
            <DropdownMenuItem
              onSelect={() => onDeleted(comment)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          )}
          {!mine && (
            <ReportDialog profile={comment.author} context="comment" contextId={comment.id} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export default function CommentSheet({
  post,
  open,
  onOpenChange,
}: {
  post: FeedPost;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const { data: comments, isLoading } = useCommentThread(open ? post.id : null);
  const { data: friendships } = useMyFriendships();
  const add = useAddComment();
  const remove = useDeleteComment();
  const [draft, setDraft] = useState("");

  const friendIds = new Set(
    friendships && myId ? deriveFriends(friendships, myId).map((f) => f.profile.id) : [],
  );
  const mayComment = canCommentOn(post.author.id, myId, friendIds);
  const authorName = post.author.display_name || post.author.username;

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await add.mutateAsync({ postId: post.id, body });
      setDraft("");
    } catch {
      toast.error("Couldn't post that comment. Try again.");
    }
  };

  const doDelete = async (c: NightComment) => {
    try {
      await remove.mutateAsync({ commentId: c.id, postId: post.id });
    } catch {
      toast.error("Couldn't delete that comment. Try again.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerTitle className="px-4 pt-2 text-base font-semibold">Comments</DrawerTitle>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : comments?.length ? (
            <ul className="space-y-4">
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  postAuthorId={post.author.id}
                  onDeleted={doDelete}
                />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </p>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {mayComment ? (
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={COMMENT_MAX}
                rows={1}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
                aria-label="Add a comment"
              />
              <Button
                size="sm"
                className="rounded-lg"
                disabled={!draft.trim() || add.isPending}
                onClick={submit}
              >
                Post
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground break-words">
              Only {authorName}'s friends can comment.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: Confirm the Drawer import path matches this project**

```bash
cd <worktree-abs-path> && grep -n "from \"@/components/ui/drawer\"" src/components/night/AddNightSheet.tsx
```

If `AddNightSheet` imports different names, change `CommentSheet` to match it — do not add a second drawer abstraction.

- [ ] **Step 3: Typecheck**

```bash
cd <worktree-abs-path> && npx tsc --noEmit -p tsconfig.app.json
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd <worktree-abs-path> && git add src/components/night/CommentSheet.tsx
git commit -m "feat(comments): thread sheet with composer, delete and report

Non-friends see the thread read-only with the reason stated rather than a
composer that fails on submit."
```

---

### Task 7: `CommentPreview` and wiring it into the feed

**Files:**
- Create: `src/components/night/CommentPreview.tsx`
- Modify: `src/components/night/PostCard.tsx` (add a `commentPreview` prop and render the row after the night label)
- Modify: `src/components/night/FeedList.tsx` (fetch previews, reduce, pass down)

**Interfaces:**
- Consumes: `CommentPreview` type and `reduceCommentPreviews` from Task 3, `useCommentPreviews` from Task 4, `CommentSheet` from Task 6.
- Produces: `PostCard` gains an optional prop `commentPreview?: CommentPreview`.

- [ ] **Step 1: Write `CommentPreview.tsx`**

```tsx
/**
 * The comment row under a feed card: a count and the newest comment, both
 * opening the thread. Not the thread itself — an unbounded comment list under
 * a card that already carries author, venue, score, note and photos makes the
 * feed grow without limit.
 */
import type { CommentPreview as Preview } from "@/lib/night/comments";

export default function CommentPreview({
  preview,
  canComment,
  onOpen,
}: {
  preview: Preview | undefined;
  canComment: boolean;
  onOpen: () => void;
}) {
  // Nothing to show and nothing they could add — render nothing rather than an
  // empty affordance.
  if (!preview && !canComment) return null;

  if (!preview) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Add a comment
      </button>
    );
  }

  const name = preview.latest.author.display_name || preview.latest.author.username;

  return (
    <div className="mt-2 space-y-1">
      {preview.count > 1 && (
        <button
          type="button"
          onClick={onOpen}
          className="block text-sm text-muted-foreground hover:text-foreground"
        >
          View all {preview.count} comments
        </button>
      )}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* line-clamp keeps the feed scannable; break-words keeps a long
            unbroken name or body from widening the card. Both are needed. */}
        <p className="text-sm leading-snug break-words line-clamp-2">
          <span className="font-semibold">{name}</span>{" "}
          <span className="text-muted-foreground">{preview.latest.body}</span>
        </p>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `PostCard`**

Add to `PostCard`'s props:

```tsx
  commentPreview,
}: {
  post: FeedPost;
  venue?: Venue;
  photos?: { id: string; url: string | null }[];
  commentPreview?: CommentPreview;
}) {
```

Add these imports:

```tsx
import CommentPreview from "@/components/night/CommentPreview";
import CommentSheet from "@/components/night/CommentSheet";
import type { CommentPreview as CommentPreviewData } from "@/lib/night/comments";
import { canCommentOn } from "@/lib/night/comments";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
```

Note the type is imported under an alias because the component and the type share a name.

Add state and the friend check next to the existing `useState` calls:

```tsx
  const [threadOpen, setThreadOpen] = useState(false);
  const { data: friendships } = useMyFriendships();
  const friendIds = new Set(
    friendships && myId ? deriveFriends(friendships, myId).map((f) => f.profile.id) : [],
  );
  const mayComment = canCommentOn(post.author.id, myId, friendIds);
```

Then, immediately **after** the existing night-label paragraph:

```tsx
      <p className="mt-3 text-xs text-muted-foreground">{nightLabel(post.nightDate)}</p>

      <CommentPreview
        preview={commentPreview}
        canComment={mayComment}
        onOpen={() => setThreadOpen(true)}
      />

      <CommentSheet post={post} open={threadOpen} onOpenChange={setThreadOpen} />
```

Fix the prop type name so it matches the alias:

```tsx
  commentPreview?: CommentPreviewData;
```

- [ ] **Step 3: Wire it into `FeedList`**

Add imports and the query, and pass the reduced map down:

```tsx
import { useCommentPreviews } from "@/hooks/useComments";
import { reduceCommentPreviews } from "@/lib/night/comments";
```

Inside the component, after the existing `usePostPhotos` line:

```tsx
  const { data: commentRows } = useCommentPreviews((posts ?? []).map((p) => p.id));
  const previews = reduceCommentPreviews(commentRows ?? []);
```

And on the `PostCard`:

```tsx
          commentPreview={previews.get(post.id)}
```

- [ ] **Step 4: Typecheck and run the whole suite**

```bash
cd <worktree-abs-path> && npx tsc --noEmit -p tsconfig.app.json && npx vitest run
```

Expected: tsc clean, 309 tests pass (301 existing + 8 new).

- [ ] **Step 5: Commit**

```bash
cd <worktree-abs-path> && git add src/components/night/CommentPreview.tsx src/components/night/PostCard.tsx src/components/night/FeedList.tsx
git commit -m "feat(comments): preview row on the feed card

Count plus the newest comment inline, full thread behind a tap. Previews
come from one batched query for the whole feed, reduced client-side — no
denormalized counter, which would be a second source of truth that can
drift."
```

---

### Task 8: Prove the RLS rules by role-impersonation

The suite cannot see any of this. **This is the task that actually verifies the feature.**

**Files:**
- Create: `scripts/2026-08-07-night-comments-rls-test.sql`

**Interfaces:**
- Consumes: the deployed `night_comments` policies from Task 2.
- Produces: a pass/fail table Colton can read at a glance.

- [ ] **Step 1: Write the proof script**

Model it on `scripts/2026-08-07-night-posts-rls-test.sql` — read that file first and match its structure: one `begin; … rollback;`, a `_res` temp table, real profiles discovered by query (profiles cannot be fabricated because `profiles.id` references `auth.users`), and `set_config('request.jwt.claims', …)` plus `set local role authenticated` to impersonate.

Cover exactly these five scenarios:

| # | Scenario | Expected |
|---|---|---|
| 1 | Stranger reads comments on a `nobody` post | **0 rows** |
| 2 | Non-friend inserts a comment on a `friends` post | **`42501`** |
| 3 | Non-friend inserts a comment on an **`everyone`** post | **`42501`** |
| 4 | User deletes someone else's comment on someone else's post | **0 rows** |
| 5 | Post author deletes a friend's comment on their own post | **1 row** |

Scenario 3 is the one that matters most: it is the decision-1 rule, and an audience-only policy would wrongly allow it. Do not drop it because it looks similar to scenario 2.

Wrap each insert in a block that traps the error so the script reaches the end:

```sql
  begin
    insert into night_comments (post_id, user_id, body)
    values (v_post_friends, v_stranger, 'should be refused');
    insert into _res values ('non-friend comments on friends post', 42501, 0, 'FAIL');
  exception when insufficient_privilege then
    insert into _res values ('non-friend comments on friends post', 42501, 42501, 'PASS');
  end;
```

End with:

```sql
select * from _res order by scenario;
select case when count(*) = 0 then 'ALL PASS' else count(*) || ' FAILED' end as verdict
  from _res where verdict <> 'PASS';
```

- [ ] **Step 2: Get it run**

```bash
cd <worktree-abs-path> && pbcopy < scripts/2026-08-07-night-comments-rls-test.sql
```

Ask Colton to paste and run it. **Expected: `ALL PASS`.** If any row fails, stop and fix the policy — do not proceed to the browser pass with a failing RLS proof.

- [ ] **Step 3: Commit**

```bash
cd <worktree-abs-path> && git add scripts/2026-08-07-night-comments-rls-test.sql
git commit -m "test(sql): prove the night_comments RLS rules

Role-impersonation in a rolled-back transaction, not two logins. Includes
the non-friend-on-an-everyone-post case, which an audience-only policy
would wrongly allow."
```

---

### Task 9: Browser verification, including layout

Three real bugs on 2026-08-07 passed 300 tests: a frozen view, a component that rendered nothing, and a native file dialog. **Open the app.**

**Files:** none — this task produces evidence, not code.

- [ ] **Step 1: Start the dev server and open a real mobile viewport**

```bash
cd <worktree-abs-path> && npm run dev
```

Chrome DevTools MCP, then `emulate` with viewport `390x844x3,mobile,touch`. **Do not use window resizing** — macOS enforces a ~500px minimum window width, so `resize_window` silently leaves you at desktop width and everything looks fine.

- [ ] **Step 2: Drive the flow by hand, signed in**

Colton must be signed in — you cannot sign in yourself. Confirm each of these by looking at the screen, not by inference:

1. A post with no comments shows `Add a comment` if you may comment, and **nothing at all** if you may not.
2. Posting a comment makes it appear in the thread **and** updates the count under the card without a reload.
3. `View all N comments` appears only when `N > 1`.
4. Deleting your own comment removes it from both the thread and the preview.
5. On someone else's post you are not friends with, the composer is replaced by `Only <name>'s friends can comment.`
6. The report option appears on comments that are not yours, and not on your own.

- [ ] **Step 3: The soft keyboard must not dismiss the sheet**

This is the same class as the 2026-08-07 file-dialog bug, which lost the venue,
the night and everything typed: opening a native file picker blurs the page and
`vaul` reads that as tapping away. A soft keyboard blurs the page the same way.

Tap the composer so the keyboard opens, type a few characters, then dismiss the
keyboard **without** submitting. Expected: the sheet is still open and the draft
is still there.

If it dismisses, guard outside-interaction while the input is focused and
**release on window focus, not on the input's `blur` or `change`** — a
cancelled interaction may fire no event at all, and releasing on one that never
comes leaves the sheet un-closable. That is the exact mistake the file-dialog
fix had to correct.

A programmatic focus in a test cannot reproduce this. It needs a real keyboard
on a real touch viewport.

- [ ] **Step 4: Assert no horizontal scroll**

With the feed populated **and** with a thread open, run in the console:

```js
(() => {
  const de = document.documentElement;
  const bad = [...document.querySelectorAll('*')]
    .filter(el => { const r = el.getBoundingClientRect();
                    return (r.width || r.height) && r.right > de.clientWidth + 0.5; })
    .map(el => String(el.className).slice(0, 60));
  return { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth,
           overflow: de.scrollWidth - de.clientWidth, offenders: bad.slice(0, 5) };
})()
```

Expected: `overflow: 0`. Elements inside the map's intentional `overflow-x-auto` row will appear in `offenders` — that is the design, not a bug. The page-level number is the signal.

- [ ] **Step 5: The unbroken-string case**

Normal data will never show this class of bug. Post a comment whose body is a **60-character unbroken string**, and have Colton temporarily set his display name to a 60-character unbroken string. Re-run the Step 4 assertion in both the feed and the open thread.

Expected: `overflow: 0`, and both strings visibly wrap.

**Restore the display name afterwards.**

- [ ] **Step 6: Delete every comment created during verification**

- [ ] **Step 7: Final checks and commit**

```bash
cd <worktree-abs-path> && npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run check:schema
```

Expected: tsc clean, 309 tests, `PASS: no schema drift`.

```bash
cd <worktree-abs-path> && git commit --allow-empty -m "chore: comments verified in-browser at 390x844

Flow driven by hand signed in; RLS proved separately by role-impersonation
in Task 8. No horizontal overflow with the feed populated, a thread open,
or with 60-character unbroken strings in a display name and a comment body.
Test comments deleted."
```

---

### Task 10: Tracker and memory

**Files:**
- Modify: `docs/ENDZ_MASTER_TASKS.md` — the "Night feed — requested 2026-08-07" section

- [ ] **Step 1: Update the tracker**

Change the comments bullet from `SPECCED … build NOT approved` to shipped, with the merge SHA. Record: the Task 1 probe result (this is the durable finding — it answers a question the photo policies left open), and that unread badges and collab nights remain undiscussed.

- [ ] **Step 2: Update memory**

Update `endz_comments_spec` to shipped state and `active_work` to move the claim to "Recently finished". Record anything the build discovered that the spec got wrong — the spec's value from here on is where it was mistaken.

- [ ] **Step 3: Commit, merge to main, push**

```bash
cd <worktree-abs-path> && git add docs/ENDZ_MASTER_TASKS.md && git commit -m "docs(tracker): comments on night posts shipped"
cd ~/Documents/night-guide && git fetch && git status -sb | head -1   # confirm 0 behind
cd ~/Documents/night-guide && git merge --no-ff <branch> && git push origin main
cd ~/Documents/night-guide && git merge-base --is-ancestor <feature-sha> origin/main && echo VERIFIED
cd ~/Documents/night-guide && git worktree remove <worktree-abs-path> && git branch -d <branch>
```

---

## Verification Summary

| Requirement | Proved by |
|---|---|
| Friend can comment; comment appears in thread and preview | Task 9 step 2 |
| Non-friend reads thread, no composer, reason stated | Task 9 step 2 |
| Post author deletes any comment on their post | Task 8 scenario 5, Task 9 step 2 |
| Commenter deletes own; nobody deletes others' | Task 8 scenario 4 |
| No one can edit | Task 2 — no UPDATE policy exists |
| Deleting a post removes its comments | Task 2 — `on delete cascade` |
| Blocked person's comments invisible | Task 2 read policy gate 2, Task 8 scenario 1 |
| Non-friend refused on an `everyone` post | Task 8 scenario 3 |
| Audience rule not duplicated | Task 1 probe → Task 2 Branch A |
| No horizontal scroll | Task 9 steps 3–4 |
| Preview reducer correct | Task 3 unit tests |
| Sheet survives the soft keyboard | Task 9 step 3 |

## Deliberate deviations from the spec

Two, both found while writing this plan:

1. **`listCommentPreviews` returns `NightComment[]`, not a `Map`.** The spec had
   it returning the reduced map directly. Splitting the network call from
   `reduceCommentPreviews` makes the grouping a pure function that can be unit
   tested without mocking Supabase, which is the only part of this data layer
   worth testing at all.
2. **Task 9 adds a soft-keyboard dismissal check** the spec did not name. The
   spec flagged the risk in prose; this makes it a step with a stated fix, since
   it is the one failure mode this feature shares with a bug that already
   shipped once.

## Known weak spot

**Task 8 does not carry the full SQL.** It gives the five scenarios, the exact
expected results, the exception-trapping shape and the closing verdict query,
but tells the implementer to model the rest on
`scripts/2026-08-07-night-posts-rls-test.sql` rather than reproducing ~150
lines. Every other task carries complete code. Saying so plainly rather than
letting someone discover it mid-task — the slice-1 plan had the same gap in its
tasks 6–7.
