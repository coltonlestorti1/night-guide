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
import { Star, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRemoveTag, useSetTagState } from "@/hooks/useTags";
import RateSheet from "@/components/night/RateSheet";
import PostCard from "@/components/night/PostCard";
import type { CardProps } from "@/components/night/PostList";

export default function TaggedPostCard({
  cardProps,
  myId,
}: {
  cardProps: CardProps;
  myId: string;
}) {
  const { post, venue } = cardProps;
  const [rateOpen, setRateOpen] = useState(false);
  const setState = useSetTagState();
  const remove = useRemoveTag();

  const collab = post.tagState === "collab";

  const toggleAudience = async () => {
    try {
      await setState.mutateAsync({ postId: post.id, state: collab ? "tag" : "collab" });
      toast.success(
        collab ? "Your friends won't see this night." : "Your friends can see this night now.",
      );
    } catch {
      toast.error("Couldn't change that. Try again.");
    }
  };

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
            <DropdownMenuItem onSelect={toggleAudience} disabled={setState.isPending}>
              <Users className="h-4 w-4 mr-2" />
              {collab ? "Hide from my friends" : "Share with my friends too"}
            </DropdownMenuItem>

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
