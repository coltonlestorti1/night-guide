import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ghost_mode: boolean;
};

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "needsUsername";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  init: () => void;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<string>;
  signOut: () => Promise<void>;
}

let initialized = false;

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
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, ghost_mode")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      // Can't tell if a profile exists — treat as signed in, retry on next auth event
      set({ status: "signedIn", profile: null });
      return;
    }
    if (data) set({ status: "signedIn", profile: data as Profile });
    else set({ status: "needsUsername", profile: null });
  },

  signInWithGoogle: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/profile` },
    });
  },

  // No-login "guest" identity for events: anonymous auth mints a real
  // authenticated user, so the existing check-in RLS just works. We create the
  // profile row the check_ins FK requires and return the new user id.
  // Requires "Anonymous sign-ins" enabled in Supabase (Auth → Providers).
  signInAsGuest: async () => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Guest check-in isn't available right now.");
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      throw new Error("Guest check-in isn't turned on yet.");
    }
    const uid = data.user.id;
    const username = `guest_${uid.replace(/-/g, "").slice(0, 12)}`;
    // Best-effort: the check_ins FK needs a matching profiles row.
    await supabase
      .from("profiles")
      .insert({ id: uid, username, display_name: "Guest", ghost_mode: false });
    await get().refreshProfile();
    return uid;
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ status: "signedOut", session: null, profile: null });
  },
}));
