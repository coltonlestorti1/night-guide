import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
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
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
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
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
