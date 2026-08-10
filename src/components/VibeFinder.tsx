/**
 * "Find the move" — three quick taps, top-3 picks from real data.
 * Free concierge v1: scoring lives in src/lib/vibeScore.ts (no LLM, no cost);
 * a Claude-backed scorer can replace it later without touching this UI.
 */
import { useEffect, useMemo, useState } from "react";
import { Venue } from "@/data/types";
import { scoreVenues, VibePrefs } from "@/lib/vibeScore";
import { useMyRatings } from "@/hooks/useMyRatings";
import { useFriendsOutTonight } from "@/hooks/useFriends";
import { useFriendSaves } from "@/hooks/useSaves";
import { selectPicks, type MovePick } from "@/lib/move/select";
import type { ActivityMap } from "@/lib/move/activity";
import { readImpressions, recordImpressions } from "@/lib/move/cooldown";
import { inferTaste } from "@/lib/taste";
import { hasOutdoorSeating, hasRooftop } from "@/lib/venueTraits";
import BarCard from "@/components/BarCard";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocationStore, geolocationPermission, hasPermissionsApi } from "@/store/location";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";
import LocationDeniedDialog from "@/components/LocationDeniedDialog";
import { Sofa, TrendingUp, Flame, Beer, Martini, Shuffle, Zap, Moon, Sparkles, MapPin, Globe, Wine, Building2, Trees, User, Users, UsersRound } from "lucide-react";

type Activity = ActivityMap;

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
const OUTSIDES = [
  { value: "rooftop", label: "Rooftop", Icon: Building2 },
  { value: "outdoor", label: "Outdoor", Icon: Trees },
  { value: undefined, label: "Doesn't matter", Icon: Shuffle },
] as const;
const AGES = ["21-25", "25-30", "30+"] as const;
const GROUPS = [
  { value: "solo", label: "Just me", Icon: User },
  { value: "two", label: "Two of us", Icon: Users },
  { value: "small", label: "3–5", Icon: Users },
  { value: "big", label: "6+", Icon: UsersRound },
] as const;

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
  const [outside, setOutside] = useState<VibePrefs["outside"]>(undefined);
  const [age, setAge] = useState<VibePrefs["age"]>(undefined);
  const [groupSize, setGroupSize] = useState<VibePrefs["groupSize"]>(undefined);
  const [page, setPage] = useState<number | null>(null); // null = answers screen
  const [showDeniedDialog, setShowDeniedDialog] = useState(false);

  const requestLocation = useLocationStore((s) => s.request);
  const coords = useLocationStore((s) => s.coords);

  // "Around me" needs location; denied gets the how-to dialog, anything else
  // falls back to no preference with the existing nudge.
  const chooseNear = async (want: boolean) => {
    if (want) {
      if ((await geolocationPermission()) === "denied") {
        setShowDeniedDialog(true);
        setNear(false);
        return;
      }
      if (!(await requestLocation())) {
        if (
          useLocationStore.getState().failure === "denied" &&
          (!hasPermissionsApi() || (await geolocationPermission()) === "denied")
        ) {
          setShowDeniedDialog(true);
        } else {
          toast.info("Turn on location to sort by what's around you");
        }
        setNear(false);
        return;
      }
    }
    setNear(want);
  };

  // Personal signals. Signed-out or unrated users get `[]`, and scoreVenues is
  // then byte-identical to its pre-personalization behaviour (pinned by a test).
  const { data: myRatings } = useMyRatings();
  const taste = useMemo(() => inferTaste(myRatings, venues), [myRatings, venues]);

  // Friend signals. Both hooks are already restricted to accepted friends and
  // already pass through RLS (ghost mode, 'nobody' and non-friend rows never
  // arrive), so naming anyone they return is naming someone this user can
  // already see. Signed-out gets undefined from both and no friend reasons.
  const { data: friendsOut } = useFriendsOutTonight();
  const { data: friendSaves } = useFriendSaves();
  const friends = useMemo(
    () => ({ out: friendsOut, saves: friendSaves }),
    [friendsOut, friendSaves],
  );

  // Stamped once when the user asks for results, so happy-hour windows and
  // cooldown decay cannot shift under them while they read the screen. Also
  // the snapshot the impression log is read against — reading it fresh on
  // every render would let this run's own writes penalise this run.
  const [runAt, setRunAt] = useState<Date | null>(null);
  const impressions = useMemo(() => (runAt ? readImpressions(runAt) : {}), [runAt]);

  const ranked = useMemo(
    () =>
      page === null || !runAt
        ? []
        : scoreVenues(venues, { vibe, drinks, when, near, happyHour, outside, age, groupSize }, activity, runAt, coords, {
            ratings: myRatings,
            taste,
            friends,
            impressions,
          }),
    [page, runAt, venues, vibe, drinks, when, near, happyHour, outside, age, groupSize, activity, coords, myRatings, taste, friends, impressions],
  );

  // Don't offer an option that can't match anything (same rule as the map chips).
  const outsideOptions = useMemo(() => {
    const anyRooftop = venues.some((v) => hasRooftop(v));
    const anyOutdoor = venues.some((v) => hasOutdoorSeating(v));
    if (!anyRooftop && !anyOutdoor) return [];
    return OUTSIDES.filter(
      (o) => (o.value !== "rooftop" || anyRooftop) && (o.value !== "outdoor" || anyOutdoor),
    );
  }, [venues]);
  /**
   * Each "3 more" page re-runs the selector over what is LEFT, rather than
   * slicing ranks 4-6 off the list. Slicing would hand back three venues that
   * were passed over precisely because they were the same kind of night as
   * page one — the diversity rules have to apply to every page or they only
   * work once.
   */
  const results = useMemo<MovePick[]>(() => {
    if (page === null || !runAt) return [];
    const ctx = { activity, coords, friends, impressions, now: runAt };
    const seen = new Set<string>();
    let picks: MovePick[] = [];
    for (let p = 0; p <= page; p++) {
      picks = selectPicks(
        ranked.filter((r) => !seen.has(r.venue.id)),
        ctx,
      );
      for (const pick of picks) seen.add(pick.venue.id);
    }
    return picks;
  }, [page, runAt, ranked, activity, coords, friends, impressions]);

  /** Wrap back to the first page once the pool cannot fill another one. */
  const shownCount = (page ?? 0) * 3 + results.length;
  const hasMore = shownCount < ranked.length;

  // Record what was actually shown, so tomorrow's run can decay it (§3).
  const shownIds = results.map((r) => r.venue.id).join(",");
  useEffect(() => {
    if (!shownIds) return;
    recordImpressions(shownIds.split(","));
  }, [shownIds]);

  const reset = () => {
    setPage(null);
    setRunAt(null);
  };

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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Who's coming?</p>
                  <div className="flex gap-2 flex-wrap">
                    {GROUPS.map((o) => (
                      <Chip key={o.value} active={groupSize === o.value} onClick={() => setGroupSize(groupSize === o.value ? undefined : o.value)}>
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
                {outsideOptions.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Outside?</p>
                    <div className="flex gap-2 flex-wrap">
                      {outsideOptions.map((o) => (
                        <Chip key={o.label} active={outside === o.value} onClick={() => setOutside(o.value)}>
                          <o.Icon className="h-4 w-4" /> {o.label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
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
                  logEvent("find_the_move", { vibe, drinks, when, near, happy_hour: happyHour, outside, age, group_size: groupSize });
                  setRunAt(new Date());
                  setPage(0);
                }}
              >
                Show me the move
              </Button>
            </>
          ) : results.length > 0 ? (
            <>
              <div className="space-y-3.5 mt-2">
                {results.map(({ venue, reasons, headline, note }) => (
                  <div key={venue.id}>
                    {headline && (
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                          {headline}
                        </span>
                        {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
                      </div>
                    )}
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
                  onClick={() => setPage(hasMore ? page + 1 : 0)}
                >
                  {hasMore ? "Not these — 3 more" : "Start over"}
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

      <LocationDeniedDialog open={showDeniedDialog} onOpenChange={setShowDeniedDialog} />
    </Drawer>
  );
}
