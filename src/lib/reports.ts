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
 *  outlive the thing it points at.
 *
 *  `post` (night-feed posts, slice 2) and `comment` (2026-08-07) needed no
 *  DDL: reports.context is plain text with no CHECK constraint, and the
 *  partial unique index on
 *  (reporter_id, reported_user_id, context, context_id) already dedupes
 *  reports that carry a context_id. */
export type ReportContext = "profile" | "plan" | "post" | "comment";

export type MyReport = {
  id: string;
  reported_user_id: string;
  context: ReportContext;
  context_id: string | null;
  reason: ReportReason;
  created_at: string;
};

/** Whether the report actually became a row.
 *
 *  `already-reported` is NOT a failure — the dedupe index is doing its job.
 *  It exists so the UI can stop claiming a report was filed when it was not.
 *  See the note on the 23505 branch below for when this is reachable. */
export type ReportOutcome = "filed" | "already-reported";

export async function submitReport(input: {
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  details?: string;
  context?: ReportContext;
  contextId?: string | null;
}): Promise<ReportOutcome> {
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
  // 23505 = the dedupe index. Report it back rather than swallowing it.
  //
  // This is reachable in two very different situations and the caller has to
  // be able to tell the user the truth in both:
  //   - Double-tapping report on the same thing. Harmless.
  //   - Reporting the same PROFILE a second time for a DIFFERENT reason.
  //     Profile reports carry context_id = null, so reports_dedupe_no_ctx
  //     allows exactly ONE per (reporter, reported, 'profile') ever.
  //
  // Returning void here meant the UI showed "Thanks — we review reports within
  // 24 hours" for a row that was discarded. For a flow Apple requires to work,
  // silently discarding a report while claiming success is the worst of the
  // available behaviours.
  if (error) {
    if (error.code === "23505") return "already-reported";
    throw error;
  }
  return "filed";
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
