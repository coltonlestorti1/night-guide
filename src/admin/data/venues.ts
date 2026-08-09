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
