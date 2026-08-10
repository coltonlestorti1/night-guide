/**
 * Your lists — Been (ranked, scored) and Want to try (saved).
 *
 * Reached from the profile stat row, not from the bottom bar: four tabs is
 * already the right number for a phone.  The active tab lives in the URL so the
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
import { ArrowLeft, Bookmark, Star } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useVenues } from "@/hooks/useVenues";
import { useMyRatings } from "@/hooks/useMyRatings";
import { useSaves } from "@/hooks/useSaves";
import { beenList } from "@/lib/night/lists";
import { venueMatches } from "@/lib/searchMatch";
import VenueListRow from "@/components/lists/VenueListRow";
import BeenRowMenu from "@/components/lists/BeenRowMenu";
import PhotoLightbox from "@/components/PhotoLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "been" | "saved";

const Empty = ({ icon, title, body }: { icon: ReactNode; title: string; body: string }) => (
  <div className="glass rounded-2xl p-6 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
      {icon}
    </div>
    <p className="font-display font-bold text-sm">{title}</p>
    <p className="text-xs text-muted-foreground mt-1">{body}</p>
  </div>
);

const Lists = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "saved" ? "saved" : "been";
  const signedIn = useAuthStore((s) => s.status) === "signedIn";

  const { data: ratings, isLoading: ratingsLoading } = useMyRatings();
  const { data: venues, isLoading: venuesLoading, isError } = useVenues({});
  const savedIds = useSaves().ids;

  const [q, setQ] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const been = useMemo(() => beenList(ratings, venues ?? []), [ratings, venues]);
  const saved = useMemo(() => {
    const byId = new Map((venues ?? []).map((v) => [v.id, v]));
    // Saved ids that no longer resolve (deactivated venue) are dropped rather
    // than rendered as blank rows — same rule beenList applies to ratings.
    return savedIds.map((id) => byId.get(id)).filter((v) => v !== undefined);
  }, [savedIds, venues]);

  const shownBeen = been.filter((e) => venueMatches(e.venue, q));
  const shownSaved = saved.filter((v) => venueMatches(v, q));
  const loading = venuesLoading || (tab === "been" && signedIn && ratingsLoading);

  const onPhotoClick = (url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  };

  const body = () => {
    if (isError) {
      return (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your spots. Check your connection and try again.
          </p>
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
              onPhotoClick={onPhotoClick}
              trailing={
                <BeenRowMenu venue={e.venue} bucket={e.bucket} allRows={ratings ?? []} />
              }
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
        />
      );
    }
    return (
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
        {shownSaved.map((venue) => (
          <VenueListRow key={venue.id} venue={venue} onPhotoClick={onPhotoClick} />
        ))}
      </ul>
    );
  };

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 rounded-xl text-muted-foreground"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}
      >
        <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
      </Button>

      <h1 className="font-display text-3xl font-bold tracking-tight mb-4">Your lists</h1>

      <div role="tablist" aria-label="Your lists" className="mb-4 grid grid-cols-2 gap-2">
        {(["been", "saved"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams({ tab: t }, { replace: true })}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold transition-colors",
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70",
            )}
          >
            {t === "been"
              ? `Been${been.length ? ` · ${been.length}` : ""}`
              : `Want to try${saved.length ? ` · ${saved.length}` : ""}`}
          </button>
        ))}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your list"
        className="mb-4 h-11 rounded-xl"
        aria-label="Search your list"
      />

      {body()}

      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} alt={lightboxAlt} />
    </section>
  );
};

export default Lists;
