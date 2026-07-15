/**
 * /welcome/location — the location-permission step of onboarding.
 *
 * Shown once, right after a new user claims their username and before they
 * land on the map. First-class but fully skippable: "Not now" and a denied
 * browser prompt both fall through to the map, so location never blocks entry.
 *
 * Rendered OUTSIDE AppLayout (like /welcome). It deliberately does NOT bounce
 * signed-in users — signed-in IS the expected state here. Anyone who somehow
 * arrives without a finished profile is sent back to the right place.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useLocationStore } from "@/store/location";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { MapPin, Loader2, Lock } from "lucide-react";

const LocationPrimer = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const request = useLocationStore((s) => s.request);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("location_primer_view");
  }, []);

  // Keep the step in its lane: only a signed-in user mid-onboarding belongs
  // here. Signed-in is expected — never bounce it.
  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  const enable = async () => {
    setBusy(true);
    // request() resolves to coords on grant, null on deny/unsupported.
    // Either way we proceed — a denied prompt must not trap the user here.
    await request();
    track("location_primer_result", { status: useLocationStore.getState().status });
    navigate("/", { replace: true });
  };

  const skip = () => {
    track("location_primer_skip");
    navigate("/", { replace: true });
  };

  return (
    <main className="relative min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* ambient glow — matches the /join landing */}
      <div
        className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 h-[55vh] w-[55vh] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm mx-auto animate-fade-in">
        <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-6 shadow-glow">
          <MapPin className="h-7 w-7 text-primary" />
        </div>

        <h1 className="text-3xl font-display font-bold tracking-tight">
          See what's live around you.
        </h1>
        <p className="mt-3 text-base leading-snug text-muted-foreground">
          Turn on location and the map opens on your block — sorted by what's
          closest and busiest right now. No more guessing which way to walk.
        </p>

        <div className="mt-6 flex items-start gap-2.5 rounded-2xl glass p-4">
          <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your location stays on your phone. ENDZ uses it to center the map and
            measure distance — it's never sent to our servers or shown to anyone.
            You only show up on the map when you check in.
          </p>
        </div>

        <div className="mt-8 space-y-2">
          <Button
            onClick={enable}
            disabled={busy}
            className="w-full h-12 rounded-xl text-base font-semibold shadow-glow"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Turn on location"}
          </Button>
          <Button
            onClick={skip}
            disabled={busy}
            variant="ghost"
            className="w-full h-11 rounded-xl text-muted-foreground"
          >
            Not now
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/80 text-center">
          You can turn this on any time from the map.
        </p>
      </div>
    </main>
  );
};

export default LocationPrimer;
