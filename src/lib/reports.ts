/**
 * Reporting user content — App Store Guideline 1.2.
 *
 * ENDZ carries user-generated content (usernames, display names, bios,
 * avatars, plan titles and notes), so Apple requires both a way to report it
 * and a way to block the author. Blocking already existed (useBlockUser);
 * this is the missing half.
 *
 * RLS is the boundary, as everywhere else: a reporter can read only their own
 * reports, and nobody can read a report filed against them — reporting must
 * never become a way to start a fight.
 */
import { getSupabase } from "@/lib/supabase";

export type ReportReason =
  | "harassment"
  | "spam"
  | "impersonation"
  | "inappropriate"
  | "safety"
  | "other";

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "harassment", label: "Harassment or bullying", hint: "Targeting or threatening someone" },
  { value: "safety", label: "Safety concern", hint: "Someone may be in danger" },
  { value: "impersonation", label: "Pretending to be someone else", hint: "Fake profile or stolen photos" },
  { value: "inappropriate", label: "Inappropriate content", hint: "Explicit, hateful or graphic" },
  { value: "spam", label: "Spam or scam", hint: "Promos, bots, or trying to sell something" },
  { value: "other", label: "Something else", hint: "Tell us what's wrong" },
];

/** Where the report was filed from. Not a foreign key — a report has to
 *  outlive the thing it points at. */
export type ReportContext = "profile" | "plan";

export type MyReport = {
  id: string;
  reported_user_id: string;
  context: ReportContext;
  context_id: string | null;
  reason: ReportReason;
  created_at: string;
};

export async function submitReport(input: {
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  details?: string;
  context?: ReportContext;
  contextId?: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("reports").insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    reason: input.reason,
    details: input.details?.trim() || null,
    context: input.context ?? "profile",
    context_id: input.contextId ?? null,
  });
  // 23505 = the one-open-report-per-target unique constraint. Tapping report
  // twice is not an error worth surfacing; the user's intent already landed.
  if (error && error.code !== "23505") throw error;
}

/** Reports the caller has filed, so the UI can say "Reported" rather than
 *  offering an action that will silently collapse into a duplicate. */
export async function listMyReports(reporterId: string): Promise<MyReport[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reports")
    .select("id, reported_user_id, context, context_id, reason, created_at")
    .eq("reporter_id", reporterId);
  if (error) throw error;
  return (data as MyReport[]) ?? [];
}
