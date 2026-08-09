/**
 * Full-size photo overlay. One implementation for night-post photos and venue
 * photos — this pattern was inline in PostCard first, and copying it a second
 * and third time is how the canvas re-encoder ended up duplicated twice before
 * it was pulled into src/lib/imageEncode.ts.
 *
 * Built on the app's Dialog rather than a hand-rolled overlay: focus trapping,
 * scroll locking and Escape-to-close are the parts people get wrong, and Radix
 * already has them right.
 */
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  /** The image to show. `null` means closed. */
  url: string | null;
  onClose: () => void;
  alt?: string;
};

const PhotoLightbox = ({ url, onClose, alt = "" }: Props) => (
  <Dialog open={!!url} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
      <DialogTitle className="sr-only">Photo</DialogTitle>
      {url && (
        <img
          src={url}
          alt={alt}
          className="max-h-[85vh] w-full rounded-2xl object-contain"
          // If the full-size image fails, close rather than leaving a broken
          // image inside a modal the user then has to dismiss.
          onError={onClose}
        />
      )}
    </DialogContent>
  </Dialog>
);

export default PhotoLightbox;
