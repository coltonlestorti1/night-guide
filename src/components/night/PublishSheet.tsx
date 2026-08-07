/**
 * PublishSheet — the drawer wrapper around PublishForm, opened from the recap.
 *
 * AddNightSheet does NOT use this; it renders PublishForm as its own second
 * step, so only one drawer is ever alive for that flow.
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import PublishForm from "@/components/night/PublishForm";

export default function PublishSheet({
  venue,
  nightDate,
  open,
  onOpenChange,
}: {
  venue: Venue;
  nightDate: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  // Held up while the OS file dialog is open — see PublishForm.
  const [picking, setPicking] = useState(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        onInteractOutside={(e) => picking && e.preventDefault()}
        className="bg-card border-border">
        <DrawerTitle className="sr-only">Post about {venue.title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Add an optional note and choose who can see it.
        </DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <PublishForm
              onPickingChange={setPicking}
            venue={venue}
            nightDate={nightDate}
            onDone={() => onOpenChange(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
