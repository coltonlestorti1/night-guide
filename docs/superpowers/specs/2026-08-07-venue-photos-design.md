# Venue photos — design

**Date:** 2026-08-07
**Status:** design agreed with Colton 2026-08-07; **not yet approved for
implementation** — the tracker gate still applies to the build.
**Tracker:** closes the "Venue photography — where do real photos come from?"
open question and the "real photo strategy for venues" line in the
full-launch-readiness backlog. Unblocks the "list-view images" item in §19.

## Purpose

Give every venue a real photograph, curated by Colton, replacing the category
placeholder that all 56 venues show today.

This is a content problem with a small amount of plumbing attached, not a
feature. The render sites already exist and already expect a real image; there
is simply nothing to render.

## What is true today (verified 2026-08-07)

- **`venues` has no image column.** Not in `endz-schema.sql`, not in any
  script in `scripts/`.
- **Nothing populates one.** `mapVenueRow`
  (`src/data/sources/SupabaseDataSource.ts:47`) never sets `image_url`. The
  field on the `Venue` type (`src/data/types.ts:33`) is a survivor of the demo
  data era and is always `undefined` in production.
- **Three render sites are already built and already degrade correctly:**
  `BarCard` (list thumbnail, `src/components/BarCard.tsx:17`), `SavedSpotsList`
  (`:65`), and `VenuePreview`'s hero image (`:72`). Each falls back to the
  category placeholder in `src/lib/venueImages.ts` on a missing or broken URL.
- **Admin writes are already gated correctly.** `venues` carries an
  admins-only UPDATE policy (`scripts/2026-07-28-admin-ddl.sql:84`), and
  `VenueEditSheet.tsx` already edits every other column.

So the app-side work is one line. The build is storage, an admin surface, and
an import path.

## What this is NOT

**This is not night-post photos.** Those shipped earlier today (`84f3ab7`) and
are user-generated content on `night_posts`, living in the **private**
`night-photos` bucket behind signed URLs and audience-scoped RLS.

The two must not be conflated, in code or in storage:

| | Venue photos (this spec) | Night post photos (shipped) |
|---|---|---|
| Author | Colton only | any user |
| Audience | everyone, always | scoped: just-me / friends / school |
| Bucket | `venue-photos`, public | `night-photos`, private |
| Read path | durable public URL | short-lived signed URL |
| Table | column on `venues` | `night_post_photos` child table |

A user photo must never be able to become a venue's hero image. Keeping them in
separate buckets with separate write policies makes that structural rather than
a rule someone has to remember.

## Sourcing and licensing — the decision

Colton is sourcing photos from the web (stated 2026-08-07). The rules we agreed:

1. **Google Maps / Places photos are excluded.** Not a copyright judgment — a
   contract term. Places content may not be pre-fetched, cached, stored or
   modified (the 2026-08-05 finding, recorded in the tracker). This was already
   decided; nothing here reopens it.
2. **Venue-owned photos (their Instagram, their website) are the working
   source.** The venue holds copyright, but the use promotes that venue and is
   the standard practice for nightlife apps pre-partnership. Small, known,
   reversible risk.
3. **Publisher photos (Yelp, Eater, Time Out, blogs) are excluded.** Those
   rights-holders enforce.
4. **Provenance is stored, not remembered.** Every photo records where it came
   from. A takedown request becomes a single admin edit instead of an
   investigation.

Point 4 is the reason `image_source` exists below. It is the entire risk
mitigation, and it costs one column.

**Upgrade path, non-code:** venues asked directly will often supply a press
shot, and a better one. That is outreach, not a build task, and it swaps in
through the same admin field with no migration.

## Design

### 1. Data

Additive, idempotent, in the house style of `scripts/*.sql`:

```sql
alter table venues add column if not exists image_url    text;
alter table venues add column if not exists image_source text;
```

- `image_url` — the durable public URL of the stored file.
- `image_source` — free text: the page the photo came from, or `"supplied by
  venue"`, or a photographer credit. Never shown in the app; it exists for
  Colton and for a takedown.

**Why a URL column and not a child table:** one photo per venue, deliberately.
All three render sites take a single image, and a gallery is a materially
bigger build (ordering, a carousel, a picker) for value that a single good
photo already delivers. If a gallery is ever wanted, `venue_photos` can be
added then and `image_url` becomes the derived "primary" — this decision does
not block that.

**Why a URL and not a storage path** (the opposite of `night_post_photos`):
this bucket is public, so the URL is durable and correct to store. The night
photos table stores a path precisely because a private bucket has no durable
URL and storing one would be a stale secret.

### 2. Storage bucket — public, and why that is not the mistake we just made

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set ...;
```

`718fe0a` corrected the night-photos bucket from public to private, and the
DDL for it carries a warning against copying the `avatars` bucket
reflexively. This spec makes `venue-photos` public **on purpose**, and the
distinction is real:

- A night photo is **audience-scoped**. A public bucket serves the file to
  anyone holding the URL regardless of any table policy, so a friends-only
  photo would sit at a publicly fetchable address. That is the promise the
  audience tiers make, broken underneath them.
- A venue photo is **public by definition**. It is shown on a card to every
  user, signed out or in. There is no audience to leak it past.

Making it private would mean minting signed URLs for 56 essentially-static
images on every feed render — defeating CDN caching, adding a round trip per
card, and buying no privacy, because the photo is already visible to everyone
by design.

Storage policies: public read; INSERT / UPDATE / DELETE restricted to
`public.is_admin()`, matching the `venues` table policy. Write access is the
control, not read access.

### 3. Upload path

Path: `venue-photos/<venue_id>/photo-<timestamp>.jpg`. Timestamped filenames
mean a replacement lands at a new URL and no CDN or browser serves the old
image from cache.

Every upload goes through a **canvas re-encode** before it is stored:

- Resize to a maximum edge of **1200px** and encode as JPEG at ~0.82 quality,
  targeting under ~200KB. The hero image renders at 176px tall and the
  thumbnail at 112px; 1200px covers retina with headroom and nothing more.
- The re-encode also strips EXIF as a side effect. Less critical here than for
  night photos — these are press shots, not camera rolls — but a photo pulled
  off the web can carry a photographer's identity and location, and there is no
  reason to redistribute it.

**Shared helper.** This logic now exists twice: `src/lib/avatarUpload.ts`
(`MAX_EDGE = 512`) and `src/lib/night/photos.ts:30` (`reencode`, deliberately
separate "because the size limits differ"). A third copy is the point at which
this should be extracted. Plan: `src/lib/imageEncode.ts` exporting
`reencodeImage(file, { maxEdge, quality })`, with all three call sites using
it.

> **Collision note:** another session is actively working in this repo
> (`fix/photo-picker-ux`, touching `src/components/night/*`). Its diff does not
> touch `avatarUpload.ts` or `night/photos.ts`, so the extraction is safe as of
> `78316c8` — but it must be re-checked at merge time. If that branch has moved
> into those files, add the third copy and extract in a follow-up. Duplication
> is cheaper than a merge conflict in shipped photo code.

**Ordering on replace:** write `venues.image_url` first, delete the old file
only after that write succeeds. The reverse order 404s the live photo if the
write fails — the exact bug fixed in the avatar flow during the §14 review, and
the same ordering rule `84f3ab7` applies to night photo deletion.

### 4. Admin — the control surface

**`VenueEditSheet.tsx`** gains a photo row at the top:

- Current photo preview, or the category placeholder if unset.
- **Replace** — file picker, re-encode, upload, set `image_url`.
- **Remove** — clears `image_url`; the venue falls back to its placeholder.
  Never a broken image.
- **Source** — plain text input bound to `image_source`.

`image_url` and `image_source` are added to `EDITABLE_FIELDS`
(`src/admin/data/venues.ts:36`) so they flow through the existing changed-fields-
only patch logic.

**`AdminVenues.tsx`** gains a thumbnail column, and a "no photo" filter
alongside the existing active/dormant filter.

This is what "final say" means in practice, and why no approval queue is
needed: the database already permits only admins to write these columns, so
nothing can appear that Colton did not put there. The table view exists so he
can see all 56 at once and fix the bad ones in a tap.

### 5. Bulk import — in the browser, not a CLI script

Doing 56 venues one file dialog at a time is the actual cost of this feature,
so it needs a bulk path. **It belongs in `/admin`, not in `scripts/`.** Two
findings force this, and both were checked:

1. **There is no service-role key on this machine.** `.env.local` holds only
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and
   `GOOGLE_PLACES_API_KEY`. The publishable key is unauthenticated, so it
   cannot satisfy `is_admin()` and cannot write. A CLI script would require
   introducing a service-role key — a secret that bypasses every RLS policy in
   the project — onto disk, to save a few clicks. Not worth it.
2. **The re-encode is browser-only.** It is `document.createElement("canvas")`.
   In Node it would need a new image dependency (`sharp`) and a second,
   divergent implementation of the resize rules.

In the browser Colton is already signed in as an admin, so the existing policy
does the authorising and no new secret exists anywhere.

**Design — a "Bulk photos" panel on the admin venues page:**

1. Drop a folder or multi-select files.
2. Each file is matched to a venue by filename, slug-normalised
   (`amor-y-amargo.jpg` → "Amor y Amargo"): lowercase, strip punctuation and
   extension, hyphens/underscores to spaces.
3. A **preview table** renders before anything is written: thumbnail, matched
   venue name, and the match's confidence. Ambiguous or unmatched files get a
   venue dropdown; nothing is guessed silently.
4. Colton confirms. Only then does it upload and write.
5. A result summary: succeeded, skipped, failed, each with the reason.

Step 3 is load-bearing. The failure mode to design against is not a failed
upload — it is a photo silently attached to the **wrong bar**, which looks
fine, is invisible in any test, and is discovered by a user standing outside a
different venue.

`image_source` is set per-batch in the panel (one field applying to all files
in the drop), because photos are realistically gathered in one sitting from one
kind of source. Per-venue corrections happen in the edit sheet.

### 6. App read path

One line in `mapVenueRow`, matching the defensive style of the neighbourhood
fields around it:

```ts
if (row.image_url) venue.image_url = row.image_url;
```

`image_source` is deliberately **not** mapped into `Venue`. It is admin
metadata; shipping it to every client on every venue fetch would be pointless
payload.

No component changes. The three render sites light up on the next fetch.

## Error handling

- **Bucket missing** (DDL not yet pasted): uploads fail with the Postgres error
  surfaced verbatim, as the admin editor already does for the venues UPDATE
  policy. No friendly rewrite — the message names the real cause.
- **Upload succeeds, row write fails:** the file is orphaned in the bucket and
  the venue keeps its old photo. Orphan files are invisible and cheap; a row
  pointing at a missing file is a broken image for every user. Fail in the
  cheap direction.
- **Broken or removed URL at render:** already handled — every render site has
  an `onError` fallback to the category placeholder.
- **Oversized or wrong-type file:** rejected at the bucket (5MB, image MIME
  types) and pre-checked client-side for a better message.

## Testing

Unit-testable, and therefore tested:

- Filename → venue matching: exact, case/punctuation variants, ambiguous
  (two venues matching), and unmatched. This is where a wrong-bar bug would
  originate.
- `mapVenueRow` sets `image_url` when present and leaves it undefined when the
  column is absent — the older-row case the mapper is already defensive about.
- `venueImageSrc` already has the placeholder fallback covered.

Not unit-testable, and therefore verified in the browser before merge — the
repo's failures live where the tests cannot see (the `PublishSheet` that
rendered nothing while 298 tests passed):

- Upload a real photo in `/admin`, confirm it appears on the card, the saved
  list and the hero.
- Replace it; confirm the new photo appears rather than a cached old one.
- Remove it; confirm a clean placeholder, not a broken image.
- Run one bulk batch and confirm the preview table matches correctly **before**
  writing.

## Cost

Free, on the current Supabase plan, with room to spare:

- **Storage:** 56 photos at ~200KB is ~11MB, against a free-tier allowance of
  roughly 1GB. Not a consideration.
- **Egress** is the metric that matters, not storage — roughly 5GB/month on the
  free tier. A full browse of all 56 cards is ~11MB uncached, so thousands of
  full browses per month fit. At 12 users it is noise. Browser and CDN caching
  make repeat views free.
- **No paid API.** This deliberately avoids the one expensive option: the legal
  Google Places route would have required a Place Details call per venue view,
  billed per call, forever.

The 1200px/200KB ceiling is what keeps egress cheap. Dropping unresized 4MB
photos into the bucket would be the one way to make this cost money.

*(Free-tier figures are from memory and worth a glance at the Supabase
dashboard before relying on them; the conclusion holds with wide margin either
way.)*

## Out of scope

- **Galleries / multiple photos per venue.** One photo, deliberately.
- **User-submitted venue photos.** Different trust model entirely; would need
  moderation. Night-post photos already serve the "users share pictures" need.
- **Automated sourcing / scraping.** Every photo is placed by hand, on purpose.
  That is the licensing control.
- **Photo cropping or editing in-app.** Crop before uploading if needed.
- **Backfilling all 56.** This spec ships the mechanism. Filling it is content
  work Colton does at his own pace, and the app is correct at 0, 12 or 56
  photos.

## Open questions

None blocking. Two worth a decision during the build:

1. Whether the "no photo" admin filter is worth it at 56 venues, or whether
   the thumbnail column alone makes gaps obvious enough.
2. Whether `image_source` should be required before a save is allowed. Leaning
   no — a required field on a bulk path becomes a field people paste junk into.
