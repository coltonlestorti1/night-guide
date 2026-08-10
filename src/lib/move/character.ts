/**
 * What KIND of pick a venue is (§3: "return approximately three options with
 * meaningful differences").
 *
 * Ranks 1–3 are not three options, they are one option listed three times —
 * usually three cocktail bars on the same block. A character is the honest
 * answer to "why would I pick this one over the other two", and it is only
 * ever derived from data we hold. A venue that has nothing distinctive gets no
 * character, and the selector falls back to rank.
 *
 * Colton, 2026-08-09, on what these should feel like: "a req to make a res
 * somewhere, or find a place with a smaller crowd to avoid the line, or
 * something like if you don't mind waiting in line this is the most fun."
 * `easy-door` and `worth-it` are the two halves of that, and they are
 * deliberately opposites — the same crowd fact, read for two different nights.
 */
import { Venue } from "@/data/types";
import { getEnrichment, getHappyHourState } from "@/data/enrichment";
import { takesReservations } from "@/lib/venueTraits";
import { haversineMiles, formatMiles } from "@/lib/distance";
import { Coords } from "@/store/location";
import { hasFriendSignal, type FriendSignals } from "./friends";

export type Character = "fit" | "easy-door" | "worth-it" | "value" | "close" | "friends";

export type CharacterContext = {
  activity?: Record<string, { count: number; vibe?: string }>;
  coords?: Coords | null;
  friends?: FriendSignals;
  now?: Date;
};

/** Same boundaries vibeScore uses — one definition of "packed". */
const tierOf = (count: number) => (count >= 6 ? "packed" : count >= 3 ? "lively" : "chill");
/** Rating floor for "worth the wait": a queue needs justifying. */
const WORTH_IT_RATING = 4.3;
/** Beyond this, "closest" stops being a selling point. */
const CLOSE_MILES = 0.4;

export const HEADLINES: Record<Character, string> = {
  fit: "Best fit",
  "easy-door": "Easy door",
  "worth-it": "Worth the wait",
  value: "Best value",
  close: "Closest",
  friends: "Your people",
};

/**
 * The note under the headline — says WHY, in the venue's own facts. Returns
 * null when we have nothing honest to add, and the UI then shows the headline
 * alone rather than filler.
 */
export function characterNote(
  c: Character,
  venue: Venue,
  ctx: CharacterContext = {},
): string | null {
  const now = ctx.now ?? new Date();
  const count = ctx.activity?.[venue.id]?.count ?? 0;
  switch (c) {
    case "easy-door":
      if (takesReservations(venue)) return "You can book ahead";
      return count === 0 ? "Quiet right now — walk straight in" : "Not busy right now";
    case "worth-it": {
      // Only what this venue's own data proves. An earlier draft said "busiest
      // of the three, and the highest rated" — a ranking against the other two
      // picks that nothing here ever computed.
      const rating = getEnrichment(venue.title)?.rating;
      return rating ? `Busy right now, and rated ${rating.toFixed(1)}` : "Busy right now";
    }
    case "value": {
      const hh = getHappyHourState(getEnrichment(venue.title)?.happyHour, now);
      if (hh.status === "active") return "Happy hour on now";
      if (hh.status === "upcoming-today" && hh.startsAt) return `Happy hour at ${hh.startsAt}`;
      return "Cheaper drinks";
    }
    case "close": {
      if (!ctx.coords || venue.latitude == null || venue.longitude == null) return null;
      const d = haversineMiles(ctx.coords, { lat: venue.latitude, lng: venue.longitude });
      return `${formatMiles(d)} from you`;
    }
    case "friends":
      return null; // the named reason string already says it, better
    case "fit":
      return null;
  }
}

/**
 * Every character that is TRUE for this venue, best-first. `fit` is never
 * derived here — the selector assigns it to whatever ranked highest.
 */
export function deriveCharacters(venue: Venue, ctx: CharacterContext = {}): Character[] {
  const now = ctx.now ?? new Date();
  const e = getEnrichment(venue.title);
  const act = ctx.activity?.[venue.id];
  const tier = act ? tierOf(act.count) : null;
  const out: Character[] = [];

  if (hasFriendSignal(venue.id, ctx.friends)) out.push("friends");

  if (tier === "packed" && (e?.rating ?? 0) >= WORTH_IT_RATING) out.push("worth-it");

  // Deliberately mutually exclusive with worth-it: a packed room is not an
  // easy door, whatever its reservation policy says.
  if (tier !== "packed" && (takesReservations(venue) || tier === "chill")) out.push("easy-door");

  const hh = getHappyHourState(e?.happyHour, now);
  if (hh.status === "active" || hh.status === "upcoming-today" || (venue.avg_price_level ?? 3) <= 2) {
    out.push("value");
  }

  if (ctx.coords && venue.latitude != null && venue.longitude != null) {
    const d = haversineMiles(ctx.coords, { lat: venue.latitude, lng: venue.longitude });
    if (d < CLOSE_MILES) out.push("close");
  }

  return out;
}

export const CHARACTER_INTERNALS = { WORTH_IT_RATING, CLOSE_MILES };
