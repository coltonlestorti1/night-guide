/**
 * The Activity block on the venue card: what it is doing now, when it peaks,
 * and whether a line is likely.
 *
 * Purely presentational — every string is decided by src/lib/heat/copy.ts.
 * Lines are omitted entirely when their data is absent: no "Unknown", no empty
 * labels, so a low-confidence venue looks deliberate rather than broken.
 */
import { Flame, Clock, CalendarDays, Users } from "lucide-react";
import { Venue } from "@/data/types";
import { getEnrichment } from "@/data/enrichment";
import { activityCopy } from "@/lib/heat/copy";
import { useOneVenueHeat } from "@/hooks/useVenueHeat";
import { cn } from "@/lib/utils";

export default function ActivitySection({ venue }: { venue: Venue }) {
  const { heat, baseline, signals } = useOneVenueHeat(venue);
  if (!heat || !baseline) return null;

  // The venue blurb lives here and nowhere else. It used to render a second
  // time under "More info" > About; that section is gone, so the Google
  // fallback and its required attribution moved here with it.
  const enrichment = getEnrichment(venue.title);
  const about = venue.description ?? enrichment?.editorialSummary;

  const copy = activityCopy(heat, baseline, signals);
  const hot = heat.label === "Hot Now";

  return (
    <section className="mt-3 rounded-2xl bg-secondary/60 p-3" aria-label="Activity">
      <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Activity</h3>

      <p className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("text-sm font-semibold", hot && "text-[hsl(var(--hot))]")}>
          {hot && <Flame className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />}
          {copy.status}
        </span>
        {copy.lineNote && (
          <span className="text-xs font-medium text-[hsl(var(--trending))]">· {copy.lineNote}</span>
        )}
      </p>

      {copy.peakNote && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" /> {copy.peakNote}
        </p>
      )}

      {copy.bestNightsNote && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3 shrink-0" /> {copy.bestNightsNote}
        </p>
      )}

      {copy.signalNote && (
        <p className="mt-1 text-xs text-foreground/80 flex items-center gap-1.5">
          <Users className="h-3 w-3 shrink-0" /> {copy.signalNote}
        </p>
      )}

      {(copy.momentNote || about) && (
        <>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {/* The moment clause shifts with the night; the venue description is
                fixed and describes its character. Together they read as one line. */}
            {copy.momentNote && <span className="text-foreground/80">{copy.momentNote} </span>}
            {about}
          </p>
          {about && !venue.description && (
            <p className="text-[10px] text-muted-foreground/70 mt-1">Description: Google</p>
          )}
        </>
      )}
    </section>
  );
}
