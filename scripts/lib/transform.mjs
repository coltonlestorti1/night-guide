/**
 * Pure transform: Places API (New) Place Details response -> enrichment record.
 * Google's openNow is deliberately never read: it is stale the moment we cache
 * it. We store weekly periods; the app computes open state at render time.
 */

function mapPeriod(p) {
  if (!p?.open || !p?.close) return null; // 24/7 or malformed — skip, EV bars close
  const offset = (p.close.day - p.open.day + 7) % 7;
  if (offset > 1) return null; // >24h period: not representable, skip
  return {
    day: p.open.day,
    openHour: p.open.hour ?? 0,
    openMinute: p.open.minute ?? 0,
    closeHour: p.close.hour ?? 0,
    closeMinute: p.close.minute ?? 0,
    closeDayOffset: offset,
  };
}

function mapPeriods(periods) {
  const mapped = (periods ?? []).map(mapPeriod).filter(Boolean);
  return mapped.length ? mapped : undefined;
}

function formatPriceRange(pr) {
  const lo = pr?.startPrice?.units;
  const hi = pr?.endPrice?.units;
  if (lo && hi) return `$${lo}–${hi}`;
  if (lo) return `$${lo}+`;
  return undefined;
}

export function transformPlace(place, fetchedAt) {
  const happy = (place.regularSecondaryOpeningHours ?? []).find(
    (s) => s.secondaryHoursType === "HAPPY_HOUR",
  );
  const rec = {
    placeId: place.id,
    fetchedAt,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    priceRange: formatPriceRange(place.priceRange),
    editorialSummary: place.editorialSummary?.text,
    phone: place.nationalPhoneNumber,
    websiteUri: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
    businessStatus: place.businessStatus,
    hours: mapPeriods(place.regularOpeningHours?.periods),
    happyHour: mapPeriods(happy?.periods),
    // Google returns true/false when known, omits when unknown. We keep the
    // tri-state: undefined keys are dropped below, so "unknown" never becomes
    // a fake "no". Only true means verified outdoor seating.
    outdoorSeating: place.outdoorSeating,
  };
  // drop undefined keys so the committed JSON stays clean
  return Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== undefined));
}
