/**
 * "Planning to go" surface on the venue sheet — the map's plan layer as seen
 * from a tapped pin. Renders the opted-in plans at this venue that RLS/ghost
 * rules let me see (plans_on_map). Tapping a plan opens a centered detail card:
 * members/hosts get the full PlanDetailSheet (guest list, RSVP, host requests,
 * share, edit/cancel); a non-member friend gets a light card with the
 * request-to-join control. Names + notes never appear for non-members — the
 * rpc doesn't return them.
 */
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { CalendarClock, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { PlanOnMap } from "@/lib/plans";
import {
  usePlanFeed,
  usePlansOnMap,
  useRequestToJoin,
  useWithdrawRequest,
} from "@/hooks/usePlans";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import PlanDetailSheet from "@/components/social/PlanDetailSheet";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "EEE h:mmaaa"); // e.g. "Fri 10:30pm"
}

function goingLabel(n: number): string {
  return n === 1 ? "1 going" : `${n} going`;
}

/** Right-side quick action + status for one plan row. */
function RowAction({ plan }: { plan: PlanOnMap }) {
  const request = useRequestToJoin();
  const withdraw = useWithdrawRequest();
  const busy = request.isPending || withdraw.isPending;

  if (plan.viewerIsHost) {
    return (
      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
        You&apos;re hosting
      </span>
    );
  }
  if (plan.viewerIsMember) {
    return (
      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
        You&apos;re in
      </span>
    );
  }
  if (plan.viewerRequest === "requested") {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Requested
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() =>
            withdraw.mutate(plan.planId, {
              onError: () => toast.error("Couldn't cancel that request."),
            })
          }
        >
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button
      size="sm"
      className="h-8 shrink-0 rounded-lg text-xs"
      disabled={busy}
      onClick={() =>
        request.mutate(plan.planId, {
          onSuccess: () => toast.success("Request sent — the host will get back to you."),
          onError: () => toast.error("Couldn't send that request — try again."),
        })
      }
    >
      Request to join
    </Button>
  );
}

/** Light centered detail card for a non-member friend (no names, no note). */
function NonMemberDetail({
  plan,
  venueName,
  open,
  onOpenChange,
}: {
  plan: PlanOnMap;
  venueName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogTitle className="flex items-center gap-1.5 font-display text-xl font-bold">
          <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          {venueName}
        </DialogTitle>
        <DialogDescription className="sr-only">Plan details and request to join.</DialogDescription>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {format(new Date(plan.plannedAt), "EEEE MMM d · h:mm a")}
        </p>
        <p className="text-sm">
          Hosted by{" "}
          {plan.hostUsername ? (
            <Link to={`/u/${plan.hostUsername}`} className="font-medium hover:underline">
              @{plan.hostUsername}
            </Link>
          ) : (
            <span className="font-medium">a friend</span>
          )}{" "}
          · {goingLabel(plan.goingCount)}
        </p>
        <div className="pt-1">
          <RowAction plan={plan} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PlansHereRow({
  venueId,
  venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const { data: plans } = usePlansOnMap();
  const { data: feed } = usePlanFeed();
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);

  const here = useMemo(
    () => (plans ?? []).filter((p) => p.venueId === venueId),
    [plans, venueId]
  );
  if (here.length === 0) return null;

  const openPlan = here.find((p) => p.planId === openPlanId) ?? null;
  // Members/hosts have the full plan in their Social feed → full detail sheet.
  const openFeedItem = openPlanId ? (feed ?? []).find((f) => f.plan.id === openPlanId) ?? null : null;
  const editFeedItem = editPlanId ? (feed ?? []).find((f) => f.plan.id === editPlanId) ?? null : null;

  return (
    <div className="mt-3 w-full animate-fade-in overflow-hidden rounded-2xl border border-border bg-card">
      <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Planning to go
      </p>
      <div className="divide-y divide-border/60">
        {here.map((p) => (
          <div key={p.planId} className="flex items-center gap-3 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setOpenPlanId(p.planId)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-label={`Open plan at ${venueName}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{timeLabel(p.plannedAt)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Hosted by {p.hostUsername ? `@${p.hostUsername}` : "a friend"} · {goingLabel(p.goingCount)}
                </span>
              </span>
            </button>
            <RowAction plan={p} />
          </div>
        ))}
      </div>

      {/* Detail card. Member/host → full PlanDetailSheet; else light card. */}
      {openPlan && openFeedItem ? (
        <PlanDetailSheet
          item={openFeedItem}
          open={!!openPlanId}
          onOpenChange={(o) => !o && setOpenPlanId(null)}
          onEdit={() => {
            setEditPlanId(openPlanId);
            setOpenPlanId(null);
          }}
        />
      ) : openPlan ? (
        <NonMemberDetail
          plan={openPlan}
          venueName={venueName}
          open={!!openPlanId}
          onOpenChange={(o) => !o && setOpenPlanId(null)}
        />
      ) : null}

      {editFeedItem && (
        <CreatePlanSheet
          open={!!editPlanId}
          onOpenChange={(o) => !o && setEditPlanId(null)}
          surface="venue"
          editItem={editFeedItem}
        />
      )}
    </div>
  );
}
