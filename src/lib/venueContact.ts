/**
 * Reaching a venue: the pure bits, so they can be tested without a browser.
 */
import { Venue } from "@/data/types";
import { getEnrichment } from "@/data/enrichment";

/**
 * Whether we have a number to dial.
 *
 * Exported so the LAYOUT can ask too — with no phone the action row must give
 * Directions the full width rather than leaving it half-size beside an empty
 * cell, which reads as a missing button rather than a venue with no number.
 */
export function hasPhone(venue: Venue): boolean {
  return !!getEnrichment(venue.title)?.phone;
}

/**
 * A `tel:` href from a human-formatted number.
 *
 * Strips everything but digits and a leading +. Google returns numbers like
 * "(212) 777-9637", which iOS will dial anyway, but Android and desktop
 * handlers are less forgiving — and a href that silently does nothing is worse
 * than no button.
 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

/**
 * What the call button says.
 *
 * "Call to book" ONLY when Google has verified the venue takes reservations —
 * 28 of 56 at last count. Absent or false means "not recorded", never
 * "definitely takes none", so everyone else gets the plain verb rather than a
 * claim we cannot support.
 *
 * This is deliberately NOT a booking flow. No venue in the dataset has a
 * Resy/OpenTable/SevenRooms/Tock link — checked, zero matches — so the honest
 * ceiling today is putting you on the phone. Real in-app reservations wait for
 * venue accounts (tracker §33).
 */
export function callActionLabel(reservable: boolean): string {
  return reservable ? "Call to book" : "Call";
}
