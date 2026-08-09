# Deletion and retention — design

**Date:** 2026-08-09
**Status:** design approved by Colton, build approved
**Origin:** findings #4 and #8 of the 2026-08-09 full security review, handed
off unfixed. The escalation in Part 1 was found during this audit, not in the
original review.

## The problem in one line

ENDZ tells users their data is deleted and then keeps it — and in one case, a
photo the user deleted can be re-published to a wider audience by someone else.

## What is actually broken

### 1. A deleted photo can be re-claimed and widened (escalation)

The `night_post_photos` INSERT policy checks that the *post* belongs to the
caller. It never checks that `storage_path` belongs to the caller. The unique
index on `storage_path` normally prevents re-using another user's path — but
deleting a post frees that index entry, and the file was never removed.

1. Alice posts a friends-only photo. Bob, a friend, reads `storage_path`
   straight out of the feed payload.
2. Alice deletes the post. Row gone, file retained, path unclaimed.
3. Bob attaches Alice's path to his own `everyone` post. The storage read
   policy joins through *Bob's* post, so Alice's deleted private photo becomes
   signable by every user on ENDZ.

Alice did the one thing the product told her would make it go away. This is an
exposure path, not a retention complaint, and it is the reason this work has a
deadline.

### 2. Nothing ever deletes a file

Three independent leaks, all row-only:

- **Abandoned composer.** `PublishForm.tsx:131` uploads the moment a file is
  picked, before any post exists. `PublishForm.tsx:248` removes it from React
  state only. Tapping X, or closing the sheet, strands the file with no row
  ever created. This is the confirmed source of the 2 live orphans.
- **Post deleted.** `deletePost` (`posts.ts:158`) deletes the `night_posts`
  row. Photo rows cascade. Storage objects are untouched.
- **Account deleted.** `delete_own_account()` cascades the tables and touches
  no storage at all.

`deleteNightPhoto` (`photos.ts:103`) is the only function that removes row and
file together — and it has zero callers. It also ignores the result of
`storage.remove()`, so a failed delete is silent.

### 3. Your avatar survives your account

Avatars live in the **public** `avatars` bucket. After account deletion the
photo is still served at a stable public URL, while `DELETION_REMOVES`
(`account.ts:17`) tells the user in the confirm dialog that their photo is
removed. That is a false statement in a consent dialog.

`DELETION_REMOVES` is also stale in the other direction: it never mentions
posts, photos, comments, likes, ratings or tags, all of which are destroyed.

### 4. Deleting your account erases the reports about you

`reports.reporter_id` and `reports.reported_user_id` are both
`on delete cascade` to `profiles`. So: harass people, tap Delete Account —
which Guideline 5.1.1(v) *requires* the app to offer — and every report about
you evaporates. Re-register clean.

Apple Guideline 1.2 compliance rests on that record existing, and
`delete_own_account()` is self-serve.

## Decisions

| Decision | Call | Why |
|---|---|---|
| `reporter_id` on account deletion | `set null`, no snapshot | The report is a safety record about someone *else*. The reporter's identity is not what makes it actionable, and keeping it retains personal data about someone who asked to be forgotten. |
| `reported_user_id` on account deletion | `set null` + snapshot of username and display name | A report whose subject is nulled out is an unreadable record. Snapshot is the minimum identity that keeps it meaningful. |
| Where the snapshot is written | `before insert` trigger | Client-supplied values would be spoofable straight past the INSERT policy. |
| Storage cleanup on account deletion | Client-side, before the RPC, best-effort | Both buckets already have own-folder DELETE policies, so this needs no new grants. Deletion must never be blocked by a storage failure. |
| Backstop for missed files | Admin sweep, paths only | Without it, an account-deletion orphan is permanently undeletable — the only DELETE policy is "your own folder" and the owner is gone. |
| Admin SELECT on `night-photos` | **Rejected** | It is the easy way to build the sweep and it would hand the admin every friends-only photo on the app. The sweep gets paths from a definer function and a delete policy constrained to unreferenced paths instead. |

## Design

### Part 1 — Constrain the path (DDL)

Add to the `night_post_photos` INSERT policy:

```sql
and split_part(storage_path, '/', 1) = auth.uid()::text
```

`split_part` rather than `storage.foldername()`: `storage_path` is a plain
column on a public table, so there is no reason to reach into the storage
schema for a prefix test. Paths are written as `<uid>/<uuid>.jpg` by
`uploadNightPhoto`.

**This part stands alone.** It holds even if every cleanup path below fails
forever, which is why it ships and is proved first.

### Part 2 — Reports outlive the account (DDL)

- `reported_username` / `reported_display_name` columns, backfilled from
  `profiles` **before** the FKs change, while every id still resolves
- both FK columns become nullable
- both FKs recreated `on delete set null`, dropped by lookup rather than by
  guessing the generated constraint name
- `reports_snapshot_reported()` `before insert` trigger, SECURITY DEFINER with
  `search_path = public, pg_temp` so the snapshot is written regardless of what
  the reporter can SELECT

The INSERT policy is unchanged, so every *new* report is still attributed —
only departure nulls it. The dedupe partial indexes keep working: Postgres
treats NULLs as distinct, so orphaned reports simply stop blocking new ones.

### Part 3 — Deletion removes the bytes (client)

1. **`PublishForm`** — X on a pending photo removes it from storage; unmounting
   with photos still pending removes them too.
2. **`deletePost`** — read the paths, delete the post, remove the files, and
   **check the `storage.remove()` result** instead of discarding it.
3. **`deleteOwnAccount`** — remove `night-photos/<uid>/` and `avatars/<uid>/`
   before calling the RPC, because the JWT is worthless the moment it returns.
   Best-effort: a storage failure is logged and the account deletion proceeds.

### Part 4 — Admin orphan sweep

`list_orphaned_storage()`, SECURITY DEFINER, admin-gated, returning bucket,
path, created_at and size — never content. An orphan is:

- `night-photos`: no `night_post_photos` row with that `storage_path`
- `avatars`: folder uid has no `profiles` row

Plus a DELETE policy on `storage.objects` for each bucket, gated on
`is_admin()` **and** on the path being unreferenced, so the policy itself
cannot be used to delete a live photo.

Surfaces as a panel in `/admin` showing the orphan list with a count and a
sweep action. This is also what clears the 2 existing orphans.

### Part 5 — Make the dialog true

Rewrite `DELETION_REMOVES` to list what actually goes: profile, username and
photo; check-in history; saved spots; friends and pending requests; plans and
RSVPs; **posts and their photos; comments; likes; venue ratings; tags**.

## Acceptance criteria

1. A user cannot insert a `night_post_photos` row whose `storage_path` is
   outside their own folder — proved by role-impersonation SQL, attempting the
   exact Bob-reclaims-Alice's-path sequence, expecting `42501`.
2. Removing a pending photo in the composer, then querying the bucket, shows
   the file gone.
3. Deleting a post removes both the rows and the files.
4. Deleting an account removes the user's night photos **and** their avatar;
   the avatar's public URL 404s afterward.
5. A report survives its subject deleting their account, with
   `reported_user_id` null and `reported_username` populated.
6. A report survives its reporter deleting their account, with `reporter_id`
   null and no reporter snapshot.
7. `list_orphaned_storage()` returns 0 rows for a non-admin and the real orphan
   set for an admin.
8. The admin delete policy refuses a path that is still referenced.
9. Existing orphan count goes 2 → 0.

Criteria 4, 5 and 6 destroy accounts, so they run against throwaway accounts,
not Colton's.

## Out of scope, logged to the tracker

- `MAX_PHOTOS_PER_POST = 3` is client-only with no DB constraint.
- The night-photos policies still duplicate the audience predicate that
  `night_posts` already enforces (policy inheritance was proved on 2026-08-07).
- Avatar files whose profile still exists but whose `avatar_url` points
  elsewhere are not treated as orphans; `avatarUpload` already prunes stale
  versions on replace.
