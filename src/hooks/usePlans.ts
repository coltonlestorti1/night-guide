/**
 * React Query layer for group plans. One query (["plans", userId]) feeds the
 * Social Plans section: my hosted plans + open invites. RSVP is optimistic
 * (one-tap must feel instant); create/edit/cancel just invalidate — they're
 * low-frequency and end in a toast anyway.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import {
  PlanFeedItem,
  PlanRow,
  PlanRsvpValue,
  cancelPlan,
  createPlan,
  listMyPlanFeed,
  setMyRsvp,
  updatePlan,
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
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (input: {
      venueId: string;
      plannedAt: Date;
      note: string;
      hideGuestList: boolean;
      inviteFriendIds: string[];
    }): Promise<PlanRow> => createPlan({ creatorId: userId!, ...input }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}

export function useSetRsvp() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: ({
      planId,
      patch,
    }: {
      planId: string;
      patch: { venue_id?: string; planned_at?: string; note?: string | null; hide_guest_list?: boolean };
    }) => updatePlan(planId, patch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}

export function useCancelPlan() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  return useMutation({
    mutationFn: (planId: string) => cancelPlan(planId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["plans", userId] }),
  });
}
