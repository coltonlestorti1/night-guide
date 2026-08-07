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
