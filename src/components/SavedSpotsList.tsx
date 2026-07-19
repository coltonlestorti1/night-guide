import { useNavigate } from "react-router-dom";
import { Bookmark, ChevronRight } from "lucide-react";
import { useVenues } from "@/hooks/useVenues";
import { useSavedStore } from "@/store/saved";
import { venueImageSrc } from "@/lib/venueImages";
import { Skeleton } from "@/components/ui/skeleton";

const EmptyState = () => (
  <div className="glass rounded-2xl p-6 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
      <Bookmark className="h-5 w-5 text-primary" aria-hidden="true" />
    </div>
    <p className="font-display font-bold text-sm">No saved spots yet.</p>
    <p className="text-xs text-muted-foreground mt-1">
      Tap the bookmark on any venue to save it for later.
    </p>
  </div>
);

/** Profile section body: the venues you've bookmarked, in save order. */
const SavedSpotsList = () => {
  const navigate = useNavigate();
  const ids = useSavedStore((s) => s.ids);
  const { data: venues, isLoading, isError } = useVenues({});

  if (ids.length === 0) return <EmptyState />;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {ids.slice(0, 3).map((id) => (
          <Skeleton key={id} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn't load your saved spots. Check your connection and try again.
        </p>
      </div>
    );
  }

  const byId = new Map((venues ?? []).map((v) => [v.id, v]));
  const saved = ids.map((id) => byId.get(id)).filter((v) => v !== undefined);

  // Saved ids that no longer match any live venue (deactivated, data source
  // changed) shouldn't leave a bare bordered box on the page.
  if (saved.length === 0) return <EmptyState />;

  return (
    <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
      {saved.map((venue) => (
        <li key={venue.id}>
          <button
            type="button"
            onClick={() => navigate(`/venue/${venue.id}`)}
            className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={venueImageSrc(venue)}
              alt=""
              className="h-11 w-11 rounded-xl object-cover shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{venue.title}</span>
              {venue.neighborhood && (
                <span className="block truncate text-xs text-muted-foreground">
                  {venue.neighborhood}
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
};

export default SavedSpotsList;
