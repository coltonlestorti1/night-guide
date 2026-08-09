/**
 * One post's comment thread.
 *
 * Non-friends get the thread read-only with a stated reason rather than a
 * composer that fails on submit — the database refuses their insert either
 * way, so the only question is whether they learn that before or after typing.
 */
import { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FeedPost } from "@/lib/night/posts";
import { COMMENT_MAX, type NightComment } from "@/lib/night/comments";
import { useAddComment, useCanCommentOn, useCommentThread, useDeleteComment } from "@/hooks/useComments";
import { useAuthStore } from "@/store/auth";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import ReportDialog from "@/components/social/ReportDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function CommentRow({
  comment,
  postAuthorId,
  onDeleted,
}: {
  comment: NightComment;
  postAuthorId: string;
  onDeleted: (c: NightComment) => void;
}) {
  const myId = useAuthStore((s) => s.session?.user.id);
  // Your own comment, or any comment on your own post. Mirrors the DELETE
  // policy — the database is still the enforcer.
  const canDelete = myId === comment.author.id || myId === postAuthorId;
  const mine = comment.author.id === myId;

  return (
    <li className="flex items-start gap-3">
      <ProfileAvatar profile={comment.author} className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        {/* break-words on BOTH the name and the body. Display names have no
            length limit, and a missing one here shipped a whole-page
            horizontal scroll bug on 2026-08-07. */}
        <p className="text-sm leading-snug break-words">
          <span className="font-semibold">
            {comment.author.display_name || comment.author.username}
          </span>{" "}
          <span className="whitespace-pre-wrap">{comment.body}</span>
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Comment options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canDelete && (
            <DropdownMenuItem
              onSelect={() => onDeleted(comment)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          )}
          {!mine && (
            <ReportDialog profile={comment.author} context="comment" contextId={comment.id} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export default function CommentSheet({
  post,
  open,
  onOpenChange,
}: {
  post: FeedPost;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: comments, isLoading } = useCommentThread(open ? post.id : null);
  const canComment = useCanCommentOn(post.author.id);
  const add = useAddComment();
  const remove = useDeleteComment();
  const [draft, setDraft] = useState("");

  const authorName = post.author.display_name || post.author.username;

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await add.mutateAsync({ postId: post.id, body });
      setDraft("");
    } catch {
      toast.error("Couldn't post that comment. Try again.");
    }
  };

  const doDelete = async (c: NightComment) => {
    try {
      await remove.mutateAsync({ commentId: c.id, postId: post.id });
    } catch {
      toast.error("Couldn't delete that comment. Try again.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="sheet-h-85">
        <DrawerTitle className="px-4 pt-2 text-base font-semibold">Comments</DrawerTitle>
        <DrawerDescription className="sr-only">
          The comment thread on {authorName}'s post.
        </DrawerDescription>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : comments?.length ? (
            <ul className="space-y-4">
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  postAuthorId={post.author.id}
                  onDeleted={doDelete}
                />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </p>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {canComment.status === "yes" ? (
            <div className="flex items-end gap-2">
              {/* The shared Textarea, NOT a raw <textarea>. It carries
                  `text-base md:text-sm`, and that is load-bearing: iOS Safari
                  force-zooms the whole page when a focused field's font-size is
                  under 16px, which blows the layout up and pushes the Post
                  button off screen. The first version of this composer was a
                  raw element at text-sm and did exactly that on Colton's phone.
                  min-h-0 + rows=1 keeps it a one-line composer rather than the
                  component's default 80px box. */}
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={COMMENT_MAX}
                rows={1}
                placeholder="Add a comment…"
                className="min-h-0 min-w-0 flex-1 resize-none rounded-xl"
                aria-label="Add a comment"
              />
              <Button
                size="sm"
                className="rounded-lg"
                disabled={!draft.trim() || add.isPending}
                onClick={submit}
              >
                Post
              </Button>
            </div>
          ) : canComment.status === "loading" ? (
            // The friendships query that decides this hasn't resolved yet — a
            // neutral spinner, never the refusal copy below, which would be
            // an outright false statement for a friend mid-load.
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground break-words">
              Only {authorName}'s friends can comment.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
