/**
 * One plan in the Social Plans section: venue + time + host + note, one-tap
 * RSVP row, and the guest list per the visibility rule — RLS already
 * decided what rsvp rows came back; when the list is hidden and I'm not
 * host, `counts` (from the gated rpc) is all we show. Host gets share /
 * edit / cancel.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, MapPin, MoreHorizontal, Share2 } from "lucide-react";
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
import { PlanFeedItem, PlanRsvpValue, planShareUrl } from "@/lib/plans";
import { useCancelPlan, useSetRsvp } from "@/hooks/usePlans";
import { logEvent } from "@/lib/analytics";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";

const RSVP_OPTIONS: { value: PlanRsvpValue; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't" },
];

function rsvpName(r: PlanFeedItem["rsvps"][number]): string {
  if (r.profile) return r.profile.display_name || `@${r.profile.username}`;
  return r.guest_name ?? "Someone";
}

export default function PlanCard({ item }: { item: PlanFeedItem }) {
  const setRsvp = useSetRsvp();
  const cancel = useCancelPlan();
  const [editOpen, setEditOpen] = useState(false);
  const { plan, venueName, host, isHost, rsvps, counts, myRsvp } = item;

  const going = rsvps.filter((r) => r.rsvp === "going");
  const maybe = rsvps.filter((r) => r.rsvp === "maybe");
  const showNames = isHost || !plan.hide_guest_list;

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
        await navigator.share({ text: `${venueName} — you in?`, url });
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

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-3.5 mb-2 last:mb-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to={`/venue/${plan.venue_id}`} className="block">
            <p className="text-sm font-semibold truncate flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {venueName}
            </p>
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {format(new Date(plan.planned_at), "EEE MMM d · h:mm a")}
          </p>
          {host && !isHost && (
            <Link
              to={`/u/${host.username}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ProfileAvatar profile={host} className="h-4 w-4" />
              {host.display_name || `@${host.username}`}&apos;s plan
            </Link>
          )}
          {plan.note && <p className="text-xs text-foreground/80 mt-1.5">{plan.note}</p>}
        </div>

        {isHost ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-full"
              onClick={share}
              aria-label="Share plan link"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-full"
                    aria-label="Plan options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                    Edit plan
                  </DropdownMenuItem>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive">
                      Cancel plan
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Everyone's link will show the plan is off. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      cancel.mutate(plan.id, {
                        onSuccess: () => toast.success("Plan cancelled"),
                        onError: () => toast.error("Couldn't cancel the plan"),
                      })
                    }
                  >
                    Cancel plan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>

      {/* One-tap RSVP */}
      {!isHost && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {RSVP_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={myRsvp === opt.value ? "default" : "secondary"}
              className="h-9 rounded-xl text-xs"
              onClick={() => tapRsvp(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {/* Guest list / counts */}
      <div className="mt-2.5">
        {showNames ? (
          going.length + maybe.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {going.map(rsvpName).join(", ")}
              </span>
              {going.length > 0 && " going"}
              {maybe.length > 0 && (
                <>
                  {going.length > 0 && " · "}
                  {maybe.map(rsvpName).join(", ")} maybe
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No RSVPs yet — share the link.</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            {counts ? `${counts.going} going · ${counts.maybe} maybe` : "Guest list hidden"}
          </p>
        )}
      </div>

      {isHost && (
        <CreatePlanSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          surface="social"
          editItem={item}
        />
      )}
    </div>
  );
}
