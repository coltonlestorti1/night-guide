/**
 * The everything-else filter surface (§27). The chip row keeps only the four
 * decisions you'd make standing on a corner; category, amenities, music and
 * price live here so the row stops outgrowing the screen as attributes grow.
 *
 * Options that can't match anything are not rendered — same dead-end rule the
 * chip row uses. An empty section is better than a filter that blanks the map.
 */
import { Venue, VenueCategory } from "@/data/types";
import { useFilterStore } from "@/store/filters";
import { hasOutdoorSeating, hasRooftop } from "@/lib/venueTraits";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Building2, Trees, DollarSign } from "lucide-react";

const CATEGORIES: { value: VenueCategory; label: string }[] = [
  { value: "bar", label: "Bars" },
  { value: "club", label: "Clubs" },
  { value: "lounge", label: "Lounges" },
];

const PRICES = [
  { value: 1, label: "$" },
  { value: 2, label: "$$" },
  { value: 3, label: "$$$" },
];

const Chip = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
      active
        ? "bg-primary text-primary-foreground border-transparent shadow-glow"
        : "bg-secondary border-border hover:bg-secondary/70",
    )}
  >
    {children}
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
    <div className="flex gap-2 flex-wrap">{children}</div>
  </div>
);

export default function FiltersSheet({
  open,
  onOpenChange,
  venues,
  resultCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** The full venue set, so options are offered only when they can match. */
  venues: Venue[];
  resultCount: number;
}) {
  const f = useFilterStore();
  const { set, reset } = f;

  const anyRooftop = venues.some(hasRooftop);
  const anyOutdoor = venues.some(hasOutdoorSeating);

  // Genres come from the venues actually loaded — a hardcoded list had "Latin"
  // in it, which matched nothing.
  const genres = [
    ...new Set(
      venues
        .map((v) => v.music_type)
        .filter((m): m is string => !!m)
        .flatMap((m) => m.split("/").map((p) => p.trim()))
        .filter(Boolean),
    ),
  ].sort();

  const categoriesWith = CATEGORIES.filter((c) => venues.some((v) => v.category === c.value));
  const pricesWith = PRICES.filter((p) => venues.some((v) => v.avg_price_level === p.value));

  const toggleCategory = (c: VenueCategory) =>
    set({
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <DrawerTitle className="sr-only">Filters</DrawerTitle>
        <DrawerDescription className="sr-only">
          Narrow the map by type, amenities, music, and price.
        </DrawerDescription>
        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full">
          <h2 className="text-lg font-display font-bold mb-4">Filters</h2>

          <div className="space-y-4">
            {categoriesWith.length > 1 && (
              <Section title="Type">
                {categoriesWith.map((c) => (
                  <Chip
                    key={c.value}
                    active={f.categories.includes(c.value)}
                    onClick={() => toggleCategory(c.value)}
                  >
                    {c.label}
                  </Chip>
                ))}
              </Section>
            )}

            {(anyRooftop || anyOutdoor) && (
              <Section title="Outside">
                {anyOutdoor && (
                  <Chip active={f.outdoor} onClick={() => set({ outdoor: !f.outdoor })}>
                    <Trees className="h-4 w-4" /> Outdoor
                  </Chip>
                )}
                {anyRooftop && (
                  <Chip active={f.rooftop} onClick={() => set({ rooftop: !f.rooftop })}>
                    <Building2 className="h-4 w-4" /> Rooftop
                  </Chip>
                )}
              </Section>
            )}

            {genres.length > 0 && (
              <Section title="Music">
                {genres.map((g) => (
                  <Chip
                    key={g}
                    active={f.musicVibe === g}
                    onClick={() => set({ musicVibe: f.musicVibe === g ? undefined : g })}
                  >
                    {g}
                  </Chip>
                ))}
              </Section>
            )}

            {pricesWith.length > 1 && (
              <Section title="Price">
                {pricesWith.map((p) => (
                  <Chip
                    key={p.value}
                    active={f.priceMax === p.value}
                    onClick={() => set({ priceMax: f.priceMax === p.value ? undefined : p.value })}
                  >
                    <DollarSign className="h-4 w-4" /> {p.label} or less
                  </Chip>
                ))}
              </Section>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6">
            <Button variant="secondary" className="h-11 rounded-xl" onClick={reset}>
              Clear all
            </Button>
            <Button className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
              Show {resultCount} {resultCount === 1 ? "spot" : "spots"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
