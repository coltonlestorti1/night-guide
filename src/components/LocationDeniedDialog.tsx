/**
 * Shown when the user explicitly asks for location but permission is denied
 * at the browser/OS level. Web pages can't open system settings or re-trigger
 * a denied prompt — clear steps are the ceiling until the Capacitor wrap
 * (native can deep-link straight to the app's Settings pane; when that lands,
 * swap the steps for an "Open Settings" button here).
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const platformSteps = (): string[] => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return [
      'Open Settings → Privacy & Security → Location Services, and set Safari Websites to "Ask Next Time Or When I Share".',
      "Still blocked? In Safari, tap aA in the address bar → Website Settings → Location → Ask.",
    ];
  }
  if (/Android/.test(ua)) {
    return [
      "Tap the lock icon next to the address bar → Permissions → Location → Allow.",
      "No Location entry? Open your browser's Settings → Site settings → Location.",
    ];
  }
  return ["Turn location back on for your browser in your device settings, then try again."];
};

const LocationDeniedDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Location is off for ENDZ</DialogTitle>
        <DialogDescription>
          Your phone is blocking location for this site, so the map can't find
          you. Here's the fix:
        </DialogDescription>
      </DialogHeader>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
        {platformSteps().map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} className="w-full">
          Got it
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default LocationDeniedDialog;
