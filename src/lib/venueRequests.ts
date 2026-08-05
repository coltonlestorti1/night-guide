/**
 * Bars a user wants that ENDZ does not carry yet.
 *
 * A Google place id is stored alongside the name so a future "we added your
 * bar" is an exact join against venues.google_place_id, not fuzzy string
 * matching forever. Insert-only from the client; fulfilled_venue_id is set by
 * an operator.
 */
import { getSupabase } from "@/lib/supabase";

export type PlaceHit = { placeId: string; name: string; address?: string };

/** First occurrence wins. Anything already an ENDZ venue is not a request. */
export function dedupeHits(hits: PlaceHit[], alreadyPicked: string[]): PlaceHit[] {
  const seen = new Set(alreadyPicked);
  const out: PlaceHit[] = [];
  for (const h of hits) {
    if (!h.placeId || seen.has(h.placeId)) continue;
    seen.add(h.placeId);
    out.push(h);
  }
  return out;
}

/**
 * Upsert, not insert: the unique (user_id, google_place_id) makes a repeat
 * submission a 23505 otherwise, and a duplicate request is a no-op.
 */
export async function addVenueRequests(userId: string, hits: PlaceHit[]): Promise<void> {
  if (hits.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("venue_requests").upsert(
    hits.map((h) => ({
      user_id: userId,
      google_place_id: h.placeId,
      name: h.name,
      address: h.address ?? null,
    })),
    { onConflict: "user_id,google_place_id" }
  );
  if (error) throw error;
}
