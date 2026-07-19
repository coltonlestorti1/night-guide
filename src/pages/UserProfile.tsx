/**
 * Viewable profile — /u/:username. Three-layer visibility (Decision Log
 * 2026-07-19): identity card renders for any signed-in viewer; the
 * out-tonight line only ever has data for friends because it reads the
 * RLS-scoped friends-out-tonight feed — no client-side privacy filtering.
 */
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, UserX } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useFriendsOutTonight, useProfileByUsername } from "@/hooks/useFriends";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AddButton from "@/components/social/AddButton";
import ProfileAvatar from "@/components/social/ProfileAvatar";

const UserProfile = () => {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const myUsername = useAuthStore((s) => s.profile?.username);
  const myId = useAuthStore((s) => s.session?.user.id);
  const handle = username.replace(/^@/, "").toLowerCase();
  const { data: profile, isLoading, isError } = useProfileByUsername(
    status === "signedIn" ? handle : undefined
  );
  const { data: out } = useFriendsOutTonight();

  // Own handle → the real profile page (edit lives there).
  if (myUsername && handle === myUsername) return <Navigate to="/profile" replace />;

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="mb-4 -ml-2 rounded-xl text-muted-foreground"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/social"))}
    >
      <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
    </Button>
  );

  if (status !== "signedIn") {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {back}
        <div className="rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <p className="font-display text-lg font-bold">Sign in to view profiles.</p>
          <Button className="mt-5 h-11 w-full rounded-xl" onClick={() => navigate("/profile")}>
            Sign in
          </Button>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {back}
        <div className="rounded-3xl border border-border bg-card p-6 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !profile) {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {back}
        <div className="rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <UserX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="font-display text-lg font-bold">
            {isError ? "Couldn't load that profile." : "No one by that handle."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError
              ? "Give it another shot in a second."
              : `@${handle} doesn't exist — maybe they changed it.`}
          </p>
        </div>
      </section>
    );
  }

  const liveNow = (out ?? []).find((f) => f.profile.id === profile.id);

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {back}
      <div className="rounded-3xl border border-border bg-card p-6 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <ProfileAvatar profile={profile} className="h-24 w-24 ring-4 ring-card shadow-float" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
            {profile.display_name || `@${profile.username}`}
          </h1>
          {profile.display_name && (
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
          )}
          {/* Guard on id as well as the username redirect above: if the profile
              fetch errored (signedIn but profile null → myUsername undefined),
              the redirect is skipped, so never offer to friend yourself. */}
          {myId !== profile.id && (
            <div className="mt-4">
              <AddButton profile={profile} />
            </div>
          )}
        </div>
      </div>

      {liveNow && (
        <Link
          to="/"
          state={{ venueId: liveNow.venueId }}
          className="mt-4 flex items-center gap-2.5 rounded-3xl border border-border bg-card px-4 py-3.5 animate-fade-in transition-colors hover:bg-secondary/60"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              Out tonight at {liveNow.venueName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {timeAgo(liveNow.checkedInAt)}
            </span>
          </span>
        </Link>
      )}
    </section>
  );
};

export default UserProfile;
