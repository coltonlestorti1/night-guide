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
 * A stalled upload must become a normal, catchable rejection rather than
 * hang forever — both the admin edit sheet and the bulk photo panel gate
 * their UI on the upload settling, so a request that never resolves and
 * never rejects would trap the caller with no escape. 60s is generous for a
 * real photo on a slow connection, but short enough to still act as an
 * escape hatch rather than an indefinite wait.
 */
export const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Race a promise against a timer. If the timer fires first, rejects with an
 * Error carrying `message` — otherwise settles exactly as `promise` does.
 * The Supabase storage client's `upload()` doesn't accept an `AbortSignal`
 * (unlike its `download`/`list` methods), so this is the fallback: it can't
 * cancel the underlying request, but it stops the caller from waiting on it
 * forever.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Re-encode and upload, returning the durable public URL. Throws on failure —
 * including while the bucket does not exist yet, or the upload hangs past
 * `UPLOAD_TIMEOUT_MS` — so callers surface the real message rather than
 * half-updating a venue or hanging indefinitely.
 *
 * Deliberately does NOT remove the previous photo: it must stay live until
 * venues.image_url has been repointed. See deleteVenuePhotoByUrl.
 */
export async function uploadVenuePhoto(file: File, venueId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const blob = await reencodeImage(file, { maxEdge: VENUE_PHOTO_MAX_EDGE });
  const path = `${venueId}/photo-${Date.now()}.jpg`;

  const { error } = await withTimeout(
    supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false }),
    UPLOAD_TIMEOUT_MS,
    `Upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s. Check your connection and try again.`,
  );
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Delete a stored photo given its public URL. Call this only AFTER
 * venues.image_url has been repointed — the reverse order 404s the live photo
 * if the row write fails.
 *
 * Non-throwing by design — that property is load-bearing. This runs after
 * the database row has already been committed, so a thrown error here would
 * turn a successful save into a visible failure. But "non-throwing" must not
 * mean "silent": the `venue-photos` bucket is public and a takedown request
 * is this project's entire licensing mitigation, so a delete that fails has
 * to be loud. It's console.warn'd here, and the return value lets callers on
 * the takedown path (replacing/removing a photo) surface a distinct warning
 * toast — never folded into the success toast.
 *
 * Returns true if nothing needed deleting (empty/external URL) or the delete
 * succeeded; false only when a delete was actually attempted and failed.
 */
export async function deleteVenuePhotoByUrl(url: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !url) return true;
  // Match the full Supabase public-object path, not just "/venue-photos/" —
  // that fragment could appear in an externally hosted URL too
  // (e.g. https://example.com/venue-photos/123/photo.jpg), which would then
  // get parsed as one of ours and issue a delete against our bucket.
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return true; // not one of ours — an external URL, leave it alone
  const path = url.slice(at + marker.length);
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
    return true;
  } catch (e) {
    // The caller already wrote the database row successfully — throwing
    // here would tell the admin their save failed when it didn't. But this
    // file is still public and fetchable at `path`, possibly after someone
    // asked for it to be taken down, so it must not vanish into a catch
    // block unseen.
    console.warn(`[venuePhotos] failed to delete "${path}" — it may still be publicly reachable.`, e);
    return false;
  }
}
