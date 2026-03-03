import { ChevronRight } from "lucide-react";
import { Venue } from "@/data/types";

const crowdLabel: Record<string, string> = { low: "Chill", medium: "Lively", high: "Packed" };

const PLACEHOLDER: Record<string, string> = {
  bar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='%233b82f6'%3E%3Crect width='96' height='96' rx='8' opacity='.15'/%3E%3Ctext x='48' y='54' text-anchor='middle' font-size='14' fill='%233b82f6'%3EBar%3C/text%3E%3C/svg%3E",
  club: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='%23ef4444'%3E%3Crect width='96' height='96' rx='8' opacity='.15'/%3E%3Ctext x='48' y='54' text-anchor='middle' font-size='14' fill='%23ef4444'%3EClub%3C/text%3E%3C/svg%3E",
  lounge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='%23a855f7'%3E%3Crect width='96' height='96' rx='8' opacity='.15'/%3E%3Ctext x='48' y='54' text-anchor='middle' font-size='14' fill='%23a855f7'%3ELounge%3C/text%3E%3C/svg%3E",
};

export default function BarCard({ venue, onClick }: { venue: Venue; onClick?: () => void }) {
  const imgSrc = venue.image_url || PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl glass hover:bg-accent/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden flex items-stretch"
      aria-label={`${venue.title} details`}
    >
      <div className="w-24 h-24 flex-shrink-0 bg-secondary">
        <img
          src={imgSrc}
          alt={venue.title}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER[venue.category] || PLACEHOLDER.bar; }}
        />
      </div>
      <div className="flex-1 p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold leading-tight truncate">{venue.title}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white uppercase tracking-wide ${
              venue.category === "bar" ? "bg-[hsl(var(--venue-bar))]"
              : venue.category === "club" ? "bg-[hsl(var(--venue-club))]"
              : "bg-[hsl(var(--venue-lounge))]"
            }`}>
              {venue.category}
            </span>
          </div>
          {venue.neighborhood && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{venue.neighborhood}</p>
          )}
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
