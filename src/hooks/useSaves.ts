/**
 * React Query layer for saved venues.
 *
 * useSaves() deliberately returns { ids, toggle, isSaved } — the exact shape
 * the old useSavedStore had — so the five call sites swap one import and
 * nothing else. Signed in: the server is the truth. Signed out or offline: the
 * localStorage store still works, and whatever accumulated there gets lifted to
 * the server on the first signed-in load.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useSavedStore } from "@/store/saved";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
import type { CheckinVisibility } from "@/lib/checkins";
import {
  VenueSaveFriends,
  addSave,
  friendSavesByVenue,
  getSaveVisibility,
  listMySaves,
  migrateLocalSaves,
  removeSave,
} from "@/lib/saves";

const MIGRATED_KEY = "endz:saves-migrated";

export function useSaveVisibility() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<CheckinVisibility>({
    queryKey: ["save-visibility", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => getSaveVisibility(userId!),
  });
}

export function useSaves() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const localIds = useSavedStore((s) => s.ids);
  const toggleLocal = useSavedStore((s) => s.toggle);
  const { data: visibility } = useSaveVisibility();

  const { data: serverIds } = useQuery<string[]>({
    queryKey: ["my-saves", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: () => listMySaves(userId!),
  });

  // One-time lift of pre-2026-08-05 device saves. Guarded by a ref as well as
  // the localStorage flag: the effect can re-run before the flag write settles.
  const migrating = useRef(false);
  useEffect(() => {
    if (!userId || serverIds === undefined || migrating.current) return;
    if (localStorage.getItem(MIGRATED_KEY) === "1") return;
    const missing = localIds.filter((id) => !serverIds.includes(id));
    migrating.current = true;
    (async () => {
      try {
        await migrateLocalSaves(userId, missing, visibility ?? "friends");
        localStorage.setItem(MIGRATED_KEY, "1");
        queryClient.invalidateQueries({ queryKey: ["my-saves", userId] });
      } catch {
        migrating.current = false; // leave the flag unset so the next load retries
      }
    })();
  }, [userId, serverIds, localIds, visibility, queryClient]);

  // Memoized so toggle/isSaved keep stable identities — BarCard renders this
  // once per Discover row, and a new array each render re-runs every consumer.
  const ids = useMemo(
    () => (userId ? serverIds ?? [] : localIds),
    [userId, serverIds, localIds]
  );

  const mutation = useMutation({
    mutationFn: async ({ venueId, saved }: { venueId: string; saved: boolean }) => {
      if (!userId) return;
      if (saved) await removeSave(userId, venueId);
      else await addSave(userId, venueId, visibility ?? "friends");
    },
    onMutate: async ({ venueId, saved }) => {
      if (!userId) return { prev: undefined };
      const key = ["my-saves", userId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (cur = []) =>
        saved ? cur.filter((id) => id !== venueId) : [venueId, ...cur]
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (userId && ctx?.prev) queryClient.setQueryData(["my-saves", userId], ctx.prev);
    },
    onSettled: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ["my-saves", userId] });
    },
  });

  const toggle = useCallback(
    (venueId: string) => {
      // Keep the local mirror in step either way: it's the offline fallback,
      // and a signed-out user has nothing else.
      toggleLocal(venueId);
      if (userId) mutation.mutate({ venueId, saved: ids.includes(venueId) });
    },
    [userId, ids, mutation, toggleLocal]
  );

  const isSaved = useCallback((venueId: string) => ids.includes(venueId), [ids]);

  return { ids, toggle, isSaved };
}

/**
 * Friends who saved each venue, keyed by venue id — what the card facepile
 * renders. Restricted to accepted friends on top of RLS: a save set to
 * 'everyone' is visible to strangers, but "who likes this spot" on a card is a
 * friends signal, and a stranger's face there would read as a bug.
 */
export function useFriendSaves() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const friendIds = useMemo(() => {
    if (!rows || !userId) return undefined;
    return new Set(deriveFriends(rows, userId).map((f) => f.profile.id));
  }, [rows, userId]);

  return useQuery<VenueSaveFriends>({
    queryKey: ["friend-saves", userId],
    enabled: !!userId && friendIds !== undefined,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const all = await friendSavesByVenue(userId!);
      const out: VenueSaveFriends = {};
      for (const [venueId, people] of Object.entries(all)) {
        const friends = people.filter((p) => friendIds!.has(p.id));
        if (friends.length) out[venueId] = friends;
      }
      return out;
    },
  });
}
