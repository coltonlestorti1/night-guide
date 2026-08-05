/**
 * Birthday and gender. Deliberately NOT in `profiles` — that table's SELECT
 * policy exposes every column to any signed-in user, and RLS is row-level so
 * two columns cannot be exempted. profile_private carries its own self-only
 * policies (scripts/2026-08-05-onboarding-taste-ddl.sql).
 *
 * Nothing renders these fields. They exist for personalization only, and the
 * derived age — never the raw date — is what scoring consumes.
 */
import { getSupabase } from "@/lib/supabase";

export type Gender = "woman" | "man" | "nonbinary" | "prefer_not_to_say";

export const GENDERS: readonly Gender[] = [
  "woman",
  "man",
  "nonbinary",
  "prefer_not_to_say",
] as const;

export const GENDER_LABELS: Record<Gender, string> = {
  woman: "Woman",
  man: "Man",
  nonbinary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

export async function savePrivateProfile(
  userId: string,
  birthday: string,
  gender: Gender | null
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("profile_private")
    .upsert({ id: userId, birthday, gender }, { onConflict: "id" });
  if (error) throw error;
}

export async function getPrivateProfile(
  userId: string
): Promise<{ birthday: string; gender: Gender | null } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profile_private")
    .select("birthday, gender")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { birthday: string; gender: Gender | null } | null) ?? null;
}
