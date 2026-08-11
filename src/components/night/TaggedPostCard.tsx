/**
 * A post you were tagged in, on your own Tagged tab, with the controls for
 * managing that tag.
 *
 * The pending half of tag management shipped 2026-08-09 — accept or decline,
 * in Activity. This is the other half Colton asked for the same day: once you
 * have accepted, there was nowhere to change your mind between 'tag' and
 * 'collab', to remove yourself, or to rate a night you accepted without
 * rating.
 *
 * RLS is the boundary and is not re-checked here. Only the tagged person may
 * move a tag to 'collab', and the INSERT policy refuses a tag that does not
 * start 'pending' — proved by scripts/2026-08-09-collab-tags-rls-test.sql.
 * This component only renders the choices.
 *
 * It exists as a wrapper rather than a slot inside PostCard because RateSheet
 * renders a Drawer: mounted inside DropdownMenuContent it would be destroyed
 * the instant the menu closed on select, so it has to be a SIBLING of the
 * menu. Same arrangement as ListRowMenu.
 */
import { useState } from "react";
import { Check, Star, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRemoveTag, useSetTagState } from "@/hooks/useTags";
import RateSheet from "@/components/night/RateSheet";
import PostCard from "@/components/night/PostCard";
import type { CardProps } from "@/components/night/PostList";
import type { TagState } from "@/lib/night/tags";

export default function TaggedPostCard({
  cardProps,
  myId,
  state,
}: {
  cardProps: CardProps;
  myId: string;
  /**
   * The caller's own tag state on this post, read from the tag rows rather
   * than the post. The post-level field is only populated by the Tagged tab's
   * query, so taking it from there would have left these controls behaving
   * differently on the feed — which is exactly the bug this fixes.
   */
  state: TagState;
}) {
  const { post, venue } = cardProps;
  const [rateOpen, setRateOpen] = useState(false);
  const setState = useSetTagState();
  const remove = useRemoveTag();

  const collab = state === "collab";

  const choose = async (next: "tag" | "collab") => {
    try {
      await setState.mutateAsync({ postId: post.id, state: next });
      toast.success(
        next === "collab"
          ? "Your friends can see this night now."
          : "Your friends won't see this night.",
      );
    } catch {
      toast.error("Couldn't change that. Try again.");
    }
  };

  const toggleAudience = () => choose(collab ? "tag" : "collab");

  const removeMe = async () => {
    try {
      await remove.mutateAsync({ postId: post.id, taggedUserId: myId });
      toast.success("You're off this night.");
    } catch {
      toast.error("Couldn't remove that tag. Try again.");
    }
  };

  return (
    <>
      <PostCard
        {...cardProps}
        menuExtra={
          <>
            {/* Pending gets BOTH choices, the same pair the Activity sheet
                offers — either one accepts the tag, and a single toggle would
                only ever reach 'collab'. Once accepted it becomes a toggle,
                because by then the other option is the one you didn't pick. */}
            {state === "pending" ? (
              <>
                <DropdownMenuItem
                  onSelect={() => choose("collab")}
                  disabled={setState.isPending}
                >
                  <Users className="h-4 w-4 mr-2" /> Share with my friends
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => choose("tag")}
                  disabled={setState.isPending}
                >
                  <Check className="h-4 w-4 mr-2" /> Just a tag
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onSelect={toggleAudience} disabled={setState.isPending}>
                <Users className="h-4 w-4 mr-2" />
                {collab ? "Hide from my friends" : "Share with my friends too"}
              </DropdownMenuItem>
            )}

            {/* Only when the venue resolved — RateSheet needs a real Venue,
                and without the guard this opens an empty sheet. Same guard
                PostCard's own Edit item uses. */}
            {venue && (
              <DropdownMenuItem onSelect={() => setRateOpen(true)}>
                <Star className="h-4 w-4 mr-2" />
                {post.score === null ? "Rate this spot" : "Change your rating"}
              </DropdownMenuItem>
            )}

            {/* No confirm dialog: removal is reversible — the author can tag
                you again — and a confirm on every row is friction on the
                common case. */}
            <DropdownMenuItem
              onSelect={removeMe}
              disabled={remove.isPending}
              className="text-destructive focus:text-destructive"
            >
              <UserMinus className="h-4 w-4 mr-2" /> Remove me from this night
            </DropdownMenuItem>
          </>
        }
      />

      {/* Mounted only while open: one drawer per card would put a few dozen of
          them on the page. Same reason as ListRowMenu. */}
      {venue && rateOpen && <RateSheet venue={venue} open onOpenChange={setRateOpen} />}
    </>
  );
}
