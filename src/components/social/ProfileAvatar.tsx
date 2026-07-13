import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FriendProfile } from "@/lib/friends";
import { cn } from "@/lib/utils";

export default function ProfileAvatar({
  profile,
  className,
}: {
  profile: FriendProfile;
  className?: string;
}) {
  const initial = (profile.display_name || profile.username).slice(0, 1).toUpperCase();
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
      <AvatarFallback className="bg-primary-soft text-primary text-sm font-semibold">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
