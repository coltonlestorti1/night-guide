/**
 * Picking which night, for the Add-a-night sheet.
 *
 * TWO controls, one per platform, and that is deliberate:
 *   - phones keep the NATIVE <input type="date">, which is the iOS wheel
 *     Colton already likes and which no custom widget beats on touch;
 *   - desktop (md+) gets a calendar popover, because spinning a wheel with a
 *     mouse is worse than clicking a day in a grid.
 *
 * The draft-string dance on the native input is load-bearing — see the comment
 * on onChange. It fixed the field fighting your typing on 2026-08-09.
 */
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Local-time YYYY-MM-DD. Never toISOString() — that shifts the day for
 *  anyone west of UTC, which is everyone using this app. */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function NightDateField({
  value,
  max,
  onChange,
}: {
  value: string;
  /** Today, as YYYY-MM-DD. You cannot have been out tomorrow. */
  max: string;
  onChange: (next: string) => void;
}) {
  // The native input needs its own draft: it reports "" while you are part-way
  // through typing MM/DD/YYYY, and writing the committed value back mid-edit
  // is what made the field feel dead on desktop.
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);

  // Keep the draft honest when a chip changes the night from outside.
  if (draft !== value && document.activeElement?.getAttribute("type") !== "date") {
    // Cheap sync during render rather than an effect — no extra paint, and it
    // only runs while the field is NOT being typed into.
    setDraft(value);
  }

  const selected = value ? parseISO(value) : undefined;

  return (
    <>
      {/* Phone: the native wheel. */}
      <Input
        type="date"
        style={{ minWidth: 0, maxWidth: "100%" }}
        value={draft}
        max={max}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          if (next && next <= max) onChange(next);
        }}
        onBlur={() => setDraft(value)}
        className="mb-5 md:hidden"
        aria-label="Or pick a date"
      />

      {/* Desktop: a calendar you can page through. */}
      <div className="mb-5 hidden md:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 rounded-md font-normal"
              aria-label="Pick a date"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {selected ? format(selected, "EEEE, d MMMM yyyy") : "Pick a date"}
              </span>
            </Button>
          </PopoverTrigger>
          {open && (
          <PopoverContent
            // Mounted only while open, and the close animation is off.
            // Inside this drawer Radix never received the exit animation's
            // animationend, so the calendar stayed painted on screen with
            // data-state="closed" after a day was picked. Owning the mount
            // removes the dependency on that event entirely.
            className="w-auto p-0 data-[state=closed]:animate-none"
            align="start"
          >
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              // Future nights are not a thing you can have been out on.
              disabled={{ after: parseISO(max) }}
              onSelect={(d) => {
                if (!d) return;
                onChange(isoLocal(d));
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
          )}
        </Popover>
      </div>
    </>
  );
}
