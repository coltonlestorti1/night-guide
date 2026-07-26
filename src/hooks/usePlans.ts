/**
 * React Query layer for group plans. One query (["plans", userId]) feeds the
 * Social Plans section: my hosted plans + open invites. RSVP is optimistic
 * (one-tap must feel instant); create/edit/cancel just invalidate — they're
 * low-frequency and end in a toast anyway.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  HostPendingRequest,
  PlanFeedItem,
  PlanOnMap,
  PlanRow,
  PlanRsvpValue,
  addInvitees,
  approveRequest,
  cancelPlan,
  createPlan,
  denyRequest,
  listHostPendingRequests,
  listMyPlanFeed,
  plansOnMap,
  removeGuest,
  requestToJoin,
  setMyRsvp,
  updatePlan,
  withdrawRequest,
} from "@/lib/plans";

export function usePlanFeed() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<PlanFeedItem[]>({
    queryKey: ["plans", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: () => listMyPlanFeed(userId!),
  });
}

export function useCreatePlan() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (input: {
      venueId: string;
      plannedAt: Date;
      note: string;
      hideGuestList: boolean;
      showOnMap?: boolean;
      inviteFriendIds: string[];
    }): Promise<{ plan: PlanRow; invitesFailed: boolean }> =>
      createPlan({ creatorId: userId!, ...input }),
    // A plan created with show_on_map on must reach the pin without waiting
    // for the next poll.
    onSettled: invalidate,
  });
}

export function useSetRsvp() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: ({ planId, value }: { planId: string; value: PlanRsvpValue }) =>
      setMyRsvp(planId, userId!, value),
    onMutate: async ({ planId, value }) => {
      await queryClient.cancelQueries({ queryKey: ["plans", userId] });
      const prev = queryClient.getQueryData<PlanFeedItem[]>(["plans", userId]);
      if (prev) {
        queryClient.setQueryData(
          ["plans", userId],
          prev.map((it) =>
            it.plan.id === planId
              ? { ...it, myRsvp: value, invitedNoResponse: false }
              : it
          )
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["plans", userId], ctx.prev);
    },
    // The map badge carries a going-count, so an RSVP has to refresh it too.
    onSettled: invalidate,
  });
}

export function useUpdatePlan() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: ({
      planId,
      patch,
    }: {
      planId: string;
      patch: { venue_id?: string; planned_at?: string; note?: string | null; hide_guest_list?: boolean; show_on_map?: boolean };
    }) => updatePlan(planId, patch),
    // Editing time/venue/show_on_map must move the pin badge too.
    onSettled: invalidate,
  });
}

export function useCancelPlan() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (planId: string) => cancelPlan(planId),
    // Every plan view, not just the Social feed: a cancelled plan was still
    // showing as "Planning to go" on the venue sheet and as a badge on the pin
    // until the 60s poll caught up.
    onSettled: invalidate,
  });
}

/* ── Map-plans Slice A ── */

/** Plans on the map: my own + friends' opted-in, polled like out-tonight. */
export function usePlansOnMap() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<PlanOnMap[]>({
    queryKey: ["plans-on-map", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => plansOnMap(),
  });
}

/** Pending join-requests across all of my hosted plans (badge + list). */
export function usePendingRequests() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<HostPendingRequest[]>({
    queryKey: ["plan-pending-requests", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => listHostPendingRequests(userId!),
  });
}

/** Invalidate every view a request/approval touches: map layer, host pending
 *  list, and the Social Plans feed. */
function useInvalidatePlanViews() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return () => {
    queryClient.invalidateQueries({ queryKey: ["plans-on-map", userId] });
    queryClient.invalidateQueries({ queryKey: ["plan-pending-requests", userId] });
    queryClient.invalidateQueries({ queryKey: ["plans", userId] });
  };
}

export function useRequestToJoin() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (planId: string) => requestToJoin(planId, userId!),
    onSuccess: invalidate,
  });
}

export function useWithdrawRequest() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (planId: string) => withdrawRequest(planId, userId!),
    onSuccess: invalidate,
  });
}

export function useApproveRequest() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (rsvpId: string) => approveRequest(rsvpId),
    onSuccess: invalidate,
  });
}

export function useDenyRequest() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (rsvpId: string) => denyRequest(rsvpId),
    onSuccess: invalidate,
  });
}

export function useRemoveGuest() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: (rsvpId: string) => removeGuest(rsvpId),
    onSuccess: invalidate,
  });
}

export function useAddInvitees() {
  const invalidate = useInvalidatePlanViews();
  return useMutation({
    mutationFn: ({ planId, friendIds }: { planId: string; friendIds: string[] }) =>
      addInvitees(planId, friendIds),
    onSuccess: invalidate,
  });
}
