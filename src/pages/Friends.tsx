/**
 * Your friends — the list behind the Friends stat on your profile.
 *
 * A page rather than the Social tab: the stat is a count of a specific set of
 * people, so tapping it should land on that set, not on a hub that also holds
 * plans, requests and search. Requests, search and blocked stay in Social's
 * FriendsSheet; this is only the accepted list.
 *
 * Rows are the same FriendRow the sheet uses, so tap-through and the
 * remove/block sheet behave identically in both places.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useMyFriendships } from "@/hooks/useFriends";
import { deriveFriends } from "@/lib/friends";
import FriendRow from "@/components/social/FriendRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const Friends = () => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user.id);
  const signedIn = useAuthStore((s) => s.status) === "signedIn";
  const { data: rows, isLoading, isError, refetch } = useMyFriendships();
  const [q, setQ] = useState("");

  const friends = useMemo(
    () => (rows && userId ? deriveFriends(rows, userId) : []),
    [rows, userId],
  );

  const term = q.trim().toLowerCase();
  const shown = term
    ? friends.filter(
        (f) =>
          f.profile.username.toLowerCase().includes(term) ||
          (f.profile.display_name ?? "").toLowerCase().includes(term),
      )
    : friends;

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="mb-3 -ml-2 rounded-xl text-muted-foreground"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}
    >
      <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
    </Button>
  );

  const empty = (title: string, body: string, action?: React.ReactNode) => (
    <div className="glass rounded-2xl p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
        <Users className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <p className="font-display font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

  const body = () => {
    if (!signedIn) {
      return empty(
        "Sign in to see your friends.",
        "Your friends list is only yours.",
        <Button className="h-11 w-full rounded-xl" onClick={() => navigate("/profile")}>
          Sign in
        </Button>,
      );
    }
    if (isError) {
      return (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your friends. Check your connection and try again.
          </p>
          <Button
            variant="secondary"
            className="mt-4 h-11 rounded-xl"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      );
    }
    if (shown.length === 0) {
      return empty(
        term ? "No one by that name." : "No friends yet.",
        term
          ? "Try a different name or handle."
          : "Add people from Social — search a handle, or share yours.",
        term ? undefined : (
          <Button variant="secondary" className="h-11 rounded-xl" onClick={() => navigate("/social")}>
            <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" /> Find friends
          </Button>
        ),
      );
    }
    return (
      <div className="glass divide-y divide-border/60 rounded-2xl px-4">
        {shown.map((f) => (
          <FriendRow key={f.rowId} rowId={f.rowId} profile={f.profile} />
        ))}
      </div>
    );
  };

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {back}
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Friends{friends.length ? ` · ${friends.length}` : ""}
      </h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Requests and search live in Social.
      </p>

      {signedIn && friends.length > 0 && (
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your friends"
          className="mb-4 h-11 rounded-xl"
          aria-label="Search your friends"
        />
      )}

      {body()}
    </section>
  );
};

export default Friends;
