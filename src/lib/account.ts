/**
 * Account lifecycle. Currently one operation, and it is irreversible.
 *
 * App Store Guideline 5.1.1(v) requires deletion to be initiated inside the
 * app — the previous `mailto:` support link does not satisfy it. The delete
 * runs through the SECURITY DEFINER rpc `delete_own_account()` because the anon
 * key cannot touch auth.users; the function takes no argument and reads the id
 * from the JWT, so there is no way to express "delete someone else".
 *
 * The RPC cascades TABLES. It does not, and cannot, touch STORAGE — so the
 * files have to go from here, while the caller still holds a working JWT.
 */
import { getSupabase } from "@/lib/supabase";
import { removeAllAvatars } from "@/lib/avatarUpload";
import { listAllPhotoPathsForUser, removeStoredPhotos } from "@/lib/night/photos";

/**
 * What deletion actually removes, in the order a user would think of it.
 * Rendered in the confirm dialog — a deletion warning that doesn't say what
 * disappears isn't informed consent.
 *
 * This list was wrong in both directions until 2026-08-09: it promised the
 * profile photo was removed when nothing ever deleted it from the public
 * avatars bucket, and it never mentioned posts, photos, comments, likes,
 * ratings or tags, all of which the cascade destroys.
 */
export const DELETION_REMOVES = [
  "Your profile, username and photo",
  "Every check-in you've ever made, including your history",
  "Your saved spots",
  "Your friends and any pending requests",
  "Plans you created, and your RSVPs",
  "Your posts and the photos on them",
  "Your comments, likes and venue ratings",
  "Tags connecting you to other people's nights",
] as const;

/**
 * Delete the files the table cascade cannot reach.
 *
 * Best-effort on purpose, and it never throws. A user's right to close their
 * account does not get held hostage to a storage hiccup — a failure here leaves
 * an orphan, and the admin sweep (`list_orphaned_storage()`) is the backstop
 * for exactly that case.
 *
 * Night photos are read from the FOLDER rather than from night_post_photos,
 * because the folder also holds files stranded by an abandoned composer, which
 * never had a row to find them by.
 */
async function purgeOwnStorage(userId: string): Promise<void> {
  try {
    const paths = await listAllPhotoPathsForUser(userId);
    if (paths.length) await removeStoredPhotos(paths);
  } catch {
    /* best-effort */
  }
  await removeAllAvatars(userId);
}

/**
 * Deletes the signed-in user's account. Irreversible.
 *
 * The session is dead the moment this returns — the caller must sign out
 * rather than let React Query refetch against a deleted user.
 */
export async function deleteOwnAccount(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");

  // Storage first, RPC second. The order is load-bearing: both buckets are
  // governed by "your own folder" policies, so the instant delete_own_account()
  // returns there is no longer any principal on earth who can delete these
  // files — not the user, who no longer exists, and not an admin, whose sweep
  // policy is deliberately scoped to unreferenced paths.
  await purgeOwnStorage(userId);

  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
}
