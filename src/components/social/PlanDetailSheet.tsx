/**
 * Plan detail bottom sheet (§21) — opens when you tap a PlanCard. Shows the
 * full event (venue, time, host, note), the complete guest list (going /
 * maybe / can't, or counts when the list is hidden and you're not the host),
 * one-tap RSVP, share, and a host ⋯ menu (edit / cancel) top-right. Edit is
 * lifted to the parent via onEdit so we don't nest two vaul drawers; cancel
 * and share are handled here. This is also the surface map-plans "event
 * detail" will reuse.
 */
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, Forward, MapPin, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PlanFeedItem,
  PlanRsvpRow,
  PlanRsvpValue,
  planShareMessage,
  planShareUrl,
  rsvpDisplayName,
} from "@/lib/plans";
import { useCancelPlan, useSetRsvp } from "@/hooks/usePlans";
import { logEvent } from "@/lib/analytics";
import ProfileAvatar from "@/components/social/ProfileAvatar";

const RSVP_OPTIONS: { value: PlanRsvpValue; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't" },
];

const STATUS_LABEL: Record<PlanRsvpValue, string> = {
  going: "going",
  maybe: "maybe",
  no: "can't",
};
const STATUS_COLOR: Record<PlanRsvpValue, string> = {
  going: "text-emerald-600",
  maybe: "text-amber-600",
  no: "text-muted-foreground",
};

export default function PlanDetailSheet({
  item,
  open,
  onOpenChange,
  onEdit,
}: {
  item: PlanFeedItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
}) {
  const setRsvp = useSetRsvp();
  const cancel = useCancelPlan();
  const { plan, venueName, host, isHost, rsvps, counts, myRsvp } = item;

  const showNames = isHost || !plan.hide_guest_list;
  const responded = rsvps.filter((r) => r.rsvp !== null);
  // going first, then maybe, then can't
  const order: Record<string, number> = { going: 0, maybe: 1, no: 2 };
  const ordered = [...responded].sort(
    (a, b) => (order[a.rsvp ?? "no"] ?? 3) - (order[b.rsvp ?? "no"] ?? 3)
  );

  const tapRsvp = (value: PlanRsvpValue) => {
    setRsvp.mutate(
      { planId: plan.id, value },
      { onError: () => toast.error("Couldn't save your RSVP") }
    );
    logEvent("plan_rsvp", { venue_id: plan.venue_id, surface: "social", value });
  };

  const share = async () => {
    const url = planShareUrl(plan);
    if (navigator.share) {
      try {
        await navigator.share({ text: planShareMessage(venueName, plan.planned_at), url });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        // Clipboard unavailable — nothing sane to do
      }
    }
  };

  const guestRow = (r: PlanRsvpRow) => (
    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 min-w-0">
        {r.profile ? (
          <ProfileAvatar profile={r.profile} className="h-6 w-6" />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
            {rsvpDisplayName(r).slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="truncate">{rsvpDisplayName(r)}</span>
      </span>
      {r.rsvp && (
        <span className={cn("shrink-0 text-xs font-medium", STATUS_COLOR[r.rsvp])}>
          {STATUS_LABEL[r.rsvp]}
        </span>
      )}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Centered modal (not a bottom drawer) so it reads as a card on
          desktop. gap-0/p-0 hand spacing to the inner div; the built-in
          close X is hidden ([&>button]:hidden) since the header carries
          share + the ⋯ menu and the modal closes on outside-click. */}
      <DialogContent className="bg-card border-border max-w-md gap-0 p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Plan details</DialogTitle>
        <DialogDescription className="sr-only">
          Event details, guest list, and RSVP.
        </DialogDescription>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to={`/venue/${plan.venue_id}`}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1.5 font-display text-xl font-bold leading-tight"
              >
                <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                {venueName}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {format(new Date(plan.planned_at), "EEEE MMM d · h:mm a")}
              </p>
              {host && !isHost && (
                <Link
                  to={`/u/${host.username}`}
                  onClick={() => onOpenChange(false)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ProfileAvatar profile={host} className="h-4 w-4" />
                  {host.display_name || `@${host.username}`}&apos;s plan
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 rounded-full"
                onClick={share}
                aria-label="Share plan link"
              >
                <Forward className="h-4 w-4" />
              </Button>
              {isHost && (
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0 rounded-full"
                        aria-label="Plan options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={onEdit}>Edit plan</DropdownMenuItem>
                      <AlertDialogTrigger asChild>
                        {/* preventDefault: keep the menu from auto-closing and
                            unmounting this trigger before the dialog opens. */}
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          Cancel plan
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Everyone&apos;s link will show the plan is off. This can&apos;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          cancel.mutate(plan.id, {
                            onSuccess: () => {
                              toast.success("Plan cancelled");
                              onOpenChange(false);
                            },
                            onError: () => toast.error("Couldn't cancel the plan"),
                          })
                        }
                      >
                        Cancel plan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {plan.note && <p className="text-sm text-foreground/90">{plan.note}</p>}

          {/* RSVP (non-host) */}
          {!isHost && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Your answer
              </p>
              <div className="grid grid-cols-3 gap-2">
                {RSVP_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={myRsvp === opt.value ? "default" : "secondary"}
                    className="h-11 rounded-xl"
                    onClick={() => tapRsvp(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Guest list */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Who&apos;s in
            </p>
            {showNames ? (
              ordered.length > 0 ? (
                <ul className="space-y-2">{ordered.map(guestRow)}</ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No RSVPs yet — share the link to get people in.
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {counts
                  ? `${counts.going} going · ${counts.maybe} maybe`
                  : "The host hid the guest list."}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
