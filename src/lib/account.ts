/**
 * Account lifecycle. Currently one operation, and it is irreversible.
 *
 * App Store Guideline 5.1.1(v) requires deletion to be initiated inside the
 * app — the previous `mailto:` support link does not satisfy it. The delete
 * runs through the SECURITY DEFINER rpc `delete_own_account()` because the anon
 * key cannot touch auth.users; the function takes no argument and reads the id
 * from the JWT, so there is no way to express "delete someone else".
 */
import { getSupabase } from "@/lib/supabase";

/**
 * What the cascade actually removes, in the order a user would think of it.
 * Rendered in the confirm dialog — a deletion warning that doesn't say what
 * disappears isn't informed consent.
 */
export const DELETION_REMOVES = [
  "Your profile, username and photo",
  "Every check-in you've ever made, including your history",
  "Your saved spots",
  "Your friends and any pending requests",
  "Plans you created, and your RSVPs",
] as const;

/**
 * Deletes the signed-in user's account. Irreversible.
 *
 * The session is dead the moment this returns — the caller must sign out
 * rather than let React Query refetch against a deleted user.
 */
export async function deleteOwnAccount(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
}
