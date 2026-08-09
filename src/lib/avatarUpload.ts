import { getSupabase } from "@/lib/supabase";
import { reencodeImage } from "@/lib/imageEncode";

/** Downscale to ≤512px JPEG so we never store multi-MB originals. */
const downscale = (file: File) => reencodeImage(file, { maxEdge: 512 });

/**
 * Upload a new avatar to avatars/<uid>/avatar-<ts>.jpg (timestamped names
 * dodge CDN caching) and return its public URL. Throws on failure — including
 * while the avatars bucket doesn't exist yet — so callers surface a toast
 * instead of half-updating the profile. Deliberately does NOT touch existing
 * files: the previous avatar must stay live until profiles.avatar_url has
 * been repointed (see cleanupOldAvatars).
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected");
  const blob = await downscale(file);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/**
 * Best-effort removal of EVERY avatar the user has, for account deletion.
 *
 * The avatars bucket is PUBLIC, so a file left behind here is not a private
 * orphan like a night photo — it stays served at a stable public URL forever,
 * while the confirm dialog told the user their photo was removed. That made
 * DELETION_REMOVES a false statement until this existed.
 *
 * Must run BEFORE delete_own_account(), which invalidates the JWT this needs.
 */
export async function removeAllAvatars(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !userId) return;
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    const paths = (files ?? []).filter((f) => f.id !== null).map((f) => `${userId}/${f.name}`);
    if (paths.length) await supabase.storage.from("avatars").remove(paths);
  } catch {
    /* best-effort only — see deleteOwnAccount */
  }
}

/**
 * Best-effort removal of every avatar file except the one keepUrl points at.
 * Call fire-and-forget AFTER profiles.avatar_url has been updated — never
 * before, or a failed profile write would leave the account pointing at a
 * deleted object.
 */
export async function cleanupOldAvatars(userId: string, keepUrl: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    const stale = (files ?? [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => !keepUrl.endsWith(p));
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
  } catch {
    /* best-effort only */
  }
}
