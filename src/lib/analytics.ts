/**
 * Fail-safe event logging. `logEvent(name, props?)` fires a best-effort INSERT
 * into the Supabase `events` table and returns immediately — it never throws,
 * never awaits, never blocks the UI, and silently no-ops when the backend is
 * unconfigured (demo mode) or the table doesn't exist yet. Analytics must never
 * be able to break a user action.
 *
 * Privacy: we record the signed-in `user_id` when present, a device-scoped
 * `anonymous_id`, the event name, an optional `venue_id`, and a small `props`
 * bag. NEVER put PII (names, emails, phones, raw GPS) in props — keep it to
 * ids and low-cardinality descriptors.
 *
 * The events table + RLS live in ~/Documents/endz/endz-schema.sql. RLS allows
 * INSERT only (no client SELECT), matching the waitlist-table pattern.
 */
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

const ANON_ID_KEY = "endz:anon-id";

/** Stable per-device id so signed-out activity can still be attributed. */
function getAnonymousId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked — degrade to an ephemeral marker.
    return "anon-unknown";
  }
}

/** `venue_id` is lifted into its own column; everything else lands in props. */
export type EventProps = { venue_id?: string | null } & Record<string, unknown>;

/**
 * Fire-and-forget analytics event. Safe to call from any handler.
 */
export function logEvent(name: string, props: EventProps = {}): void {
  try {
    if (import.meta.env.MODE === "development") {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", name, props);
    }
    const supabase = getSupabase();
    if (!supabase) return; // demo / unconfigured — silent no-op

    const { venue_id, ...rest } = props;
    const userId = useAuthStore.getState().session?.user.id ?? null;

    void supabase
      .from("events")
      .insert({
        user_id: userId,
        anonymous_id: getAnonymousId(),
        event_name: name,
        venue_id: venue_id ?? null,
        props: rest,
      })
      // Swallow every failure mode (table missing, offline, RLS) — both
      // handlers present so no promise rejection ever surfaces.
      .then(
        () => {},
        () => {}
      );
  } catch {
    // Never let analytics break a user action.
  }
}

export type AnalyticsEvent = { name: string; payload?: Record<string, unknown> };

/** @deprecated use logEvent — thin alias kept so existing call sites compile. */
export function track(name: string, payload?: Record<string, unknown>): void {
  logEvent(name, payload as EventProps);
}
