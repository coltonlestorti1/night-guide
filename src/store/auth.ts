import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ghost_mode: boolean;
  bio: string | null;
  /** FK to colleges.slug. Null = not answered; the onboarding field is optional. */
  college_slug: string | null;
  /** Graduation year. Past years read as alum. Null = not answered. */
  class_year: number | null;
  /** Join date, for the profile's "Member since" line. Optional on the type
   *  because a locally-constructed profile (sign-up, before the row is read
   *  back) has not seen the database default yet. */
  created_at?: string;
};

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "needsUsername";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  init: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "username" | "avatar_url" | "bio">>) => Promise<void>;
  setGhostMode: (next: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

let initialized = false;

/**
 * Monotonic ticket for ghost-mode writes.
 *
 * The Switch fires a request per tap and the taps are not serialized, so two
 * can be in flight at once. Without a ticket, whichever RESPONSE lands last
 * repaints the toggle — which may be the OLDER request. For a privacy switch
 * that means the UI can settle on a state the database does not hold. Only the
 * most recently issued write is allowed to touch local state.
 */
let ghostModeSeq = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,

  init: () => {
    if (initialized) return;
    initialized = true;
    const supabase = getSupabase();
    if (!supabase) {
      set({ status: "signedOut" });
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session });
      if (session) get().refreshProfile();
      else set({ status: "signedOut" });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) get().refreshProfile();
      else set({ status: "signedOut", profile: null });
    });
  },

  refreshProfile: async () => {
    const supabase = getSupabase();
    const session = get().session;
    if (!supabase || !session) return;
    let { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, ghost_mode, created_at, bio, college_slug, class_year",
      )
      .eq("id", session.user.id)
      .maybeSingle();
    if (error && error.code === "42703") {
      // Optional-column DDL not pasted yet (bio, or the college fields) —
      // degrade to the columns that have always existed rather than leaving
      // the user profile-less, and null the rest.
      ({ data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, ghost_mode, created_at")
        .eq("id", session.user.id)
        .maybeSingle());
      if (data) {
        const row = data as Record<string, unknown>;
        row.bio = null;
        row.college_slug = null;
        row.class_year = null;
      }
    }
    if (error) {
      // Can't tell if a profile exists — treat as signed in, retry on next auth event
      set({ status: "signedIn", profile: null });
      return;
    }
    if (data) set({ status: "signedIn", profile: data as Profile });
    else set({ status: "needsUsername", profile: null });
  },

  updateProfile: async (patch) => {
    const supabase = getSupabase();
    const { session, profile } = get();
    if (!supabase || !session || !profile) throw new Error("Not signed in");
    // Field-scoped snapshot: only revert the keys this call touched, so a
    // concurrent update's committed fields survive a failure here.
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    const prevFields = Object.fromEntries(keys.map((k) => [k, profile[k]])) as typeof patch;
    // Optimistic: apply locally, revert if the write fails.
    set({ profile: { ...profile, ...patch } });
    // `.select()` for the same reason as setGhostMode below: a bare .update()
    // that matches zero rows returns NO error, so a refused write is
    // indistinguishable from a saved one and the form reports success.
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", session.user.id)
      .select("id");
    const current = get().profile;
    if (error) {
      if (current) set({ profile: { ...current, ...prevFields } });
      throw error;
    }
    if (!data || data.length === 0) {
      if (current) set({ profile: { ...current, ...prevFields } });
      throw new Error("Profile update matched no rows");
    }
    // Re-assert over any refreshProfile that raced us with a stale row.
    if (current) set({ profile: { ...current, ...patch } });
  },

  setGhostMode: async (next: boolean) => {
    const supabase = getSupabase();
    const { session, profile } = get();
    if (!supabase || !session || !profile) return;
    const prev = profile.ghost_mode;
    if (prev === next) return;

    // ghost_mode is enforced ENTIRELY server-side — four RLS sites read it
    // (check_ins, venue_saves, plans_on_map, can_request_join) and the client
    // uses it for nothing but drawing this toggle. There is no second layer.
    // So a write that matches zero rows and returns no error, which is what a
    // bare .update() does, leaves the switch reading "hidden" while every
    // policy still sees false and keeps broadcasting live location to friends.
    // `.select()` is what turns that silence into a failure — the same reason
    // setVibe, publishPost and attachPhotos all read their rows back.
    const seq = ++ghostModeSeq;
    // Optimistic: flip locally, reconcile or revert once the row comes back.
    set({ profile: { ...profile, ghost_mode: next } });
    const { data, error } = await supabase
      .from("profiles")
      .update({ ghost_mode: next })
      .eq("id", session.user.id)
      .select("ghost_mode");

    // A stale response must never repaint the toggle — see ghostModeSeq.
    const isLatest = seq === ghostModeSeq;
    const revert = () => {
      const cur = get().profile;
      if (cur) set({ profile: { ...cur, ghost_mode: prev } });
    };

    if (error) {
      if (isLatest) revert();
      throw error;
    }
    if (!data || data.length === 0) {
      if (isLatest) revert();
      throw new Error("Ghost mode update matched no rows");
    }
    // The database is the only thing that enforces this, so its value wins
    // over what we optimistically guessed.
    if (isLatest) {
      const cur = get().profile;
      if (cur) set({ profile: { ...cur, ghost_mode: !!data[0].ghost_mode } });
    }
  },

  signInWithGoogle: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/profile` },
    });
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ status: "signedOut", session: null, profile: null });
  },
}));
