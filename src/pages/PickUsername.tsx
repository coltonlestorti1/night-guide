import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { getSupabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { USERNAME_RE, suggestUsername } from "@/lib/username";

type Availability = "idle" | "invalid" | "checking" | "available" | "taken";

const PickUsername = () => {
  const navigate = useNavigate();
  const { status, session, refreshProfile } = useAuthStore();
  const [username, setUsername] = useState(() => suggestUsername(useAuthStore.getState().session?.user.email));
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Set the instant we claim, so the redirect effect below doesn't race the
  // signedIn flip and yank us to "/" before the location step can show.
  const claimedRef = useRef(false);

  // Only makes sense mid-onboarding; bounce anyone else. A fresh claim routes
  // itself to the location step, so don't treat that signedIn flip as "already
  // onboarded, send to map."
  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "signedIn" && !claimedRef.current) navigate("/");
  }, [status, navigate]);

  // Session can arrive after mount (direct load on /welcome while restoring);
  // fill the suggestion once it does, unless the user already typed something.
  useEffect(() => {
    if (!username && session?.user.email) {
      setUsername(suggestUsername(session.user.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Debounced availability check
  useEffect(() => {
    setError("");
    if (!username) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const t = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setAvailability(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const claim = async () => {
    const supabase = getSupabase();
    if (!supabase || !session || availability !== "available") return;
    setSubmitting(true);
    setError("");
    const meta = session.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
    const { error: insertError } = await supabase.from("profiles").insert({
      id: session.user.id,
      username,
      display_name: meta.full_name || meta.name || null,
      avatar_url: meta.avatar_url || meta.picture || null,
    });
    if (insertError) {
      setSubmitting(false);
      if (insertError.code === "23505") {
        setAvailability("taken");
        setError("Someone just grabbed that one — try another.");
      } else {
        setError("Couldn't save that. Give it another shot.");
      }
      return;
    }
    claimedRef.current = true;
    await refreshProfile(); // flips status to signedIn
    // New users get the location step next, then the map. The redirect effect
    // is suppressed by claimedRef so it can't beat us to "/".
    navigate("/welcome/location", { replace: true });
  };

  const hint =
    availability === "invalid"
      ? "3-20 characters: lowercase letters, numbers, underscores."
      : availability === "taken"
      ? error || "That one's taken."
      : error;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 pt-24">
      <div className="w-full max-w-sm glass rounded-3xl p-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight">Pick your username</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          It's how friends find you. You can't hide from a good handle.
        </p>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
          <Input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === "Enter" && claim()}
            className="pl-8 pr-9 h-11"
            aria-label="Username"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {availability === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {availability === "available" && <Check className="h-4 w-4 text-green-500" />}
            {(availability === "taken" || availability === "invalid") && <X className="h-4 w-4 text-red-500" />}
          </span>
        </div>

        <p className={cn("text-xs mt-2 min-h-4", availability === "available" ? "text-green-500" : "text-muted-foreground")}>
          {availability === "available" ? "It's yours if you want it." : hint}
        </p>

        <Button
          onClick={claim}
          disabled={availability !== "available" || submitting}
          className="w-full h-11 rounded-xl mt-4"
        >
          {submitting ? "Claiming…" : "Claim it"}
        </Button>
      </div>
    </div>
  );
};

export default PickUsername;
