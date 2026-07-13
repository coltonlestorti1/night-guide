/**
 * Quiet per-check-in visibility control: one line under the check-in button,
 * a 3-option bottom sheet on tap. Never a required step — check-in stays
 * one tap. Enforcement is the DB's "checkins visible per rules" policy;
 * this only picks the value written with the row.
 */
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CheckinVisibility as Visibility } from "@/lib/checkins";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "everyone", label: "Everyone", hint: "Anyone on ENDZ can see you're here" },
  { value: "friends", label: "Friends", hint: "Only your friends see you" },
  { value: "nobody", label: "Nobody", hint: "Check in silently — you still count in the crowd" },
];

export default function CheckInVisibility({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Check-in visibility: ${current.label}. Change`}
      >
        Visible to: <span className="font-semibold text-foreground">{current.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerTitle className="px-4 pt-2 text-base font-semibold text-center">
            Who sees your check-in?
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Choose who can see you're here. Your choice sticks for next time.
          </DrawerDescription>
          <div className="max-w-lg mx-auto w-full px-4 pb-8 pt-3 space-y-2">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
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
