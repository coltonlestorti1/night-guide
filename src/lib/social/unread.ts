/**
 * The unread badge on the Social tab.
 *
 * ONE watermark per user (`profiles.social_last_seen_at`), not a reads table.
 * The badge only ever renders a NUMBER, and "seen" means "you opened Social"
 * (Colton, 2026-08-09) — so per-item read rows would buy precision that is
 * never displayed while being written on every feed view.
 *
 * RLS is the boundary, as everywhere else: countNewPosts asks for what the
 * caller may see and counts it. There is no client-side audience filtering,
 * so the badge can never disagree with the feed it is counting.
 */
import { getSupabase } from "@/lib/supabase";

/** Read the caller's watermark. Null = has never opened Social. */
export async function getLastSeen(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("social_last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { social_last_seen_at: string | null } | null)?.social_last_seen_at ?? null;
}

/**
 * Posts the caller can see that landed after the watermark, excluding their
 * own — you are not "unread" to yourself.
 *
 * A null watermark returns 0, deliberately. Treating "never opened" as
 * "everything is new" would greet a fresh signup with a count of every post
 * that has ever existed, which reads as broken rather than welcoming.
 */
export async function countNewPosts(userId: string, lastSeen: string | null): Promise<number> {
  const supabase = getSupabase();
  if (!supabase || !lastSeen) return 0;
  const { count, error } = await supabase
    .from("night_posts")
    .select("id", { count: "exact", head: true })
    .gt("created_at", lastSeen)
    .neq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/** Stamp "I looked at Social just now". */
export async function markSocialSeen(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .update({ social_last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * What the tab shows. Pure so it can be tested without a network.
 *
 * Friend requests and plan alerts are included but are NOT gated on the
 * watermark: they clear when you act on them, not when you glance at them.
 * That is the split agreed with Colton — the tab badge says "something is
 * here", the on-page Friends and Plans badges say "this still needs you".
 */
export function badgeCount(input: {
  newPosts: number;
  friendRequests: number;
  planAlerts: number;
}): number {
  return input.newPosts + input.friendRequests + input.planAlerts;
}

/** Badges stop being countable long before they stop being useful. */
export function badgeLabel(n: number): string {
  return n > 9 ? "9+" : String(n);
}
