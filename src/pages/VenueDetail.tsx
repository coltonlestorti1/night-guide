import { useNavigate, useParams } from "react-router-dom";
import { useVenue } from "@/hooks/useVenue";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useSavedStore } from "@/store/saved";
import { ArrowLeft, Bookmark, Navigation as NavIcon, Flame, Star, MapPin, Music2, Ticket, DollarSign, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Venue } from "@/data/types";

/**
 * Stat tiles render only for data the venue actually has — no permanent
 * "—" placeholders. Buzz/Cover slots resurface automatically once real
 * check-in data starts populating those fields.
 */
const statTiles = (v: Venue) => {
  const tiles: { label: string; icon: React.ReactNode; value: string; accent?: boolean }[] = [];
  if (v.buzz_score != null) tiles.push({ label: "Buzz", icon: <Zap className="h-3 w-3" />, value: String(v.buzz_score), accent: true });
  if (v.music_type) tiles.push({ label: "Music", icon: <Music2 className="h-3 w-3" />, value: v.music_type });
  if (v.avg_price_level) tiles.push({ label: "Price", icon: <DollarSign className="h-3 w-3" />, value: "$".repeat(v.avg_price_level) });
  if (v.age_range_min && v.age_range_max) tiles.push({ label: "Ages", icon: <Users className="h-3 w-3" />, value: `${v.age_range_min}–${v.age_range_max}` });
  if (v.cover_charge) tiles.push({ label: "Cover", icon: <Ticket className="h-3 w-3" />, value: v.cover_charge });
  return tiles;
};

const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

const VenueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useVenue(id);
  const { ids, toggle } = useSavedStore();
  const saved = !!data && ids.includes(data.id);

  return (
    <section aria-labelledby="venue-heading" className="pb-28">
      {isLoading ? (
        <>
          <Skeleton className="h-72 w-full rounded-none" />
          <div className="container pt-4 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </>
      ) : data ? (
        <>
          {/* Hero */}
          <div className="relative h-72 w-full overflow-hidden bg-secondary">
            {data.image_url ? (
              <img
                src={data.image_url}
                alt={data.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = "none";
                  (t.parentElement as HTMLElement).style.background =
                    "linear-gradient(135deg, hsl(var(--primary)/0.4), hsl(var(--accent)/0.2))";
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <div className="absolute top-4 left-16 flex gap-1.5">
              {data.hot_tonight && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-rose-500 text-white">
                  <Flame className="h-3 w-3" /> Hot Tonight
                </span>
              )}
              {data.editors_pick && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-400 text-black">
                  <Star className="h-3 w-3" /> Editor's Pick
                </span>
              )}
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <h1 id="venue-heading" className="text-3xl font-bold leading-tight">{data.title}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-white",
                  data.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
                  : data.category === "club" ? "bg-[hsl(var(--venue-club))]"
                  : "bg-[hsl(var(--venue-lounge))]"
                )}>{data.category}</span>
                {data.neighborhood && (
                  <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {data.neighborhood}
                  </span>
                )}
                {data.open_now && (
                  <span className="text-xs text-emerald-400 font-medium">● Open now</span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="container pt-5 space-y-5 max-w-2xl">
            {statTiles(data).length > 0 && (
              <div className={cn("grid gap-2", GRID_COLS[Math.min(statTiles(data).length, 3)])}>
                {statTiles(data).map((t) => (
                  <div key={t.label} className="rounded-xl bg-secondary/60 p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                      {t.icon} {t.label}
                    </div>
                    <div className={cn("text-xs font-medium mt-0.5 truncate", t.accent && "text-base font-bold text-primary")}>
                      {t.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.description && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">About</h2>
                <p className="text-sm leading-relaxed text-foreground/90">{data.description}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="container pt-10">
          <div className="text-center bg-card border rounded-xl p-8">
            <p className="text-muted-foreground">Venue not found.</p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate("/")}>Back to map</Button>
          </div>
        </div>
      )}

      {/* Sticky bottom CTA */}
      {data && (
        <div className="fixed bottom-16 inset-x-0 z-30 px-4 pb-2">
          <div className="max-w-lg mx-auto grid grid-cols-2 gap-2 p-2 rounded-2xl glass shadow-2xl">
            <Button
              variant="secondary"
              className="h-11 rounded-xl"
              onClick={() => toggle(data.id)}
            >
              <Bookmark className={cn("h-4 w-4 mr-2", saved && "fill-primary text-primary")} />
              {saved ? "Saved" : "Save"}
            </Button>
            <Button
              className="h-11 rounded-xl"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`, "_blank")}
            >
              <NavIcon className="h-4 w-4 mr-2" /> Directions
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default VenueDetail;
