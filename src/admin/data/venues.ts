/**
 * Admin venue access. Reads and writes RAW `venues` rows, unlike
 * SupabaseDataSource which maps rows into the app's `Venue` shape and drops
 * anything the consumer UI doesn't render. The editor needs every column,
 * including the ones the app ignores.
 *
 * Writes require the admin UPDATE policy from
 * scripts/2026-07-28-admin-ddl.sql. Until that is pasted, saves fail with a
 * Postgres permission error and the UI surfaces it verbatim — silently
 * "succeeding" against 0 matched rows is the failure mode this project has
 * already been burned by (see the setVibe RLS bug, 2026-07-14).
 */
import { getSupabase } from "@/lib/supabase";
import { deleteVenuePhotoByUrl } from "@/lib/venuePhotos";

export type VenueType = "bar" | "club" | "lounge";
export type PriceTier = "$" | "$$" | "$$$" | "$$$$";

export type AdminVenueRow = {
  id: string;
  name: string;
  type: VenueType;
  price: PriceTier | null;
  description: string | null;
  music: string | null;
  age_range: string | null;
  lat: number;
  lng: number;
  neighborhood: string | null;
  image_url: string | null;
  image_source: string | null;
  is_college_scene: boolean;
  has_rooftop: boolean;
  has_outdoor: boolean;
  is_active: boolean;
  created_at?: string;
};

/** The columns the editor is allowed to write. `id` and `created_at` are not. */
export const EDITABLE_FIELDS = [
  "name",
  "type",
  "price",
  "description",
  "music",
  "age_range",
  "lat",
  "lng",
  "neighborhood",
  "image_url",
  "image_source",
  "is_college_scene",
  "has_rooftop",
  "has_outdoor",
  "is_active",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type VenuePatch = Partial<Pick<AdminVenueRow, EditableField>>;

/** Fills columns that may not exist yet on older rows, so the form is never
 *  handed an undefined it has to guess about. */
export function normalizeRow(row: Record<string, unknown>): AdminVenueRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    type: (row.type as VenueType) ?? "bar",
    price: (row.price as PriceTier | null) ?? null,
    description: (row.description as string | null) ?? null,
    music: (row.music as string | null) ?? null,
    age_range: (row.age_range as string | null) ?? null,
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    neighborhood: (row.neighborhood as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    image_source: (row.image_source as string | null) ?? null,
    is_college_scene: Boolean(row.is_college_scene),
    has_rooftop: Boolean(row.has_rooftop),
    has_outdoor: Boolean(row.has_outdoor),
    // Pre-dates the is_active migration -> treat as active, matching the
    // column's own `not null default true`.
    is_active: row.is_active === undefined ? true : Boolean(row.is_active),
  };
}

/** Empty strings from text inputs become null, not "". A blank description
 *  should read as "unset" everywhere downstream, including completeness. */
export function cleanPatch(patch: VenuePatch): VenuePatch {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] = typeof value === "string" && value.trim() === "" ? null : value;
  }
  return out as VenuePatch;
}

export async function fetchAdminVenues(): Promise<AdminVenueRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("venues").select("*").order("name");
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(normalizeRow);
}

export async function updateAdminVenue(
  id: string,
  patch: VenuePatch,
): Promise<AdminVenueRow> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  // .select() so a policy that matches zero rows surfaces as an empty result
  // instead of a silent success.
  const { data, error } = await supabase
    .from("venues")
    .update(cleanPatch(patch))
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Update matched no rows. The admin UPDATE policy is probably missing — paste scripts/2026-07-28-admin-ddl.sql.",
    );
  }
  return normalizeRow(data as Record<string, unknown>);
}

/**
 * Row counts from every table that references `venues`, keyed by table name —
 * the output shape of the `venue_delete_impact` RPC in
 * scripts/2026-08-09-venue-delete-ddl.sql.
 *
 * `events` survives a venue delete (ON DELETE SET NULL — the row loses its
 * venue rather than being destroyed). `venue_requests` counts rows where this
 * venue is `fulfilled_venue_id`; that FK has NO ACTION, so a nonzero count
 * here BLOCKS the delete outright rather than being destroyed by it. Every
 * other field is ON DELETE CASCADE and is destroyed along with the venue.
 */
export type VenueDeleteImpact = {
  check_ins: number;
  venue_ratings: number;
  night_posts: number;
  plans: number;
  venue_saves: number;
  venue_hour_stats: number;
  events: number;
  venue_requests: number;
};

/** The VenueDeleteImpact fields that are actually destroyed (CASCADE) when a
 *  venue is deleted. Excludes `events` (survives, venue_id -> null) and
 *  `venue_requests` (not destroyed — a nonzero count there blocks the delete
 *  entirely, it never reaches "destroyed"). */
const DESTRUCTIVE_IMPACT_KEYS = [
  "check_ins",
  "venue_ratings",
  "night_posts",
  "plans",
  "venue_saves",
  "venue_hour_stats",
] as const satisfies readonly (keyof VenueDeleteImpact)[];

/**
 * Sum of rows permanently destroyed by deleting this venue — the number a
 * confirmation guard should key off of (e.g. one-click under some threshold,
 * type-the-name-to-confirm above it). Deliberately excludes `events` (it
 * survives with venue_id set to null) and `venue_requests` (it blocks the
 * delete rather than being destroyed by it).
 */
export function totalDestroyed(impact: VenueDeleteImpact): number {
  return DESTRUCTIVE_IMPACT_KEYS.reduce((sum, key) => sum + impact[key], 0);
}

/**
 * Counts every row referencing this venue, computed INSIDE the database via
 * the venue_delete_impact() RPC — never client-side. check_ins, venue_ratings
 * and night_posts are RLS-protected, so a browser client only ever sees its
 * own rows plus whatever's currently public; a client-side count would report
 * 0 attached records for a venue with 14 other people's check-ins, and a
 * confirmation guard built on that count would wave the delete through.
 */
export async function fetchVenueDeleteImpact(venueId: string): Promise<VenueDeleteImpact> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc("venue_delete_impact", {
    p_venue_id: venueId,
  });
  if (error) throw error;

  // The RPC returns a single-row table, so supabase-js hands back an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error(
      "venue_delete_impact returned no row. The RPC is probably missing — paste scripts/2026-08-09-venue-delete-ddl.sql.",
    );
  }
  return row as VenueDeleteImpact;
}

/**
 * Deletes the venue row, then best-effort deletes its stored photo.
 *
 * `.select()` so a policy matching zero rows surfaces as an explicit error
 * instead of a silent success — same convention as updateAdminVenue above,
 * and the same reason: this project has been burned by a silent no-op write
 * before (the setVibe RLS bug, 2026-07-14).
 *
 * Errors are surfaced verbatim, not rewritten. If venue_requests.fulfilled_venue_id
 * points at this venue, Postgres blocks the delete with a foreign-key
 * violation (that FK is NO ACTION, not CASCADE) and the raw Postgres message
 * already names the real cause.
 *
 * Order matters: the row is deleted FIRST, then the photo file. The reverse
 * order would leave a venue on screen with a 404ing image if the row delete
 * then failed — the same ordering rule uploadVenuePhoto/deleteVenuePhotoByUrl
 * already follow for exactly that reason.
 */
export async function deleteAdminVenue(venueId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("venues")
    .delete()
    .eq("id", venueId)
    .select("id, image_url")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Delete matched no rows. The admin DELETE policy is probably missing — paste scripts/2026-08-09-venue-delete-ddl.sql.",
    );
  }

  const imageUrl = (data as { image_url: string | null }).image_url;
  if (imageUrl) {
    await deleteVenuePhotoByUrl(imageUrl);
  }
}
