import { useNavigate } from "react-router-dom";
import { useVenues } from "@/hooks/useVenues";
import BarCard from "@/components/BarCard";
import { Skeleton } from "@/components/ui/skeleton";

const Discover = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useVenues({});
  return (
    <section className="container pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-sm text-muted-foreground">Browse trending spots</p>
      </header>
      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : data && data.length ? (
        <div className="space-y-3">
          {data.map((v) => (
            <BarCard key={v.id} venue={v} onClick={() => navigate(`/discover?venue=${v.id}`)} />
          ))}
        </div>
      ) : (
        <div className="text-center bg-card border rounded-lg p-6">
          <p className="text-muted-foreground">Nothing to show yet. Connect data sources.</p>
        </div>
      )}
    </section>
  );
};

export default Discover;
