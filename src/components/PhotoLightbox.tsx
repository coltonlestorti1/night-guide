/**
 * Full-size photo overlay. One implementation for night-post photos and venue
 * photos — this pattern was inline in PostCard first, and copying it a second
 * and third time is how the canvas re-encoder ended up duplicated twice before
 * it was pulled into src/lib/imageEncode.ts.
 *
 * Built on Radix's Dialog rather than a hand-rolled overlay: focus trapping,
 * scroll locking and Escape-to-close are the parts people get wrong, and Radix
 * already has them right.
 *
 * It composes the Radix primitives directly instead of the app's DialogContent
 * wrapper. The wrapper centers a fixed-width card with `translate(-50%, -50%)`,
 * and both halves of that fight this screen. The width meant the image was laid
 * out `w-full` and letterboxed by `object-contain`, so the dead space beside a
 * portrait photo still belonged to the image element — on a phone that is most
 * of the screen, and tapping it did nothing, leaving the small X as the only
 * way out. The transform is worse than it looks: it makes the content a
 * containing block, so a `fixed inset-0` tap target nested inside it would
 * cover only the card, not the viewport. Here the content IS the viewport.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Dialog, DialogTitle } from "@/components/ui/dialog";

type Props = {
  /** The image to show. `null` means closed. */
  url: string | null;
  onClose: () => void;
  alt?: string;
};

const PhotoLightbox = ({ url, onClose, alt = "" }: Props) => (
  // React bubbles portal content along the React tree, not the DOM tree, so a
  // click on the (portalled) overlay or content still reaches whatever
  // clickable ancestor rendered this component — e.g. a BarCard row. Radix's
  // own outside-click dismissal is a separate native listener and still
  // fires; this only stops the click's own onward journey once it gets here.
  // Keydown needs the same treatment: Radix autofocuses the close button on
  // open, and Enter/Space there both closes the photo and (absent this stop)
  // bubbles to reach the ancestor's onKeyDown too.
  // `contents` keeps this div out of the caller's layout — it exists only as
  // a React event boundary, not a box any caller's flow should see.
  <div className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
    <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          // Full-bleed, so every dark pixel around the photo is a close
          // target whatever shape the photo is. No slide-in here: those
          // animations translate by half the element's width, which is half
          // the screen once the element is the screen.
          //
          // The padding is the point, not decoration: a portrait photo on a
          // portrait phone is width-constrained, so without it the only
          // backdrop beside the photo is a couple of pixels. `px-10` buys a
          // 40px strip down each side — a real thumb target — for about a
          // tenth of the photo's width.
          className="fixed inset-0 z-50 flex items-center justify-center px-10 py-12 duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onClick={onClose}
        >
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {url && (
            <img
              src={url}
              alt={alt}
              // No `w-full`: letting the image size itself under both caps
              // keeps its box the same shape as the picture, so there is no
              // transparent margin inside it swallowing taps meant for the
              // backdrop.
              className="max-h-full max-w-full rounded-2xl object-contain"
              // The photo itself is the one thing that does not close: a tap
              // that lands on it is someone looking, and a long press there
              // is iOS's save-image menu.
              onClick={(e) => e.stopPropagation()}
              // If the full-size image fails, close rather than leaving a broken
              // image inside a modal the user then has to dismiss.
              onError={onClose}
            />
          )}
          <DialogPrimitive.Close
            // Kept for desktop, where there is no tap-anywhere instinct, and
            // as the focusable control Radix lands on. Clear of the status
            // bar when the PWA runs standalone.
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] rounded-full bg-black/50 p-2 text-white/90 ring-offset-black transition-opacity hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  </div>
);

export default PhotoLightbox;
