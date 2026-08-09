import { Venue } from "@/data/types";

/** Per-category placeholder art for venues without a real image. */
export const PLACEHOLDER: Record<string, string> = {
  bar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='%233b82f6'%3E%3Crect width='96' height='96' rx='8' opacity='.15'/%3E%3Ctext x='48' y='54' text-anchor='middle' font-size='14' fill='%233b82f6'%3EBar%3C/text%3E%3C/svg%3E",
  club: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='%23ef4444'%3E%3Crect width='96' height='96' rx='8' opacity='.15'/%3E%3Ctext x='48' y='54' text-anchor='middle' font-size='14' fill='%23ef4444'%3EClub%3C/text%3E%3C/svg%3E",
  lounge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='%23a855f7'%3E%3Crect width='96' height='96' rx='8' opacity='.15'/%3E%3Ctext x='48' y='54' text-anchor='middle' font-size='14' fill='%23a855f7'%3ELounge%3C/text%3E%3C/svg%3E",
};

/** The image to show for a venue: real photo, else category placeholder. */
export function venueImageSrc(venue: Pick<Venue, "image_url" | "category">): string {
  return venue.image_url || PLACEHOLDER[venue.category] || PLACEHOLDER.bar;
}

/**
 * Does this venue have a real photograph, as opposed to a category placeholder?
 *
 * Gates every tap-to-expand affordance. Expanding a placeholder would show a
 * large grey rectangle, and refusing to expand it is also what keeps the photo
 * from stealing taps on rows that are already tappable.
 *
 * Structurally typed rather than taking a `Venue`, so the admin's
 * `AdminVenueRow` satisfies it too.
 */
export function hasRealPhoto(v: { image_url?: string | null }): boolean {
  return Boolean(v.image_url);
}
