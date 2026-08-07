/**
 * The comment row under a feed card: a count and the newest comment, both
 * opening the thread. Not the thread itself — an unbounded comment list under
 * a card that already carries author, venue, score, note and photos makes the
 * feed grow without limit.
 */
import type { CommentPreview as Preview } from "@/lib/night/comments";

export default function CommentPreview({
  preview,
  canComment,
  onOpen,
}: {
  preview: Preview | undefined;
  canComment: boolean;
  onOpen: () => void;
}) {
  // Nothing to show and nothing they could add — render nothing rather than an
  // empty affordance.
  if (!preview && !canComment) return null;

  if (!preview) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Add a comment
      </button>
    );
  }

  const name = preview.latest.author.display_name || preview.latest.author.username;

  return (
    <div className="mt-2 space-y-1">
      {preview.count > 1 && (
        <button
          type="button"
          onClick={onOpen}
          className="block text-sm text-muted-foreground hover:text-foreground"
        >
          View all {preview.count} comments
        </button>
      )}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* line-clamp keeps the feed scannable; break-words keeps a long
            unbroken name or body from widening the card. Both are needed. */}
        <p className="text-sm leading-snug break-words line-clamp-2">
          <span className="font-semibold">{name}</span>{" "}
          <span className="text-muted-foreground">{preview.latest.body}</span>
        </p>
      </button>
    </div>
  );
}
