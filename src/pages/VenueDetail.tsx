/**
 * Standalone venue page. A thin container around VenuePreview — the same
 * component the map sheet uses, opened expanded with a back glyph.
 *
 * It deliberately renders no hero, no stat tiles and no action bar of its own:
 * VenuePreview already owns all three, and this page previously duplicated
 * them, which is the duplication the §19 slice-1 merge removed.
 *
 * Reached from Discover (happy hours, weekend favorites), Saved spots, and
 * plan links. The map no longer navigates here at all — its sheet expands in
 * place — so the old back-button special case that reopened the map sheet is
 * gone, and back is plain history-back for every remaining entry point.
 */
import { useNavigate, useParams } from "react-router-dom";
import { useVenue } from "@/hooks/useVenue";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import VenuePreview from "@/components/VenuePreview";

const VenueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useVenue(id);

  return (
    <section aria-label="Venue" className="pb-24">
      {isLoading ? (
        <div className="container pt-4 space-y-3 max-w-2xl">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data ? (
        <div className="max-w-2xl mx-auto w-full">
          <VenuePreview
            venue={data}
            onClose={() => navigate(-1)}
            defaultExpanded
            closeIcon="back"
          />
        </div>
      ) : (
        <div className="container pt-10">
          <div className="text-center bg-card border rounded-xl p-8">
            <p className="text-muted-foreground">Venue not found.</p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate("/")}>
              Back to map
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default VenueDetail;
