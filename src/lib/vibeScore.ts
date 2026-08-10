/**
 * Rules-based venue scoring for "Find the move" — concierge v1, no LLM.
 * Every reason string is built from real data (enrichment, live check-ins,
 * seeded fields); missing data scores neutral and produces no reason.
 * A future Claude-backed scorer can replace this module without UI changes.
 */
import { Venue } from "@/data/types";
import { getEnrichment, computeOpenState, isWithinPeriods, formatTime, getHappyHourState } from "@/data/enrichment";
import { isCocktailSpot, hasOutdoorSeating, hasRooftop, takesReservations } from "@/lib/venueTraits";
import { friendVerdict, type FriendSignals } from "@/lib/move/friends";
import { cooldownPenalty, type ImpressionLog } from "@/lib/move/cooldown";
import { Coords } from "@/store/location";
import { haversineMiles, formatMiles } from "@/lib/distance";
import { directBoost, tasteBoost, type TasteProfile } from "@/lib/taste";
import type { RatingRow } from "@/lib/night/ratings";

export type VibePrefs = {
  vibe?: "chill" | "lively" | "packed";
  drinks?: "beer" | "cocktails";
  when: "now" | "later";
  near?: boolean;
  happyHour?: boolean;
  age?: "21-25" | "25-30" | "30+";
  /** Kept as one single-select preference — you want a roof or a yard, not both. */
  outside?: "rooftop" | "outdoor";
  /**
   * §17 party size. Changes which ROOM suits you, never what we claim about a
   * venue's capacity — no capacity data exists, so nothing here may assert one.
   */
  groupSize?: "solo" | "two" | "small" | "big";
};

export type ScoredVenue = { venue: Venue; score: number; reasons: string[] };

type Activity = Record<string, { count: number; vibe?: string }> | undefined;

const tierOf = (count: number): "chill" | "lively" | "packed" =>
  count >= 6 ? "packed" : count >= 3 ? "lively" : "chill";

/**
 * Personal signals. Optional on purpose: omit it (or pass no ratings) and this
 * function scores exactly as it did before personalization existed.
 */
export type PersonalSignals = {
  ratings?: RatingRow[];
  /** Inferred once, by the caller, from the same venue set being scored. */
  taste?: TasteProfile | null;
  /**
   * Friends who are out now / who saved a venue. Already RLS-filtered by the
   * hooks that produce them — see src/lib/move/friends.ts for the naming rule.
   */
  friends?: FriendSignals;
  /** Recent impressions, so the same three stop repeating (§3). */
  impressions?: ImpressionLog;
};

export function scoreVenues(
  venues: Venue[],
  prefs: VibePrefs,
  activity: Activity,
  now: Date = new Date(),
  userCoords?: Coords | null,
  personal?: PersonalSignals,
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
      if (isCocktailSpot(venue)) {
        score += 1;
        reasons.push("Cocktail spot");
      }
    }

    if (e?.happyHour && isWithinPeriods(e.happyHour, now)) {
      score += 1.5;
      const ends = e.happyHour.find((p) => isWithinPeriods([p], now));
      reasons.push(ends ? `🥂 Happy hour til ${formatTime(ends.closeHour, ends.closeMinute)}` : "Happy hour now");
    }

    // Age lean — there is NO real crowd-age data, so this only nudges toward
    // venue TRAITS we actually have (type / price / cocktail-ness). It never
    // asserts a crowd's age and adds no age-claim reasons.
    if (prefs.age === "21-25") {
      if (venue.category === "club") score += 1;
      if ((venue.avg_price_level ?? 3) <= 2) score += 0.5;
    } else if (prefs.age === "30+") {
      if (isCocktailSpot(venue) || venue.category === "lounge") score += 1;
      if ((venue.avg_price_level ?? 0) >= 3) score += 0.5;
    }

    // "Happy hour" preference — surface spots with a deal now/soon, sink the rest.
    if (prefs.happyHour) {
      const hh = getHappyHourState(e?.happyHour, now);
      if (hh.status === "active") score += 2; // reason already added above
      else if (hh.status === "upcoming-today") {
        score += 1;
        reasons.push(`🥂 Happy hour at ${hh.startsAt}`);
      } else score -= 2;
    }

    // Rooftop / outdoor preference — same shape as happy hour: boost the
    // matches, sink the rest. Curated flags, so absent means "no", not
    // "unknown", and sinking is honest.
    if (prefs.outside === "rooftop") {
      if (hasRooftop(venue)) {
        score += 2;
        reasons.push("Rooftop");
      } else score -= 2;
    } else if (prefs.outside === "outdoor") {
      if (hasOutdoorSeating(venue)) {
        score += 2;
        reasons.push("Outdoor seating");
      } else score -= 2;
    }

    // ---- §17 party size. Two separate jobs, kept apart on purpose.
    //
    // (1) ROOM signals — what suits six people vs one, from facts we hold.
    //     `reservable` is the only one allowed to speak: there is NO capacity
    //     data anywhere, so nothing here may claim a venue "fits your group".
    // (2) The CROWD dimension — see below, where a stated preference wins.
    if (prefs.groupSize === "big" || prefs.groupSize === "small") {
      const big = prefs.groupSize === "big";
      if (takesReservations(venue)) {
        score += big ? 1.5 : 0.75;
        reasons.push("Takes reservations");
      }
      // Absent/false reservable is NEVER sunk — "not recorded" is not "no".
      if (hasRooftop(venue) || hasOutdoorSeating(venue)) score += big ? 1 : 0.5;
      if (big) {
        if ((venue.avg_price_level ?? 3) <= 2) score += 0.5; // splitting a tab
        if (venue.category === "club") score += 0.5;
      }
    } else if (prefs.groupSize === "solo" || prefs.groupSize === "two") {
      if (isCocktailSpot(venue) || venue.category === "lounge") score += 1;
    }

    // A STATED preference beats an INFERENCE. If they picked a vibe, party size
    // stays out of the crowd dimension entirely — six people who asked for
    // "packed" mean it, and quietly sinking packed rooms would overrule them.
    // Only when they said nothing does group size lean at all.
    if (prefs.groupSize === "big" && !prefs.vibe && act && tierOf(act.count) === "packed") {
      score -= 1;
    }

    // "Around me" — boost closer venues (soft ranking, never a hard filter).
    if (prefs.near && userCoords && venue.latitude != null && venue.longitude != null) {
      const dist = haversineMiles(userCoords, { lat: venue.latitude, lng: venue.longitude });
      score += Math.max(0, 1.5 - dist * 2); // ~0 mi: +1.5, fades to 0 by 0.75 mi
      reasons.unshift(`${formatMiles(dist)} away`);
    }

    // ---- personal signals, last so they only ever reorder what already
    // qualifies. Anything excluded above (closed when "now", a filter miss) has
    // already been skipped or sunk, and nothing here can undo that.
    if (personal) {
      const rated = directBoost(venue.id, personal.ratings);
      if (rated > 0) {
        score += rated;
        reasons.unshift("You rated this great");
      } else if (rated < 0) {
        score += rated; // sunk, never explained — no one needs telling twice
      }

      // Taste only applies to venues they have NOT rated: for a rated venue the
      // direct signal is the better evidence, and stacking both double-counts.
      if (rated === 0) {
        const { delta, reason } = tasteBoost(venue, personal.taste ?? null);
        score += delta;
        if (reason) reasons.push(reason);
      }

      // Friends. Named, and only ever from a signal this user could already
      // see — both sources are RLS-filtered accepted-friend queries. Unshifted
      // because "Maya is here now" beats any generic reason for the slot.
      const friends = friendVerdict(venue.id, personal.friends);
      if (friends.delta) score += friends.delta;
      if (friends.reason) reasons.unshift(friends.reason);

      // Recent-impression decay (§3). A penalty, never an exclusion — a venue
      // that is still clearly the best survives it and says so in select.ts.
      if (personal.impressions) {
        score -= cooldownPenalty(venue.id, personal.impressions, now);
      }
    }

    scored.push({ venue, score, reasons: reasons.slice(0, 3) });
  }

  return scored.sort((a, b) => b.score - a.score);
}
