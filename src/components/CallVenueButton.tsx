/**
 * Call the venue, from the action row.
 *
 * The number was already in the app — VenueInfoCard has rendered a `tel:` link
 * since enrichment landed — but it sits behind the "More info" expander, which
 * is not where anyone looks at 10pm. This promotes the ACTION to sit beside
 * Directions; the reference row keeps showing the digits, which is a different
 * job.
 *
 * Renders nothing without a number. 17 of 56 venues have none, and a dead
 * control is worse than an absent one — the same rule the crowd meter follows
 * for closed venues.
 *
 * The label is the only place `reservable` is spoken out loud. It is a
 * Google-verified fact and the one group-related claim this app is allowed to
 * make; everywhere else it only nudges ranking.
 */
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Venue } from "@/data/types";
import { getEnrichment } from "@/data/enrichment";
import { takesReservations } from "@/lib/venueTraits";
import { callActionLabel, telHref } from "@/lib/venueContact";

export default function CallVenueButton({
  venue,
  className,
}: {
  venue: Venue;
  className?: string;
}) {
  const phone = getEnrichment(venue.title)?.phone;
  if (!phone) return null;

  return (
    <Button asChild variant="secondary" className={className}>
      <a href={telHref(phone)}>
        <Phone className="h-4 w-4 mr-2" aria-hidden="true" />
        {callActionLabel(takesReservations(venue))}
      </a>
    </Button>
  );
}
