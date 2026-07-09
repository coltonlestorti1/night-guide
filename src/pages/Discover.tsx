import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVenues } from "@/hooks/useVenues";
import HappyHourRail from "@/components/HappyHourRail";
import WeekendFavorites from "@/components/WeekendFavorites";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "happy", label: "Happy Hours" },
  { key: "weekend", label: "Weekend Favorites" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const Discover = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useVenues({});
  const [tab, setTab] = useState<TabKey>("happy");

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
        <p className="text-sm text-muted-foreground">Where to go out in the East Village</p>
      </header>

      <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "flex-1 text-sm font-medium py-2 rounded-lg transition-colors",
              tab === key ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : data && data.length ? (
        tab === "happy" ? (
          <HappyHourRail venues={data} onPick={(v) => navigate(`/venue/${v.id}`)} showHeading={false} />
        ) : (
          <WeekendFavorites venues={data} onPick={(v) => navigate(`/venue/${v.id}`)} />
        )
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
