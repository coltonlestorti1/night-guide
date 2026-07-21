/**
 * Group plans data layer (§21) — plain async functions, mirroring
 * src/lib/friends.ts. State reads happen through src/hooks/usePlans.ts.
 *
 * RLS is the only privacy boundary: plans come back only for host +
 * invitees; rsvp rows follow the hide-guest-list rule server-side. When the
 * list is hidden, members can't see others' rows at all — counts come from
 * the security-definer rpc plan_rsvp_counts.
 *
 * The token/guest surface (/p/:token) is NOT here — it talks to the
 * plan-guest Edge Function (src/lib/planGuest.ts) and never touches RLS.
 *
 * Pre-DDL grace: list reads treat Postgres 42P01 (undefined table) as
 * empty, same stance as the profiles.bio 42703 fallback — the app renders,
 * the feature is dark until Colton pastes the DDL.
 */
import { format } from "date-fns";
import { getSupabase } from "@/lib/supabase";
import { FriendProfile } from "@/lib/friends";

/** Plans auto-age into "past" this many hours after planned_at.
 *  Duplicated in supabase/functions/plan-guest/index.ts — keep in sync. */
export const PLAN_EXPIRE_HOURS = 6;

export const PLAN_NOTE_MAX = 200;

export type PlanRsvpValue = "going" | "maybe" | "no";

export type PlanRow = {
  id: string;
  creator_id: string;
  venue_id: string;
  planned_at: string;
  note: string | null;
  hide_guest_list: boolean;
  status: "active" | "cancelled";
  share_token: string;
  created_at: string;
};

export type PlanRsvpRow = {
  id: string;
  plan_id: string;
  user_id: string | null;
  guest_name: string | null;
  rsvp: PlanRsvpValue | null;
  created_at: string;
  profile: FriendProfile | null;
};

export type PlanFeedItem = {
  plan: PlanRow;
  venueName: string;
  host: FriendProfile | null; // null while profiles fetch races; UI shows "a friend"
  isHost: boolean;
  /** Rows RLS let me see (all of them for host/open lists; just mine when hidden). */
  rsvps: PlanRsvpRow[];
  /** Filled via plan_rsvp_counts rpc only when hidden and I'm not the host. */
  counts: { going: number; maybe: number } | null;
  myRsvp: PlanRsvpValue | null;
  invitedNoResponse: boolean;
};

const PLAN_COLS =
  "id, creator_id, venue_id, planned_at, note, hide_guest_list, status, share_token, created_at";
// guest_secret is excluded from the authenticated column grant — never select it.
const RSVP_COLS = "id, plan_id, user_id, guest_name, rsvp, created_at";
const PROFILE_COLS = "id, username, display_name, avatar_url";

export function planShareUrl(plan: PlanRow): string {
  return `${window.location.origin}/p/${plan.share_token}`;
}

/** Display name for one RSVP row — ENDZ user's name, else the guest name. */
export function rsvpDisplayName(r: PlanRsvpRow): string {
  if (r.profile) return r.profile.display_name || `@${r.profile.username}`;
  return r.guest_name ?? "Someone";
}

/** Warm invite line for the native share sheet / SMS. The share URL is sent
 *  as navigator.share's separate `url` field, so this text ends on a natural
 *  lead-in to the link. */
export function planShareMessage(venueName: string, plannedAt: string | Date): string {
  const when = format(new Date(plannedAt), "EEE MMM d 'at' h:mm a");
  return `You're invited 🌙 Join me at ${venueName} — ${when}. Tap to RSVP:`;
}

export type SharePlanResult = "shared" | "copied" | "unavailable";

/**
 * Share a plan link. On touch devices the native share sheet (SMS/WhatsApp)
 * is the right affordance; on desktop that OS sheet has no "copy link", so we
 * copy to the clipboard instead — the reliable way to hand someone the link.
 * Callers toast on "copied"/"unavailable"; "shared" is silent (the OS gives
 * its own feedback, and a dismissed sheet is a no-op, not an error).
 */
export async function sharePlanLink(
  plan: PlanRow,
  venueName: string
): Promise<SharePlanResult> {
  const url = planShareUrl(plan);
  const preferNative =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof matchMedia !== "undefined" &&
    matchMedia("(pointer: coarse)").matches;
  if (preferNative) {
    try {
      await navigator.share({ text: planShareMessage(venueName, plan.planned_at), url });
    } catch {
      // Sheet dismissed — not an error.
    }
    return "shared";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "unavailable";
  }
}

export function isPlanPast(plan: Pick<PlanRow, "planned_at">): boolean {
  return Date.now() > new Date(plan.planned_at).getTime() + PLAN_EXPIRE_HOURS * 3_600_000;
}

/** Missing-table grace: true for Postgres 42P01 (plans DDL not pasted yet). */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

/**
 * Everything the Social Plans section needs, assembled from four queries
 * (plans → venues + host profiles + rsvps-with-profile), the same explicit
 * client-side join style as friendsOutTonight. Active, non-expired plans
 * only — cancelled/expired plans simply drop off (one-night ethos, no
 * archive; the /p/ link handles the graceful "over" state).
 */
export async function listMyPlanFeed(myId: string): Promise<PlanFeedItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const cutoff = new Date(Date.now() - PLAN_EXPIRE_HOURS * 3_600_000).toISOString();
  const { data: planData, error } = await supabase
    .from("plans")
    .select(PLAN_COLS)
    .eq("status", "active")
    .gte("planned_at", cutoff)
    .order("planned_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const plans = (planData ?? []) as PlanRow[];
  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const venueIds = [...new Set(plans.map((p) => p.venue_id))];
  const hostIds = [...new Set(plans.map((p) => p.creator_id))];

  const [venuesRes, hostsRes, rsvpsRes] = await Promise.all([
    supabase.from("venues").select("id, name").in("id", venueIds),
    supabase.from("profiles").select(PROFILE_COLS).in("id", hostIds),
    supabase
      .from("plan_rsvps")
      .select(`${RSVP_COLS}, profile:profiles!plan_rsvps_user_id_fkey(${PROFILE_COLS})`)
      .in("plan_id", planIds)
      .order("created_at", { ascending: true }),
  ]);
  if (venuesRes.error) throw venuesRes.error;
  if (hostsRes.error) throw hostsRes.error;
  if (rsvpsRes.error) throw rsvpsRes.error;

  const venueName = new Map(
    (venuesRes.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name])
  );
  const hostById = new Map(
    ((hostsRes.data ?? []) as FriendProfile[]).map((p) => [p.id, p])
  );
  const rsvps = (rsvpsRes.data as unknown as PlanRsvpRow[]) ?? [];

  const items: PlanFeedItem[] = plans.map((plan) => {
    const planRsvps = rsvps.filter((r) => r.plan_id === plan.id);
    const mine = planRsvps.find((r) => r.user_id === myId) ?? null;
    return {
      plan,
      venueName: venueName.get(plan.venue_id) ?? "a spot nearby",
      host: hostById.get(plan.creator_id) ?? null,
      isHost: plan.creator_id === myId,
      rsvps: planRsvps,
      counts: null,
      myRsvp: mine?.rsvp ?? null,
      invitedNoResponse: !!mine && mine.rsvp === null && plan.creator_id !== myId,
    };
  });

  // Hidden guest list + not host → RLS returned only my row; fetch counts
  // via the gated security-definer rpc so the card can still show "N going".
  await Promise.all(
    items
      .filter((it) => it.plan.hide_guest_list && !it.isHost)
      .map(async (it) => {
        const { data, error: rpcErr } = await supabase.rpc("plan_rsvp_counts", {
          pid: it.plan.id,
        });
        if (rpcErr) return; // counts are decorative — never fail the feed
        const row = Array.isArray(data) ? data[0] : data;
        if (row) it.counts = { going: Number(row.going), maybe: Number(row.maybe) };
      })
  );

  return items;
}

/**
 * Create the plan, the host's own 'going' row, and the invite rows.
 * The plan itself is the durable outcome: once it's inserted, rsvp-row
 * failures (unfriend race, network blip) are reported via `invitesFailed`
 * rather than thrown, so the caller still gets the plan + share link
 * instead of a false "try again" that would create a duplicate plan.
 */
export async function createPlan(input: {
  creatorId: string;
  venueId: string;
  plannedAt: Date;
  note: string;
  hideGuestList: boolean;
  inviteFriendIds: string[];
}): Promise<{ plan: PlanRow; invitesFailed: boolean }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const note = input.note.trim().slice(0, PLAN_NOTE_MAX);
  const { data, error } = await supabase
    .from("plans")
    .insert({
      creator_id: input.creatorId,
      venue_id: input.venueId,
      planned_at: input.plannedAt.toISOString(),
      note: note || null,
      hide_guest_list: input.hideGuestList,
    })
    .select(PLAN_COLS)
    .single();
  if (error) throw error;
  const plan = data as PlanRow;

  // The plan exists from here on — rsvp-row failures (unfriend race, network
  // blip) must NOT throw, or the host never sees the share link and a retry
  // creates a duplicate plan. Report partial failure instead.
  let invitesFailed = false;
  const hostRow = await supabase
    .from("plan_rsvps")
    .insert({ plan_id: plan.id, user_id: input.creatorId, rsvp: "going" });
  if (hostRow.error) invitesFailed = true;

  if (input.inviteFriendIds.length > 0) {
    const { error: invErr } = await supabase.from("plan_rsvps").insert(
      input.inviteFriendIds.map((friendId) => ({ plan_id: plan.id, user_id: friendId }))
    );
    if (invErr) invitesFailed = true;
  }
  return { plan, invitesFailed };
}

/** Host edits time/venue/note/visibility. Count-check like friends.ts —
 *  0 rows means RLS blocked it and the UI must not pretend it worked. */
export async function updatePlan(
  planId: string,
  patch: { venue_id?: string; planned_at?: string; note?: string | null; hide_guest_list?: boolean }
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plans")
    .update(patch)
    .eq("id", planId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't update that plan");
}

/** Cancel = status flip so the /p/ link renders "this plan is over". */
export async function cancelPlan(planId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plans")
    .update({ status: "cancelled" })
    .eq("id", planId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't cancel that plan");
}

/**
 * One-tap RSVP. Upsert covers both cases: invited (row exists, rsvp null →
 * update) and joining a visible plan with no row yet (insert). onConflict
 * targets the unique(plan_id, user_id) index; created_at isn't in the
 * payload so the snapshot-pattern update policy passes.
 */
export async function setMyRsvp(
  planId: string,
  myId: string,
  value: PlanRsvpValue
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { data, error } = await supabase
    .from("plan_rsvps")
    .upsert(
      { plan_id: planId, user_id: myId, rsvp: value },
      { onConflict: "plan_id,user_id" }
    )
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't save your RSVP");
}
