/**
 * "Find the move" — three quick taps, top-3 picks from real data.
 * Free concierge v1: scoring lives in src/lib/vibeScore.ts (no LLM, no cost);
 * a Claude-backed scorer can replace it later without touching this UI.
 */
import { useMemo, useState } from "react";
import { Venue } from "@/data/types";
import { scoreVenues, VibePrefs } from "@/lib/vibeScore";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocationStore } from "@/store/location";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";
import { Sofa, TrendingUp, Flame, Beer, Martini, Shuffle, Zap, Moon, Sparkles, MapPin, Globe, Wine } from "lucide-react";

type Activity = Record<string, { count: number; vibe?: string }> | undefined;

const VIBES = [
  { value: "chill", label: "Chill", Icon: Sofa },
  { value: "lively", label: "Lively", Icon: TrendingUp },
  { value: "packed", label: "Packed", Icon: Flame },
] as const;
const DRINKS = [
  { value: "beer", label: "Cheap beers", Icon: Beer },
  { value: "cocktails", label: "Cocktails", Icon: Martini },
  { value: undefined, label: "Whatever", Icon: Shuffle },
] as const;
const WHENS = [
  { value: "now", label: "Right now", Icon: Zap },
  { value: "later", label: "Later tonight", Icon: Moon },
] as const;
const DISTANCES = [
  { value: true, label: "Around me", Icon: MapPin },
  { value: false, label: "Doesn't matter", Icon: Globe },
] as const;
const HAPPY_HOURS = [
  { value: true, label: "Happy hour", Icon: Wine },
  { value: false, label: "Doesn't matter", Icon: Shuffle },
] as const;
const AGES = ["21-25", "25-30", "30+"] as const;

const Chip = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
      active ? "bg-primary text-primary-foreground border-transparent shadow-glow" : "bg-secondary border-border hover:bg-secondary/70",
    )}
  >
    {children}
  </button>
);

export default function VibeFinder({
  open,
  onOpenChange,
  venues,
  activity,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  venues: Venue[];
  activity: Activity;
  onPick: (v: Venue) => void;
}) {
  const [vibe, setVibe] = useState<VibePrefs["vibe"]>(undefined);
  const [drinks, setDrinks] = useState<VibePrefs["drinks"]>(undefined);
  const [when, setWhen] = useState<VibePrefs["when"]>("now");
  const [near, setNear] = useState(false);
  const [happyHour, setHappyHour] = useState(false);
  const [age, setAge] = useState<VibePrefs["age"]>(undefined);
  const [page, setPage] = useState<number | null>(null); // null = answers screen

  const requestLocation = useLocationStore((s) => s.request);
  const coords = useLocationStore((s) => s.coords);

  // "Around me" needs location; if the user declines, fall back to no preference.
  const chooseNear = async (want: boolean) => {
    if (want && !(await requestLocation())) {
      toast.info("Turn on location to sort by what's around you");
      setNear(false);
      return;
    }
    setNear(want);
  };

  const ranked = useMemo(
    () => (page === null ? [] : scoreVenues(venues, { vibe, drinks, when, near, happyHour, age }, activity, undefined, coords)),
    [page, venues, vibe, drinks, when, near, happyHour, age, activity, coords],
  );
  const results = page === null ? [] : ranked.slice(page * 3, page * 3 + 3);

  const reset = () => setPage(null);

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">Find the move</DrawerTitle>
        <DrawerDescription className="sr-only">Answer a few quick questions to get venue picks that fit.</DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <h2 className="text-lg font-display font-bold mb-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Find the move
          </h2>

          {page === null ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">A few taps. We'll pull the spots that actually fit.</p>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">What's the vibe?</p>
                  <div className="flex gap-2 flex-wrap">
                    {VIBES.map((o) => (
                      <Chip key={o.value} active={vibe === o.value} onClick={() => setVibe(vibe === o.value ? undefined : o.value)}>
                        <o.Icon className="h-4 w-4" /> {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Drinks?</p>
                  <div className="flex gap-2 flex-wrap">
                    {DRINKS.map((o) => (
                      <Chip key={o.label} active={drinks === o.value} onClick={() => setDrinks(o.value)}>
                        <o.Icon className="h-4 w-4" /> {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">When?</p>
                  <div className="flex gap-2 flex-wrap">
                    {WHENS.map((o) => (
                      <Chip key={o.value} active={when === o.value} onClick={() => setWhen(o.value)}>
                        <o.Icon className="h-4 w-4" /> {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">How far?</p>
                  <div className="flex gap-2 flex-wrap">
                    {DISTANCES.map((o) => (
                      <Chip key={o.label} active={near === o.value} onClick={() => chooseNear(o.value)}>
                        <o.Icon className="h-4 w-4" /> {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Happy hour?</p>
                  <div className="flex gap-2 flex-wrap">
                    {HAPPY_HOURS.map((o) => (
                      <Chip key={o.label} active={happyHour === o.value} onClick={() => setHappyHour(o.value)}>
                        <o.Icon className="h-4 w-4" /> {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Your age?</p>
                  <div className="flex gap-2 flex-wrap">
                    {AGES.map((a) => (
                      <Chip key={a} active={age === a} onClick={() => setAge(age === a ? undefined : a)}>
                        {a}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                className="w-full h-11 rounded-xl mt-5"
                onClick={() => {
                  logEvent("find_the_move", { vibe, drinks, when, near, happy_hour: happyHour, age });
                  setPage(0);
                }}
              >
                Show me the move
              </Button>
            </>
          ) : results.length > 0 ? (
            <>
              <div className="space-y-2.5 mt-2">
                {results.map(({ venue, reasons }) => (
                  <div key={venue.id}>
                    <BarCard venue={venue} onClick={() => { onPick(venue); onOpenChange(false); reset(); }} />
                    {reasons.length > 0 && (
                      <p className="text-[11px] text-primary/90 mt-1 px-1">{reasons.join(" · ")}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="secondary" className="h-11 rounded-xl" onClick={reset}>
                  Change answers
                </Button>
                <Button
                  variant="secondary"
                  className="h-11 rounded-xl"
                  onClick={() => setPage(((page + 1) * 3 >= ranked.length ? 0 : page + 1))}
                >
                  Not these — 3 more
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="font-medium">Nothing open matches right now.</p>
              <p className="text-sm text-muted-foreground mt-1">Try "Later tonight" or loosen a pick.</p>
              <Button variant="secondary" className="mt-4 rounded-xl" onClick={reset}>
                Change answers
              </Button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
