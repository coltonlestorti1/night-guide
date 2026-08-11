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
          // Padding is vertical only, and that asymmetry is deliberate. Side
          // padding was tried and rejected: on a phone the photo is
          // width-constrained, so every pixel of side strip comes straight out
          // of how big the picture is, and the picture matters more. The
          // photo keeps the full width it has always had; the bands above and
          // below are where you tap to dismiss. `py-20` guarantees one even
          // for a tall photo. Keep it in step with the `10rem` the image caps
          // itself against.
          className="fixed inset-0 z-50 flex items-center justify-center px-0 py-20 duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onClick={onClose}
        >
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {url && (
            // This wrapper exists to give the close button something to anchor
            // to. It shrink-wraps the photo, so `absolute` inside it means the
            // photo's corner rather than the screen's — which is why the caps
            // below are viewport-relative rather than `max-h-full`: a
            // percentage would resolve against this wrapper's own auto height
            // and collapse to no limit at all. `10rem` is the content's `py-20`
            // top and bottom.
            //
            // Stopping the click here covers the photo and its button in one
            // place. The button still closes: Radix's own handler runs on the
            // button itself, before this ever sees the event.
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <img
                src={url}
                alt={alt}
                // No `w-full`: letting the image size itself under both caps
                // keeps its box the same shape as the picture, so there is no
                // transparent margin inside it swallowing taps meant for the
                // backdrop.
                className="block max-h-[calc(100dvh-10rem)] max-w-[100vw] rounded-2xl object-contain"
                // If the full-size image fails, close rather than leaving a broken
                // image inside a modal the user then has to dismiss.
                onError={onClose}
              />
              <DialogPrimitive.Close
                // Sits on the photo's top-right corner. It needs the solid
                // fill and the ring to stay findable against whatever happens
                // to be in that corner of the picture.
                //
                // `focus-visible`, not `focus`: Radix autofocuses this on open,
                // so a plain `focus:ring` painted a bright ring around the X
                // every time a photo was opened by touch.
                className="absolute right-2 top-2 rounded-full bg-black/60 p-2.5 text-white ring-1 ring-white/20 transition-colors hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  </div>
);

export default PhotoLightbox;
