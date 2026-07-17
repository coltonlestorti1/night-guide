import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVenues } from "@/hooks/useVenues";
import HappyHourRail from "@/components/HappyHourRail";
import WeekendFavorites from "@/components/WeekendFavorites";
import { Skeleton } from "@/components/ui/skeleton";
import { MoonStar, Sparkles, Wine } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "happy", label: "Happy Hours", Icon: Wine },
  { key: "weekend", label: "Weekend Favorites", Icon: MoonStar },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const Discover = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useVenues({});
  const [tab, setTab] = useState<TabKey>("happy");

  return (
    <section className="relative container pt-6 pb-24 max-w-lg">
      {/* Ambient light spill — same device as /join, tinted to the lineup */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-12 h-56 opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(ellipse 70% 100% at 18% 0%, hsl(var(--trending)) 0%, transparent 65%)" }}
      />

      <header className="relative mb-6 animate-fade-in">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
          Tonight&apos;s lineup
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where to go out in the East Village.</p>
      </header>

      <div className="relative flex gap-1 p-1 rounded-2xl glass mb-5">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === key
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : data && data.length ? (
        <div key={tab} className="relative animate-fade-in">
          {tab === "happy" ? (
            <HappyHourRail venues={data} onPick={(v) => navigate(`/venue/${v.id}`)} showHeading={false} />
          ) : (
            <WeekendFavorites venues={data} onPick={(v) => navigate(`/venue/${v.id}`)} />
          )}
        </div>
      ) : (
        <div className="relative text-center glass rounded-3xl p-8 animate-fade-in">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
            <Sparkles className="h-6 w-6 text-amber-700" />
          </div>
          <p className="font-display font-bold">No venues yet.</p>
          <p className="text-sm text-muted-foreground mt-1">The lineup is loading up — check back soon.</p>
        </div>
      )}
    </section>
  );
};

export default Discover;
