/**
 * Turns a ranked list into the three picks the user actually sees.
 *
 * §3's diversity rules, in order of priority:
 *   - never return three effectively identical venues
 *   - vary by neighborhood / type / price / atmosphere / reason
 *   - never a dead end: always return three when three exist (Colton,
 *     2026-08-09 — "i like keeping it dynamic", relax rather than refuse)
 *
 * The selector only ever REORDERS and LABELS what the scorer already
 * qualified. It cannot introduce a venue the scorer excluded.
 */
import type { ScoredVenue } from "@/lib/vibeScore";
import { deriveCharacters, characterNote, HEADLINES, type Character, type CharacterContext } from "./character";
import { cooldownPenalty, SUPERIORITY_MARGIN, REPEAT_REASON, type ImpressionLog } from "./cooldown";

export type MovePick = {
  venue: ScoredVenue["venue"];
  reasons: string[];
  /**
   * Null when we relaxed the diversity rules to fill the slot and the venue has
   * nothing distinctive left to say. Showing "Best value" twice reads as a bug,
   * and inventing a label is worse — so the card just goes quiet.
   */
  character: Character | null;
  headline: string | null;
  note: string | null;
};

export type SelectContext = CharacterContext & {
  impressions?: ImpressionLog;
  count?: number;
};

/** Two picks are "the same kind of night" if type AND area both match. */
const sameKind = (a: ScoredVenue, b: ScoredVenue) =>
  a.venue.category === b.venue.category && a.venue.neighborhood === b.venue.neighborhood;

/**
 * A venue seen recently only keeps its place if it is still CLEARLY better
 * than the next option; otherwise it drops behind everything fresh.
 *
 * The score penalty alone is not enough. A strong leader absorbs −1.0 and
 * comes back at the top anyway, which is exactly the "same three every night"
 * §3 exists to stop — caught in the browser 2026-08-09, where the top pick
 * repeated one minute later with no explanation. Relative order is preserved
 * inside each group, and when EVERY candidate is a repeat this is a no-op, so
 * it can never shorten the list.
 */
function demoteUnearnedRepeats(ranked: ScoredVenue[], ctx: SelectContext): ScoredVenue[] {
  if (!ctx.impressions) return ranked;
  const fresh: ScoredVenue[] = [];
  const demoted: ScoredVenue[] = [];
  for (const sv of ranked) {
    const seen = cooldownPenalty(sv.venue.id, ctx.impressions, ctx.now) > 0;
    if (seen && !isClearlySuperior(sv, ranked)) demoted.push(sv);
    else fresh.push(sv);
  }
  return [...fresh, ...demoted];
}

/** Beats the best venue that is NOT itself by more than the margin. */
function isClearlySuperior(sv: ScoredVenue, ranked: ScoredVenue[]): boolean {
  const rival = ranked.find((r) => r.venue.id !== sv.venue.id);
  return !rival || sv.score - rival.score > SUPERIORITY_MARGIN;
}

export function selectPicks(rankedInput: ScoredVenue[], ctx: SelectContext = {}): MovePick[] {
  const want = ctx.count ?? 3;
  if (rankedInput.length === 0) return [];
  const ranked = demoteUnearnedRepeats(rankedInput, ctx);

  const chosen: { sv: ScoredVenue; character: Character | null }[] = [];
  const usedCharacters = new Set<Character>();

  // Slot 1 is simply the best thing available — the honest answer to the
  // question asked. Everything after it has to EARN its place by differing.
  chosen.push({ sv: ranked[0], character: "fit" });
  usedCharacters.add("fit");

  /**
   * One pass over the remaining venues. A character is only ever assigned when
   * it is UNUSED, so two picks can never carry the same label; relaxing lets a
   * venue in without one rather than duplicating.
   */
  const fill = (requireFresh: boolean, requireDiverse: boolean) => {
    for (const sv of ranked.slice(1)) {
      if (chosen.length >= want) return;
      if (chosen.some((c) => c.sv.venue.id === sv.venue.id)) continue;
      if (requireDiverse && chosen.some((c) => sameKind(c.sv, sv))) continue;
      const fresh = deriveCharacters(sv.venue, ctx).find((c) => !usedCharacters.has(c));
      if (requireFresh && !fresh) continue;
      chosen.push({ sv, character: fresh ?? null });
      if (fresh) usedCharacters.add(fresh);
    }
  };

  // Ideal: a different character AND a different kind of night.
  fill(true, true);
  // Then drop the character requirement, then diversity — never return fewer
  // than asked for. A short list is indistinguishable from a broken feature.
  if (chosen.length < want) fill(false, true);
  if (chosen.length < want) fill(false, false);

  return chosen.map(({ sv, character }) => {
    const reasons = [...sv.reasons];
    // §3 allows a repeat when the venue is still clearly superior — and
    // requires it to be EXPLAINED. Anything that survived a cooldown penalty
    // and still leads by the margin has earned the line.
    if (
      ctx.impressions &&
      cooldownPenalty(sv.venue.id, ctx.impressions, ctx.now) > 0 &&
      isClearlySuperior(sv, rankedInput)
    ) {
      reasons.unshift(REPEAT_REASON);
    }
    return {
      venue: sv.venue,
      reasons: reasons.slice(0, 3),
      character,
      headline: character ? HEADLINES[character] : null,
      note: character ? characterNote(character, sv.venue, ctx) : null,
    };
  });
}
