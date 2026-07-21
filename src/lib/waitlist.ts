/**
 * Early-access waitlist capture. Inserts into the `waitlist` Supabase table,
 * which has an anon-INSERT-only RLS policy (no client SELECT) — so this write
 * works for signed-out visitors and nobody can read the list from the client.
 */
import { getSupabase } from "@/lib/supabase";

export type WaitlistInput = {
  name: string;
  email: string;
  phone: string;
  source?: string;
};

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());
export const isPhone = (v: string) => v.replace(/[^\d]/g, "").length >= 7;

export async function joinWaitlist({ name, email, phone, source }: WaitlistInput): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Signups aren't set up right now — try again in a bit.");
  }
  const { error } = await supabase.from("waitlist").insert({
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    source: source ?? null,
  });
  if (error) throw error;
}
