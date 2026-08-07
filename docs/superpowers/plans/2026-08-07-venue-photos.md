# Venue Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every venue a real, Colton-curated photograph in place of the category placeholder all 56 currently show.

**Architecture:** Two additive columns on `venues` (`image_url`, `image_source`) plus a public `venue-photos` storage bucket whose writes are restricted to admins. Photos are uploaded from `/admin` through a canvas re-encode that downscales and strips EXIF, one at a time in the venue edit sheet or in bulk through a filename-matching panel that previews every match before writing. The app reads the new column in one line of `mapVenueRow`; the three render sites already handle real images and already fall back to the placeholder on error.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase (Postgres + Storage), TanStack Query, shadcn/ui, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-07-venue-photos-design.md`

## Global Constraints

- **Work only in the worktree** `/Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos` on branch `feat/venue-photos`. Never `cd` into `~/Documents/night-guide` — several sessions share it. Pass absolute paths to file tools and `cd <abs-path> &&` inside every Bash call.
- **Never `git add -A`.** Stage explicit paths only.
- **Typecheck with** `npx tsc --noEmit -p tsconfig.app.json`. Bare `npx tsc` is a silent no-op.
- **Tests:** `npm test` (`vitest run`). The Vitest environment is **`node`** and only `src/**/*.test.ts` is collected — **`.tsx` component tests do not run and must not be written.** Anything touching the DOM, canvas, or `createImageBitmap` is unit-untestable here and is verified in the browser instead. Baseline is 300 tests passing; every task must leave the suite green.
- **DDL never runs from code.** Only the publishable (anon) key exists locally. SQL goes to the clipboard, Colton pastes it into the Supabase SQL editor, and every statement is also recorded in `/Users/colton.lestorti/Documents/endz/endz-schema.sql`.
- **Image ceiling:** max edge **1200px**, JPEG quality **0.85**. (The spec said ~0.82; 0.85 matches both existing re-encoders, and matching them is worth more than the 3%.)
- **Storage path:** `venue-photos/<venue_id>/photo-<timestamp>.jpg`. Timestamped so a replacement never serves stale from CDN or browser cache.
- **Ordering rule, absolute:** commit `venues.image_url` **first**, delete the old file only after that write succeeds. An orphan file is invisible and cheap; a row pointing at a missing file is a broken image for every user.
- **This is not night-post photos.** Those are user content in the **private** `night-photos` bucket behind signed URLs. Never mix the buckets, the policies, or the tables.

---

### Task 1: DDL — columns, bucket, storage policies

**Files:**
- Create: `scripts/2026-08-07-venue-photos-ddl.sql`
- Modify: `/Users/colton.lestorti/Documents/endz/endz-schema.sql` (append the same statements)

**Interfaces:**
- Consumes: nothing.
- Produces: `venues.image_url text`, `venues.image_source text`, and the public `venue-photos` bucket. Every later task assumes these exist.

- [ ] **Step 1: Write the DDL script**

```sql
-- ============================================================================
-- 2026-08-07 — venue photos
-- Additive and idempotent. Safe to run more than once.
--
-- WHY THIS BUCKET IS PUBLIC, WHEN night-photos IS NOT
-- 718fe0a corrected night-photos from public to private, and that correction
-- was right: a night photo is AUDIENCE-SCOPED, so a public bucket would serve
-- a friends-only image to anyone holding the URL, breaking the promise the
-- audience tiers make from underneath them.
-- A venue photo has no audience to leak past. It is rendered on a card to
-- every user, signed in or out, by definition. Making it private would mean
-- minting signed URLs for 56 essentially-static images on every feed render —
-- defeating CDN caching and adding a round trip per card, in exchange for no
-- privacy whatsoever.
-- The control here is WRITE access, not read access: only admins can put a
-- photo in this bucket or point a venue at one.
-- ============================================================================

-- ---------- columns ----------
-- image_url: the durable public URL of the stored file (a public bucket has
-- one; night_post_photos stores a path precisely because a private bucket
-- does not).
-- image_source: where the photo came from — a URL, "supplied by venue", or a
-- photographer credit. Never rendered in the app. It exists so that a takedown
-- request is one admin edit instead of an investigation, and it is the entire
-- mitigation for sourcing photos from the web.
alter table venues add column if not exists image_url    text;
alter table venues add column if not exists image_source text;

-- ---------- storage bucket (PUBLIC — see the header) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- storage.objects policies ----------
-- Read: public = true already serves the object over the public URL, so this
-- SELECT policy exists for authenticated clients listing the bucket. Stated
-- explicitly rather than left implicit — assuming what a policy "probably"
-- does is how active_check_ins leaked every live check-in on 2026-08-06.
drop policy if exists "venue photos are publicly readable" on storage.objects;
create policy "venue photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

-- Write: admins only, matching the `venues` UPDATE policy in
-- scripts/2026-07-28-admin-ddl.sql. Three separate policies because Postgres
-- has no single "write" verb, and a missing DELETE policy would silently turn
-- every photo replacement into an orphaned file.
drop policy if exists "admins upload venue photos" on storage.objects;
create policy "admins upload venue photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-photos' and public.is_admin());

drop policy if exists "admins update venue photos" on storage.objects;
create policy "admins update venue photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'venue-photos' and public.is_admin())
  with check (bucket_id = 'venue-photos' and public.is_admin());

drop policy if exists "admins delete venue photos" on storage.objects;
create policy "admins delete venue photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and public.is_admin());

-- ---------- verification ----------
-- Run after pasting. Expect: two rows (image_url, image_source), and one
-- bucket row with public = true.
-- select column_name from information_schema.columns
--   where table_name = 'venues' and column_name in ('image_url', 'image_source');
-- select id, public, file_size_limit from storage.buckets where id = 'venue-photos';
```

- [ ] **Step 2: Append the same statements to the schema record**

Append the full contents of the new script to `/Users/colton.lestorti/Documents/endz/endz-schema.sql` under a `-- 2026-08-07 — venue photos` heading. Every DDL in this project is recorded there; a script that only exists in `scripts/` is invisible to the next session.

- [ ] **Step 3: Hand the SQL to Colton**

Copy the script to the clipboard:

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && pbcopy < scripts/2026-08-07-venue-photos-ddl.sql
```

Tell Colton it's on the clipboard, ask him to paste it into the Supabase SQL editor, and ask him to paste back the output of the two verification queries. **Do not claim the DDL is applied until he confirms.** The build can continue while this is pending — every later task fails loudly rather than silently if the columns are missing.

- [ ] **Step 4: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add scripts/2026-08-07-venue-photos-ddl.sql && \
git commit -m "feat(venues): DDL for curated venue photos"
```

---

### Task 2: Extract the shared image re-encoder

`downscale()` in `src/lib/avatarUpload.ts:6` and `reencode()` in `src/lib/night/photos.ts:30` are byte-identical apart from `MAX_EDGE` (512 vs 1600). A third copy for venue photos is the point at which this gets extracted. The night-feed session confirmed on the claim board that these files are unowned and the extraction is ours.

**Files:**
- Create: `src/lib/imageEncode.ts`
- Modify: `src/lib/avatarUpload.ts` (delete local `downscale`, import instead)
- Modify: `src/lib/night/photos.ts` (delete local `reencode`, import instead)

**Interfaces:**
- Consumes: nothing.
- Produces: `reencodeImage(file: File, opts: { maxEdge: number; quality?: number }): Promise<Blob>` — used by Task 5.

**No unit test.** `createImageBitmap` and `document.createElement("canvas")` do not exist in the `node` Vitest environment, and the constraint above forbids adding a DOM environment for one helper. This task is a pure refactor: its verification is that the typecheck passes, all 300 existing tests still pass, and the avatar and night-photo upload paths still work in the browser (Task 10).

- [ ] **Step 1: Create the shared helper**

```ts
/**
 * Canvas re-encode: downscale an image and re-emit it as JPEG.
 *
 * ⚠️ THE REDRAW IS THE EXIF STRIP, NOT A RESIZE CONVENIENCE.
 * Rebuilding the image from raw pixels discards all metadata. Camera EXIF
 * carries GPS coordinates and an exact capture time — precisely what
 * night_posts.night_date exists to withhold — so uploading an original File
 * would undo that privacy design through a side channel. Any future "skip the
 * resize when the image is already small" optimisation must still round-trip
 * through the canvas.
 *
 * Browser-only: createImageBitmap and canvas do not exist under Node, which is
 * why callers of this are verified in the browser rather than in Vitest.
 */
export async function reencodeImage(
  file: File,
  { maxEdge, quality = 0.85 }: { maxEdge: number; quality?: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      quality,
    ),
  );
}
```

- [ ] **Step 2: Point `avatarUpload.ts` at it**

Delete the `MAX_EDGE` constant and the whole `downscale` function. Add the import and a local wrapper so the call site below is unchanged:

```ts
import { reencodeImage } from "@/lib/imageEncode";

/** Downscale to ≤512px JPEG so we never store multi-MB originals. */
const downscale = (file: File) => reencodeImage(file, { maxEdge: 512 });
```

- [ ] **Step 3: Point `night/photos.ts` at it**

Delete its `MAX_EDGE` and `reencode` function, keeping the comment's reasoning attached to the new call:

```ts
import { reencodeImage } from "@/lib/imageEncode";

/**
 * Downscale to ≤1600px JPEG. Larger than an avatar because a feed photo is
 * looked at rather than glanced at, small enough to stay well under the
 * bucket's 5 MB cap. The redraw is also the EXIF strip — see imageEncode.ts.
 */
const reencode = (file: File) => reencodeImage(file, { maxEdge: 1600 });
```

- [ ] **Step 4: Verify nothing broke**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 type errors, 300 tests passing. If the count dropped, stop — you deleted something a test depended on.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/lib/imageEncode.ts src/lib/avatarUpload.ts src/lib/night/photos.ts && \
git commit -m "refactor(images): one canvas re-encoder for avatars, night photos and venues"
```

---

### Task 3: The app reads `image_url`

**Files:**
- Modify: `src/data/sources/SupabaseDataSource.ts` (the `VenueRow` type and `mapVenueRow`)
- Test: `src/data/sources/SupabaseDataSource.test.ts` (create if absent — check first)

**Interfaces:**
- Consumes: `venues.image_url` from Task 1.
- Produces: `Venue.image_url` populated in production. `BarCard`, `SavedSpotsList` and `VenuePreview` consume it with no change.

- [ ] **Step 1: Write the failing tests**

Check whether the test file exists first; if it does, add these cases to it rather than overwriting.

```ts
import { describe, it, expect } from "vitest";
import { mapVenueRow } from "./SupabaseDataSource";

const base = {
  id: "v1",
  name: "The Grafton",
  type: "bar",
  price: "$$" as const,
  description: null,
  music: null,
  age_range: null,
  lat: 40.7,
  lng: -73.9,
};

describe("mapVenueRow image_url", () => {
  it("carries a real photo URL through", () => {
    const v = mapVenueRow({ ...base, image_url: "https://x.supabase.co/a.jpg" });
    expect(v.image_url).toBe("https://x.supabase.co/a.jpg");
  });

  it("leaves image_url undefined when the column is absent", () => {
    // The column does not exist until the Task 1 DDL is pasted, and
    // select("*") simply returns fewer columns until then.
    expect(mapVenueRow(base).image_url).toBeUndefined();
  });

  it("treats null and empty string as no photo, so the placeholder wins", () => {
    expect(mapVenueRow({ ...base, image_url: null }).image_url).toBeUndefined();
    expect(mapVenueRow({ ...base, image_url: "" }).image_url).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx vitest run src/data/sources/SupabaseDataSource.test.ts
```

Expected: the first test FAILS (`expected undefined to be 'https://…'`). The other two pass trivially — that is fine and expected, they are guarding the fallback.

- [ ] **Step 3: Add the column to `VenueRow` and one line to the mapper**

In the `VenueRow` type, beside the other late-added optional columns:

```ts
  // Added 2026-08-07 with venue photos. Optional for the same reason as the
  // fields above: the code ships before the DDL is pasted.
  image_url?: string | null;
```

In `mapVenueRow`, with the other conditional assignments:

```ts
  if (row.image_url) venue.image_url = row.image_url;
```

`image_source` is deliberately **not** mapped. It is admin metadata; shipping it to every client on every venue fetch is pointless payload.

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx vitest run src/data/sources/SupabaseDataSource.test.ts && npm test
```

Expected: all three pass; full suite green.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/data/sources/SupabaseDataSource.ts src/data/sources/SupabaseDataSource.test.ts && \
git commit -m "feat(venues): the app reads image_url"
```

---

### Task 4: Admin data layer knows about the photo columns

**Files:**
- Modify: `src/admin/data/venues.ts` (`AdminVenueRow`, `EDITABLE_FIELDS`, `normalizeRow`)
- Test: `src/admin/data/venues.test.ts` (create if absent — check first)

**Interfaces:**
- Consumes: Task 1's columns.
- Produces: `AdminVenueRow.image_url: string | null`, `AdminVenueRow.image_source: string | null`, both in `EDITABLE_FIELDS`. Tasks 6, 7 and 9 rely on these names.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { normalizeRow, EDITABLE_FIELDS, cleanPatch } from "./venues";

describe("venue photo columns", () => {
  it("normalizes a missing image column to null, not undefined", () => {
    const row = normalizeRow({ id: "v1", name: "The Grafton", lat: 40.7, lng: -73.9 });
    expect(row.image_url).toBeNull();
    expect(row.image_source).toBeNull();
  });

  it("carries the stored values through", () => {
    const row = normalizeRow({
      id: "v1", name: "The Grafton", lat: 40.7, lng: -73.9,
      image_url: "https://x.supabase.co/a.jpg", image_source: "instagram.com/thegrafton",
    });
    expect(row.image_url).toBe("https://x.supabase.co/a.jpg");
    expect(row.image_source).toBe("instagram.com/thegrafton");
  });

  it("lets the editor write both", () => {
    expect(EDITABLE_FIELDS).toContain("image_url");
    expect(EDITABLE_FIELDS).toContain("image_source");
  });

  it("turns a cleared photo field into null, so Remove really unsets it", () => {
    expect(cleanPatch({ image_url: "" }).image_url).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx vitest run src/admin/data/venues.test.ts
```

Expected: FAIL — `image_url` is not a property of `AdminVenueRow`, and `EDITABLE_FIELDS` does not contain it.

- [ ] **Step 3: Add the fields**

In `AdminVenueRow`, after `neighborhood`:

```ts
  image_url: string | null;
  image_source: string | null;
```

In `EDITABLE_FIELDS`, after `"neighborhood"`:

```ts
  "image_url",
  "image_source",
```

In `normalizeRow`, after the `neighborhood` line:

```ts
    image_url: (row.image_url as string | null) ?? null,
    image_source: (row.image_source as string | null) ?? null,
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx vitest run src/admin/data/venues.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 4 new tests pass, 0 type errors, full suite green. Note the typecheck matters here — `quality.test.ts` builds `AdminVenueRow` fixtures and will fail to compile until they include the new required fields. Add `image_url: null, image_source: null` to that fixture if so.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/admin/data/venues.ts src/admin/data/venues.test.ts src/admin/data/quality.test.ts && \
git commit -m "feat(admin): venue photo columns in the admin data layer"
```

---

### Task 5: Venue photo upload and delete

**Files:**
- Create: `src/lib/venuePhotos.ts`

**Interfaces:**
- Consumes: `reencodeImage` (Task 2), the `venue-photos` bucket (Task 1).
- Produces:
  - `uploadVenuePhoto(file: File, venueId: string): Promise<string>` — returns the public URL.
  - `deleteVenuePhotoByUrl(url: string): Promise<void>` — best-effort cleanup of a superseded file.
  - `VENUE_PHOTO_MAX_EDGE = 1200`

**No unit test** — same reason as Task 2 (canvas + a live Supabase client). Verified in the browser in Task 10.

- [ ] **Step 1: Write the module**

```ts
/**
 * Curated venue photos. Colton-only: the `venue-photos` bucket restricts
 * INSERT/UPDATE/DELETE to public.is_admin(), so this module is unusable by a
 * normal signed-in user by design.
 *
 * NOT to be confused with src/lib/night/photos.ts — that is user-generated
 * content in a PRIVATE bucket read through signed URLs. This bucket is public
 * because a venue photo is shown to everyone by definition. See
 * scripts/2026-08-07-venue-photos-ddl.sql for the full reasoning.
 */
import { getSupabase } from "@/lib/supabase";
import { reencodeImage } from "@/lib/imageEncode";

const BUCKET = "venue-photos";

/** Hero renders at 176px tall, the card thumbnail at 112px. 1200 covers
 *  retina with headroom and keeps egress cheap on the free tier. */
export const VENUE_PHOTO_MAX_EDGE = 1200;

/**
 * Re-encode and upload, returning the durable public URL. Throws on failure —
 * including while the bucket does not exist yet — so callers surface the real
 * message rather than half-updating a venue.
 *
 * Deliberately does NOT remove the previous photo: it must stay live until
 * venues.image_url has been repointed. See deleteVenuePhotoByUrl.
 */
export async function uploadVenuePhoto(file: File, venueId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const blob = await reencodeImage(file, { maxEdge: VENUE_PHOTO_MAX_EDGE });
  const path = `${venueId}/photo-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Delete a stored photo given its public URL. Call this only AFTER
 * venues.image_url has been repointed — the reverse order 404s the live photo
 * if the row write fails.
 *
 * Best-effort: a failure here leaves an orphaned file, which is invisible and
 * costs a few hundred KB. Never let it fail the caller's save.
 */
export async function deleteVenuePhotoByUrl(url: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !url) return;
  const marker = `/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return; // not one of ours — an external URL, leave it alone
  const path = url.slice(at + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, suite green.

- [ ] **Step 3: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/lib/venuePhotos.ts && \
git commit -m "feat(venues): upload and delete curated venue photos"
```

---

### Task 6: Photo row in the venue edit sheet

**Files:**
- Modify: `src/admin/components/VenueEditSheet.tsx`

**Interfaces:**
- Consumes: `uploadVenuePhoto`, `deleteVenuePhotoByUrl` (Task 5); `AdminVenueRow.image_url` / `.image_source` (Task 4); `venueImageSrc` (`src/lib/venueImages.ts`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the imports and upload state**

```ts
import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { uploadVenuePhoto, deleteVenuePhotoByUrl } from "@/lib/venuePhotos";
import { PLACEHOLDER } from "@/lib/venueImages";
```

Inside the component, beside `const [saving, setSaving] = useState(false);`:

```ts
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // The photo the venue had when the sheet opened. If the draft now points
  // somewhere else, this file is superseded and gets deleted after a
  // successful save — never before.
  const supersededUrl = venue.image_url;
```

- [ ] **Step 2: Add the pick handler**

```ts
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set("image_url", await uploadVenuePhoto(file, venue.id));
    } catch (e) {
      // Verbatim: while the bucket is missing, the Postgres/storage message
      // names the real cause and a friendly rewrite would hide it.
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
```

- [ ] **Step 3: Clean up the superseded file after the save succeeds**

In the existing `save` function, immediately after `await updateAdminVenue(venue.id, changed);` and **before** `toast.success(...)`:

```ts
      // Only now that the row points at the new URL. The reverse order 404s
      // the live photo if the write fails.
      if (supersededUrl && supersededUrl !== draft.image_url) {
        await deleteVenuePhotoByUrl(supersededUrl);
      }
```

- [ ] **Step 4: Render the photo row**

Insert as the **first** child of the `<div className="flex-1 space-y-4 pb-4">` block, above the Name field:

```tsx
          <FieldRow
            label="Photo"
            hint="Venue-owned photos only (their Instagram or site). Not Google Maps, not press sites."
          >
            <div className="flex gap-3">
              <img
                src={draft.image_url || PLACEHOLDER[draft.type] || PLACEHOLDER.bar}
                alt=""
                className="h-20 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
              />
              <div className="flex flex-col justify-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  {draft.image_url ? "Replace" : "Add photo"}
                </Button>
                {draft.image_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => set("image_url", null)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </FieldRow>

          <FieldRow
            label="Photo source"
            hint="Where it came from. Makes a takedown a 30-second edit."
          >
            <Input
              value={draft.image_source ?? ""}
              onChange={(e) => set("image_source", e.target.value)}
              placeholder="instagram.com/venuehandle"
            />
          </FieldRow>
```

Note the placeholder uses `draft.type`, not a category string — `PLACEHOLDER` is keyed by `bar` / `club` / `lounge`, which is exactly what `AdminVenueRow.type` holds.

- [ ] **Step 5: Block saving mid-upload**

Add `|| uploading` to the Save button's `disabled` expression:

```tsx
            disabled={!dirty || saving || uploading || coordsInvalid}
```

Without this, saving while an upload is in flight commits the old URL and orphans the new file.

- [ ] **Step 6: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, suite green. (Reachability of this UI is verified in Task 10 — a component that renders nothing passes every check here. That exact failure shipped in `PublishSheet` on 2026-08-07.)

- [ ] **Step 7: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/admin/components/VenueEditSheet.tsx && \
git commit -m "feat(admin): add, replace and remove a venue photo"
```

---

### Task 7: Thumbnails and a "no photo" filter in the venues table

**Files:**
- Modify: `src/admin/pages/AdminVenues.tsx`

**Interfaces:**
- Consumes: `AdminVenueRow.image_url` (Task 4).
- Produces: nothing consumed by later tasks.

This is the review surface: all 56 venues on one screen, so a wrong or ugly photo is obvious at a glance and one tap from fixed.

- [ ] **Step 1: Add "no photo" to the filter type and state**

```ts
type ActiveFilter = "all" | "active" | "dormant" | "no photo";
```

- [ ] **Step 2: Handle it in the filter and the counts**

In the `venues` memo, replace the two filter lines with:

```ts
      if (activeFilter === "active" && !v.is_active) return false;
      if (activeFilter === "dormant" && v.is_active) return false;
      if (activeFilter === "no photo" && v.image_url) return false;
```

In the `counts` memo, add:

```ts
      "no photo": rows.filter((v) => !v.image_url).length,
```

- [ ] **Step 3: Add the filter button**

Change the filter button list to include the new value:

```tsx
            {(["all", "active", "dormant", "no photo"] as const).map((f) => (
```

- [ ] **Step 4: Add the thumbnail column**

Import the placeholder helper:

```ts
import { PLACEHOLDER } from "@/lib/venueImages";
```

Add a header cell as the first column, with an empty accessible label since the image is decorative next to the name:

```tsx
                    <TableHead className="w-14"><span className="sr-only">Photo</span></TableHead>
```

And as the first cell in each row:

```tsx
                      <TableCell>
                        <img
                          src={v.image_url || PLACEHOLDER[v.type] || PLACEHOLDER.bar}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      </TableCell>
```

- [ ] **Step 5: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, suite green.

- [ ] **Step 6: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/admin/pages/AdminVenues.tsx && \
git commit -m "feat(admin): venue thumbnails and a no-photo filter"
```

---

### Task 8: Filename → venue matching

The one piece of real logic in this feature, and the one place a serious bug can hide: a photo silently attached to the **wrong bar** looks fine, breaks no test, and is discovered by a user standing outside a different venue. Pure functions, fully tested.

**Files:**
- Create: `src/admin/data/photoMatch.ts`
- Test: `src/admin/data/photoMatch.test.ts`

**Interfaces:**
- Consumes: `AdminVenueRow` (Task 4).
- Produces:
  - `slugify(s: string): string`
  - `type PhotoMatch = { fileName: string; venueId: string | null; confidence: "exact" | "ambiguous" | "none"; candidates: string[] }`
  - `matchFileToVenues(fileName: string, venues: AdminVenueRow[]): PhotoMatch`
  - Task 9 renders exactly this shape.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { slugify, matchFileToVenues } from "./photoMatch";
import type { AdminVenueRow } from "./venues";

function venue(id: string, name: string): AdminVenueRow {
  return {
    id, name, type: "bar", price: null, description: null, music: null,
    age_range: null, lat: 40.7, lng: -73.9, neighborhood: null,
    image_url: null, image_source: null, is_college_scene: false,
    has_rooftop: false, has_outdoor: false, is_active: true,
  };
}

const VENUES = [
  venue("v1", "Amor y Amargo"),
  venue("v2", "The Grafton"),
  venue("v3", "Death & Co"),
  venue("v4", "Bar Nine"),
  venue("v5", "Bar Nine"), // deliberate duplicate name
];

describe("slugify", () => {
  it("lowercases and collapses separators", () => {
    expect(slugify("Amor y Amargo")).toBe("amor y amargo");
    expect(slugify("amor-y-amargo")).toBe("amor y amargo");
    expect(slugify("amor_y_amargo")).toBe("amor y amargo");
    expect(slugify("  Amor   y  Amargo  ")).toBe("amor y amargo");
  });

  it("drops punctuation so & and 'and' both land", () => {
    expect(slugify("Death & Co")).toBe("death co");
    expect(slugify("death-and-co")).toBe("death co");
  });
});

describe("matchFileToVenues", () => {
  it("matches a hyphenated filename to its venue", () => {
    const m = matchFileToVenues("amor-y-amargo.jpg", VENUES);
    expect(m.venueId).toBe("v1");
    expect(m.confidence).toBe("exact");
  });

  it("ignores the extension and case", () => {
    expect(matchFileToVenues("The_Grafton.PNG", VENUES).venueId).toBe("v2");
  });

  it("ignores a trailing counter from a download", () => {
    expect(matchFileToVenues("the-grafton (1).jpg", VENUES).venueId).toBe("v2");
    expect(matchFileToVenues("the-grafton-2.webp", VENUES).venueId).toBe("v2");
  });

  it("refuses to guess when two venues share a name", () => {
    const m = matchFileToVenues("bar-nine.jpg", VENUES);
    expect(m.confidence).toBe("ambiguous");
    expect(m.venueId).toBeNull();
    expect(m.candidates).toEqual(["v4", "v5"]);
  });

  it("reports no match rather than picking something close", () => {
    const m = matchFileToVenues("some-random-bar.jpg", VENUES);
    expect(m.confidence).toBe("none");
    expect(m.venueId).toBeNull();
  });

  it("does not fuzzy-match a substring — a wrong bar is worse than no bar", () => {
    // "bar" appears inside "Bar Nine" but must not match on its own.
    expect(matchFileToVenues("bar.jpg", VENUES).confidence).toBe("none");
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx vitest run src/admin/data/photoMatch.test.ts
```

Expected: FAIL — `Cannot find module './photoMatch'`.

- [ ] **Step 3: Implement**

```ts
/**
 * Matching dropped photo files to venues by filename.
 *
 * Exact-or-nothing, deliberately. Fuzzy matching would let "bar.jpg" land on
 * "Bar Nine", and a photo on the wrong venue is invisible in every test,
 * looks perfectly fine in the admin table, and is discovered by a user
 * standing outside a different bar. Anything not certain is handed back to
 * Colton to resolve with a dropdown.
 */
import type { AdminVenueRow } from "./venues";

/** Lowercase, strip punctuation, collapse separators to single spaces. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Strip the extension and any trailing download counter: "x (1)", "x-2". */
function baseName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[-_\s]+\d+$/, "");
}

export type PhotoMatch = {
  fileName: string;
  venueId: string | null;
  confidence: "exact" | "ambiguous" | "none";
  candidates: string[];
};

export function matchFileToVenues(
  fileName: string,
  venues: AdminVenueRow[],
): PhotoMatch {
  const target = slugify(baseName(fileName));
  const hits = venues.filter((v) => slugify(v.name) === target);

  if (hits.length === 1) {
    return { fileName, venueId: hits[0].id, confidence: "exact", candidates: [hits[0].id] };
  }
  if (hits.length > 1) {
    return {
      fileName, venueId: null, confidence: "ambiguous",
      candidates: hits.map((v) => v.id),
    };
  }
  return { fileName, venueId: null, confidence: "none", candidates: [] };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx vitest run src/admin/data/photoMatch.test.ts && npm test
```

Expected: 8 new tests pass; full suite green.

- [ ] **Step 5: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/admin/data/photoMatch.ts src/admin/data/photoMatch.test.ts && \
git commit -m "feat(admin): exact-or-nothing filename to venue matching"
```

---

### Task 9: Bulk photo panel

**Files:**
- Create: `src/admin/components/BulkPhotoPanel.tsx`
- Modify: `src/admin/pages/AdminVenues.tsx` (render the panel)

**Interfaces:**
- Consumes: `matchFileToVenues` / `PhotoMatch` (Task 8), `uploadVenuePhoto` (Task 5), `updateAdminVenue` (Task 4), `AdminVenueRow`.
- Produces: nothing consumed by later tasks.

The load-bearing property: **nothing is written until Colton has seen the match table and confirmed.** That confirmation step is the "final say" requirement, and it is the only guard against the wrong-bar failure.

- [ ] **Step 1: Write the panel**

```tsx
/**
 * Bulk venue photos: drop a folder, review every match, then write.
 *
 * Lives in /admin rather than scripts/ for two reasons, both checked:
 * only the publishable (anon) key exists on disk, so a CLI script could not
 * satisfy is_admin() without introducing an RLS-bypassing service-role key;
 * and the canvas re-encode is browser-only. In the browser Colton is already
 * an authenticated admin, so the existing policy does the authorising and no
 * new secret exists anywhere.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { matchFileToVenues, type PhotoMatch } from "../data/photoMatch";
import { updateAdminVenue, type AdminVenueRow } from "../data/venues";
import { uploadVenuePhoto } from "@/lib/venuePhotos";

const UNASSIGNED = "__none__";

type Staged = PhotoMatch & { file: File; previewUrl: string };

const BulkPhotoPanel = ({
  venues,
  onDone,
}: {
  venues: AdminVenueRow[];
  onDone: () => void;
}) => {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [source, setSource] = useState("");
  const [running, setRunning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const stage = (files: FileList | null) => {
    if (!files) return;
    setStaged(
      Array.from(files).map((file) => ({
        ...matchFileToVenues(file.name, venues),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    );
  };

  const assign = (fileName: string, venueId: string) =>
    setStaged((s) =>
      s.map((item) =>
        item.fileName === fileName
          ? {
              ...item,
              venueId: venueId === UNASSIGNED ? null : venueId,
              confidence: venueId === UNASSIGNED ? "none" : "exact",
            }
          : item,
      ),
    );

  const ready = staged.filter((s) => s.venueId);

  const run = async () => {
    setRunning(true);
    let ok = 0;
    const failed: string[] = [];
    for (const item of ready) {
      try {
        const url = await uploadVenuePhoto(item.file, item.venueId!);
        await updateAdminVenue(item.venueId!, {
          image_url: url,
          ...(source.trim() ? { image_source: source.trim() } : {}),
        });
        ok++;
      } catch (e) {
        failed.push(`${item.fileName}: ${(e as Error).message}`);
      }
    }
    setRunning(false);
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    if (fileInput.current) fileInput.current.value = "";
    toast[failed.length ? "warning" : "success"](
      `${ok} photo${ok === 1 ? "" : "s"} set${failed.length ? `, ${failed.length} failed` : ""}.`,
    );
    // Verbatim, one toast each: a bulk run that hides its failures behind a
    // count is how you end up believing 56 venues have photos when 9 do not.
    failed.forEach((f) => toast.error(f));
    onDone();
  };

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => stage(e.target.files)}
        />
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Choose photos
        </Button>
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source for this batch, e.g. venue Instagram"
          className="min-w-[240px] flex-1"
        />
        <span className="text-xs text-muted-foreground">
          Name each file after the venue: <code>amor-y-amargo.jpg</code>
        </span>
      </div>

      {staged.length > 0 && (
        <>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {staged.map((item) => (
              <div key={item.fileName} className="flex items-center gap-3 rounded border border-border p-2">
                <img src={item.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.fileName}</span>
                {item.confidence === "exact" ? (
                  <span className="text-sm">
                    {venues.find((v) => v.id === item.venueId)?.name}
                  </span>
                ) : (
                  <Select
                    value={item.venueId ?? UNASSIGNED}
                    onValueChange={(v) => assign(item.fileName, v)}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Pick a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Skip this file</SelectItem>
                      {(item.confidence === "ambiguous"
                        ? venues.filter((v) => item.candidates.includes(v.id))
                        : venues
                      ).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {v.neighborhood ? ` — ${v.neighborhood}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button onClick={run} disabled={running || ready.length === 0}>
              {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload {ready.length} photo{ready.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" onClick={() => setStaged([])} disabled={running}>
              Clear
            </Button>
            {staged.length !== ready.length && (
              <span className="text-xs text-muted-foreground">
                {staged.length - ready.length} unmatched — assign or they&apos;re skipped.
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default BulkPhotoPanel;
```

Note the ambiguous case narrows the dropdown to just the candidates, while the no-match case offers every venue — the two need different lists, and collapsing them would make a duplicate-name choice harder, not easier.

- [ ] **Step 2: Render it behind a toggle on the venues page**

In `AdminVenues.tsx`, add state and a button beside the filters, so the panel is not permanently occupying the top of the page:

```ts
const [bulkOpen, setBulkOpen] = useState(false);
```

```tsx
            <Button variant={bulkOpen ? "default" : "outline"} size="sm" onClick={() => setBulkOpen((b) => !b)}>
              Bulk photos
            </Button>
```

And above the table, inside the `configured` block:

```tsx
          {bulkOpen && (
            <BulkPhotoPanel venues={data ?? []} onDone={() => refetch()} />
          )}
```

Import it: `import BulkPhotoPanel from "../components/BulkPhotoPanel";`

Note `venues={data ?? []}` passes the **unfiltered** list deliberately — matching against a search-filtered subset would silently fail to match venues that are merely scrolled out of view.

- [ ] **Step 3: Verify**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Expected: 0 errors, suite green.

- [ ] **Step 4: Commit**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add src/admin/components/BulkPhotoPanel.tsx src/admin/pages/AdminVenues.tsx && \
git commit -m "feat(admin): bulk venue photos with a confirm-before-write preview"
```

---

### Task 10: Browser verification and docs

Nothing in Tasks 6, 7 and 9 is covered by a unit test — the Vitest environment is `node` and collects only `.ts`. This repo has already shipped a component that rendered nothing while 298 tests, the typecheck and the schema guard all passed. **This task is the real gate.**

**Files:**
- Modify: `docs/ENDZ_MASTER_TASKS.md`

**Prerequisite:** Colton has confirmed the Task 1 DDL is applied. Do not attempt this before that.

- [ ] **Step 1: Run the full check suite**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
npx tsc --noEmit -p tsconfig.app.json && npm test && npm run check:schema && npm run build
```

Expected: 0 type errors; suite green (300 baseline + 15 new); schema guard reports 0 drift; production build clean.

Note `check:schema` reads `.env.local`, which is gitignored and therefore **absent from this worktree** — it exits 2 and skips silently. That is the bug found on 2026-08-07. If it skips, re-run it from the main checkout, read-only, or copy `.env.local` into the worktree first.

- [ ] **Step 2: Verify in the browser, signed in as an admin**

Start `npm run dev` and walk `/admin/venues`:

1. The table shows a thumbnail column; unphotographed venues show their category placeholder, not a broken image.
2. "No photo" filter shows 56 before any upload.
3. Open a venue → the Photo row renders → "Add photo" opens a file dialog → pick a real photo → preview updates → Save.
4. Reload: the photo persists.
5. **Check the app side:** the venue's card in the list, its hero in the bottom sheet, and its row in saved spots all show the real photo.
6. Replace it with a different photo → Save → the new photo appears immediately, not a cached old one.
7. Remove → Save → clean category placeholder, no broken image.
8. Bulk: open the panel, choose 3 files — one named exactly, one for a duplicate name, one nonsense — and confirm the preview table marks them correctly **before** you press upload. Press upload; confirm the three outcomes match what was previewed.
9. **Confirm the avatar and night-photo paths still work** — Task 2 touched both. Change your profile photo on `/profile`, and attach a photo to a night post on `/social`.

- [ ] **Step 3: Delete the verification data**

Remove any test photo you set on a real venue, and delete the night post from step 9. Every prior session on this repo has cleaned up its verification data; do the same.

- [ ] **Step 4: Update the tracker**

In `docs/ENDZ_MASTER_TASKS.md`:
- Mark the "Venue photography — where do real photos come from?" open question as **RESOLVED 2026-08-07**, recording the decision: venue-owned photos, Google Places still excluded, provenance stored in `image_source`.
- Note that "list-view images" in §19 is now unblocked — the mechanism exists, filling it is content work.
- State plainly that the mechanism ships with **0 of 56 venues photographed**; the app is correct at 0, 12 or 56.

- [ ] **Step 5: Commit and report**

```bash
cd /Users/colton.lestorti/Documents/night-guide/.claude/worktrees/venue-photos && \
git add docs/ENDZ_MASTER_TASKS.md && \
git commit -m "docs(tracker): venue photo sourcing resolved, mechanism shipped"
```

Report to Colton what was verified **in the browser** versus what only passed automated checks, and hand the merge decision to him. Do not merge or push without his say-so.

---

## Self-Review

**Spec coverage:** Data model → Task 1. Public-bucket reasoning → Task 1 header. Upload path + re-encode + shared helper → Tasks 2, 5. Admin edit surface → Task 6. Admin review surface → Task 7. Bulk import → Tasks 8, 9. App read path → Task 3. Error handling → Tasks 5, 6, 9 (verbatim messages, orphan-over-broken-row, per-file failure toasts). Testing → Tasks 3, 4, 8 unit; Task 10 browser. Cost → enforced by the 1200px ceiling in Task 5. Out of scope items are absent from the plan, as intended.

**Deviations from the spec, both deliberate:** JPEG quality is 0.85 rather than ~0.82, to match the two existing re-encoders. The spec's open question about the "no photo" filter is resolved as *yes, build it* (Task 7) — it is three lines and it is how Colton finds the gaps.

**Type consistency:** `AdminVenueRow.image_url` / `.image_source` (Task 4) are used unchanged in Tasks 6, 7, 8, 9. `PhotoMatch` (Task 8) is rendered field-for-field in Task 9. `reencodeImage(file, { maxEdge, quality })` (Task 2) is called with that exact signature in Task 5 and both migrated call sites. `uploadVenuePhoto(file, venueId)` (Task 5) is called identically in Tasks 6 and 9.
