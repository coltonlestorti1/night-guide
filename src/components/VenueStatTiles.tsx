/**
 * Stat tiles render only for data the venue actually has — no permanent
 * "—" placeholders. Buzz/Cover slots resurface automatically once real
 * check-in data starts populating those fields.
 */
import { Venue } from "@/data/types";
import { Music2, Ticket, DollarSign, Users, Zap, Building2, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAgeDisplay } from "@/lib/format";
import { hasOutdoorSeating, hasRooftop } from "@/lib/venueTraits";

const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

const tilesFor = (v: Venue) => {
  const tiles: { label: string; icon: React.ReactNode; value: string; accent?: boolean }[] = [];
  if (v.buzz_score != null) tiles.push({ label: "Buzz", icon: <Zap className="h-3 w-3" />, value: String(v.buzz_score), accent: true });
  if (v.music_type) tiles.push({ label: "Music", icon: <Music2 className="h-3 w-3" />, value: v.music_type });
  if (v.avg_price_level) tiles.push({ label: "Price", icon: <DollarSign className="h-3 w-3" />, value: "$".repeat(v.avg_price_level) });
  const ages = formatAgeDisplay(v);
  if (ages) tiles.push({ label: "Ages", icon: <Users className="h-3 w-3" />, value: ages });
  if (v.cover_charge) tiles.push({ label: "Cover", icon: <Ticket className="h-3 w-3" />, value: v.cover_charge });
  // Rooftop and outdoor stay separate tiles with separate icons — a rooftop is
  // never presented as generic outdoor seating, or vice versa.
  if (hasRooftop(v)) tiles.push({ label: "Rooftop", icon: <Building2 className="h-3 w-3" />, value: "Yes" });
  if (hasOutdoorSeating(v)) tiles.push({ label: "Outdoor", icon: <Trees className="h-3 w-3" />, value: "Yes" });
  return tiles;
};

export default function VenueStatTiles({ venue, compact }: { venue: Venue; compact?: boolean }) {
  const tiles = tilesFor(venue);
  if (tiles.length === 0) return null;
  return (
    <div className={cn("grid gap-2", GRID_COLS[Math.min(tiles.length, 3)])}>
      {tiles.map((t) => (
        <div key={t.label} className={cn("rounded-xl bg-secondary/60 text-center", compact ? "p-2.5" : "p-3")}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
            {t.icon} {t.label}
          </div>
          <div className={cn("text-xs font-medium mt-0.5 truncate", t.accent && "text-base font-bold text-primary")}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  );
}
