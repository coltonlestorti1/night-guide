/**
 * "Looks like you're at {venue} — check in?" prompt raised by out-tonight mode.
 * Check in reuses the normal check-in action (feeds friend map + live counts).
 * "Not here" reveals the next-nearest venues so a dense-block miss is one tap
 * to fix. Nothing public happens unless the user taps Check in.
 */
import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useOutTonightStore } from "@/store/outTonight";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/location";
import { useVenues } from "@/hooks/useVenues";
import { rankNearby } from "@/lib/venueProximity";
import { checkIn, pokeActivity, getStoredVisibility } from "@/lib/checkins";
import { logEvent } from "@/lib/analytics";
import type { Venue } from "@/data/types";

export default function OutTonightPrompt() {
  const promptVenue = useOutTonightStore((s) => s.promptVenue);
  const dismissPrompt = useOutTonightStore((s) => s.dismissPrompt);
  const userId = useAuthStore((s) => s.session?.user.id);
  const coords = useLocationStore((s) => s.coords);
  const { data: venues } = useVenues({});
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pickOther, setPickOther] = useState(false);

  if (!promptVenue || !userId) return null;

  const doCheckIn = async (venue: Venue) => {
    if (busy) return;
    setBusy(true);
    const visibility = getStoredVisibility();
    const prev = queryClient.getQueryData(["my-check-in", userId]);
    queryClient.setQueryData(["my-check-in", userId], {
      id: "optimistic", venue_id: venue.id, vibe: null,
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    });
    try {
      await checkIn(userId, venue.id, visibility);
      logEvent("out_tonight_checkin_confirmed", { venue_id: venue.id, visibility });
      pokeActivity();
      useOutTonightStore.getState().dismissPrompt();
      setPickOther(false);
    } catch {
      queryClient.setQueryData(["my-check-in", userId], prev);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["my-check-in"] });
      queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
      setBusy(false);
    }
  };

  const nearby = coords && venues ? rankNearby(coords, venues).slice(0, 3) : [];

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,26rem)]">
      <div className="glass rounded-2xl p-4 shadow-glow animate-fade-in">
        <button
          onClick={() => { dismissPrompt(); setPickOther(false); }}
          className="absolute right-3 top-3 text-muted-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        {!pickOther ? (
          <>
            <div className="flex items-center gap-2 font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              Looks like you're at {promptVenue.title}
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-3">Check in?</p>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" disabled={busy} onClick={() => doCheckIn(promptVenue)}>
                Check in
              </Button>
              <Button variant="secondary" className="rounded-xl" disabled={busy} onClick={() => setPickOther(true)}>
                Not here
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="font-medium mb-2">Where are you?</div>
            <div className="grid gap-2">
              {nearby.map(({ venue }) => (
                <Button key={venue.id} variant="secondary" className="justify-start rounded-xl" disabled={busy} onClick={() => doCheckIn(venue)}>
                  {venue.title}
                </Button>
              ))}
              <Button variant="ghost" className="rounded-xl" onClick={() => { dismissPrompt(); setPickOther(false); }}>
                None of these
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
