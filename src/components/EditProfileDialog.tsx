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
import { Textarea } from "@/components/ui/textarea";
import { Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CollegeField from "@/components/CollegeField";
import { AGE_BANDS, AgeBand, getStoredAgeBand, storeAgeBand } from "@/lib/agePref";
import { useMyAge } from "@/hooks/useMyAge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditProfileDialog = ({ open, onOpenChange }: Props) => {
  const { session, profile, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [collegeSlug, setCollegeSlug] = useState<string | null>(null);
  const [classYear, setClassYear] = useState<number | null>(null);
  // Pending, NOT committed. On the Profile page tapping a band called
  // storeAgeBand() immediately, which is fine for a page whose every control
  // self-saves. In here it would be a trap: every other field waits for Save,
  // so a tap-then-dismiss would silently persist a change the user backed out
  // of. Held as state and written only in save(), like the fields above.
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [availability, setAvailability] = useUsernameAvailability(
    open ? username : "",
    profile?.username,
  );
  const { age: myAge, fromBirthday } = useMyAge();

  // Seed the fields ONLY on the open transition — a profile update landing
  // mid-edit (photo upload, token-refresh refetch) must not wipe typed input.
  useEffect(() => {
    if (open) {
      const p = useAuthStore.getState().profile;
      if (p) {
        setDisplayName(p.display_name ?? "");
        setUsername(p.username);
        setBio(p.bio ?? "");
        setCollegeSlug(p.college_slug ?? null);
        setClassYear(p.class_year ?? null);
      }
      // Reseeded from storage on every open so a dismissed edit is genuinely
      // discarded — reopening shows what is stored, not what was abandoned.
      setAgeBand(getStoredAgeBand());
    }
  }, [open]);

  if (!profile) return null;

  // Same fallback chain as the Profile card, so the dialog never shows a bare
  // letter while the page shows the user's Google photo.
  const meta = session?.user.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  const avatarSrc = profile.avatar_url || meta?.avatar_url || meta?.picture || undefined;

  const usernameChanged = username !== profile.username;
  const nameChanged = displayName.trim() !== (profile.display_name ?? "");
  const bioChanged = bio.trim() !== (profile.bio ?? "");
  const collegeChanged = collegeSlug !== (profile.college_slug ?? null);
  const classYearChanged = classYear !== (profile.class_year ?? null);
  // A real birthday outranks the band outright, so the chips aren't offered and
  // can't be dirty. useMyAge() already reads storage during render, so the
  // stored value is the live baseline here the way `profile` is for the rest.
  const showAgeBands = !(myAge != null && fromBirthday);
  const ageBandChanged = showAgeBands && ageBand !== getStoredAgeBand();
  const dirty =
    usernameChanged ||
    nameChanged ||
    bioChanged ||
    collegeChanged ||
    classYearChanged ||
    ageBandChanged;
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
    const patch: {
      display_name?: string | null;
      username?: string;
      bio?: string | null;
      college_slug?: string | null;
      class_year?: number | null;
    } = {};
    if (nameChanged) patch.display_name = displayName.trim() || null;
    if (usernameChanged) patch.username = username;
    if (bioChanged) patch.bio = bio.trim() || null;
    if (collegeChanged) patch.college_slug = collegeSlug;
    if (classYearChanged) patch.class_year = classYear;
    try {
      // Skipped when the band is the only edit: an empty patch is a
      // `.update({})` with nothing to set, and a pointless round trip.
      if (Object.keys(patch).length > 0) await updateProfile(patch);
      // Written only once the profile write has survived. Save reads as one
      // action, so a rejected save (a username taken out from under us) has to
      // leave the band alone too — committing it here anyway would half-apply
      // a save the user was just told had failed, and the dialog stays open
      // still showing the band as pending.
      if (ageBandChanged && ageBand) storeAgeBand(ageBand);
      toast.success("Profile updated.");
      onOpenChange(false);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505") {
        setAvailability("taken");
      } else if (code === "42703") {
        toast.error("Couldn't save your bio just yet — give it another shot.");
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
      {/* Scrollable and viewport-capped. DialogContent is fixed at top-50%
          with translate-y-[-50%] and sets NO max-height and NO overflow, so a
          dialog taller than the screen is clipped at BOTH ends with no way to
          reach either. This one crossed that line when the age field arrived,
          and the iOS keyboard shrinks the visual viewport further — leaving
          the name and username fields unreachable behind the top edge.
          dvh, not vh: vh on iOS is the tallest-possible viewport and ignores
          the keyboard entirely. */}
      <DialogContent className="max-w-sm rounded-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
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

        {/* The escape hatch for anyone who skipped it at onboarding — without
            this, a skip would be permanent and they could never be matched. */}
        <div className="space-y-2">
          <span className="text-sm font-medium">School</span>
          <CollegeField
            collegeSlug={collegeSlug}
            classYear={classYear}
            onCollegeChange={setCollegeSlug}
            onClassYearChange={setClassYear}
            disabled={saving}
          />
        </div>

        {!showAgeBands ? (
          // Real age from the onboarding birthday. Shown to the account owner
          // only — birthday and gender live in profile_private precisely
          // because `profiles` is readable by every signed-in user, and this
          // dialog is only ever opened by the owner of the profile it edits
          // (Colton, 2026-08-07: "just me for now").
          //
          // Read-only on purpose: the birthday is the source of truth, so the
          // band would be a second, weaker copy of an answer already given.
          <div className="glass rounded-2xl p-4">
            <div className="font-medium text-sm">
              Your age <span className="text-muted-foreground font-normal">· {myAge}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              From the birthday you gave when you signed up. Only you can see it — it
              sharpens your picks and is never shown on your profile.
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl p-4">
            <div className="font-medium text-sm">Your age range</div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Sharpens your picks in Discover. Stays on this device.
            </p>
            <div className="flex flex-wrap gap-2">
              {AGE_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setAgeBand(band)}
                  aria-pressed={ageBand === band}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ageBand === band
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {band}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="edit-bio" className="text-sm font-medium">
              Bio
            </label>
            <span className="text-xs text-muted-foreground">{bio.length}/150</span>
          </div>
          <Textarea
            id="edit-bio"
            value={bio}
            maxLength={150}
            rows={2}
            placeholder="One line about your nights out."
            onChange={(e) => setBio(e.target.value)}
            className="resize-none"
          />
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
