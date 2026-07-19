import { getSupabase } from "@/lib/supabase";

const MAX_EDGE = 512;

/** Downscale to ≤512px JPEG so we never store multi-MB originals. */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
      0.85,
    ),
  );
}

/**
 * Upload a new avatar to avatars/<uid>/avatar-<ts>.jpg, remove older files in
 * the user's folder (timestamped names dodge CDN caching), return public URL.
 * Throws on failure — including while the avatars bucket doesn't exist yet —
 * so callers surface a toast instead of half-updating the profile.
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
  // Best-effort cleanup of previous avatars; never fail the upload over it.
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    const stale = (files ?? [])
      .filter((f) => `${userId}/${f.name}` !== path)
      .map((f) => `${userId}/${f.name}`);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
  } catch {
    /* ignore */
  }
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
