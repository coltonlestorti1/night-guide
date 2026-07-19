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
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "username" | "avatar_url">>) => Promise<void>;
  setGhostMode: (next: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

  updateProfile: async (patch) => {
    const supabase = getSupabase();
    const { session, profile } = get();
    if (!supabase || !session || !profile) throw new Error("Not signed in");
    const prev = profile;
    // Optimistic: apply locally, revert if the write fails.
    set({ profile: { ...profile, ...patch } });
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", session.user.id);
    if (error) {
      set({ profile: prev });
      throw error;
    }
  },

  setGhostMode: async (next: boolean) => {
    const supabase = getSupabase();
    const { session, profile } = get();
    if (!supabase || !session || !profile) return;
    const prev = profile.ghost_mode;
    if (prev === next) return;
    // Optimistic: flip locally, revert if the write fails.
    set({ profile: { ...profile, ghost_mode: next } });
    const { error } = await supabase
      .from("profiles")
      .update({ ghost_mode: next })
      .eq("id", session.user.id);
    if (error) {
      set({ profile: { ...get().profile!, ghost_mode: prev } });
      throw error;
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
