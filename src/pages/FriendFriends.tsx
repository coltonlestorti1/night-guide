/**
 * Someone else's friends — /u/:username/friends.
 *
 * Read-only by construction, the same way FriendList is: the rows here are
 * plain links to profiles, never FriendRow, because FriendRow carries remove
 * and block actions that belong to YOUR friendships. Nothing on this page can
 * write to another person's social graph.
 *
 * ⚠️ THE ORACLE THIS SITS NEXT TO. On 2026-08-10 a security review found
 * are_friends(a, b) granted to authenticated — a pairwise oracle that let any
 * signed-in user reconstruct the app's entire friendship graph. This page is
 * the deliberate, scoped opposite: one gated function, answering only about
 * someone you are ALREADY friends with. Nothing here filters client-side; the
 * function returns zero rows to anyone else.
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useProfileByUsername } from "@/hooks/useFriends";
import { useFriendFriendList, useFriendProfileStats } from "@/hooks/useFriendList";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const FriendFriends = () => {
  const navigate = useNavigate();
  const { username = "" } = useParams();
  const handle = username.replace(/^@/, "").toLowerCase();
  const signedIn = useAuthStore((s) => s.status) === "signedIn";
  const authLoading = useAuthStore((s) => s.status) === "loading";
  const myId = useAuthStore((s) => s.session?.user.id);

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useProfileByUsername(signedIn ? handle : undefined);
  const {
    data: people,
    isLoading: listLoading,
    isError: listError,
  } = useFriendFriendList(profile?.id);
  // Already cached from their profile page. Distinguishes "we are friends and
  // they have no one" from "you cannot see this", which the list call alone
  // cannot — it answers both with zero rows on purpose.
  const { data: stats } = useFriendProfileStats(profile?.id);

  const name = profile?.display_name || (profile ? `@${profile.username}` : "");
  // authLoading counts as loading: status starts at "loading" while the session
  // is fetched, and treating that as signed-out flashes the sign-in prompt at a
  // signed-in user every cold load and refresh.
  const loading = authLoading || profileLoading || listLoading;
  const isError = profileError || listError;

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="mb-3 -ml-2 rounded-xl text-muted-foreground"
      onClick={() =>
        window.history.length > 1 ? navigate(-1) : navigate(`/u/${handle}`)
      }
    >
      <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
    </Button>
  );

  const empty = (title: string, body: string) => (
    <div className="glass rounded-2xl p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
        <Users className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <p className="font-display font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
    </div>
  );

  const body = () => {
    // Order matters: loading before signed-out, or a cold load renders the
    // sign-in prompt before the session resolves.
    if (loading)
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      );
    if (!signedIn) return empty("Sign in to see this.", "Friends lists are friends only.");
    // A failed fetch must never be reported as "they aren't your friend" or
    // "no such user" — both are claims about a person, made on the evidence of
    // a dropped request.
    if (isError)
      return empty("Couldn't load that list.", "Check your connection and try again.");
    if (!profile) return empty("No one by that handle.", `@${handle} doesn't exist.`);
    if (!people?.length)
      // `stats` is non-null only for someone allowed to see this, so a friend
      // gets the truthful empty message. For everyone else the message stays
      // ambiguous on purpose: the list call answers "not your friend" and "has
      // no friends" with the same zero rows, and telling them apart would leak
      // whether a stranger has friends at all.
      return stats
        ? empty("No friends yet.", `${name} hasn't added anyone.`)
        : empty("Nothing to see here.", "Friends lists are friends only.");

    return (
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => navigate(p.id === myId ? "/profile" : `/u/${p.username}`)}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              aria-label={`View @${p.username}'s profile`}
            >
              <ProfileAvatar profile={p} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {p.display_name || `@${p.username}`}
                </span>
                {p.display_name && (
                  <span className="block truncate text-xs text-muted-foreground">
                    @{p.username}
                  </span>
                )}
              </span>
              {/* You will be on this list whenever you are viewing a friend's
                  friends. Saying so is friendlier than silently linking your
                  own row somewhere different from every other row. */}
              {p.id === myId && (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">You</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {back}
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {name ? `${name}'s friends` : "Their friends"}
      </h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Who they go out with.</p>
      {body()}
    </section>
  );
};

export default FriendFriends;
