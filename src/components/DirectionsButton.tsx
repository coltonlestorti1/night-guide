/**
 * Directions button with a maps-app picker. Tapping it lets the user choose
 * Apple Maps or Google Maps; both route to the venue's coordinates. Used on
 * the map drawer and the venue detail page so the choice lives in one place.
 */
import { Navigation, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { openDirections } from "@/lib/directions";

export default function DirectionsButton({
  latitude,
  longitude,
  className,
  variant = "secondary",
}: {
  latitude: number;
  longitude: number;
  className?: string;
  variant?: "default" | "secondary";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className={className}>
          <Navigation className="h-4 w-4 mr-2" /> Directions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[11rem]">
        <DropdownMenuItem onClick={() => openDirections("apple", latitude, longitude)}>
          <Apple className="h-4 w-4 mr-2" /> Apple Maps
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDirections("google", latitude, longitude)}>
          <Navigation className="h-4 w-4 mr-2" /> Google Maps
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
