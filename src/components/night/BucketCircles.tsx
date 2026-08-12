/**
 * "How was it?" — three circles, Beli's form in ENDZ's tones.
 *
 * not_great is muted with a dashed border and NEVER red: this is the user's own
 * private ranking of a real business, and a red option editorialises. That is
 * the same decision ScoreBadge documents, and the two must not drift.
 *
 * Selecting does not advance a step. It selects, and stays re-tappable until
 * Post — the comparisons run afterwards. That is what makes one circle plus one
 * Post a complete log.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUCKET_LABELS, type Bucket } from "@/lib/night/ranking";
import { PICKER_LABELS } from "@/lib/night/logNight";

const BUCKETS: Bucket[] = ["great", "good", "not_great"];

/**
 * Every bucket gets its OWN hue in both states. Distinguishing them by opacity
 * alone fails the same way the crowd meter did — at one-handed, night-time
 * glance the scale collapses into one colour.
 */
const TONE: Record<Bucket, { on: string; off: string }> = {
  great: {
    on: "bg-primary border-primary text-primary-foreground",
    off: "bg-primary/15 border-primary/40 text-primary",
  },
  good: {
    on: "bg-amber-400 border-amber-400 text-[#121212]",
    off: "bg-amber-400/15 border-amber-400/45 text-amber-300",
  },
  not_great: {
    on: "bg-muted border-dashed border-muted-foreground text-foreground",
    off: "bg-muted/40 border-dashed border-border text-muted-foreground",
  },
};

export default function BucketCircles({
  value,
  onChange,
  disabled = false,
}: {
  value: Bucket | null;
  onChange: (b: Bucket) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-around gap-2 py-1">
      {BUCKETS.map((b) => {
        const on = value === b;
        return (
          <button
            key={b}
            type="button"
            disabled={disabled}
            onClick={() => onChange(b)}
            aria-pressed={on}
            // The stored name, not the friendly copy: "Loved it" read aloud
            // out of context does not say what it sets.
            aria-label={BUCKET_LABELS[b]}
            className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all",
                on ? TONE[b].on : TONE[b].off,
                on && "scale-105",
              )}
            >
              {on && <Check className="h-6 w-6" aria-hidden="true" />}
            </span>
            <span
              className={cn(
                "text-center text-xs leading-tight",
                on ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {PICKER_LABELS[b]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
