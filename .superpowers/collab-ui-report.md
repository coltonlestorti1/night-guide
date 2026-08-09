# Collab tags UI — report

Built the four pieces on top of the already-committed `src/lib/night/tags.ts`.

## 1. `src/hooks/useTags.ts`
`usePostTags(postIds)` (batched, sorted key), `useMyPendingTags()`,
`useSetTagState()`, `useRemoveTag()`, `useAddTag()`. All three mutations share
one `useInvalidateTags()` helper that invalidates `["post-tags"]`,
`["pending-tags"]`, and `["night-feed"]` — the last one because accepting a
`collab` tag changes what `post_has_collab_for_me` lets the feed's SELECT
policy return, not just how an already-visible card renders.

## 2. "with Sam" line
`PostCard.tsx` takes an optional `tags?: PostTag[]`, renders
`withLine(tags)` directly under the neighbourhood line, nothing when null.
Wired into `FeedList.tsx` and `MyActivity.tsx` via `usePostTags` +
`tagsByPost`, same shape as the existing `commentPreview`/`likes` wiring.

## 3. Pending tag rows in `ActivitySheet.tsx`
New `PendingTagRow` renders above the reaction list in its own group under a
"Waiting on you" heading, fed by `useMyPendingTags()` — a separate query from
`useActivity`, so it is never gated on the `lastSeen` watermark and never
clears itself. Three actions: "Share with my friends" (`collab`), "Just a
tag" (`tag`), "Remove". Each wrapped in try/catch with `toast.error` on
failure.

## 4. Tagging on publish, `PublishForm.tsx`
Chip picker over `useMyFriendships()` + `deriveFriends`, shown only when the
user has accepted friends. Selected ids live in local state (reset alongside
`note`/`audience` when venue/night changes) and are only turned into
`addTag` calls after `publish.mutateAsync` resolves to a post id — `Promise.allSettled`
so one failed tag can't undo the post; a toast reports if any failed.
`isPrivatePost` is `audience === "nobody"`.

## FK constraint check
`scripts/2026-08-09-collab-tags-ddl.sql` declares
`tagged_user_id uuid not null references profiles (id) on delete cascade`
with no explicit `constraint <name>`. Postgres's default naming for an
unnamed column FK is `<table>_<column>_fkey`, which resolves to
`night_post_tags_tagged_user_id_fkey` — exactly the name `listTagsForPosts`
embeds (`profiles!night_post_tags_tagged_user_id_fkey`). **The embed name is
correct.**

## Constraints followed
- `break-words` on the "with Sam" line and pending-tag row text;
  `min-w-0` on their flex containers.
- Publish-form tag chips use a bounded `max-w-[9rem] truncate` on the name
  instead of break-words — a flex-wrap chip has no shrink target for
  break-words to wrap against, so a hard cap was used to block the same
  overflow bug class (documented inline).
- No padding+negative-margin tap-target growth was added; all new buttons are
  plain shadcn `Button` sizes.
- `ActivitySheet`'s scroll container already had `overflow-y-auto
  overflow-x-hidden`; untouched.
- No client-side re-checking of RLS decisions — only render logic.
- No unit tests added for these components (jsdom can't see layout).

## Verification run
- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npx vitest run` — 362 passed (37 files)
- `npm run build` — clean (pre-existing >500kB chunk-size warning only,
  unrelated to this change)
