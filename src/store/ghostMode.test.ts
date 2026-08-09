/**
 * Ghost mode — the one switch where a write that silently does nothing is a
 * privacy failure rather than an inconvenience.
 *
 * ghost_mode is enforced ENTIRELY server-side: four RLS sites read it
 * (check_ins, venue_saves, plans_on_map, can_request_join) and the client uses
 * it for exactly one thing — drawing the toggle. There is no second layer. So
 * if the UPDATE matches zero rows, or if a stale in-flight response wins a
 * race, the switch reads "hidden" while every policy still sees false and keeps
 * broadcasting the user's live location to their friends.
 *
 * These tests drive the real store against a fake supabase client.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/** What the fake UPDATE will return, per call, in order. */
let updateResults: { data: { ghost_mode: boolean }[] | null; error: unknown }[] = [];
/** Resolvers so a test can land responses out of order. */
let pending: (() => void)[] = [];
let updateCalls: { payload: Record<string, unknown> }[] = [];
/** When true, each UPDATE waits until the test releases it. */
let manualRelease = false;

function makeBuilder(payload: Record<string, unknown>) {
  const idx = updateCalls.length;
  updateCalls.push({ payload });
  const result = () => updateResults[idx] ?? { data: [{ ghost_mode: !!payload.ghost_mode }], error: null };
  const builder = {
    eq: () => builder,
    select: () => builder,
    maybeSingle: () => settle(),
    then: (res: (v: unknown) => unknown) => settle().then(res),
  };
  function settle(): Promise<unknown> {
    if (!manualRelease) return Promise.resolve(result());
    return new Promise((resolve) => {
      pending[idx] = () => resolve(result());
    });
  }
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => makeBuilder(payload),
      select: () => makeBuilder({}),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  }),
}));

import { useAuthStore, type Profile } from "@/store/auth";

const PROFILE: Profile = {
  id: "user-1",
  username: "colton",
  display_name: "Colton",
  avatar_url: null,
  ghost_mode: false,
  bio: null,
  college_slug: null,
  class_year: null,
};

const signIn = (over: Partial<Profile> = {}) =>
  useAuthStore.setState({
    status: "signedIn",
    session: { user: { id: "user-1" } } as never,
    profile: { ...PROFILE, ...over },
  });

const ghost = () => useAuthStore.getState().profile?.ghost_mode;

beforeEach(() => {
  updateResults = [];
  updateCalls = [];
  pending = [];
  manualRelease = false;
  signIn();
});

describe("setGhostMode", () => {
  it("turns ghost mode on when the row is actually written", async () => {
    await useAuthStore.getState().setGhostMode(true);
    expect(ghost()).toBe(true);
    expect(updateCalls[0].payload).toEqual({ ghost_mode: true });
  });

  it("THROWS and leaves the toggle OFF when the write matches zero rows", async () => {
    // RLS refused, or the profile row is gone. PostgREST returns no error for
    // this — the old code treated it as success and the switch showed "hidden"
    // while the database, the only thing that enforces it, still said false.
    updateResults = [{ data: [], error: null }];

    await expect(useAuthStore.getState().setGhostMode(true)).rejects.toThrow();

    // The lie is the bug. The toggle must not claim a protection that is not
    // in force.
    expect(ghost()).toBe(false);
  });

  it("still reverts and throws on an explicit error", async () => {
    updateResults = [{ data: null, error: { message: "boom" } }];

    await expect(useAuthStore.getState().setGhostMode(true)).rejects.toBeTruthy();
    expect(ghost()).toBe(false);
  });

  it("takes the SERVER's value, not the optimistic guess", async () => {
    // If the database disagrees with what we asked for, the database wins —
    // it is the thing the RLS policies read.
    updateResults = [{ data: [{ ghost_mode: false }], error: null }];

    await useAuthStore.getState().setGhostMode(true);

    expect(ghost()).toBe(false);
  });

  it("a stale in-flight response cannot repaint the toggle", async () => {
    // Double-tap: on, then off. The Switch has no disabled state, so both
    // requests are in flight at once. If the FIRST response lands last, the
    // old code left the UI showing "hidden" while the database held the
    // second write. That is the dangerous direction — believing you are
    // invisible while you are broadcasting.
    manualRelease = true;
    updateResults = [
      { data: [{ ghost_mode: true }], error: null },
      { data: [{ ghost_mode: false }], error: null },
    ];

    const first = useAuthStore.getState().setGhostMode(true);
    const second = useAuthStore.getState().setGhostMode(false);

    // `await` on a THENABLE calls .then in a microtask, not synchronously, so
    // neither request has registered its resolver yet. Let the queue drain
    // before trying to land them.
    await new Promise((r) => setTimeout(r, 0));

    // Land them out of order: the newer write resolves first.
    pending[1]();
    await second;
    pending[0]();
    await first.catch(() => {});

    // The NEWER request's server value wins; the older response is ignored.
    // Note this guard protects local state only — it cannot control which
    // write lands last in the database. That is why the Switch is disabled
    // while a toggle is in flight (Profile.tsx), so two are never racing.
    expect(ghost()).toBe(false);
  });
});

describe("updateProfile", () => {
  it("applies the patch when the row is written", async () => {
    await useAuthStore.getState().updateProfile({ display_name: "New Name" });
    expect(useAuthStore.getState().profile?.display_name).toBe("New Name");
  });

  it("THROWS and reverts when the write matches zero rows", async () => {
    // Same silence as ghost mode: no error, no rows, and the edit dialog would
    // have closed reporting success over a change that never happened.
    updateResults = [{ data: [], error: null }];

    await expect(
      useAuthStore.getState().updateProfile({ display_name: "New Name" }),
    ).rejects.toThrow();

    expect(useAuthStore.getState().profile?.display_name).toBe("Colton");
  });

  it("reverts only the keys it touched, not the whole profile", async () => {
    // A concurrent update's committed fields must survive this failure — the
    // field-scoped snapshot exists for that reason.
    useAuthStore.setState({
      profile: { ...PROFILE, display_name: "Colton", bio: "set by another tab" },
    });
    updateResults = [{ data: [], error: null }];

    await expect(
      useAuthStore.getState().updateProfile({ display_name: "New Name" }),
    ).rejects.toThrow();

    const p = useAuthStore.getState().profile;
    expect(p?.display_name).toBe("Colton");
    expect(p?.bio).toBe("set by another tab");
  });
});
