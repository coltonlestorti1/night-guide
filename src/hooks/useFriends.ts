/**
 * React Query layer for the friends graph. One query (["friendships", userId])
 * feeds requests, the friends list, suggested-exclusion, and Add-button
 * states; mutations flip it optimistically and roll back on error
 * (pre-RLS-patch, decline/cancel/remove/block are EXPECTED to roll back —
 * see the spec's "hard prerequisite before merge").
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  FriendOutTonight,
  FriendProfile,
  FriendshipRow,
  acceptRequest,
  blockUser,
  cancelRequest,
  declineRequest,
  deriveFriends,
  friendsOutTonight,
  getProfileByUsername,
  listMyFriendships,
  removeFriend,
  searchProfiles,
  sendRequest,
  suggestedProfiles,
  unblockUser,
} from "@/lib/friends";

export function useMyFriendships() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendshipRow[]>({
    queryKey: ["friendships", userId],
    enabled: !!userId,
    queryFn: () => listMyFriendships(),
  });
}

/** Accepted friends with an active check-in. Poll + focus keep it fresh; the
 *  AppLayout poke invalidation makes it ~2s after any check-in. */
export function useFriendsOutTonight() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const friends = useMemo(
    () => (rows && userId ? deriveFriends(rows, userId).map((f) => f.profile) : undefined),
    [rows, userId]
  );
  return useQuery<FriendOutTonight[]>({
    queryKey: ["friends-out-tonight", userId],
    enabled: !!userId && friends !== undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => friendsOutTonight(friends ?? []),
  });
}

export function useSearchProfiles(term: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendProfile[]>({
    queryKey: ["profile-search", userId, term],
    enabled: !!userId && term.length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    queryFn: () => searchProfiles(userId!, term),
  });
}

export function useSuggestedProfiles() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendProfile[]>({
    queryKey: ["suggested-profiles", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => suggestedProfiles(userId!),
  });
}

export function useProfileByUsername(username: string | undefined) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendProfile | null>({
    queryKey: ["profile-by-username", username?.toLowerCase()],
    enabled: !!userId && !!username,
    staleTime: 30_000,
    queryFn: () => getProfileByUsername(username!),
  });
}

/* ── Optimistic mutation plumbing ── */

function useFriendshipMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<void>,
  update: (rows: FriendshipRow[], vars: TVars) => FriendshipRow[]
) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: ["friendships", userId] });
      const prev = queryClient.getQueryData<FriendshipRow[]>(["friendships", userId]);
      if (prev) queryClient.setQueryData(["friendships", userId], update(prev, vars));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["friendships", userId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships", userId] });
      queryClient.invalidateQueries({ queryKey: ["friends-out-tonight", userId] });
    },
  });
}

function meAsProfile(): FriendProfile | null {
  const me = useAuthStore.getState().profile;
  if (!me) return null;
  return { id: me.id, username: me.username, display_name: me.display_name, avatar_url: me.avatar_url };
}

export function useSendRequest() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useFriendshipMutation<FriendProfile>(
    (profile) => sendRequest(userId!, profile.id),
    (rows, profile) => {
      const me = meAsProfile();
      if (!userId || !me) return rows;
      const optimistic: FriendshipRow = {
        id: `optimistic-${profile.id}`,
        user_id: userId,
        friend_id: profile.id,
        status: "pending",
        created_at: new Date().toISOString(),
        requester: me,
        recipient: profile,
      };
      return [...rows, optimistic];
    }
  );
}

export function useAcceptRequest() {
  return useFriendshipMutation<string>(
    (rowId) => acceptRequest(rowId),
    (rows, rowId) => rows.map((r) => (r.id === rowId ? { ...r, status: "accepted" as const } : r))
  );
}

export function useDeclineRequest() {
  return useFriendshipMutation<string>(
    (rowId) => declineRequest(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useCancelRequest() {
  return useFriendshipMutation<string>(
    (rowId) => cancelRequest(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useRemoveFriend() {
  return useFriendshipMutation<string>(
    (rowId) => removeFriend(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useUnblockUser() {
  return useFriendshipMutation<string>(
    (rowId) => unblockUser(rowId),
    (rows, rowId) => rows.filter((r) => r.id !== rowId)
  );
}

export function useBlockUser() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useFriendshipMutation<FriendProfile>(
    (profile) => blockUser(userId!, profile.id),
    (rows, profile) => {
      const me = meAsProfile();
      if (!userId || !me) return rows;
      const rest = rows.filter(
        (r) =>
          !(
            (r.user_id === userId && r.friend_id === profile.id) ||
            (r.user_id === profile.id && r.friend_id === userId)
          )
      );
      const blockedRow: FriendshipRow = {
        id: `optimistic-block-${profile.id}`,
        user_id: userId,
        friend_id: profile.id,
        status: "blocked",
        created_at: new Date().toISOString(),
        requester: me,
        recipient: profile,
      };
      return [...rest, blockedRow];
    }
  );
}
