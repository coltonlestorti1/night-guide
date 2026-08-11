/**
 * Your profile — who you are and what you've been up to. Nothing else.
 *
 * Settings used to live below the Activity feed on this page, which meant they
 * sat underneath an unbounded list: you scrolled past your nights to reach
 * Ghost mode, and every setting queued in §14 would have pushed sign-out
 * further down. They now live at /settings behind the ☰ button.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { useMyRatings } from "@/hooks/useMyRatings";
import { useSaves } from "@/hooks/useSaves";
import { useVenues } from "@/hooks/useVenues";
import { beenList } from "@/lib/night/lists";
import EditProfileDialog from "@/components/EditProfileDialog";
import ProfileHeader from "@/components/ProfileHeader";
import MyActivity from "@/components/night/MyActivity";
import TaggedPosts from "@/components/night/TaggedPosts";
import ProfileTabs, { type ProfileTab } from "@/components/night/ProfileTabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Menu, Pencil } from "lucide-react";
import { collegeLabel } from "@/data/colleges";

const Profile = () => {
  const { status, session, profile, signInWithGoogle } = useAuthStore();
  const [signingIn, setSigningIn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("activity");

  const handleSignIn = async () => {
    setSigningIn(true);
    await signInWithGoogle();
    // OAuth redirects away; if it didn't (config missing), release the button
    setTimeout(() => setSigningIn(false), 4000);
  };

  // Counts for the header. Every hook here is already loaded elsewhere in this
  // page's tree (MyActivity calls useVenues), so this adds no requests.
  //
  // Counted from the RESOLVED lists, not the raw rows: a rating or save whose
  // venue has since been deactivated is dropped by /lists, and a stat that
  // says "Been 12" linking to a list of 11 reads as a bug.
  const { data: friendships } = useMyFriendships();
  const { data: myRatings } = useMyRatings();
  const { data: allVenues } = useVenues({});
  const savedIds = useSaves().ids;
  const friendCount = (friendships ?? []).filter((r) => r.status === "accepted").length;
  const beenCount = beenList(myRatings, allVenues ?? []).length;
  const savedCount = allVenues
    ? savedIds.filter((id) => allVenues.some((v) => v.id === id)).length
    : savedIds.length;

  const meta = session?.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string } | undefined;
  const displayName = profile?.display_name || meta?.full_name || meta?.name || "";
  const avatarUrl = profile?.avatar_url || meta?.avatar_url || meta?.picture || "";
  const myId = session?.user.id;

  return (
    <section className="relative container pt-6 pb-24 max-w-lg">
      {/* Ambient light spill — brand purple, echoing /join */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-12 h-56 opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(ellipse 70% 100% at 18% 0%, hsl(var(--primary)) 0%, transparent 65%)" }}
      />

      <header className="relative mb-6 flex items-start justify-between gap-4 animate-fade-in">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            You on the map
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Profile</h1>
        </div>

        {/* Present even when signed out: /settings has its own signed-out
            state, and a control that appears only sometimes is harder to find
            than one that is always in the same corner. */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-mr-2 mt-1 rounded-xl text-muted-foreground"
        >
          <Link to="/settings" aria-label="Settings">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      {status === "loading" ? (
        <div className="relative glass rounded-3xl overflow-hidden">
          <Skeleton className="h-20 w-full rounded-none" />
          <div className="p-6 pt-0">
            <Skeleton className="h-20 w-20 rounded-full -mt-10 ring-4 ring-card" />
            <div className="space-y-2 mt-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ) : status === "signedOut" ? (
        <div className="relative glass rounded-3xl p-8 text-center animate-slide-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-bold">
            Find out where your friends are tonight.
          </h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Sign in to check in, add friends, and show up on the map.
          </p>
          <Button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full h-12 rounded-xl text-base font-semibold shadow-glow"
          >
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </Button>
        </div>
      ) : (
        <>
          <ProfileHeader
            displayName={displayName}
            username={profile?.username}
            avatarUrl={avatarUrl}
            createdAt={profile?.created_at}
            collegeLine={collegeLabel(profile?.college_slug, profile?.class_year)}
            bio={profile?.bio}
            stats={[
              { label: "Friends", value: friendCount, to: "/friends" },
              { label: "Been", value: beenCount, to: "/lists?tab=been" },
              { label: "Saved", value: savedCount, to: "/lists?tab=saved" },
            ]}
            action={
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Edit Profile
              </Button>
            }
          />

          <div className="mt-6">
            <ProfileTabs value={tab} onChange={setTab} />
          </div>

          <div className="mt-4">
            {tab === "activity" ? (
              <MyActivity />
            ) : (
              myId && <TaggedPosts userId={myId} isSelf />
            )}
          </div>

          <EditProfileDialog open={editing} onOpenChange={setEditing} />
        </>
      )}
    </section>
  );
};

export default Profile;
