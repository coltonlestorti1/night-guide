/**
 * The signed-in user's real age, derived from the birthday captured in §32
 * onboarding (profile_private, self-only).
 *
 * Before this existed, `ageAffinity()` was fed by getStoredAgeBand() — a
 * localStorage band from a SEPARATE prompt in Weekend Favorites. So a user who
 * had already given their birthday got asked their age again, under-21s had no
 * band at all (the bands start at 21), and the birthday itself influenced
 * nothing. This closes that: the stored band stays as the fallback for anyone
 * who onboarded before §32 or is signed out.
 *
 * Returns an exact age, which is what ageAffinity() wants — never a band.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { getPrivateProfile } from "@/lib/profilePrivate";
import { ageFromBirthday } from "@/lib/birthday";
import { getStoredAgeBand, ageOf } from "@/lib/agePref";

export function useMyAge() {
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data, isLoading } = useQuery<number | null>({
    queryKey: ["my-age", userId],
    enabled: !!userId,
    staleTime: 60 * 60 * 1000, // a birthday does not move
    queryFn: async () => {
      if (!userId) return null;
      const row = await getPrivateProfile(userId);
      return row?.birthday ? ageFromBirthday(row.birthday) : null;
    },
  });

  // Fall back to the on-device band so signed-out users and pre-§32 accounts
  // keep the behaviour they had.
  const band = getStoredAgeBand();
  const fallback = band ? ageOf(band) : null;

  return {
    age: data ?? fallback,
    /** True when we have a real birthday — the caller can stop asking. */
    fromBirthday: data != null,
    isLoading,
  };
}
