/**
 * Report a user — App Store Guideline 1.2.
 *
 * Apple requires reporting AND blocking for apps with user-generated content,
 * plus acting on reports within 24 hours. The dialog offers blocking in the
 * same breath as reporting because they're the same impulse: the person who
 * wants this user reviewed almost always wants them gone from their feed now,
 * and making them hunt for a second control is how people give up.
 *
 * The 24-hour commitment is stated in the confirmation copy, not just in the
 * Terms — Apple looks for it in the flow.
 */
import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useBlockUser } from "@/hooks/useFriends";
import { REPORT_REASONS, ReportContext, ReportReason, submitReport } from "@/lib/reports";
import type { FriendProfile } from "@/lib/friends";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function ReportDialog({
  profile,
  context = "profile",
  contextId = null,
}: {
  profile: FriendProfile;
  context?: ReportContext;
  contextId?: string | null;
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const blockUser = useBlockUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const name = profile.display_name || `@${profile.username}`;

  const reset = () => { setReason(null); setDetails(""); setAlsoBlock(true); };

  const submit = async () => {
    if (!myId || !reason || busy) return;
    setBusy(true);
    try {
      const outcome = await submitReport({
        reporterId: myId,
        reportedUserId: profile.id,
        reason,
        details,
        context,
        contextId,
      });
      // Report first, block second: the report is the compliance-critical write
      // and must land even if blocking fails for a graph-state reason.
      if (alsoBlock) {
        try {
          await blockUser.mutateAsync(profile);
        } catch {
          // Must branch on outcome too. Saying "Reported" here when the row
          // was a discarded duplicate is the same false success this fix
          // exists to remove — just on the block-failed path.
          toast.error(
            outcome === "already-reported"
              ? `You'd already reported ${name}, and we couldn't block them. Try blocking from their profile.`
              : `Reported, but couldn't block them. Try blocking from their profile.`,
          );
          setOpen(false);
          reset();
          return;
        }
      }
      setOpen(false);
      reset();
      // Say what actually happened. A duplicate is not an error, but claiming
      // a report was filed when the row was discarded is a lie in exactly the
      // flow that must be trustworthy.
      const blocked = alsoBlock ? ` ${name} is blocked.` : "";
      toast.success(
        outcome === "already-reported"
          ? `You've already reported ${name} — it's still under review.${blocked}`
          : `Thanks — we review reports within 24 hours.${blocked}`,
      );
    } catch {
      toast.error("Couldn't send that report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!myId || myId === profile.id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) reset(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report {name}</DialogTitle>
            <DialogDescription>
              What's going on? We review every report within 24 hours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                aria-pressed={reason === r.value}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  reason === r.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:bg-secondary"
                )}
              >
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.hint}</span>
              </button>
            ))}
          </div>

          {reason && (
            <div className="space-y-3 animate-fade-in">
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else we should know? (optional)"
                rows={3}
                maxLength={1000}
                className="text-sm"
              />
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={alsoBlock}
                  onCheckedChange={(v) => setAlsoBlock(v === true)}
                />
                <span>Also block {name}</span>
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setOpen(false); reset(); }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={!reason || busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending…</> : "Send report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
