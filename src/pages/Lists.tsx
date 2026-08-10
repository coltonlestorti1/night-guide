/**
 * Your lists — Been (ranked, scored) and Want to try (saved).
 *
 * Reached from the profile stat row, not from the bottom bar: four tabs is
 * already the right number for a phone. The active tab lives in the URL so the
 * stat row can deep-link to either one and back behaves.
 *
 * Been is a flat list ordered best-first. It is not grouped by bucket — the
 * bands guarantee the order already, and headers would turn one ranking into
 * three short ones.
 *
 * Everything here is the signed-in user's own data. venue_ratings is owner-only
 * at the RLS level and nothing on this page reads anyone else's.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Compass, Star } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings } from "@/hooks/useMyRatings";
import { useSaves } from "@/hooks/useSaves";
import { beenList } from "@/lib/night/lists";
import { venueMatches } from "@/lib/searchMatch";
import VenueListRow from "@/components/lists/VenueListRow";
import ListRowMenu from "@/components/lists/ListRowMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "been" | "saved";

const Empty = ({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) => (
  <div className="glass rounded-2xl p-6 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
      {icon}
    </div>
    <p className="font-display font-bold text-sm">{title}</p>
    <p className="text-xs text-muted-foreground mt-1">{body}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const Lists = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "saved" ? "saved" : "been";
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  const {
    data: ratings,
    isLoading: ratingsLoading,
    isError: ratingsError,
    refetch: refetchRatings,
  } = useMyRatings();
  const {
    data: venues,
    isLoading: venuesLoading,
    isError: venuesError,
    refetch: refetchVenues,
  } = useVenues({});
  const savedIds = useSaves().ids;

  const [q, setQ] = useState("");

  const been = useMemo(() => beenList(ratings, venues ?? []), [ratings, venues]);
  const saved = useMemo(() => {
    const byId = new Map((venues ?? []).map((v) => [v.id, v]));
    // Saved ids that no longer resolve (deactivated venue) are dropped rather
    // than rendered as blank rows — same rule beenList applies to ratings.
    return savedIds.map((id) => byId.get(id)).filter((v) => v !== undefined);
  }, [savedIds, venues]);

  const shownBeen = been.filter((e) => venueMatches(e.venue, q));
  const shownSaved = saved.filter((v) => venueMatches(v, q));

  // A failed ratings fetch must never render as "you haven't ranked anywhere" —
  // that reads as data loss on a list the user knows has thirty venues in it.
  const isError = venuesError || (tab === "been" && signedIn && ratingsError);
  const loading = venuesLoading || (tab === "been" && signedIn && ratingsLoading);

  const body = () => {
    if (isError) {
      return (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your lists. Check your connection and try again.
          </p>
          <Button
            variant="secondary"
            className="mt-4 h-11 rounded-xl"
            onClick={() => {
              void refetchVenues();
              void refetchRatings();
            }}
          >
            Try again
          </Button>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      );
    }

    if (tab === "been") {
      if (!signedIn) {
        return (
          <Empty
            icon={<Star className="h-5 w-5 text-primary" aria-hidden="true" />}
            title="Sign in to see your rankings."
            body="Your list stays private to you."
            action={
              <Button className="h-11 w-full rounded-xl" onClick={() => navigate("/profile")}>
                Sign in
              </Button>
            }
          />
        );
      }
      if (shownBeen.length === 0) {
        return (
          <Empty
            icon={<Star className="h-5 w-5 text-primary" aria-hidden="true" />}
            title={q ? "Nothing matches that." : "You haven't ranked anywhere yet."}
            body={
              q
                ? "Try a different name."
                : "Open a spot you've been to and rate it — it lands here."
            }
            action={
              q ? undefined : (
                <Button
                  variant="secondary"
                  className="h-11 rounded-xl"
                  onClick={() => navigate("/discover")}
                >
                  <Compass className="h-4 w-4 mr-2" aria-hidden="true" /> Find a spot
                </Button>
              )
            }
          />
        );
      }
      return (
        <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
          {shownBeen.map((e) => (
            <VenueListRow
              key={e.venue.id}
              venue={e.venue}
              rank={e.position}
              score={e.score}
              bucket={e.bucket}
              trailing={<ListRowMenu venue={e.venue} bucket={e.bucket} />}
            />
          ))}
        </ul>
      );
    }

    if (shownSaved.length === 0) {
      return (
        <Empty
          icon={<Bookmark className="h-5 w-5 text-primary" aria-hidden="true" />}
          title={q ? "Nothing matches that." : "No saved spots yet."}
          body={
            q ? "Try a different name." : "Tap the bookmark on any venue to save it for later."
          }
          action={
            q ? undefined : (
              <Button
                variant="secondary"
                className="h-11 rounded-xl"
                onClick={() => navigate("/discover")}
              >
                <Compass className="h-4 w-4 mr-2" aria-hidden="true" /> Find a spot
              </Button>
            )
          }
        />
      );
    }
    return (
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
        {shownSaved.map((venue) => (
          <VenueListRow
            key={venue.id}
            venue={venue}
            trailing={signedIn ? <ListRowMenu venue={venue} /> : undefined}
          />
        ))}
      </ul>
    );
  };

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2 rounded-xl text-muted-foreground"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}
      >
        <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
      </Button>

      <h1 className="font-display text-3xl font-bold tracking-tight">Your lists</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Scores are out of 10, best first. Only you can see them.
      </p>

      {/* Sticky: the tabs are the page's main control, and scrolling forty
          venues to switch lists puts them out of thumb reach. */}
      <div className="sticky top-0 z-10 -mx-1 bg-background/85 px-1 pb-3 pt-1 backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          {(["been", "saved"] as Tab[]).map((t) => (
            <Button
              key={t}
              variant={tab === t ? "default" : "secondary"}
              aria-pressed={tab === t}
              onClick={() => setParams({ tab: t }, { replace: true })}
              className={cn("h-11 rounded-xl text-sm font-semibold")}
            >
              {t === "been"
                ? `Been${been.length ? ` · ${been.length}` : ""}`
                : `Want to try${saved.length ? ` · ${saved.length}` : ""}`}
            </Button>
          ))}
        </div>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your list"
          className="mt-2 h-11 rounded-xl"
          aria-label="Search your list"
        />
      </div>

      {body()}
    </section>
  );
};

export default Lists;
