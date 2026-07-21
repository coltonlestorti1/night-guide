/**
 * "Planning to go" surface on the venue sheet — the map's plan layer as seen
 * from a tapped pin. Renders the opted-in plans at this venue that RLS/ghost
 * rules let me see (plans_on_map). For a non-member friend it exposes the
 * request-to-join control; for a member it shows their status. Names + notes
 * never appear here for non-members — the rpc doesn't return them.
 */
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import type { PlanOnMap } from "@/lib/plans";
import { usePlansOnMap, useRequestToJoin, useWithdrawRequest } from "@/hooks/usePlans";
import { Button } from "@/components/ui/button";

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "EEE h:mmaaa"); // e.g. "Fri 10:30pm"
}

function goingLabel(n: number): string {
  return n === 1 ? "1 going" : `${n} going`;
}

function PlanHereItem({ plan }: { plan: PlanOnMap }) {
  const request = useRequestToJoin();
  const withdraw = useWithdrawRequest();
  const busy = request.isPending || withdraw.isPending;

  const onRequest = () =>
    request.mutate(plan.planId, {
      onSuccess: () => toast.success("Request sent — the host will get back to you."),
      onError: () => toast.error("Couldn't send that request — try again."),
    });
  const onWithdraw = () =>
    withdraw.mutate(plan.planId, {
      onError: () => toast.error("Couldn't cancel that request."),
    });

  const host = plan.hostUsername ? (
    <Link to={`/u/${plan.hostUsername}`} className="font-medium hover:underline">
      @{plan.hostUsername}
    </Link>
  ) : (
    <span className="font-medium">a friend</span>
  );

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Clock className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{timeLabel(plan.plannedAt)}</p>
        <p className="truncate text-xs text-muted-foreground">
          Hosted by {host} · {goingLabel(plan.goingCount)}
        </p>
      </div>
      {plan.viewerIsHost ? (
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          You're hosting
        </span>
      ) : plan.viewerIsMember ? (
        <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
          You're in
        </span>
      ) : plan.viewerRequest === "requested" ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Requested
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={busy}
            onClick={onWithdraw}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          className="h-8 shrink-0 rounded-lg text-xs"
          disabled={busy}
          onClick={onRequest}
        >
          Request to join
        </Button>
      )}
    </div>
  );
}

export default function PlansHereRow({ venueId }: { venueId: string }) {
  const { data: plans } = usePlansOnMap();
  const here = useMemo(
    () => (plans ?? []).filter((p) => p.venueId === venueId),
    [plans, venueId]
  );
  if (here.length === 0) return null;

  return (
    <div className="mt-3 w-full animate-fade-in overflow-hidden rounded-2xl border border-border bg-card">
      <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Planning to go
      </p>
      <div className="divide-y divide-border/60">
        {here.map((p) => (
          <PlanHereItem key={p.planId} plan={p} />
        ))}
      </div>
    </div>
  );
}
