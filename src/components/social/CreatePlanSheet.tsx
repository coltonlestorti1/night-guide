/**
 * Create-a-plan bottom sheet (§21) — the one shared create surface for both
 * entry points (Social "Make a plan", VenueDetail "Plan a night here").
 * Flow: venue + time + note + hide-toggle + check off friends → create →
 * share step with the /p/:token link. Edit mode (editItem set) reuses the
 * same fields, saves via updatePlan, and skips invites + share step
 * (invite changes are out of MVP scope; the link never changes).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, Share2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useVenues } from "@/hooks/useVenues";
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
import { useCreatePlan, useUpdatePlan } from "@/hooks/usePlans";
import { PLAN_NOTE_MAX, PlanFeedItem, PlanRow, planShareMessage, planShareUrl } from "@/lib/plans";
import { logEvent } from "@/lib/analytics";
import ProfileAvatar from "@/components/social/ProfileAvatar";

/** Tonight at 9pm local, as a datetime-local input value. */
function defaultPlannedAt(): string {
  const d = new Date();
  d.setHours(21, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setTime(Date.now() + 60 * 60_000);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function CreatePlanSheet({
  open,
  onOpenChange,
  initialVenueId,
  surface,
  editItem,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialVenueId?: string;
  surface: "social" | "venue";
  editItem?: PlanFeedItem;
}) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: venues } = useVenues({});
  const { data: friendRows } = useMyFriendships();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueSearch, setVenueSearch] = useState("");
  const [plannedAt, setPlannedAt] = useState(defaultPlannedAt());
  const [note, setNote] = useState("");
  const [hideGuestList, setHideGuestList] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<PlanRow | null>(null);
  const [copied, setCopied] = useState(false);

  // Seed fields on the closed→open transition only. Keying this on
  // editItem's identity would re-seed mid-edit: usePlanFeed refetches on
  // window focus, producing a new editItem object for the same plan, and a
  // dep-array reseed would silently wipe whatever the host was mid-typing.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    setCreated(null);
    setCopied(false);
    setVenueSearch("");
    setInvited(new Set());
    if (editItem) {
      setVenueId(editItem.plan.venue_id);
      setPlannedAt(format(new Date(editItem.plan.planned_at), "yyyy-MM-dd'T'HH:mm"));
      setNote(editItem.plan.note ?? "");
      setHideGuestList(editItem.plan.hide_guest_list);
    } else {
      setVenueId(initialVenueId ?? null);
      setPlannedAt(defaultPlannedAt());
      setNote("");
      setHideGuestList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const friends = useMemo(
    () => (friendRows && userId ? deriveFriends(friendRows, userId) : []),
    [friendRows, userId]
  );

  const selectedVenue = venues?.find((v) => v.id === venueId) ?? null;
  const venueMatches = useMemo(() => {
    if (!venues) return [];
    const q = venueSearch.trim().toLowerCase();
    if (!q) return venues.slice(0, 6);
    return venues.filter((v) => v.title.toLowerCase().includes(q)).slice(0, 6);
  }, [venues, venueSearch]);

  const canSubmit =
    !!venueId && !!plannedAt && !Number.isNaN(new Date(plannedAt).getTime());

  const submit = async () => {
    if (!canSubmit || !venueId) return;
    if (editItem) {
      updatePlan.mutate(
        {
          planId: editItem.plan.id,
          patch: {
            venue_id: venueId,
            planned_at: new Date(plannedAt).toISOString(),
            note: note.trim() || null,
            hide_guest_list: hideGuestList,
          },
        },
        {
          onSuccess: () => {
            toast.success("Plan updated");
            onOpenChange(false);
          },
          onError: () => toast.error("Couldn't update the plan"),
        }
      );
      return;
    }
    createPlan.mutate(
      {
        venueId,
        plannedAt: new Date(plannedAt),
        note,
        hideGuestList,
        inviteFriendIds: [...invited],
      },
      {
        onSuccess: ({ plan, invitesFailed }) => {
          logEvent("plan_created", { venue_id: venueId, surface });
          setCreated(plan);
          if (invitesFailed) {
            toast.warning("Plan made, but some invites didn't go through — share the link instead.");
          }
        },
        onError: () => toast.error("Couldn't create the plan — try again"),
      }
    );
  };

  const link = created ? planShareUrl(created) : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (non-secure context) — nothing sane to do
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: planShareMessage(selectedVenue?.title ?? "the spot", plannedAt),
          url: link,
        });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      copyLink();
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">
          {editItem ? "Edit plan" : "Make a plan"}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick a spot and a time, then share the link.
        </DrawerDescription>

        {created ? (
          /* ── Share step ── */
          <div className="p-5 pb-8 space-y-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <Check className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <p className="font-display text-lg font-bold">Plan made.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Anyone with this link can see it and RSVP — no app needed.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/60 px-3.5 py-3 text-xs font-mono break-all">
              {link}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11 rounded-xl" onClick={copyLink}>
                {copied ? "Copied ✓" : "Copy link"}
              </Button>
              <Button className="h-11 rounded-xl" onClick={shareLink}>
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full h-10 rounded-xl text-muted-foreground"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          /* ── Form step ── */
          <div className="p-5 pb-8 space-y-4 overflow-y-auto max-h-[85vh]">
            <p className="font-display text-lg font-bold">
              {editItem ? "Edit plan" : "Make a plan"}
            </p>

            {/* Venue */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Where
              </p>
              {selectedVenue ? (
                <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary-soft/40 px-3.5 py-3">
                  <p className="text-sm font-semibold truncate">{selectedVenue.title}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 text-xs text-muted-foreground"
                    onClick={() => setVenueId(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search spots…"
                    value={venueSearch}
                    onChange={(e) => setVenueSearch(e.target.value)}
                    className="rounded-xl"
                  />
                  <div className="mt-2 space-y-1">
                    {venueMatches.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVenueId(v.id)}
                        className="w-full text-left rounded-xl px-3 py-2.5 text-sm hover:bg-secondary transition-colors"
                      >
                        <span className="font-medium">{v.title}</span>
                        {v.neighborhood && (
                          <span className="text-muted-foreground"> · {v.neighborhood}</span>
                        )}
                      </button>
                    ))}
                    {venues && venueMatches.length === 0 && (
                      <p className="text-sm text-muted-foreground px-3 py-2">No matches.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Time */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                When
              </p>
              {/* The vaul drawer captures pointer events on its content for
                  drag-to-dismiss, which eats the click before the native
                  date/time picker can open ("can't change the time").
                  data-vaul-no-drag excludes the input from vaul's own drag
                  check; stopping propagation in the capture phase guarantees
                  vaul's ancestor handlers never see the pointerdown at all
                  (the input itself is still the event target, so focus + the
                  native picker work normally). */}
              <Input
                type="datetime-local"
                value={plannedAt}
                onChange={(e) => setPlannedAt(e.target.value)}
                className="rounded-xl [color-scheme:light] dark:[color-scheme:dark]"
                data-vaul-no-drag
                onPointerDownCapture={(e) => e.stopPropagation()}
              />
            </div>

            {/* Note */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Note <span className="normal-case font-normal">(optional)</span>
              </p>
              <Textarea
                placeholder="Pre-game at mine first…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={PLAN_NOTE_MAX}
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>

            {/* Guest list visibility */}
            <div className="flex items-center justify-between rounded-2xl border border-border px-3.5 py-3">
              <div className="min-w-0 pr-3">
                <p className="text-sm font-medium">Hide guest list</p>
                <p className="text-xs text-muted-foreground">
                  People see counts, not names.
                </p>
              </div>
              <Switch checked={hideGuestList} onCheckedChange={setHideGuestList} />
            </div>

            {/* Invites — create mode only */}
            {!editItem && friends.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Invite friends
                </p>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {friends.map((f) => {
                    const checked = invited.has(f.profile.id);
                    return (
                      <label
                        key={f.profile.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition-colors",
                          checked ? "bg-primary-soft/50" : "hover:bg-secondary"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setInvited((prev) => {
                              const next = new Set(prev);
                              if (c) next.add(f.profile.id);
                              else next.delete(f.profile.id);
                              return next;
                            });
                          }}
                        />
                        <ProfileAvatar profile={f.profile} className="h-8 w-8" />
                        <span className="text-sm font-medium truncate">
                          {f.profile.display_name || `@${f.profile.username}`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-xl shadow-glow"
              disabled={!canSubmit || createPlan.isPending || updatePlan.isPending}
              onClick={submit}
            >
              {editItem
                ? updatePlan.isPending ? "Saving…" : "Save changes"
                : createPlan.isPending ? "Making it…" : "Make the plan"}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
