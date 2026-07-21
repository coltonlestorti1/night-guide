/**
 * Client for the plan-guest Edge Function — the ONLY code the /p/:token
 * page uses for data. Deliberately not the supabase-js client: this surface
 * works fully signed-out and never touches RLS. Signed-in users get their
 * access token attached so the function records the RSVP as them
 * (acceptance #3); guests get a guest_secret back, kept in localStorage so
 * they can change their answer later.
 */
import { getFunctionsBase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { PlanRsvpValue } from "@/lib/plans";

export type TokenPlanView = {
  plan: {
    planned_at: string;
    note: string | null;
    status: "active" | "cancelled";
    is_past: boolean;
  };
  venue: { name: string; latitude: number; longitude: number } | null;
  host: { username: string; display_name: string | null; avatar_url: string | null } | null;
  guest_list: {
    hidden: boolean;
    going: number;
    maybe: number;
    entries?: { name: string; rsvp: PlanRsvpValue }[];
  };
};

export type StoredGuestRsvp = {
  rsvpId: string;
  guestSecret: string;
  guestName: string;
  rsvp: PlanRsvpValue;
};

/** Thrown on 410 — plan cancelled/expired between page load and tap. */
export class PlanGoneError extends Error {
  constructor() {
    super("This plan is over");
    this.name = "PlanGoneError";
  }
}

const storageKey = (token: string) => `endz:plan-guest:${token}`;

export function getStoredGuestRsvp(token: string): StoredGuestRsvp | null {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuestRsvp;
    return parsed && typeof parsed.rsvpId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function storeGuestRsvp(token: string, value: StoredGuestRsvp): void {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(value));
  } catch {
    // Private mode — guest just can't edit later. Accepted.
  }
}

function endpoint(): string {
  const base = getFunctionsBase();
  if (!base) throw new Error("Backend not configured");
  return `${base}/plan-guest`;
}

export async function fetchPlanByToken(token: string): Promise<TokenPlanView | null> {
  const res = await fetch(`${endpoint()}?token=${encodeURIComponent(token)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`plan fetch failed (${res.status})`);
  return (await res.json()) as TokenPlanView;
}

export async function submitTokenRsvp(input: {
  token: string;
  rsvp: PlanRsvpValue;
  guestName?: string;
}): Promise<{ asUser: boolean }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken = useAuthStore.getState().session?.access_token;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(endpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: input.token,
      rsvp: input.rsvp,
      guest_name: input.guestName,
    }),
  });
  if (res.status === 410) throw new PlanGoneError();
  if (!res.ok) throw new Error(`rsvp failed (${res.status})`);
  const body = (await res.json()) as {
    as_user?: boolean;
    rsvp_id?: string;
    guest_secret?: string;
  };
  if (body.as_user) return { asUser: true };
  if (body.rsvp_id && body.guest_secret) {
    storeGuestRsvp(input.token, {
      rsvpId: body.rsvp_id,
      guestSecret: body.guest_secret,
      guestName: input.guestName ?? "",
      rsvp: input.rsvp,
    });
  }
  return { asUser: false };
}

export async function updateGuestRsvp(token: string, rsvp: PlanRsvpValue): Promise<void> {
  const stored = getStoredGuestRsvp(token);
  if (!stored) throw new Error("No stored RSVP for this plan");
  const res = await fetch(endpoint(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      rsvp_id: stored.rsvpId,
      guest_secret: stored.guestSecret,
      rsvp,
    }),
  });
  if (res.status === 410) throw new PlanGoneError();
  if (!res.ok) throw new Error(`rsvp update failed (${res.status})`);
  storeGuestRsvp(token, { ...stored, rsvp });
}
