import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { USERNAME_RE } from "@/lib/username";

export type Availability = "idle" | "invalid" | "checking" | "available" | "taken";

/**
 * Debounced (400ms) username-availability check shared by onboarding and
 * Edit Profile. `current` marks the caller's existing handle: entering it is
 * "unchanged", never queried. A query error resolves to "idle" (unknown) —
 * never a false "available" — and stale in-flight responses are discarded.
 * The returned setter lets callers mark "taken" from a 23505 insert/update.
 */
export function useUsernameAvailability(
  username: string,
  current?: string | null,
): [Availability, (a: Availability) => void] {
  const [availability, setAvailability] = useState<Availability>("idle");

  useEffect(() => {
    if (!username || username === current) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setAvailability("idle"); // unknown — don't claim available
        return;
      }
      setAvailability(data ? "taken" : "available");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, current]);

  return [availability, setAvailability];
}
