/**
 * Rules-based venue scoring for "Find the move" — concierge v1, no LLM.
 * Every reason string is built from real data (enrichment, live check-ins,
 * seeded fields); missing data scores neutral and produces no reason.
 * A future Claude-backed scorer can replace this module without UI changes.
 */
import { Venue } from "@/data/types";
import { getEnrichment, computeOpenState, isWithinPeriods, formatTime } from "@/data/enrichment";
import { normalize } from "@/lib/searchMatch";

export type VibePrefs = {
  vibe?: "chill" | "lively" | "packed";
  drinks?: "beer" | "cocktails";
  when: "now" | "later";
};

export type ScoredVenue = { venue: Venue; score: number; reasons: string[] };

type Activity = Record<string, { count: number; vibe?: string }> | undefined;

const tierOf = (count: number): "chill" | "lively" | "packed" =>
  count >= 6 ? "packed" : count >= 3 ? "lively" : "chill";

export function scoreVenues(
  venues: Venue[],
  prefs: VibePrefs,
  activity: Activity,
  now: Date = new Date(),
): ScoredVenue[] {
  const scored: ScoredVenue[] = [];

  for (const venue of venues) {
    const e = getEnrichment(venue.title);
    const state = computeOpenState(e?.hours, now);
    let score = 0;
    const reasons: string[] = [];

    // "Right now" = open venues only; unknown hours are not punished.
    if (prefs.when === "now" && state && !state.open) continue;
    if (state?.open) {
      score += 1;
      reasons.push(state.closesAt ? `Open til ${state.closesAt}` : "Open now");
    }

    if (e?.rating != null) {
      const weight = Math.min(1, Math.log10(Math.max(e.userRatingCount ?? 1, 1)) / 3);
      score += (e.rating - 3.5) * weight;
      if (e.rating >= 4.2 && e.userRatingCount) {
        reasons.push(`★ ${e.rating.toFixed(1)} · ${e.userRatingCount.toLocaleString()} reviews`);
      }
    }

    const act = activity?.[venue.id];
    if (act && prefs.vibe) {
      const tier = tierOf(act.count);
      if (tier === prefs.vibe) {
        score += 2;
        reasons.push(act.count > 0 ? `${act.count} here now` : "Quiet right now");
      } else if (
        (tier === "packed" && prefs.vibe === "chill") ||
        (tier === "chill" && prefs.vibe === "packed")
      ) {
        score -= 1;
      }
      if (act.vibe && act.vibe === prefs.vibe) score += 1;
    }

    if (prefs.drinks === "beer") {
      if ((venue.avg_price_level ?? 5) <= 2) {
        score += 1.5;
        reasons.push("Cheap drinks");
      }
      if (venue.category === "bar") score += 0.5;
    } else if (prefs.drinks === "cocktails") {
      if (venue.category === "lounge" || venue.category === "club") score += 1;
      if ((venue.avg_price_level ?? 0) >= 3) score += 0.5;
      const text = normalize(`${venue.title} ${venue.description ?? ""}`);
      if (text.includes("cocktail") || text.includes("speakeasy")) {
        score += 1;
        reasons.push("Cocktail spot");
      }
    }

    if (e?.happyHour && isWithinPeriods(e.happyHour, now)) {
      score += 1.5;
      const ends = e.happyHour.find((p) => isWithinPeriods([p], now));
      reasons.push(ends ? `Happy hour til ${formatTime(ends.closeHour, ends.closeMinute)}` : "Happy hour now");
    }

    scored.push({ venue, score, reasons: reasons.slice(0, 3) });
  }

  return scored.sort((a, b) => b.score - a.score);
}
