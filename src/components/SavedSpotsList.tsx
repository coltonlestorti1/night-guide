import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useVenues } from "@/hooks/useVenues";
import { useSaves } from "@/hooks/useSaves";
import { Skeleton } from "@/components/ui/skeleton";
import PhotoLightbox from "@/components/PhotoLightbox";
import VenueListRow from "@/components/lists/VenueListRow";

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
  const ids = useSaves().ids;
  const { data: venues, isLoading, isError } = useVenues({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

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
    <>
      <ul className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
        {saved.map((venue) => (
          <VenueListRow
            key={venue.id}
            venue={venue}
            onPhotoClick={(url, alt) => {
              setLightboxUrl(url);
              setLightboxAlt(alt);
            }}
          />
        ))}
      </ul>
      <PhotoLightbox
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
        alt={lightboxAlt}
      />
    </>
  );
};

export default SavedSpotsList;
