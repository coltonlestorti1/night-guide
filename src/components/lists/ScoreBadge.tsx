/**
 * The 0-10 score in a circle. Colour carries the bucket, because the number
 * alone reads as a grade out of ten and a 2.1 looks like a failure rather than
 * "I did not rate this highly".
 *
 * `not_great` is deliberately muted rather than red: this is the user's own
 * private list about a real business, and a red badge editorialises.
 */
import { cn } from "@/lib/utils";
import { BUCKET_LABELS, type Bucket } from "@/lib/night/ranking";

const TONE: Record<Bucket, string> = {
  great: "border-primary/40 text-primary",
  good: "border-border text-foreground",
  not_great: "border-border text-muted-foreground",
};

export default function ScoreBadge({ score, bucket }: { score: number; bucket: Bucket }) {
  return (
    <span
      className={cn(
        "shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-card text-sm font-bold tabular-nums",
        TONE[bucket],
      )}
      // The number on its own is meaningless to a screen reader; the bucket is
      // the part that carries meaning.
      aria-label={`Your rating ${score.toFixed(1)} out of 10 — ${BUCKET_LABELS[bucket]}`}
    >
      {score.toFixed(1)}
    </span>
  );
}
