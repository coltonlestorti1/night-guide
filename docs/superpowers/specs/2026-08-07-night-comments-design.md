# Comments on night posts — design

**Date:** 2026-08-07
**Status:** design approved by Colton in discussion. Build NOT approved.
**Base:** `main` @ `fa64e52`
**Related:** `2026-08-06-night-feed-design.md` (the parent feature)

---

## 1. What this is

A comment thread under a night post. Friends of the post's author can write;
everyone who can already see the post can read.

This is the third UGC surface in the app, after profiles/plans and posts
themselves. It is deliberately the smallest version that is still a real
feature: no replies, no likes, no editing, no mentions, no photos, no
notifications.

## 2. What already exists (audited 2026-08-07, not assumed)

| Thing | Where | State |
|---|---|---|
| `night_posts` + 4-tier audience RLS | `scripts/2026-08-06-night-posts-ddl.sql` | Shipped, RLS proved by role-impersonation |
| Feed read path | `src/lib/night/posts.ts` | `listFeed()` asks for everything, renders what RLS returns. **No client-side audience filtering, deliberately.** |
| Post card | `src/components/night/PostCard.tsx` (204 lines) | Author, venue, score ring, note, photo grid, lightbox, report menu |
| Report flow | `src/lib/reports.ts`, `ReportDialog` | `reports.context` is **plain `text` with no CHECK constraint** (`2026-08-05-appstore-compliance-ddl.sql:83`) |
| Block semantics | `src/lib/friends.ts:225` `blockUser()` | Deletes any existing row for the pair, then inserts `(blocker, blocked, 'blocked')`. So `accepted` and `blocked` **cannot coexist** for a pair. |

Two consequences worth stating plainly:

- **Adding comments to the report flow needs no DDL.** Widen the
  `ReportContext` union in `src/lib/reports.ts:41` to include `"comment"` and
  pass `contextId={comment.id}`. The existing partial unique index
  `reports_dedupe_ctx (reporter_id, reported_user_id, context, context_id)`
  already dedupes it correctly, because comment reports always carry a
  `context_id`. The tracker called this "a *second* moderation surface" — the
  moderation *policy* question is real, the plumbing is one line.
- **The block invariant is enforced by client code, not by the database.** A
  failed delete followed by a successful insert would leave both rows. The
  INSERT policy below therefore checks for a block edge explicitly rather than
  inferring its absence from the accepted row. Cheap, and it does not depend on
  `blockUser()` staying correct.

## 3. Decisions (settled with Colton, 2026-08-07)

1. **Friends-only writing.** Only accepted friends of the post's author may
   comment — including on `school` and `everyone` posts. Rationale: narrow→wide
   is reversible, wide→narrow is a trust event. Thousands of classmates able to
   write under someone's name, on a post about a named real business, with no
   moderation staff, is a materially different product from thousands being
   able to read.
2. **Reading is not restricted to friends.** Anyone who can see the post reads
   the whole thread. The alternative — you only see comments from your own
   friends — gives every viewer a different thread, so a reply stops making
   sense to the person it sits under.
3. **Blocking hides a comment from you regardless of the post.** This is a new
   axis. Post visibility gates *viewer vs. post author*; it says nothing about
   *viewer vs. commenter*. A person you blocked, commenting on a mutual
   friend's post, must not reach you.
4. **Two people can delete a comment:** its author, and the post's author. The
   person whose night it is owns the thread. That is the moderation lever that
   functions with no staff; reporting is the second line.
5. **No editing.** Delete and retype. Editing means either an edit history or
   silent rewrites underneath someone else's reply.
6. **No notifications, on purpose.** "Someone commented on your night" is the
   unread-badge feature wearing a different hat, and that feature's whole cost
   is per-user read state on the hottest write path. Shipping comments silent
   keeps that a separate, honest decision. Accepted consequence: discovery is
   weak until badges exist.
7. **Render as count + latest comment inline, full thread behind a tap.**
   Unbounded inline comments make the feed grow without limit under a card that
   already carries author, venue, score, note and photos.

## 4. Data model

```sql
create table if not exists night_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references night_posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists night_comments_post_idx
  on night_comments (post_id, created_at);
```

- `on delete cascade` from `night_posts`: deleting a post takes its thread. A
  comment has no meaning without the post it is attached to.
- 280 chars, matching `night_posts.note`. `btrim` in the check so whitespace is
  not a valid comment.
- **No `comment_count` column and no trigger.** Counts come from one batched
  read across the loaded posts. A denormalized counter is a second source of
  truth that can drift; at current volume the batched read is cheaper than the
  bug.
- Deliberately **no** `parent_id`. Threading is not in this feature.

## 5. RLS — and the question that has to be settled first

### 5.1 The prerequisite probe

The DRY form of the read policy is:

```sql
using (exists (select 1 from night_posts p where p.id = night_comments.post_id) and ...)
```

This is a single source of truth **only if Postgres applies `night_posts`' own
SELECT policy to that subquery.** If it does not, the subquery sees every post
and the audience model is bypassed entirely — a comment on a `nobody` post
would be readable by anyone.

The photo policies shipped **restating** the audience predicate in full rather
than relying on this. That was the right call under time pressure, but it left
the question unanswered, and the project already has one incident
(`active_check_ins`) caused by assuming how Postgres applies privileges to a
derived object.

**Task 1 of implementation is a role-impersonation probe that settles it**, in
the style of `scripts/2026-08-07-night-posts-rls-test.sql`: create a `nobody`
post as user A, then as user B run
`select exists (select 1 from night_posts p where p.id = <A's post>)` under
`set local role authenticated` + `set local request.jwt.claims`, inside a
rolled-back transaction.

- Returns **false** → inheritance holds → use the DRY policy in §5.2.
- Returns **true** → inheritance does not hold → the audience predicate must be
  restated in full, exactly as the photo policies do it.

No implementation code is written before this returns. The result gets recorded
as a comment in the DDL file, so the next person does not have to re-derive it.

### 5.2 Read policy (DRY branch — pending the probe)

```sql
create policy "comments visible with their post"
  on night_comments for select to authenticated
  using (
    -- Inherits night_posts' audience rule. Confirmed by probe, see header.
    exists (select 1 from night_posts p where p.id = night_comments.post_id)
    -- New axis: viewer vs. COMMENTER. Post visibility does not cover this.
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_comments.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_comments.user_id))
    )
  );
```

### 5.3 Write policy

```sql
create policy "friends of the author comment"
  on night_comments for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id
        and (
          p.user_id = auth.uid()          -- the author can comment on their own
          or exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and ((f.user_id = auth.uid()   and f.friend_id = p.user_id)
                or (f.friend_id = auth.uid() and f.user_id   = p.user_id))
          )
        )
    )
    -- Belt and braces: blockUser() deletes the pair's row before inserting the
    -- block, so an accepted row should never coexist with a blocked one. That
    -- invariant lives in client code, not in a constraint.
    and not exists (
      select 1 from friendships f
      where f.status = 'blocked'
        and ((f.user_id = auth.uid()   and f.friend_id = night_comments.user_id)
          or (f.friend_id = auth.uid() and f.user_id   = night_comments.user_id))
    )
  );
```

Note there is no *restated* `visibility` check on the write path — but that is
not the same as "no dependency on visibility." The `exists (select 1 from
night_posts p where p.id = night_comments.post_id and (...))` subquery runs
under `night_posts`' own RLS, exactly like the read policy's gate 1 does, so
the write path *transitively inherits* audience through that subquery in
addition to requiring friendship. A friend commenting on an `everyone` post is
still a friend, so that case behaves the same either way. But a `nobody` post
is invisible to everyone but its author — including a friend, because the
subquery itself can't see the row to match against — so even a friend of the
author is refused. The friendship clause and the inherited visibility clause
are two independent gates on this path, not one.

### 5.4 Delete policy

```sql
create policy "author or post owner deletes"
  on night_comments for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from night_posts p
      where p.id = night_comments.post_id and p.user_id = auth.uid()
    )
  );
```

**No UPDATE policy at all.** Absent policy = denied. That is decision 5
enforced by the database rather than by the UI.

## 6. Data layer — `src/lib/night/comments.ts`

New module, following `posts.ts` conventions exactly: RLS is the boundary, no
client-side filtering that could disagree with it, and a zero-rows-no-error
write is treated as a failure and thrown.

```ts
export type NightComment = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  author: FriendProfile;
};

/** Counts + the newest comment for each of the loaded posts, in one round
 *  trip. Called with the ids the feed just rendered. */
listCommentPreviews(postIds: string[]): Promise<Map<string, { count: number; latest: NightComment }>>

/** The full thread, oldest first — reading a conversation top to bottom. */
listComments(postId: string): Promise<NightComment[]>

addComment(input: { postId: string; userId: string; body: string }): Promise<NightComment>

deleteComment(commentId: string): Promise<void>
```

`listCommentPreviews` is one `select ... in (postIds)` ordered by
`(post_id, created_at)`, reduced client-side. Not an RPC and not a view — this
project has been bitten by a view freezing its column list, and there is no
reason to introduce one for a grouping this small.

React Query keys: `["night-comments", postId]` for a thread,
`["night-comment-previews", ...postIds]` for the feed row. Adding or deleting
invalidates both.

## 7. UI

### 7.1 `PostCard` — a preview row

`PostCard` is already 204 lines and does five things. The comment preview goes
in a new `CommentPreview.tsx`, rendered by `PostCard` after the night label:

- No comments and you can't write → render nothing.
- No comments and you can write → `Add a comment` (muted, tappable).
- Otherwise → the newest comment as `<name> <body>` truncated to two lines,
  with `View all N comments` above it when `N > 1`.

Tapping anywhere in the row opens the thread sheet.

### 7.2 `CommentSheet.tsx`

A `vaul` drawer, matching `AddNightSheet`/`PlansSheet`. The post's header
repeats at the top for context, the thread scrolls, the composer pins to the
bottom above the keyboard.

**Carry forward the file-dialog lesson:** any sheet that can lose typed input
needs its dismissal path thought through, and a guard that releases on window
focus rather than on an event that a cancelled interaction never fires. This
sheet has no file picker, but it does have a text input and a soft keyboard,
which is the same class of "the page blurs and vaul reads it as tapping away."
This is an explicit thing to drive by hand on a real phone-sized viewport,
not to assert from a passing test.

Non-friends see the thread read-only with a one-line explanation — `Only <name>'s
friends can comment` — rather than a composer that fails on submit.

### 7.3 Layout — no horizontal movement (Colton, explicit requirement)

The feed must scroll vertically over the full screen and must **never** scroll
or drift horizontally on mobile.

**Audited state:** there is no global horizontal guard. `src/index.css:69` sets
`body` to background/foreground/antialiased only — no `overflow-x`, no
`max-width`. Any single element that pokes past the viewport therefore scrolls
the entire page sideways.

**Cause found and reproduced in Chrome at a true 390×844 mobile viewport
(2026-08-07), not inferred:**

**The author line in `PostCard.tsx:88-96` has no `break-words`.** The `<p>` holds
three spans — display name, verb, venue title — and a single unbroken token in
the name or the title cannot wrap. `min-w-0` on the flex parent lets the *box*
shrink but does not let the *text* break, so the card grows past the viewport
and, with no page-level guard, the whole document scrolls sideways.

Measured, injecting the exact `PostCard` markup into the live `section.container`
at `clientWidth` 390:

| Case | `scrollWidth` | Overflow |
|---|---|---|
| Normal name and title | 390 | **0** |
| 60-char unbroken **display name** | 585 | **195px** |
| 60-char unbroken **venue title** | 626 | **236px** |
| 60-char unbroken **note** | 390 | 0 — the note already has `break-words` |
| Long URL in note | 390 | 0 |

**This is reachable with real data today.** There is no `maxLength` on the
display-name or username inputs in `EditProfileDialog.tsx`, and no length or
charset constraint on `profiles.username` / `profiles.display_name` in
`endz-schema.sql:22-23`. Any user can set a long unbroken display name and
break the horizontal layout of the feed **for everyone who can see their
posts** — it is not limited to the author's own view. The longest single word
across the 56 seeded venue titles is `International` (13 chars), so venue
titles are not currently a trigger; user-controlled names are.

**Cleared, having suspected them first:** the negative-offset unread badges
(`Social.tsx:98`, `:117`) and the `animate-ping` dot (`Social.tsx:167-169`)
each measured **0px** of overflow — the container's horizontal padding absorbs
the 2px. The 3-photo grid is also clean. I had these in an earlier draft of
this spec as likely causes; they are not.

Requirements, in priority order:

1. **Fix the cause: add `break-words` to the author line** in
   `PostCard.tsx:88`. This is a one-word change and it is the actual bug. It is
   worth shipping on its own regardless of whether comments are ever built.
2. **Add `html, body { overflow-x: clip; }` as a backstop.** `clip` rather than
   `hidden` because `overflow: hidden` on `body` creates a scroll container and
   breaks `position: sticky` in descendants; `clip` does not. This is a
   backstop, never the fix — an element that overflows still gets fixed at the
   element.
3. **Every new comment surface:** `min-w-0` on flex children, `break-words` on
   all user text — comment bodies *and* the commenter's display name, which is
   the same span that just proved it can break the feed. Comment bodies use
   `whitespace-pre-wrap break-words`, matching the note.
4. **Out of scope but logged:** a length cap on `display_name` / `username`
   at the input and in the DDL. The `break-words` fix makes the layout safe
   without it, so this is hygiene rather than a blocker — added to the tracker
   backlog, not built here.

**Acceptance test, run in a real browser at 390×844:**
`document.documentElement.scrollWidth <= document.documentElement.clientWidth`
must hold on `/social` — with the feed populated, with a comment thread open,
and with a post whose author display name and comment body are both
60-character unbroken strings. That last case is the one that catches this
class of bug, and it is the case a screenshot of normal data will never show.
The measurement technique that found it is worth reusing: walk every element,
flag any whose `getBoundingClientRect().right` exceeds `clientWidth`, which
names the offending node instead of just reporting that the page is too wide.

## 8. Moderation

- Report a comment via the existing dialog: `context="comment"`,
  `contextId={comment.id}`. Widening the `ReportContext` union is the only
  change; no DDL.
- The report option appears in a per-comment menu for comments that are not
  yours; delete appears for your own and, if you own the post, for all of them.
- §31 (App Store) note: Apple's UGC requirements are a report path, a block
  path, and a way to remove offending content. All three exist for comments on
  day one — report as above, block via the existing profile flow (which now
  also hides that person's comments, §5.2), and removal by the post author.
  **Comments do not add a new App Store blocker.**

## 9. Out of scope

Replies/threading · likes or reactions · editing · @mentions · photos in
comments · notifications of any kind · rate limiting beyond the 280-char cap ·
an admin moderation queue (reports land in the existing `reports` table and are
read the existing way).

## 10. Acceptance criteria

**Behavior**

1. A friend of the post author can comment; the comment appears in the thread
   and in the preview row for everyone who can see the post.
2. A non-friend who can see the post reads the thread and sees no composer,
   with the reason stated.
3. The post author can delete any comment on their post; a commenter can delete
   their own; nobody can delete anyone else's.
4. No one can edit any comment (no UPDATE policy exists).
5. Deleting a post removes its comments.
6. A blocked person's comments are invisible to you, including on a mutual
   friend's post.

**RLS, proved by role-impersonation in a rolled-back transaction — not by two
logins and not by the UI**

7. The §5.1 probe result is recorded in the DDL header.
8. A stranger reading comments on a `nobody` post → **0 rows**.
9. A non-friend inserting a comment on a `friends` post → **`42501`**.
10. A non-friend inserting a comment on an `everyone` post → **`42501`**
    (this is the decision-1 rule; it is the one an audience-only policy would
    wrongly allow).
11. A user deleting someone else's comment on someone else's post → **0 rows**.

**Layout**

12. The §7.3 `scrollWidth <= clientWidth` assertion holds at 390×844 in all
    three states, including the 60-character-unbroken-string case.

**Regression**

13. `npx tsc --noEmit -p tsconfig.app.json` clean.
14. Existing suite still green (301 at time of writing); new unit tests cover
    the preview reducer in `listCommentPreviews` — pure function, worth testing.
15. `npm run check:schema` reports no drift.
16. DDL recorded in `~/Documents/endz/endz-schema.sql`.

**Verification stance:** the suite is structurally blind to this app's real
failures — three bugs on 2026-08-07 passed 300 tests, including a component
that rendered nothing at all. Every criterion above that says "in a browser"
means in a browser, by hand. All test data deleted afterwards.
