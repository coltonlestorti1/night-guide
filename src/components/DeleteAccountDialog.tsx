/**
 * In-app account deletion — App Store Guideline 5.1.1(v).
 *
 * The old flow was a `mailto:` to support, which Apple names specifically as
 * insufficient: deletion has to be initiated and completed in the app.
 *
 * Friction is deliberate and calibrated. This is irreversible and now destroys
 * check-in history that cannot be rebuilt, so it asks the user to type their
 * username — enough to defeat a mis-tap, not so much that someone who genuinely
 * wants out is trapped. Apple also rejects deletion flows that are
 * unreasonably hard to complete, so there is exactly one gate, not three.
 */
import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { deleteOwnAccount, DELETION_REMOVES } from "@/lib/account";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DeleteAccountDialog({ username }: { username: string }) {
  const signOut = useAuthStore((s) => s.signOut);
  // Needed to clear the user's storage folders before the RPC kills the JWT —
  // see deleteOwnAccount.
  const userId = useAuthStore((s) => s.session?.user.id);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmed = typed.trim().toLowerCase() === username.trim().toLowerCase();

  const doDelete = async () => {
    if (!confirmed || busy) return;
    // A missing id must NOT return silently. This is the Guideline 5.1.1(v)
    // flow — a Delete button that does nothing at all, with no error, is worse
    // than one that fails loudly, and it is the same silent-no-op that made
    // submitReport claim success for a discarded row.
    if (!userId) {
      toast.error("Couldn't confirm who you're signed in as. Reload and try again.");
      return;
    }
    setBusy(true);
    try {
      await deleteOwnAccount(userId);
      // The session belongs to a user who no longer exists — sign out before
      // anything can refetch against it. Navigation follows from auth state.
      await signOut();
      toast.success("Your account and data have been deleted.");
    } catch {
      setBusy(false);
      toast.error("Couldn't delete your account. Try again, or email support.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setTyped(""); setOpen(true); }}
        className="flex w-full items-start gap-3 p-4 text-left text-sm font-medium text-destructive transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Trash2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Delete my account
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Permanently removes your account and everything in it.
          </span>
        </span>
      </button>

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left">
                <p>This can't be undone. It deletes:</p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  {DELETION_REMOVES.map((line) => (
                    <li key={line} className="text-xs">{line}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-username" className="text-xs">
              Type <span className="font-semibold text-foreground">{username}</span> to confirm
            </Label>
            <Input
              id="confirm-username"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doDelete(); }}
              disabled={!confirmed || busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Deleting…</> : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
