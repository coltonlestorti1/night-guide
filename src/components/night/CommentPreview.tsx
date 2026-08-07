/**
 * The comment row under a feed card: a count and the newest comment, both
 * opening the thread. Not the thread itself — an unbounded comment list under
 * a card that already carries author, venue, score, note and photos makes the
 * feed grow without limit.
 */
import type { CommentPreview as Preview } from "@/lib/night/comments";
import type { CanCommentStatus } from "@/hooks/useComments";

export default function CommentPreview({
  preview,
  canComment,
  onOpen,
}: {
  preview: Preview | undefined;
  /** "loading" while the friendships query that decides this is still in
   *  flight — must never be treated as "no", or a friend briefly sees no
   *  affordance at all where "Add a comment" belongs. */
  canComment: CanCommentStatus;
  onOpen: () => void;
}) {
  // Nothing to show and nothing they could add (or we don't know yet) —
  // render nothing rather than an empty affordance or a wrong refusal.
  if (!preview && canComment !== "yes") return null;

  if (!preview) {
    return (
      // The mt-2 spacing lives on this wrapper, not the button, so it never
      // shares an axis with the button's own -my-1.5 below — two classes
      // setting the same property on the same element is a cascade-order
      // gamble, not a guarantee.
      <div className="mt-2">
        <button
          type="button"
          onClick={onOpen}
          // py-1.5 -my-1.5 grows the tap target toward the ~44px guideline
          // without pushing the surrounding layout — the extra padding is
          // clawed back by the negative margin.
          className="-my-1.5 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Add a comment
        </button>
      </div>
    );
  }

  const name = preview.latest.author.display_name || preview.latest.author.username;

  return (
    <div className="mt-2 space-y-1">
      {preview.count > 1 && (
        <button
          type="button"
          onClick={onOpen}
          className="-my-1.5 block py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          View all {preview.count} comments
        </button>
      )}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* line-clamp keeps the feed scannable; break-words keeps a long
            unbroken name or body from widening the card. Both are needed.
            A <span>, not a <p> — a <p> nested inside a <button> is invalid
            HTML (block content inside an inline/interactive element). */}
        <span className="block text-sm leading-snug break-words line-clamp-2">
          <span className="font-semibold">{name}</span>{" "}
          <span className="text-muted-foreground">{preview.latest.body}</span>
        </span>
      </button>
    </div>
  );
}
