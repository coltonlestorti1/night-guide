import { useNavigate } from "react-router-dom";
import { useVenues } from "@/hooks/useVenues";
import BarCard from "@/components/BarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

const Discover = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useVenues({});

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
        <p className="text-sm text-muted-foreground">Trending nightlife in the East Village tonight</p>
      </header>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : data && data.length ? (
        <div className="space-y-3">
          {data.map((v) => (
            <BarCard key={v.id} venue={v} onClick={() => navigate(`/venue/${v.id}`)} />
          ))}
        </div>
      ) : (
        <div className="text-center glass rounded-2xl p-8">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No venues yet.</p>
        </div>
      )}
    </section>
  );
};

export default Discover;
