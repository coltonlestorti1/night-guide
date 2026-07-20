/**
 * plan-guest — ENDZ's first Edge Function (§21 Group Plans).
 *
 * Serves the /p/:token surface ONLY: resolve a share_token to one plan's
 * public view, take a guest (or signed-in) RSVP, let a guest edit theirs
 * via guest_secret. Runs with the service role (RLS bypassed), so the rule
 * is absolute: every query is scoped by the token's plan id, and responses
 * carry identity-lite fields only — never user ids, bios, friend lists, or
 * check-ins. Deployed with --no-verify-jwt (guests have no JWT; see the
 * runbook in docs/plans/2026-07-19-plan-guest-deploy-runbook.md).
 *
 * Abuse guards (MVP): 100-guest cap per plan, length/enum validation,
 * cancelled/expired plans read-only, unknown token -> generic 404. Real
 * rate limiting rides the launch-readiness item — this endpoint is flagged
 * there as the most abusable surface.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** Keep in sync with PLAN_EXPIRE_HOURS in src/lib/plans.ts. */
const PLAN_EXPIRE_HOURS = 6;
const GUEST_CAP = 100;
const RSVP_VALUES = new Set(["going", "maybe", "no"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const notFound = () => json(404, { error: "Not found" });

/** Parse a JSON request body, guaranteeing a plain object. A literal `null`
 *  or a scalar/array body would otherwise slip past req.json() and throw on
 *  the first property access — return null so callers answer 400, not 500. */
async function parseObjectBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

type PlanRecord = {
  id: string;
  creator_id: string;
  venue_id: string;
  planned_at: string;
  note: string | null;
  hide_guest_list: boolean;
  status: string;
};

function isPast(plan: PlanRecord): boolean {
  return (
    Date.now() > new Date(plan.planned_at).getTime() + PLAN_EXPIRE_HOURS * 3_600_000
  );
}

async function planByToken(token: unknown): Promise<PlanRecord | null> {
  if (typeof token !== "string" || !UUID_RE.test(token)) return null;
  const { data } = await supabase
    .from("plans")
    .select("id, creator_id, venue_id, planned_at, note, hide_guest_list, status")
    .eq("share_token", token)
    .maybeSingle();
  return (data as PlanRecord | null) ?? null;
}

async function handleGet(token: string | null): Promise<Response> {
  const plan = await planByToken(token);
  if (!plan) return notFound();

  const [venueRes, hostRes, rsvpsRes] = await Promise.all([
    supabase.from("venues").select("name, lat, lng").eq("id", plan.venue_id).maybeSingle(),
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", plan.creator_id)
      .maybeSingle(),
    supabase
      .from("plan_rsvps")
      .select("user_id, guest_name, rsvp, profile:profiles!plan_rsvps_user_id_fkey(username, display_name)")
      .eq("plan_id", plan.id)
      .order("created_at", { ascending: true }),
  ]);

  const rsvps = (rsvpsRes.data ?? []) as {
    user_id: string | null;
    guest_name: string | null;
    rsvp: string | null;
    profile: { username: string; display_name: string | null } | null;
  }[];
  const going = rsvps.filter((r) => r.rsvp === "going").length;
  const maybe = rsvps.filter((r) => r.rsvp === "maybe").length;

  const guest_list: Record<string, unknown> = {
    hidden: plan.hide_guest_list,
    going,
    maybe,
  };
  if (!plan.hide_guest_list) {
    guest_list.entries = rsvps
      .filter((r) => r.rsvp !== null)
      .map((r) => ({
        name: r.profile
          ? r.profile.display_name || `@${r.profile.username}`
          : r.guest_name ?? "Someone",
        rsvp: r.rsvp,
      }));
  }

  return json(200, {
    plan: {
      planned_at: plan.planned_at,
      note: plan.note,
      status: plan.status,
      is_past: isPast(plan),
    },
    venue: venueRes.data
      ? { name: venueRes.data.name, latitude: venueRes.data.lat, longitude: venueRes.data.lng }
      : null,
    host: hostRes.data ?? null,
    guest_list,
  });
}

/** Resolve an optional Authorization header to a user id (signed-in RSVP). */
async function userIdFromAuth(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const jwt = header.slice(7);
  const { data } = await supabase.auth.getUser(jwt);
  return data.user?.id ?? null;
}

async function handlePost(req: Request): Promise<Response> {
  const body = await parseObjectBody(req);
  if (!body) return json(400, { error: "Bad request" });
  const plan = await planByToken(body.token);
  if (!plan) return notFound();
  if (plan.status !== "active" || isPast(plan)) {
    return json(410, { error: "This plan is over" });
  }
  const rsvp = body.rsvp;
  if (typeof rsvp !== "string" || !RSVP_VALUES.has(rsvp)) {
    return json(400, { error: "Bad request" });
  }

  const userId = await userIdFromAuth(req);
  if (userId) {
    // Signed-in user arriving via link — RSVP as themselves (acceptance #3).
    const { error } = await supabase
      .from("plan_rsvps")
      .upsert(
        { plan_id: plan.id, user_id: userId, rsvp },
        { onConflict: "plan_id,user_id" }
      );
    if (error) return json(500, { error: "Something broke" });
    return json(201, { as_user: true });
  }

  const guestName = typeof body.guest_name === "string" ? body.guest_name.trim() : "";
  if (guestName.length < 1 || guestName.length > 40) {
    return json(400, { error: "Name must be 1-40 characters" });
  }
  const { count } = await supabase
    .from("plan_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", plan.id)
    .is("user_id", null);
  if ((count ?? 0) >= GUEST_CAP) {
    return json(429, { error: "This plan is full" });
  }

  const guestSecret = crypto.randomUUID();
  const { data, error } = await supabase
    .from("plan_rsvps")
    .insert({
      plan_id: plan.id,
      guest_name: guestName,
      rsvp,
      guest_secret: guestSecret,
    })
    .select("id")
    .single();
  if (error || !data) return json(500, { error: "Something broke" });
  return json(201, { rsvp_id: data.id, guest_secret: guestSecret });
}

async function handlePatch(req: Request): Promise<Response> {
  const body = await parseObjectBody(req);
  if (!body) return json(400, { error: "Bad request" });
  const plan = await planByToken(body.token);
  if (!plan) return notFound();
  if (plan.status !== "active" || isPast(plan)) {
    return json(410, { error: "This plan is over" });
  }
  const { rsvp_id, guest_secret, rsvp } = body;
  if (
    typeof rsvp !== "string" || !RSVP_VALUES.has(rsvp) ||
    typeof rsvp_id !== "string" || !UUID_RE.test(rsvp_id) ||
    typeof guest_secret !== "string" || !UUID_RE.test(guest_secret)
  ) {
    return json(400, { error: "Bad request" });
  }
  // Scoped to this token's plan AND the secret — a leaked rsvp_id alone is useless.
  const { data, error } = await supabase
    .from("plan_rsvps")
    .update({ rsvp })
    .eq("id", rsvp_id)
    .eq("plan_id", plan.id)
    .eq("guest_secret", guest_secret)
    .select("id");
  if (error) return json(500, { error: "Something broke" });
  if (!data || data.length === 0) return notFound();
  return json(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method === "GET") {
      return await handleGet(new URL(req.url).searchParams.get("token"));
    }
    if (req.method === "POST") return await handlePost(req);
    if (req.method === "PATCH") return await handlePatch(req);
    return json(405, { error: "Method not allowed" });
  } catch {
    return json(500, { error: "Something broke" });
  }
});
