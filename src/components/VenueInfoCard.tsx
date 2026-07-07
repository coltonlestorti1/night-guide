/**
 * Grafton-style reference info: live-computed open state, weekly hours,
 * price range, rating, happy hour, phone, website. Renders nothing without
 * enrichment data. Attribution line is required wherever this shows (Google ToS).
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { getEnrichment, computeOpenState, describeWeeklyPeriods, getHappyHourState } from "@/data/enrichment";
import { Star, Clock, DollarSign, Martini, Phone, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VenueInfoCard({ venue }: { venue: Venue }) {
  const [hoursOpen, setHoursOpen] = useState(false);
  const e = getEnrichment(venue.title);
  if (!e) return null;
  const state = computeOpenState(e.hours);

  return (
    <div className="rounded-2xl glass p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Info</h2>

      {state && (
        <div>
          <button
            className="w-full flex items-center gap-2 text-sm"
            onClick={() => setHoursOpen((v) => !v)}
            aria-expanded={hoursOpen}
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
            {state.open ? (
              <span><span className="text-emerald-400 font-medium">● Open</span>{state.closesAt && <span className="text-muted-foreground"> · Closes {state.closesAt}</span>}</span>
            ) : (
              <span><span className="text-rose-400 font-medium">● Closed</span>{state.opensAt && <span className="text-muted-foreground"> · Opens {state.opensAt}</span>}</span>
            )}
            <ChevronDown className={cn("h-4 w-4 ml-auto text-muted-foreground transition-transform", hoursOpen && "rotate-180")} />
          </button>
          {hoursOpen && e.hours && (
            <ul className="mt-2 ml-6 space-y-0.5 text-xs text-muted-foreground">
              {describeWeeklyPeriods(e.hours).map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
        </div>
      )}

      {e.happyHour && (() => {
        const hh = getHappyHourState(e.happyHour);
        return (
          <div className="flex items-start gap-2 text-sm">
            <Martini className={cn("h-4 w-4 mt-0.5", hh.status === "active" ? "text-amber-400" : "text-primary")} />
            <span>
              {hh.status === "active" ? (
                <span className="font-medium text-amber-400">Happy hour now · til {hh.endsAt}</span>
              ) : (
                <span className="font-medium text-primary">Happy hour</span>
              )}{" "}
              <span className="text-muted-foreground">
                {describeWeeklyPeriods(e.happyHour).join(" · ")}
                {hh.status === "upcoming-today" && ` · starts ${hh.startsAt}`}
              </span>
            </span>
          </div>
        );
      })()}

      {e.priceRange && (
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span>{e.priceRange} <span className="text-muted-foreground">per person</span></span>
        </div>
      )}

      {e.rating != null && (
        <div className="flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <span>{e.rating.toFixed(1)}{e.userRatingCount != null && <span className="text-muted-foreground"> · {e.userRatingCount.toLocaleString()} reviews</span>}</span>
        </div>
      )}

      {e.phone && (
        <a href={`tel:${e.phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 text-sm hover:underline">
          <Phone className="h-4 w-4 text-muted-foreground" /> {e.phone}
        </a>
      )}

      {e.websiteUri && (
        <a href={e.websiteUri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{e.websiteUri.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
        </a>
      )}

      <p className="text-[10px] text-muted-foreground/70 pt-1">Hours, price &amp; rating data: Google</p>
    </div>
  );
}
