/**
 * Area synonyms for the street-only `neighborhood` labels.
 *
 * The card shows the street ("Avenue C") because that is what tells someone
 * which way to walk. But people search by area ("alphabet city"), and before
 * the 2026-08-05 rule change two labels carried the area inline
 * ('Avenue B / Alphabet City'), so that search worked by accident. This keeps
 * it working on purpose, without putting redundant text back on the card —
 * every venue is in the East Village, so an area label differentiates nothing.
 *
 * Search-only. Never render these.
 */
const AREA_TERMS: Record<string, string> = {
  // Alphabet City is the avenues past 1st: A, B, C.
  "Avenue A": "alphabet city",
  "Avenue B": "alphabet city",
  // Loisaida Avenue IS Avenue C — both names find it.
  "Avenue C": "alphabet city loisaida",
  "St. Marks Place": "st marks",
  "Bowery": "noho",
};

/** Extra search terms for a neighborhood label. Always includes East Village. */
export function areaTerms(neighborhood?: string | null): string {
  const extra = neighborhood ? (AREA_TERMS[neighborhood] ?? "") : "";
  // Every venue in the dataset is East Village, so the term always applies —
  // including for venues with no neighborhood set yet.
  return `east village ${extra}`.trim();
}
