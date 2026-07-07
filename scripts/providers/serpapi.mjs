/**
 * SerpApi popular-times provider (DORMANT until SERPAPI_KEY is set).
 * SerpApi scrapes Google Maps; using it is ToS-gray — enabling is a user
 * decision, documented in the 2026-07-06 enrichment spec. Long-term the
 * provider is our own check-in history.
 * NOTE: response shape needs a live check on first enable — this adapter is
 * defensive and returns null (with a warning) on anything unrecognized.
 */
const DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

export async function fetchPopularTimes(query, apiKey) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url);
  if (!res.ok) { console.warn(`serpapi ${res.status} for "${query}" — skipped`); return null; }
  const data = await res.json();
  const graph = data.place_results?.popular_times?.graph_results;
  if (!graph || typeof graph !== "object") { console.warn(`serpapi: no popular_times for "${query}"`); return null; }
  const days = [];
  for (const [dayName, hours] of Object.entries(graph)) {
    const day = DAY_INDEX[dayName.toLowerCase()];
    if (day === undefined || !Array.isArray(hours)) continue;
    const mapped = hours
      .map((h) => ({ hour: parseHour(h.time), busyness: h.busyness_score ?? h.score ?? null }))
      .filter((h) => h.hour !== null && typeof h.busyness === "number");
    if (mapped.length) days.push({ day, hours: mapped });
  }
  return days.length ? days.sort((a, b) => a.day - b.day) : null;
}

function parseHour(t) {
  // handles "9 AM", "12 PM", "1 AM" — SerpApi's observed formats
  const m = String(t ?? "").trim().match(/^(\d{1,2})(?::\d{2})?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[2].toUpperCase() === "PM") h += 12;
  return h;
}
