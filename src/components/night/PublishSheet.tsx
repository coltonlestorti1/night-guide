/**
 * PublishSheet — the drawer wrapper around the log sheet. Opened from the
 * recap, from a post's Edit action, and from a venue's "Log the night".
 *
 * AddNightSheet does NOT use this; it renders PublishForm as its own second
 * step, so only one drawer is ever alive for that flow.
 *
 * `nightEditable` is off by default because two of the three callers must not
 * move the night: night_posts is keyed (user_id, venue_id, night_date), so
 * changing it on an edit would create a second post instead of moving this one.
 */
import { useEffect, useState } from "react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import PublishForm from "@/components/night/PublishForm";

export default function PublishSheet({
  venue,
  nightDate,
  open,
  onOpenChange,
  nightEditable = false,
}: {
  venue: Venue;
  nightDate: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Lets the sheet ask which night. Only the venue path passes this. */
  nightEditable?: boolean;
}) {
  // Held up while the OS file dialog is open — see PublishForm.
  const [picking, setPicking] = useState(false);
  // Local so the night row can move it; seeded from the caller's night. Keyed
  // on the prop so reopening for a different night starts in the right place.
  const [night, setNight] = useState(nightDate);
  useEffect(() => setNight(nightDate), [nightDate]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        onInteractOutside={(e) => picking && e.preventDefault()}
        // The log sheet is a header, three circles, five rows and two buttons —
        // taller than the old note-and-audience form, and tall enough to run
        // off a phone. Capped and scrolled like every other tall sheet here.
        className="bg-card border-border sheet-h-88">
        <DrawerTitle className="sr-only">Log a night at {venue.title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Say how it was, then add anything else you want to remember.
        </DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full overflow-y-auto overflow-x-hidden">
          <PublishForm
            onPickingChange={setPicking}
            venue={venue}
            nightDate={night}
            nightEditable={nightEditable}
            onNightDateChange={setNight}
            onDone={() => onOpenChange(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
