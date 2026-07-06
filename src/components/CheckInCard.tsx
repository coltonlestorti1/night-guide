/**
 * The core-loop control: every auth/check-in state for one venue.
 * Optimistic — the UI flips on tap; failures revert with an inline note.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useMyCheckIn, useVenueActivity } from "@/hooks/useCheckIns";
import { checkIn, checkOut, setVibe, pokeActivity, Vibe } from "@/lib/checkins";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIBES: { value: Vibe; label: string }[] = [
  { value: "chill", label: "😌 Chill" },
  { value: "building", label: "📈 Building" },
  { value: "packed", label: "🔥 Packed" },
];

export default function CheckInCard({ venueId }: { venueId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: mine } = useMyCheckIn();
  const { data: activity } = useVenueActivity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hereCount = activity?.[venueId]?.count ?? 0;
  const hereVibe = activity?.[venueId]?.vibe ?? null;
  const checkedInHere = mine?.venue_id === venueId;
  const checkedInElsewhere = !!mine && !checkedInHere;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["my-check-in"] });
    queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
  };

  const doCheckIn = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    // Optimistic: flip both caches immediately
    queryClient.setQueryData(["my-check-in", userId], {
      id: "optimistic",
      venue_id: venueId,
      vibe: null,
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    });
    try {
      await checkIn(userId, venueId);
      pokeActivity();
    } catch {
      setError("That didn't go through — try again.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  const doCheckOut = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    queryClient.setQueryData(["my-check-in", userId], null);
    try {
      await checkOut(userId);
      pokeActivity();
    } catch {
      setError("That didn't go through — try again.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  const doVibe = async (vibe: Vibe) => {
    if (!mine || mine.id === "optimistic" || busy) return;
    setError("");
    try {
      await setVibe(mine.id, vibe);
      pokeActivity();
    } catch {
      setError("Vibe didn't save — try again.");
    } finally {
      refresh();
    }
  };

  const untilLabel = mine?.expires_at
    ? new Date(mine.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div className="mt-4 min-h-[88px]">
      {hereCount > 0 && (
        <p className="text-sm font-medium text-primary mb-2">
          {hereCount} here now{hereVibe ? ` · ${VIBES.find((v) => v.value === hereVibe)?.label}` : ""}
        </p>
      )}

      {status !== "signedIn" ? (
        <Button className="w-full h-12 rounded-xl" onClick={() => navigate("/profile")}>
          Sign in to check in
        </Button>
      ) : checkedInHere ? (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="font-semibold">You're here ✓ <span className="text-xs text-muted-foreground font-normal">until ~{untilLabel}</span></p>
            <button onClick={doCheckOut} className="text-xs text-muted-foreground underline hover:text-foreground">
              Check out
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {VIBES.map((v) => (
              <button
                key={v.value}
                onClick={() => doVibe(v.value)}
                className={cn(
                  "flex-1 text-xs px-2 py-2 rounded-xl border transition-colors",
                  mine?.vibe === v.value
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-secondary/60 border-border hover:bg-secondary"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Button className="w-full h-12 rounded-xl" disabled={busy} onClick={doCheckIn}>
          {checkedInElsewhere ? "Check in here instead" : "Check in"}
        </Button>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
