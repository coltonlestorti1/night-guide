/**
 * places-search — autocomplete proxy for the onboarding "somewhere we're
 * missing?" field (§11 onboarding taste capture).
 *
 * Exists solely so GOOGLE_PLACES_API_KEY stays server-side. The key is absent
 * from the production bundle (verified in the 2026-08-05 pre-launch check) and
 * must remain so.
 *
 * Deployed WITH jwt verification — unlike plan-guest, there is no guest case
 * here, and an unauthenticated proxy is a free ride on Colton's Places quota.
 * Returns placeId/name/address only; nothing else is needed or stored.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_QUERY = 120;
const MAX_RESULTS = 6;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return json(500, { error: "not configured" });

  let query = "";
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    return json(400, { error: "bad request" });
  }
  if (query.length < 2) return json(200, { results: [] });
  if (query.length > MAX_QUERY) return json(400, { error: "query too long" });

  // Bias to the East Village beachhead so "Mona's" resolves locally.
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: MAX_RESULTS,
      locationBias: {
        circle: {
          center: { latitude: 40.7265, longitude: -73.9815 },
          radius: 2000.0,
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("places-search upstream", res.status, await res.text());
    return json(502, { error: "search unavailable" });
  }

  const data = await res.json();
  const results = (data.places ?? []).map((p: Record<string, unknown>) => ({
    placeId: p.id,
    name: (p.displayName as { text?: string } | undefined)?.text ?? "",
    address: p.formattedAddress ?? undefined,
  }));

  return json(200, { results });
});
