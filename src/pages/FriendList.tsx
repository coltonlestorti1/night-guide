/**
 * Someone else's ranked list — /u/:username/been.
 *
 * Read-only by construction: no row menus, no rate button, nothing that could
 * write to another person's ratings. The rows are the same VenueListRow the
 * owner's /lists uses, so a friend's list looks like your own.
 *
 * The whole list is shown, tail included. Truncating the low end was
 * considered and rejected (Colton, 2026-08-10): this is friends-only rather
 * than public, and if people believe the bottom of their list is hidden they
 * rate differently — which quietly poisons the recommendations that read those
 * same ratings.
 */
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useProfileByUsername } from "@/hooks/useFriends";
import { useFriendProfileStats, useFriendRankedList } from "@/hooks/useFriendList";
import { useVenues } from "@/hooks/useVenues";
import { beenList } from "@/lib/night/lists";
import VenueListRow from "@/components/lists/VenueListRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const FriendList = () => {
  const navigate = useNavigate();
  const { username = "" } = useParams();
  const handle = username.replace(/^@/, "").toLowerCase();
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  const authLoading = useAuthStore((s) => s.status) === "loading";
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useProfileByUsername(signedIn ? handle : undefined);
  const {
    data: ratings,
    isLoading: listLoading,
    isError: listError,
  } = useFriendRankedList(profile?.id);
  const { data: venues, isLoading: venuesLoading, isError: venuesError } = useVenues({});
  // Already cached from their profile page. Distinguishes "we are friends and
  // they have rated nothing" from "you cannot see this", which the list call
  // alone cannot — it answers both with zero rows on purpose.
  const { data: stats } = useFriendProfileStats(profile?.id);

  const entries = useMemo(() => beenList(ratings, venues ?? []), [ratings, venues]);
  const name = profile?.display_name || (profile ? `@${profile.username}` : "");
  // authLoading counts as loading: status starts at "loading" while the session
  // is fetched, and treating that as signed-out flashes the sign-in prompt at a
  // signed-in user every cold load and refresh.
  const loading = authLoading || profileLoading || listLoading || venuesLoading;
  const isError = profileError || listError || venuesError;

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
        <Star className="h-5 w-5 text-primary" aria-hidden="true" />
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
    if (!signedIn) return empty("Sign in to see this list.", "Ranked lists are friends only.");
    // A failed fetch must never be reported as "they aren't your friend" or
    // "no such user" — both are claims about a person, made on the evidence of
    // a dropped request.
    if (isError)
      return empty("Couldn't load that list.", "Check your connection and try again.");
    if (!profile) return empty("No one by that handle.", `@${handle} doesn't exist.`);
    if (entries.length === 0)
      // `stats` is non-null only for someone allowed to see this list, so a
      // friend gets the truthful empty message. For everyone else the message
      // stays ambiguous on purpose: the list call answers "not your friend" and
      // "rated nothing" with the same zero rows, and telling them apart would
      // leak that a stranger has a list at all.
      return stats
        ? empty("No rankings yet.", `${name} hasn't ranked anywhere.`)
        : empty("Nothing to see here.", "Ranked lists are friends only.");

    return (
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
        {entries.map((e) => (
          <VenueListRow
            key={e.venue.id}
            venue={e.venue}
            rank={e.position}
            score={e.score}
            bucket={e.bucket}
          />
        ))}
      </ul>
    );
  };

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {back}
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {name ? `${name}'s list` : "Their list"}
      </h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Where they&apos;ve been, best first.
      </p>
      {body()}
    </section>
  );
};

export default FriendList;
