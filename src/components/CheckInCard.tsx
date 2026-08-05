/**
 * The core-loop control: every auth/check-in state for one venue.
 * Optimistic — the UI flips on tap; failures revert with an inline note.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useMyCheckIn, useVenueActivity } from "@/hooks/useCheckIns";
import {
  checkIn, checkOut, setVibe, setRecommend, pokeActivity, Vibe, VIBE_LABELS,
  Recommend, RECOMMEND_LABELS,
  CheckinVisibility as Visibility, getStoredVisibility, storeVisibility,
} from "@/lib/checkins";
import CheckInVisibility from "@/components/CheckInVisibility";
import { Button } from "@/components/ui/button";
import { logEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const VIBES: { value: Vibe; label: string }[] = (
  Object.keys(VIBE_LABELS) as Vibe[]
).map((value) => ({ value, label: VIBE_LABELS[value] }));

export default function CheckInCard({ venueId }: { venueId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: mine } = useMyCheckIn();
  const { data: activity } = useVenueActivity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(getStoredVisibility);
  const [recommend, setRecommendState] = useState<Recommend | null>(null);
  const [vibePick, setVibePick] = useState<Vibe | null>(null);
  // The saved answer wins until the user taps: otherwise a reload silently
  // loses the selection even though the row still holds it.
  const shownRecommend = recommend ?? mine?.would_recommend ?? null;
  // Same rule for vibe, and it's what makes the tap feel instant: the local
  // pick paints immediately, the server value takes over once it lands.
  const shownVibe = vibePick ?? mine?.vibe ?? null;

  const changeVisibility = (v: Visibility) => {
    setVisibility(v);
    storeVisibility(v); // last choice becomes the new default
  };

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
    // A new check-in is a new report: don't carry the last venue's answers over.
    setVibePick(null);
    setRecommendState(null);
    // Optimistic: flip the cache immediately; snapshot for synchronous revert on failure
    const prev = queryClient.getQueryData(["my-check-in", userId]);
    queryClient.setQueryData(["my-check-in", userId], {
      id: "optimistic",
      venue_id: venueId,
      vibe: null,
      would_recommend: null,
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    });
    try {
      await checkIn(userId, venueId, visibility);
      logEvent("check_in", { venue_id: venueId, visibility });
      pokeActivity();
    } catch {
      queryClient.setQueryData(["my-check-in", userId], prev);
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
    setVibePick(null);
    setRecommendState(null);
    // Optimistic: flip the cache immediately; snapshot for synchronous revert on failure
    const prev = queryClient.getQueryData(["my-check-in", userId]);
    queryClient.setQueryData(["my-check-in", userId], null);
    try {
      await checkOut(userId);
      logEvent("check_out", { venue_id: venueId });
      pokeActivity();
    } catch {
      queryClient.setQueryData(["my-check-in", userId], prev);
      setError("That didn't go through — try again.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  /**
   * The single most important write in the app — this is the live data every
   * other user reads. Paint the selection before the network call so the tap
   * never feels dead on a bar's wifi, and revert loudly if it doesn't save.
   */
  const doVibe = async (vibe: Vibe) => {
    if (!mine || mine.id === "optimistic" || busy) return;
    const prevPick = shownVibe;
    setVibePick(vibe);
    setError("");
    try {
      await setVibe(mine.id, vibe);
      logEvent("vibe_set", { venue_id: venueId, vibe });
      pokeActivity();
    } catch {
      setVibePick(prevPick);
      setError("Vibe didn't save — try again.");
    } finally {
      refresh();
    }
  };

  /**
   * "Would you send friends here right now?" — recommendation quality, kept
   * separate from crowd level on purpose. A packed room is not automatically
   * a good recommendation.
   */
  const doRecommend = async (value: Recommend) => {
    if (!mine || mine.id === "optimistic") return;
    setRecommendState(value);
    try {
      await setRecommend(mine.id, value);
      logEvent("recommend_set", { venue_id: venueId, value });
    } catch {
      setRecommendState(null);
      setError("That didn't save — try again.");
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

      {status === "needsUsername" ? (
        <Button className="w-full h-12 rounded-xl" onClick={() => navigate("/welcome")}>
          Finish setup to check in
        </Button>
      ) : status !== "signedIn" ? (
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
          <p className="text-xs text-muted-foreground mt-3 mb-1.5">How is it right now?</p>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => doVibe(v.value)}
                aria-pressed={shownVibe === v.value}
                disabled={!mine || mine.id === "optimistic"}
                className={cn(
                  "flex-1 min-w-[92px] text-xs font-medium px-2 py-2 rounded-xl border",
                  "transition-all duration-150 active:scale-[0.97] disabled:opacity-50",
                  shownVibe === v.value
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-secondary/60 border-border hover:bg-secondary"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {shownVibe && (
            <div className="mt-3 animate-fade-in">
              <p className="text-xs text-muted-foreground mb-1.5">
                Would you send friends here right now?
              </p>
              <div className="flex gap-2">
                {(Object.keys(RECOMMEND_LABELS) as Recommend[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => doRecommend(r)}
                    aria-pressed={shownRecommend === r}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium",
                      "transition-all duration-150 active:scale-[0.97]",
                      shownRecommend === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-accent/30",
                    )}
                  >
                    {RECOMMEND_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Button className="w-full h-12 rounded-xl" disabled={busy} onClick={doCheckIn}>
            {checkedInElsewhere ? "Check in here instead" : "Check in"}
          </Button>
          <CheckInVisibility value={visibility} onChange={changeVisibility} />
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
