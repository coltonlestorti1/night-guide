/**
 * The five-block crowd meter, beside the activity wording.
 *
 * WHY IT EXISTS. The label alone flattens the score: a venue at 56 and one at
 * 74 both read "Busy", and there was no way to tell which night was actually
 * busier. The meter carries the magnitude the word discards.
 *
 * It NEVER replaces the wording. Colour alone is not an encoding — it fails
 * colourblind users outright, and a screen reader gets nothing from five divs.
 * The word stays, and the whole meter carries one aria-label with the value
 * spelled out.
 */
import { cn } from "@/lib/utils";
import { HeatLabel } from "@/lib/heat/types";
import { METER_SEGMENTS, meterFill, segmentsForScore } from "@/lib/heat/meter";
import { ACTIVITY_TRACK } from "@/lib/heat/activityColors";

export default function CrowdMeter({
  score,
  label,
  className,
}: {
  /** 0–100 heat score. */
  score: number;
  label: HeatLabel;
  className?: string;
}) {
  // A closed venue has no crowd to measure. An empty meter would read as
  // "dead right now", which is a different and wrong claim — so render none.
  if (label === "Closed") return null;

  const lit = segmentsForScore(score);
  const fill = meterFill(label);

  return (
    <span
      // One label for the whole control. The segments are decoration to an
      // assistive reader; the value is what matters.
      role="img"
      aria-label={`Crowd level ${lit} of ${METER_SEGMENTS} — ${label}`}
      className={cn("inline-flex items-center gap-[2px] align-middle", className)}
    >
      {Array.from({ length: METER_SEGMENTS }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          // Inline rather than a Tailwind class: these values are shared with
          // the map's pin rings, and the JIT cannot build a class name from a
          // runtime value.
          style={{ backgroundColor: i < lit ? fill : ACTIVITY_TRACK }}
          className="h-2.5 w-2.5 rounded-[2px] transition-colors"
        />
      ))}
    </span>
  );
}
