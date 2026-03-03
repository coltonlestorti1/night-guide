import { ChevronRight } from "lucide-react";
import { Venue } from "@/data/types";

const crowdLabel: Record<string, string> = { low: "Chill", medium: "Lively", high: "Packed" };

export default function BarCard({ venue, onClick }: { venue: Venue; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl glass hover:bg-accent/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden flex items-stretch"
      aria-label={`${venue.title} details`}
    >
      {venue.image_url && (
        <div className="w-24 h-24 flex-shrink-0">
          <img src={venue.image_url} alt={venue.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-tight truncate">{venue.title}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white uppercase tracking-wide ${
              venue.category === "bar" ? "bg-[hsl(217,91%,60%)]"
              : venue.category === "club" ? "bg-[hsl(0,72%,51%)]"
              : "bg-[hsl(262,83%,58%)]"
            }`}>
              {venue.category}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
            {venue.music_type && <span>🎵 {venue.music_type}</span>}
            {venue.venue_stats?.crowd_level && (
              <span>👥 {crowdLabel[venue.venue_stats.crowd_level] ?? venue.venue_stats.crowd_level}</span>
            )}
            {venue.cover_charge && <span>🎫 {venue.cover_charge}</span>}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      </div>
    </button>
  );
}
