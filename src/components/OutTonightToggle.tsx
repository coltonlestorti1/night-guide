/**
 * "I'm out tonight" control for the Map screen. First enable shows a mandatory
 * opt-in disclosure (venue logging + never-shown-to-friends). The choice to
 * accept is remembered on-device so we only disclose once.
 */
import { useState } from "react";
import { Ghost, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useOutTonightStore } from "@/store/outTonight";
import { cn } from "@/lib/utils";

const DISCLOSED_KEY = "endz:out-tonight-disclosed";

export default function OutTonightToggle() {
  const active = useOutTonightStore((s) => s.active);
  const setActive = useOutTonightStore((s) => s.setActive);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const handleClick = () => {
    if (active) {
      setActive(false);
      return;
    }
    if (localStorage.getItem(DISCLOSED_KEY) === "yes") {
      setActive(true);
      return;
    }
    setShowDisclosure(true);
  };

  const accept = () => {
    localStorage.setItem(DISCLOSED_KEY, "yes");
    setShowDisclosure(false);
    setActive(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant={active ? "default" : "secondary"}
        className={cn("rounded-full gap-2", active && "shadow-glow")}
        aria-pressed={active}
      >
        {active ? <Radio className="h-4 w-4" /> : <Ghost className="h-4 w-4" />}
        {active ? "Out tonight — on" : "I'm out tonight"}
      </Button>

      <Dialog open={showDisclosure} onOpenChange={setShowDisclosure}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Out tonight</DialogTitle>
            <DialogDescription>
              Out tonight lets ENDZ see which venues you visit tonight to
              understand where people go — never shown to your friends. Turn it
              off anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDisclosure(false)}>
              Not now
            </Button>
            <Button onClick={accept}>Turn on</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
