/**
 * Tonight's plans, moved off the Social page behind a header icon
 * (Colton, 2026-08-07) — same treatment as friend management.
 *
 * "Make a plan" does NOT open a second drawer on top of this one. It closes
 * this sheet and asks the page to open CreatePlanSheet, because stacked drawers
 * trap focus and leave the user two dismissals deep with no obvious way back.
 */
import { CalendarClock } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { usePlanFeed } from "@/hooks/usePlans";
import PlanCard from "@/components/social/PlanCard";

export default function PlansSheet({
  open,
  onOpenChange,
  onMakePlan,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMakePlan: () => void;
}) {
  const { data: planItems } = usePlanFeed();
  const items = planItems ?? [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border max-h-[88vh]">
        <DrawerTitle className="sr-only">Plans</DrawerTitle>
        <DrawerDescription className="sr-only">
          Tonight&apos;s plans, and invites waiting on you.
        </DrawerDescription>

        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full overflow-y-auto">
          <h2 className="text-lg font-display font-bold mb-3">Plans</h2>

          {items.map((item) => (
            <PlanCard key={item.plan.id} item={item} />
          ))}

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Nothing on the books tonight.</p>
          )}

          <Button
            variant="secondary"
            className="w-full h-11 rounded-xl mt-3"
            onClick={() => {
              onOpenChange(false);
              onMakePlan();
            }}
          >
            <CalendarClock className="h-4 w-4 mr-2" /> Make a plan
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
