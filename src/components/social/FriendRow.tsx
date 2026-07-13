/** A friend in "Your friends" — row tap opens a Remove / Block action sheet. */
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { FriendProfile } from "@/lib/friends";
import { useBlockUser, useRemoveFriend } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import ProfileAvatar from "@/components/social/ProfileAvatar";

export default function FriendRow({ rowId, profile }: { rowId: string; profile: FriendProfile }) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveFriend();
  const block = useBlockUser();

  return (
    <>
      <button
        className="w-full flex items-center gap-3 py-2.5 text-left"
        onClick={() => setOpen(true)}
        aria-label={`Manage @${profile.username}`}
      >
        <ProfileAvatar profile={profile} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">@{profile.username}</p>
          {profile.display_name && (
            <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
          )}
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-card border-border">
          <DrawerTitle className="px-4 pt-2 text-base font-semibold text-center">
            @{profile.username}
          </DrawerTitle>
          <DrawerDescription className="sr-only">Remove or block this friend.</DrawerDescription>
          <div className="max-w-lg mx-auto w-full px-4 pb-8 pt-3 space-y-2">
            <Button
              variant="secondary"
              className="w-full h-11 rounded-xl"
              onClick={() => {
                remove.mutate(rowId);
                setOpen(false);
              }}
            >
              Remove friend
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl text-red-600 hover:text-red-700"
              onClick={() => {
                block.mutate(profile);
                setOpen(false);
              }}
            >
              Block @{profile.username}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
