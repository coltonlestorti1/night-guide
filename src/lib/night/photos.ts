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

/** Remove a photo: the row first, then the file. */
export async function deleteNightPhoto(photoId: string, storagePath: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected");

  const { error } = await supabase.from("night_post_photos").delete().eq("id", photoId);
  if (error) throw error;
  // Row first, file second: a deleted row with an orphaned file is invisible
  // and cheap, whereas a deleted file with a live row renders as a broken image
  // for everyone who can see the post.
  await supabase.storage.from(BUCKET).remove([storagePath]);
}
