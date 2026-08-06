/**
 * Onboarding step 3 — favorite spots.
 *
 * Picks are written as real saves, so the friend facepile and Saved Spots are
 * non-empty on day one. Framing is present/aspirational ("your spots"), not
 * past-tense: the autumn beachhead is students new to the East Village, and
 * "pick your favorites" collects nothing from them.
 *
 * No minimum and no maximum — a forced minimum produces random taps.
 * Everything here is skippable and nothing may block signup.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveDataSource } from "@/data/resolver";
import { addSave, getSaveVisibility } from "@/lib/saves";
import { addVenueRequests, dedupeHits, type PlaceHit } from "@/lib/venueRequests";
import { usePlacesSearch } from "@/hooks/usePlacesSearch";
import { logEvent } from "@/lib/analytics";

const PickSpots = () => {
  const navigate = useNavigate();
  const { status, session } = useAuthStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [requests, setRequests] = useState<PlaceHit[]>([]);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { results, loading, unavailable } = usePlacesSearch(query);

  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  // getVenues, not listVenues — see src/data/sources/DataSource.ts:5. An empty
  // query returns the full active set, which is what this grid wants.
  const { data: venues = [] } = useQuery({
    queryKey: ["venues", "onboarding"],
    queryFn: ({ signal }) => resolveDataSource().getVenues({}, signal),
  });

  const fresh = useMemo(
    () => dedupeHits(results, requests.map((r) => r.placeId)),
    [results, requests]
  );

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /**
   * Never blocks. A failed save is retried on next app open; getting the user
   * to the map matters more than a complete first batch.
   */
  const finish = async () => {
    setSubmitting(true);
    if (session) {
      try {
        const visibility = await getSaveVisibility(session.user.id);
        await Promise.allSettled(picked.map((id) => addSave(session.user.id, id, visibility)));
        if (requests.length) await addVenueRequests(session.user.id, requests);
      } catch {
        // Intentionally swallowed — see the comment above.
      }
    }
    logEvent("onboarding_spots_completed", { picked: picked.length, requested: requests.length });
    navigate("/welcome/location", { replace: true });
  };

  const skip = () => {
    logEvent("onboarding_spots_skipped", {});
    navigate("/welcome/location", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-sm glass rounded-3xl p-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight">Which of these are your spots?</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Places you love or want to try. Pick a few — we'll save them for you.
        </p>

        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {venues.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => toggle(v.id)}
              aria-pressed={picked.includes(v.id)}
              className={cn(
                "h-11 rounded-xl border px-2 text-xs text-left truncate transition-colors",
                picked.includes(v.id)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {v.title}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-2 min-h-4">
          {picked.length === 0 ? "Three or so is plenty." : `${picked.length} saved.`}
        </p>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Somewhere we're missing?
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any bar"
            disabled={unavailable}
            className="h-11 text-base md:text-sm"
          />
          {unavailable && (
            <p className="text-xs text-muted-foreground mt-2">
              Search unavailable — you can add spots later.
            </p>
          )}
          {loading && <p className="text-xs text-muted-foreground mt-2">Searching…</p>}
          {fresh.map((h) => (
            <button
              key={h.placeId}
              type="button"
              onClick={() => {
                setRequests((r) => [...r, h]);
                setQuery("");
              }}
              className="w-full text-left mt-2 rounded-xl border border-border px-3 py-2"
            >
              <span className="text-sm">{h.name}</span>
              {h.address && <span className="block text-xs text-muted-foreground">{h.address}</span>}
            </button>
          ))}
          {requests.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Added: {requests.map((r) => r.name).join(", ")}
            </p>
          )}
        </div>

        <Button onClick={finish} disabled={submitting} className="w-full h-11 rounded-xl mt-5">
          {submitting ? "Saving…" : "Done"}
        </Button>
        <button
          type="button"
          onClick={skip}
          className="w-full text-center text-sm text-muted-foreground mt-3"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default PickSpots;
