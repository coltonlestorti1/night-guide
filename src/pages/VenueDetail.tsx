import { useParams } from "react-router-dom";
import { useVenue } from "@/hooks/useVenue";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAgeRange, formatPriceLevel } from "@/lib/format";

const VenueDetail = () => {
  const { id } = useParams();
  const { data, isLoading } = useVenue(id);
  return (
    <section className="container pt-6 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{data?.title ?? "Venue"}</h1>
        {data?.venue_type_primary && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
            {data.venue_type_primary.replace(/_/g, " ")}
          </span>
        )}
      </header>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : data ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground">Age</div>
              <div className="font-medium">{formatAgeRange(data)}</div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground">Price</div>
              <div className="font-medium">{formatPriceLevel(data.avg_price_level ?? null)}</div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground">Music</div>
              <div className="font-medium">{data.music_type ?? "Not provided"}</div>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="text-xs text-muted-foreground">Dress</div>
              <div className="font-medium">Not provided</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center bg-card border rounded-lg p-6">
          <p className="text-muted-foreground">Venue not found.</p>
        </div>
      )}
    </section>
  );
};

export default VenueDetail;
