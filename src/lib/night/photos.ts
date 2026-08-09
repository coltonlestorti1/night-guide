/**
 * Photos on night posts.
 *
 * TWO THINGS HERE ARE LOAD-BEARING, DO NOT "SIMPLIFY" THEM:
 *
 * 1. Every upload goes through a canvas re-encode. That rebuilds the image from
 *    raw pixels and DISCARDS EXIF — camera metadata carries GPS coordinates and
 *    an exact capture time, which is precisely what night_posts.night_date
 *    exists to withhold. Uploading the original File would hand all of it back
 *    and undo the privacy design through a side channel. Same mechanism as
 *    src/lib/avatarUpload.ts, kept separate because the size limits differ.
 *
 * 2. The bucket is PRIVATE, so reads need short-lived signed URLs. A public
 *    bucket serves the file to anyone holding the address regardless of any
 *    table policy, which would put a "Just me" photo at a fetchable URL.
 *    Signing happens only after RLS has already returned the row.
 */
import { getSupabase } from "@/lib/supabase";
import { reencodeImage } from "@/lib/imageEncode";

const BUCKET = "night-photos";
const SIGNED_TTL_SECONDS = 60 * 60;
export const MAX_PHOTOS_PER_POST = 3;

/**
 * Downscale to ≤1600px JPEG. Larger than an avatar because a feed photo is
 * looked at rather than glanced at, small enough to stay well under the
 * bucket's 5 MB cap. The redraw is also the EXIF strip — see imageEncode.ts.
 */
const reencode = (file: File) => reencodeImage(file, { maxEdge: 1600 });

/** Upload one photo and return its storage path (never a URL — see above). */
export async function uploadNightPhoto(file: File, userId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected");

  const blob = await reencode(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

/** Attach already-uploaded paths to a post, in order. */
export async function attachPhotos(postId: string, paths: string[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || paths.length === 0) return;

  const rows = paths.map((storage_path, i) => ({ post_id: postId, storage_path, sort_order: i }));
  const { data, error } = await supabase
    .from("night_post_photos")
    .insert(rows)
    .select("id");
  if (error) throw error;
  // Zero rows with no error means RLS refused it — the silence that hid the
  // 2026-07-14 vibe bug. Read it back.
  if (!data?.length) throw new Error("Photo attach matched no rows");
}

export type PostPhoto = { id: string; postId: string; storagePath: string; url: string | null };

/**
 * Photos for a set of posts, with fresh signed URLs.
 *
 * RLS on night_post_photos decides which rows come back; signing happens after
 * that, so a caller can never mint a URL for a photo they were not allowed to
 * see in the first place.
 */
export async function listPhotosForPosts(postIds: string[]): Promise<PostPhoto[]> {
  const supabase = getSupabase();
  if (!supabase || postIds.length === 0) return [];

  const { data, error } = await supabase
    .from("night_post_photos")
    .select("id, post_id, storage_path, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    post_id: string;
    storage_path: string;
  }[];
  if (rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), SIGNED_TTL_SECONDS);

  const byPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    storagePath: r.storage_path,
    url: byPath.get(r.storage_path) ?? null,
  }));
}

/**
 * Does this storage path belong to this user?
 *
 * The same rule the INSERT policy enforces in SQL
 * (`split_part(storage_path, '/', 1) = auth.uid()`), stated once here so the
 * client and the database cannot drift. The policy is the boundary; this is
 * only for catching mistakes before a round trip.
 *
 * Why the policy exists at all: the unique index on storage_path stops you
 * re-using another user's path, but DELETING A POST FREES THAT INDEX ENTRY.
 * With files retained, a friend who read the path out of the feed could attach
 * a deleted friends-only photo to their own 'everyone' post and widen it to
 * the whole app.
 */
export function ownsPhotoPath(storagePath: string, userId: string): boolean {
  if (!userId) return false;
  return storagePath.split("/")[0] === userId;
}

/**
 * Delete files from the bucket and report what did NOT go.
 *
 * Returns the paths still present. Callers decide how loud to be: a failure
 * during account deletion is swallowed (you do not get to keep someone's
 * account open because S3 hiccuped), while a failure in the composer is worth
 * a retry. Either way the admin sweep is the backstop — see
 * list_orphaned_storage() in scripts/2026-08-09-deletion-retention-ddl.sql.
 *
 * The old code ignored this result entirely, so a failed delete was silent.
 */
export async function removeStoredPhotos(paths: string[]): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase || paths.length === 0) return [];

  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
  // An error covers the whole call, so nothing is confirmed gone.
  if (error) return paths;

  const removed = new Set((data ?? []).map((o) => o.name));
  return paths.filter((p) => !removed.has(p));
}

/** The storage paths attached to a post, for deleting the files behind it. */
export async function listPhotoPathsForPost(postId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("night_post_photos")
    .select("storage_path")
    .eq("post_id", postId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { storage_path: string }).storage_path);
}

/**
 * Every night photo the user owns, by folder.
 *
 * Used on account deletion, where the post rows are about to cascade away and
 * take the only record of which paths existed with them. Reads the FOLDER
 * rather than the table for exactly that reason — it also catches files
 * stranded by an abandoned composer, which never had a row at all.
 */
export async function listAllPhotoPathsForUser(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase || !userId) return [];

  const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
  if (error) return [];
  return (data ?? []).filter((f) => f.id !== null).map((f) => `${userId}/${f.name}`);
}

/** Remove a photo: the row first, then the file. */
export async function deleteNightPhoto(photoId: string, storagePath: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected");

  const { error } = await supabase.from("night_post_photos").delete().eq("id", photoId);
  if (error) throw error;
  // Row first, file second: a deleted row with an orphaned file is invisible
  // and cheap, whereas a deleted file with a live row renders as a broken image
  // for everyone who can see the post.
  await removeStoredPhotos([storagePath]);
}
