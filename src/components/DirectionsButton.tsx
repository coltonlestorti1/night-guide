/**
 * Directions button with a maps-app picker. Tapping it lets the user choose
 * Apple Maps or Google Maps; both open the NAMED venue (name + address, plus a
 * verified place ID when available) rather than a bare dropped pin. Used on the
 * map drawer and the venue detail page so the choice lives in one place.
 */
import { Navigation, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { openDirections, type DirectionsTarget, type MapsProvider } from "@/lib/directions";
import { logEvent } from "@/lib/analytics";

export default function DirectionsButton({
  title,
  venueId,
  latitude,
  longitude,
  className,
  variant = "secondary",
}: {
  title: string;
  venueId?: string;
  latitude: number;
  longitude: number;
  className?: string;
  variant?: "default" | "secondary";
}) {
  const target: DirectionsTarget = { title, latitude, longitude };
  const go = (provider: MapsProvider) => {
    logEvent("directions_tap", { venue_id: venueId, provider });
    openDirections(provider, target);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={className}>
          <Navigation className="h-4 w-4 mr-2" /> Directions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[11rem]">
        <DropdownMenuItem onClick={() => go("apple")}>
          <Apple className="h-4 w-4 mr-2" /> Apple Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("google")}>
          <Navigation className="h-4 w-4 mr-2" /> Google Maps
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
