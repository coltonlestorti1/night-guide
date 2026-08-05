/**
 * Profile > Privacy row controlling who sees your saved spots.
 *
 * Saves became server-side on 2026-08-05 so friends' faces could appear on
 * venue cards. That made a bookmark a disclosure, and a disclosure needs an
 * off switch — this is it. Changing the setting rewrites existing saves too
 * (setSaveVisibility), because a privacy control that only applied going
 * forward would leave everything already saved exposed.
 */
import { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useSaveVisibility } from "@/hooks/useSaves";
import { setSaveVisibility } from "@/lib/saves";
import type { CheckinVisibility } from "@/lib/checkins";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CheckinVisibility; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Anyone on ENDZ can see what you've saved" },
  { value: "friends", label: "Friends", hint: "Only your friends see your saves" },
  { value: "nobody", label: "Nobody", hint: "Your saves stay private — nobody sees them" },
];

export default function SaveVisibilityRow() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: value } = useSaveVisibility();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1];

  const choose = async (next: CheckinVisibility) => {
    if (!userId || busy) return;
    setOpen(false);
    setBusy(true);
    const prev = queryClient.getQueryData(["save-visibility", userId]);
    queryClient.setQueryData(["save-visibility", userId], next);
    try {
      await setSaveVisibility(userId, next);
      // Friends' cards read from this table too — drop the cached facepiles.
      queryClient.invalidateQueries({ queryKey: ["friend-saves"] });
    } catch {
      queryClient.setQueryData(["save-visibility", userId], prev);
      toast.error("Couldn't update who sees your saves. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!userId}
        className="flex w-full items-start gap-3 glass rounded-2xl p-4 text-left transition-colors hover:bg-accent/10 disabled:opacity-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground border border-border">
          <Bookmark className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-sm">Who sees your saves</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Saved spots can show your face on your friends' cards.
          </span>
        </span>
        <span className="mt-1.5 shrink-0 text-sm font-semibold">{current.label}</span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerTitle className="px-4 pt-2 text-base font-semibold text-center">
            Who sees your saved spots?
          </DrawerTitle>
          <DrawerDescription className="px-4 pt-1 text-center text-xs text-muted-foreground">
            This applies to spots you've already saved, not just new ones.
          </DrawerDescription>
          <div className="max-w-lg mx-auto w-full px-4 pb-8 pt-3 space-y-2">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => choose(o.value)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  value === o.value
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-card hover:bg-secondary"
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
                {value === o.value && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
