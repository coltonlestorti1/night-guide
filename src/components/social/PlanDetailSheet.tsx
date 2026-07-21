/**
 * Plan detail bottom sheet (§21) — opens when you tap a PlanCard. Shows the
 * full event (venue, time, host, note), the complete guest list (going /
 * maybe / can't, or counts when the list is hidden and you're not the host),
 * one-tap RSVP, share, and a host ⋯ menu (edit / cancel) top-right. Edit is
 * lifted to the parent via onEdit so we don't nest two vaul drawers; cancel
 * and share are handled here. This is also the surface map-plans "event
 * detail" will reuse.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, Forward, MapPin, MoreHorizontal, Plus, X } from "lucide-react";
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
  rsvpDisplayName,
  sharePlanLink,
} from "@/lib/plans";
import {
  useAddInvitees,
  useApproveRequest,
  useCancelPlan,
  useDenyRequest,
  usePendingRequests,
  useRemoveGuest,
  useSetRsvp,
} from "@/hooks/usePlans";
import { logEvent } from "@/lib/analytics";
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
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
  const approve = useApproveRequest();
  const deny = useDenyRequest();
  const { plan, venueName, host, isHost, rsvps, counts, myRsvp } = item;

  const removeGuest = useRemoveGuest();
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fire every still-pending DELETE now (bare mutate — no component state touched,
  // so it's safe during unmount). Reads only refs + the stable mutate; kept in a
  // ref so the close/unmount effects always call the latest version.
  const flushPendingRef = useRef(() => {});
  flushPendingRef.current = () => {
    timersRef.current.forEach((timer, rsvpId) => {
      clearTimeout(timer);
      removeGuest.mutate(rsvpId);
    });
    timersRef.current.clear();
  };

  // Pending removals commit when their ~5s timer fires, or immediately if this
  // component unmounts (below) — deliberately NOT on sheet *close*. The "Removed
  // … · Undo" toast renders at the app root, outside this dialog, so clicking
  // Undo counts as an outside-click that closes the sheet; committing on close
  // would fire the DELETE before Undo could cancel the timer, defeating Undo.
  // Radix keeps this component mounted when the dialog closes, so the timer (and
  // therefore Undo) keeps working after a close; a genuine unmount still flushes.
  useEffect(() => () => flushPendingRef.current(), []);

  const commitRemoval = (rsvpId: string) => {
    timersRef.current.delete(rsvpId);
    removeGuest.mutate(rsvpId, {
      onError: () => {
        toast.error("Couldn't remove that guest");
        setPendingRemovals((prev) => {
          const next = new Set(prev);
          next.delete(rsvpId);
          return next;
        });
      },
    });
  };

  const startRemoval = (r: PlanRsvpRow) => {
    const name = rsvpDisplayName(r);
    setPendingRemovals((prev) => new Set(prev).add(r.id));
    const timer = setTimeout(() => commitRemoval(r.id), 5000);
    timersRef.current.set(r.id, timer);
    toast(`Removed ${name}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const t = timersRef.current.get(r.id);
          if (t) clearTimeout(t);
          timersRef.current.delete(r.id);
          setPendingRemovals((prev) => {
            const next = new Set(prev);
            next.delete(r.id);
            return next;
          });
        },
      },
    });
  };

  const addInvitees = useAddInvitees();
  const [showInvite, setShowInvite] = useState(false);
  const myId = useAuthStore((s) => s.session?.user.id);
  const { data: friendRows } = useMyFriendships();
  const friends = useMemo(
    () => (friendRows && myId ? deriveFriends(friendRows, myId) : []),
    [friendRows, myId]
  );

  // Pending join-requests for this plan (host only — the query is scoped to my
  // hosted plans server-side; filter to this one for the section).
  const { data: allPending } = usePendingRequests();

  // Everyone already on the plan (minus rows mid-removal), so we don't re-offer them.
  const rosterUserIds = useMemo(() => {
    const ids = new Set(
      rsvps
        .filter((r) => !pendingRemovals.has(r.id))
        .map((r) => r.user_id)
        .filter((id): id is string => !!id)
    );
    // Friends with an open join-request already have a plan_rsvps row ('requested',
    // stripped from `rsvps` upstream). Don't offer to invite them — the INSERT would
    // hit unique(plan_id,user_id); the host approves them in the Requests section.
    if (isHost && allPending) {
      for (const r of allPending) if (r.planId === plan.id) ids.add(r.userId);
    }
    return ids;
  }, [rsvps, pendingRemovals, allPending, isHost, plan.id]);
  const invitableFriends = friends.filter((f) => !rosterUserIds.has(f.profile.id));

  const inviteFriend = (friendId: string, name: string) =>
    addInvitees.mutate(
      { planId: plan.id, friendIds: [friendId] },
      {
        onSuccess: () => toast.success(`Invited ${name}`),
        onError: () => toast.error("Couldn't add — try again"),
      }
    );

  const pending = isHost ? (allPending ?? []).filter((r) => r.planId === plan.id) : [];
  const requestBusy = approve.isPending || deny.isPending;

  const showNames = isHost || !plan.hide_guest_list;
  const responded = rsvps.filter((r) => r.rsvp !== null && !pendingRemovals.has(r.id));
  // Host-only: invited members who haven't answered yet (rsvp null).
  const pendingInvites = rsvps.filter((r) => r.rsvp === null && !pendingRemovals.has(r.id));
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
    const res = await sharePlanLink(plan, venueName);
    if (res === "copied") toast.success("Link copied");
    else if (res === "unavailable") toast.error("Couldn't copy the link");
  };

  const guestRow = (r: PlanRsvpRow) => {
    const removable = isHost && r.user_id !== plan.creator_id;
    return (
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
        <span className="flex shrink-0 items-center gap-2">
          {r.rsvp && (
            <span className={cn("text-xs font-medium", STATUS_COLOR[r.rsvp])}>
              {STATUS_LABEL[r.rsvp]}
            </span>
          )}
          {removable && (
            <button
              type="button"
              onClick={() => startRemoval(r)}
              aria-label={`Remove ${rsvpDisplayName(r)}`}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <>
      {/* The dialog is non-modal (so a sonner toast — the "Removed … · Undo"
          affordance — stays clickable; a modal dialog blanks outside pointer
          events and Undo would never fire). Non-modal drops Radix's dimming
          overlay, so we render our own backdrop, portaled to <body> to sit under
          the z-50 content but above the page. The toaster's higher z keeps Undo
          on top and tappable. Clicking the backdrop closes, like the old overlay. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-black/80"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />,
          document.body
        )}
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      {/* Centered modal (not a bottom drawer) so it reads as a card on
          desktop. gap-0/p-0 hand spacing to the inner div; the built-in
          close X is hidden ([&>button]:hidden) since the header carries
          share + the ⋯ menu and the modal closes on outside-click. */}
      <DialogContent
        className="bg-card border-border max-w-md gap-0 p-0 [&>button]:hidden"
        onInteractOutside={(e) => {
          // A sonner toast (e.g. the "Removed … · Undo" affordance) renders at
          // the app root, outside this dialog. Without this guard, clicking it
          // counts as an outside-click that closes the sheet — and closing
          // flushes/commits the pending removal before Undo can cancel it, so
          // Undo never works. Keep the sheet open for interactions on a toast.
          const target = e.detail.originalEvent.target as Element | null;
          if (target?.closest("[data-sonner-toaster]")) e.preventDefault();
        }}
      >
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
                variant="outline"
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

          {/* Join requests (host only) — approve adds them as going, deny drops
              the request (they can ask again). */}
          {isHost && pending.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Requests ({pending.length})
              </p>
              <ul className="space-y-2">
                {pending.map((r) => (
                  <li key={r.rsvpId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm">
                      {r.username ? (
                        <Link
                          to={`/u/${r.username}`}
                          onClick={() => onOpenChange(false)}
                          className="font-medium hover:underline"
                        >
                          {r.name || `@${r.username}`}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.name || "Someone"}</span>
                      )}
                      <span className="text-muted-foreground"> wants in</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={requestBusy}
                        onClick={() =>
                          approve.mutate(r.rsvpId, {
                            onSuccess: () => toast.success(`${r.name || "They"}'re in`),
                            onError: () => toast.error("Couldn't approve that request"),
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
                        disabled={requestBusy}
                        onClick={() =>
                          deny.mutate(r.rsvpId, {
                            onError: () => toast.error("Couldn't deny that request"),
                          })
                        }
                      >
                        Deny
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              <>
                {ordered.length > 0 ? (
                  <ul className="space-y-2">{ordered.map(guestRow)}</ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No RSVPs yet — share the link to get people in.
                  </p>
                )}
                {isHost && pendingInvites.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Invited · no answer yet
                    </p>
                    <ul className="space-y-2">{pendingInvites.map(guestRow)}</ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {counts
                  ? `${counts.going} going · ${counts.maybe} maybe`
                  : "The host hid the guest list."}
              </p>
            )}
          </div>

          {/* Add invitees (host only) — add-on-tap, filtered to friends not yet
              on the roster. Removal is the × above; this only adds. */}
          {isHost && (
            <div>
              {!showInvite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-lg px-2 text-sm text-primary"
                  onClick={() => setShowInvite(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Invite friends
                </Button>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Invite friends
                  </p>
                  {invitableFriends.length > 0 ? (
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {invitableFriends.map((f) => {
                        const name = f.profile.display_name || `@${f.profile.username}`;
                        return (
                          <button
                            key={f.profile.id}
                            type="button"
                            disabled={addInvitees.isPending}
                            onClick={() => inviteFriend(f.profile.id, name)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-50"
                          >
                            <ProfileAvatar profile={f.profile} className="h-8 w-8" />
                            <span className="truncate text-sm font-medium">{name}</span>
                            <Plus className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Everyone you know is already on it.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Share with anyone — surface the plan link for people not on ENDZ,
              right where the host is thinking about who to bring. Same link and
              share/copy behavior as the header share button. */}
          {isHost && (
            <button
              type="button"
              onClick={share}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border px-3.5 py-3 text-left transition-colors hover:bg-secondary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Forward className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">Share with anyone</span>
                <span className="block text-xs text-muted-foreground">
                  Send a link to friends who aren&apos;t on ENDZ — they can RSVP too.
                </span>
              </span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
