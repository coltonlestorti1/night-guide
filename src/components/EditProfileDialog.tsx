import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { cleanupOldAvatars, uploadAvatar } from "@/lib/avatarUpload";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditProfileDialog = ({ open, onOpenChange }: Props) => {
  const { session, profile, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [availability, setAvailability] = useUsernameAvailability(
    open ? username : "",
    profile?.username,
  );

  // Seed the fields ONLY on the open transition — a profile update landing
  // mid-edit (photo upload, token-refresh refetch) must not wipe typed input.
  useEffect(() => {
    if (open) {
      const p = useAuthStore.getState().profile;
      if (p) {
        setDisplayName(p.display_name ?? "");
        setUsername(p.username);
      }
    }
  }, [open]);

  if (!profile) return null;

  // Same fallback chain as the Profile card, so the dialog never shows a bare
  // letter while the page shows the user's Google photo.
  const meta = session?.user.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  const avatarSrc = profile.avatar_url || meta?.avatar_url || meta?.picture || undefined;

  const usernameChanged = username !== profile.username;
  const nameChanged = displayName.trim() !== (profile.display_name ?? "");
  const dirty = usernameChanged || nameChanged;
  const usernameBlocked =
    usernameChanged && availability !== "available";

  const pickPhoto = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !session) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, session.user.id);
      await updateProfile({ avatar_url: url });
      // Old files only after the DB points at the new one; fire-and-forget.
      void cleanupOldAvatars(session.user.id, url);
      toast.success("New photo saved.");
    } catch {
      toast.error("Couldn't upload that photo. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!dirty || usernameBlocked || saving || uploading) return;
    setSaving(true);
    const patch: { display_name?: string | null; username?: string } = {};
    if (nameChanged) patch.display_name = displayName.trim() || null;
    if (usernameChanged) patch.username = username;
    try {
      await updateProfile(patch);
      toast.success("Profile updated.");
      onOpenChange(false);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        setAvailability("taken");
      } else {
        toast.error("Couldn't save that. Give it another shot.");
      }
    } finally {
      setSaving(false);
    }
  };

  const usernameHint =
    availability === "invalid"
      ? "3-20 characters: lowercase letters, numbers, underscores."
      : availability === "taken"
        ? "That one's taken."
        : availability === "available"
          ? "It's yours if you want it."
          : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Your name, handle, and photo.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={pickPhoto}
            disabled={uploading}
            className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Change profile photo"
          >
            <Avatar className="h-20 w-20 ring-4 ring-card shadow-float">
              <AvatarImage src={avatarSrc} alt="" />
              <AvatarFallback className="text-xl font-semibold bg-primary-soft text-primary">
                {(profile.display_name || profile.username).slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-display-name" className="text-sm font-medium">
            Display name
          </label>
          <Input
            id="edit-display-name"
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-username" className="text-sm font-medium">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              id="edit-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="pl-8 pr-9 h-11"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {availability === "checking" && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
              {availability === "available" && <Check className="h-4 w-4 text-green-500" aria-hidden="true" />}
              {(availability === "taken" || availability === "invalid") && (
                <X className="h-4 w-4 text-red-500" aria-hidden="true" />
              )}
            </span>
          </div>
          <p
            className={cn(
              "text-xs min-h-4",
              availability === "available" ? "text-green-500" : "text-muted-foreground",
            )}
          >
            {usernameHint}
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={save}
            disabled={!dirty || usernameBlocked || saving}
            className="w-full h-11 rounded-xl"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileDialog;
