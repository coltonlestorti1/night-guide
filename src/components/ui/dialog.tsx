import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      // Capped and scrollable. Without this a dialog taller than the viewport
      // is unreachable at BOTH ends: the content is fixed at top-50% and pulled
      // back by translate-y-[-50%], so overflow spills equally off the top and
      // the bottom with nothing to scroll. Edit Profile hit this the moment it
      // grew an age field, and the iOS keyboard — which shrinks the visual
      // viewport, not the layout viewport — put the name and username fields
      // behind the top edge with no way back to them.
      //
      // dvh, never vh: on iOS vh is the TALLEST possible viewport and ignores
      // the keyboard entirely, so a vh cap would not have fixed it.
      //
      // WIDTH: `w-[calc(100%-2rem)]`, not `w-full`. w-full made the card
      // exactly viewport-wide on a phone — no gutter, edge to edge, and the
      // "Plan made" share step visibly ran off the right edge. It is a WIDTH
      // rather than a max-width on purpose: callers pass their own max-w
      // (max-w-md on the plan sheet), and tailwind-merge would drop a base
      // max-w as a conflict, taking the gutter with it exactly where it is
      // needed most.
      //
      // grid-cols-[minmax(0,1fr)]: this container is `grid`, and a grid item
      // defaults to `min-width: auto` — it refuses to shrink below its
      // max-content width. One long unbreakable string (a plan's share URL)
      // therefore blew the column out past the card: measured at a 390px
      // viewport, the content ran 216px beyond the dialog's right edge and the
      // "Copy" label sat off-screen. `truncate` on the URL never got a chance,
      // because its ANCESTOR was the thing that would not shrink. And
      // overflow-y-auto governs only the y axis, so the spill was visible
      // rather than clipped.
      //
      // minmax(0,1fr) caps the track at the container width, which is the
      // canonical fix. Preferred over min-w-0 on each child because it holds
      // for every dialog without each one having to remember.
      //
      // A dialog that wants to manage its own height passes its own max-h or
      // overflow — tailwind-merge lets the caller win. PhotoLightbox does not
      // come through here at all; it composes the Radix primitives directly.
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid grid-cols-[minmax(0,1fr)] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] max-h-[calc(100dvh-2rem)] overflow-y-auto gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
