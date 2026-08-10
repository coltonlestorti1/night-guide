/**
 * The 0-10 score in a circle. Colour and border weight carry the bucket,
 * because the number alone reads as a grade out of ten and a 2.1 looks like a
 * failure rather than "I did not rate this highly".
 *
 * `not_great` is deliberately muted rather than red: this is the user's own
 * private list about a real business, and a red badge editorialises. It gets a
 * dashed border so it is still distinguishable from `good` at a glance — text
 * opacity alone is not a difference you can see one-handed at night.
 *
 * 36px, not the 44px touch minimum: it is not interactive, and the row needs
 * the width for the venue name.
 */
import { cn } from "@/lib/utils";
import { BUCKET_LABELS, type Bucket } from "@/lib/night/ranking";

const TONE: Record<Bucket, string> = {
  great: "border-primary/50 text-primary",
  good: "border-border text-foreground",
  not_great: "border-dashed border-border text-muted-foreground",
};

export default function ScoreBadge({ score, bucket }: { score: number; bucket: Bucket }) {
  return (
    <span
      // role="img" so the label is actually announced — aria-label on a bare
      // span is ignored by most screen readers, which would leave "8.4" with
      // no unit and no meaning.
      role="img"
      aria-label={`Your rating: ${score.toFixed(1)} out of 10, ${BUCKET_LABELS[bucket]}`}
      className={cn(
        "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card text-xs font-bold tabular-nums",
        TONE[bucket],
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}
