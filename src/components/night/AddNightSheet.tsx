/**
 * Add a night you didn't check into (Colton, 2026-08-07).
 *
 * The recap is built from check-ins, so anywhere you forgot to check in simply
 * never appears. This is the way back in: pick the night and the spot, then
 * write the post — all inside ONE drawer.
 *
 * The two steps live in a single Drawer on purpose. Handing off to a separate
 * PublishSheet meant two vaul drawers alive for one flow, and they interrupt
 * each other's transitions: the outgoing sheet stayed visible at
 * data-state="closed" while the incoming one mounted stuck at its start
 * transform, behind a stale `body { pointer-events: none }`. Sequencing and
 * conditional mounting both failed; one drawer makes it impossible.
 *
 * It creates a POST, never a check-in. A check-in is a live presence claim that
 * feeds venue activity and the heat model the map renders; backdating one would
 * inject people into rooms they are not in. "I went here" and "I am here now"
 * are different claims, and only one of them is being made here.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Venue } from "@/data/types";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVenues } from "@/hooks/useVenues";
import { lastCompletedNightDate, nightDateOf } from "@/lib/night/window";
import { normalize } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import PublishForm from "@/components/night/PublishForm";

/** Quick night choices, newest first. Value is a night-date. */
function nightChoices(now: Date = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];

  // "Tonight" only when a night is actually in progress — offering it at 11am
  // would invite logging a night that has not happened.
  const hour = now.getHours();
  if (hour >= 18 || hour < 6) out.push({ value: nightDateOf(now), label: "Tonight" });

  const last = lastCompletedNightDate(now);
  out.push({ value: last, label: "Last night" });

  const [y, m, d] = last.split("-").map(Number);
  for (let back = 1; back <= 3; back++) {
    const prev = new Date(y, m - 1, d - back);
    out.push({
      value: isoDate(prev),
      label: prev.toLocaleDateString(undefined, { weekday: "long" }),
    });
  }
  return out;
}

const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AddNightSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: venues } = useVenues({});
  const [q, setQ] = useState("");
  const [nightDate, setNightDate] = useState(() => lastCompletedNightDate());
  const [venue, setVenue] = useState<Venue | null>(null);
  const choices = useMemo(() => nightChoices(), []);
  const today = isoDate(new Date());

  const matches = useMemo(() => {
    const all = venues ?? [];
    if (!q.trim()) return all.slice(0, 8);
    const needle = normalize(q);
    return all.filter((v) => normalize(v.title).includes(needle)).slice(0, 8);
  }, [venues, q]);

  // Held up while the OS file dialog is open — see PublishForm.
  const [picking, setPicking] = useState(false);

  const close = () => {
    onOpenChange(false);
    // Reset after the exit animation so the sheet does not visibly rewind.
    window.setTimeout(() => {
      setVenue(null);
      setQ("");
    }, 260);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DrawerContent
        onInteractOutside={(e) => picking && e.preventDefault()}
        className="bg-card border-border sheet-h-88">
        <DrawerTitle className="sr-only">Add a night</DrawerTitle>
        <DrawerDescription className="sr-only">
          Pick a night and a spot, then write your post.
        </DrawerDescription>

        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full overflow-y-auto overflow-x-hidden">
          {venue ? (
            <PublishForm
              onPickingChange={setPicking}
              venue={venue}
              nightDate={nightDate}
              onDone={close}
              onBack={() => setVenue(null)}
            />
          ) : (
            <>
              <h2 className="text-lg font-display font-bold">Add a night</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Somewhere you went but didn&apos;t check into.
              </p>

              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Which night?
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {choices.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNightDate(c.value)}
                    aria-pressed={nightDate === c.value}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                      nightDate === c.value
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-secondary border-border hover:bg-secondary/70",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Any earlier night, for anything older than the quick chips.
                  max=today because you cannot have been out tomorrow. */}
              <Input
                type="date"
                // iOS renders this as a NATIVE control with an intrinsic
                // minimum width that Chrome does not reproduce. Without
                // min-w-0 it can push the sheet wider than the screen.
                style={{ minWidth: 0, maxWidth: "100%" }}
                value={nightDate}
                max={today}
                onChange={(e) => e.target.value && setNightDate(e.target.value)}
                className="mb-5"
                aria-label="Or pick a date"
              />

              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Where?</p>
              <div className="relative mb-3">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search spots"
                  className="pl-9"
                  aria-label="Search spots"
                />
              </div>

              <ul className="space-y-1">
                {matches.map((v) => (
                  <li key={v.id}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-11 rounded-xl px-3"
                      onClick={() => setVenue(v)}
                    >
                      <span className="truncate">{v.title}</span>
                      {v.neighborhood && (
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          {v.neighborhood}
                        </span>
                      )}
                    </Button>
                  </li>
                ))}
                {matches.length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">
                    No spots match that. ENDZ only covers the East Village so far.
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
