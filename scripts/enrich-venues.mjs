#!/usr/bin/env node
/**
 * ENDZ venue enrichment pipeline (Google Places API (New), free-tier batch).
 *   node scripts/enrich-venues.mjs test                       — transform against the fixture (no key needed)
 *   node scripts/enrich-venues.mjs resolve                    — venue titles -> scripts/place-ids.json (REVIEW the mapping)
 *   node scripts/enrich-venues.mjs refresh [--popular-times]  — place IDs -> src/data/enrichment/enrichment.json
 * Never call this from the app at runtime; data ships bundled.
 * Free-tier guards: fixed venue list (abort >100), 200ms between calls, loud abort on 4xx.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformPlace } from "./lib/transform.mjs";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const REPO = join(SCRIPTS, "..");
const ENRICHMENT_PATH = join(REPO, "src/data/enrichment/enrichment.json");
const PLACE_IDS_PATH = join(SCRIPTS, "place-ids.json");
const FIELD_MASK = [
  "id", "displayName", "rating", "userRatingCount", "priceRange",
  "editorialSummary", "nationalPhoneNumber", "websiteUri", "googleMapsUri",
  "businessStatus", "regularOpeningHours", "regularSecondaryOpeningHours",
].join(",");

function envLocal(key) {
  const path = join(REPO, ".env.local");
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function requireApiKey() {
  const key = envLocal("GOOGLE_PLACES_API_KEY");
  if (!key) {
    console.error(
      "GOOGLE_PLACES_API_KEY missing from .env.local.\n" +
      "Setup: console.cloud.google.com -> project 'Endz' -> enable 'Places API (New)'\n" +
      "-> Credentials -> Create API key -> restrict to Places API -> quota cap 500/day\n" +
      "-> add GOOGLE_PLACES_API_KEY=<key> to .env.local",
    );
    process.exit(1);
  }
  return key;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function googleFetch(url, init) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    const body = await res.text();
    if (res.status >= 500 && attempt === 0) { await sleep(1000); continue; }
    console.error(`Places API ${res.status} for ${url}\n${body}`);
    process.exit(1); // 4xx = bad key / quota / bad request: must be loud, never silent
  }
}

async function resolve() {
  const key = requireApiKey();
  const titles = JSON.parse(readFileSync(join(SCRIPTS, "venue-titles.json"), "utf8"));
  if (titles.length > 100) { console.error(`refusing to run on ${titles.length} venues (>100 guard)`); process.exit(1); }
  const out = {};
  for (const title of titles) {
    const data = await googleFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: `${title} bar East Village New York` }),
    });
    const hit = data.places?.[0];
    out[title] = hit
      ? { placeId: hit.id, matchedName: hit.displayName?.text ?? "", address: hit.formattedAddress ?? "" }
      : null;
    console.log(hit ? `  ${title}  ->  ${hit.displayName?.text}  (${hit.formattedAddress})` : `  ${title}  ->  NO MATCH`);
    await sleep(200);
  }
  writeFileSync(PLACE_IDS_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${PLACE_IDS_PATH}.\nREVIEW THE MAPPING ABOVE — wrong-place matches are the main failure mode.`);
}

async function refresh() {
  const key = requireApiKey();
  if (!existsSync(PLACE_IDS_PATH)) { console.error("scripts/place-ids.json missing — run resolve first."); process.exit(1); }
  const ids = JSON.parse(readFileSync(PLACE_IDS_PATH, "utf8"));
  const entries = Object.entries(ids);
  if (entries.length > 100) { console.error(`refusing to run on ${entries.length} venues (>100 guard)`); process.exit(1); }
  const existing = existsSync(ENRICHMENT_PATH) ? JSON.parse(readFileSync(ENRICHMENT_PATH, "utf8")) : {};
  const fetchedAt = new Date().toISOString();
  const out = {};
  for (const [title, entry] of entries) {
    if (!entry) { console.log(`  ${title}: skipped (no place match)`); continue; }
    const place = await googleFetch(`https://places.googleapis.com/v1/places/${entry.placeId}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
    });
    const rec = transformPlace(place, fetchedAt);
    const prev = existing[title];
    if (prev?.popularTimes) { rec.popularTimes = prev.popularTimes; rec.popularTimesSource = prev.popularTimesSource; }
    out[title] = rec;
    console.log(`  ${title}: ok${rec.happyHour ? " (happy hour!)" : ""}`);
    await sleep(200);
  }
  if (process.argv.includes("--popular-times")) {
    const serpKey = envLocal("SERPAPI_KEY");
    if (!serpKey) {
      console.log("\n--popular-times: SERPAPI_KEY not in .env.local — skipped." +
        "\nEnable path: create a SerpApi account (free tier ~100 searches/mo), add SERPAPI_KEY=<key>." +
        "\nNote: SerpApi scrapes Google; ToS-gray. User decision required.");
    } else {
      const { fetchPopularTimes } = await import("./providers/serpapi.mjs");
      for (const [title, rec] of Object.entries(out)) {
        const pt = await fetchPopularTimes(`${title} East Village New York`, serpKey);
        if (pt) { rec.popularTimes = pt; rec.popularTimesSource = "serpapi"; console.log(`  ${title}: popular times ok`); }
        await sleep(200);
      }
    }
  }
  writeFileSync(ENRICHMENT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${ENRICHMENT_PATH} (${Object.keys(out).length} venues, fetchedAt ${fetchedAt}).`);
}

// East Village bounding box (beachhead locked — see 2026-07-06 venue-expansion spec)
const EV_BBOX = { latMin: 40.7205, latMax: 40.7345, lngMin: -73.993, lngMax: -73.974 };
const DISCOVER_QUERIES = [
  "bars in East Village Manhattan",
  "clubs in East Village Manhattan",
  "cocktail lounges in East Village Manhattan",
];
const PRICE_FROM_LEVEL = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

async function discover() {
  const key = requireApiKey();
  const known = existsSync(PLACE_IDS_PATH)
    ? new Set(Object.values(JSON.parse(readFileSync(PLACE_IDS_PATH, "utf8"))).filter(Boolean).map((e) => e.placeId))
    : new Set();
  const seen = new Map();
  for (const textQuery of DISCOVER_QUERIES) {
    const data = await googleFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel",
      },
      body: JSON.stringify({ textQuery, pageSize: 20 }),
    });
    for (const p of data.places ?? []) seen.set(p.id, p);
    await sleep(200);
  }
  if (seen.size > 100) { console.error(`refusing to process ${seen.size} results (>100 guard)`); process.exit(1); }
  const candidates = [...seen.values()]
    .filter((p) => {
      const { latitude: lat, longitude: lng } = p.location ?? {};
      return (
        lat >= EV_BBOX.latMin && lat <= EV_BBOX.latMax &&
        lng >= EV_BBOX.lngMin && lng <= EV_BBOX.lngMax &&
        (p.types ?? []).some((t) => t === "bar" || t === "night_club") &&
        (p.userRatingCount ?? 0) >= 100 &&
        !known.has(p.id)
      );
    })
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "",
      address: p.formattedAddress ?? "",
      lat: p.location.latitude,
      lng: p.location.longitude,
      category: (p.types ?? []).includes("night_club") ? "club" : "bar",
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? 0,
      price: PRICE_FROM_LEVEL[p.priceLevel] ?? null,
      score: (p.rating ?? 0) * Math.log10(Math.max(p.userRatingCount ?? 1, 1)),
      approved: true,
    }))
    .sort((a, b) => b.score - a.score);
  writeFileSync(join(SCRIPTS, "venue-candidates.json"), JSON.stringify(candidates, null, 2) + "\n");
  console.log(` #  ${"NAME".padEnd(32)} ${"RATING".padEnd(7)} ${"REVIEWS".padEnd(8)} ${"PRICE".padEnd(6)} ADDRESS`);
  candidates.forEach((c, i) =>
    console.log(
      `${String(i + 1).padStart(2)}  ${c.name.slice(0, 31).padEnd(32)} ${String(c.rating ?? "—").padEnd(7)} ${String(c.userRatingCount).padEnd(8)} ${(c.price ?? "—").padEnd(6)} ${c.address.replace(", New York, NY", "").replace(", USA", "")}`,
    ),
  );
  console.log(`\n${candidates.length} candidates -> scripts/venue-candidates.json (all pre-approved; tell me numbers to REMOVE).`);
  console.log("Existing venues are never touched by this pipeline. The Grafton is the anchor — untouchable.");
}

/** Additive-only expansion: seeds SQL + demo data + title/place-id maps from
 *  user-approved candidates. NEVER touches existing venues (Grafton = anchor). */
async function expand() {
  const candidates = JSON.parse(readFileSync(join(SCRIPTS, "venue-candidates.json"), "utf8")).filter((c) => c.approved);
  const titles = JSON.parse(readFileSync(join(SCRIPTS, "venue-titles.json"), "utf8"));
  const existing = new Set(titles.map((t) => t.toLowerCase()));
  const ids = existsSync(PLACE_IDS_PATH) ? JSON.parse(readFileSync(PLACE_IDS_PATH, "utf8")) : {};
  const kebab = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sqlEsc = (s) => s.replace(/'/g, "''");
  const sqlLines = ["-- ENDZ venue expansion (additive; generated by enrich-venues.mjs expand)", "insert into venues (name, type, price, lat, lng) values"];
  const tsEntries = [];
  const added = [];
  for (const c of candidates) {
    if (existing.has(c.name.toLowerCase())) { console.log(`  ${c.name}: SKIPPED (title collision with existing venue)`); continue; }
    sqlLines.push(`  ('${sqlEsc(c.name)}', '${c.category}', ${c.price ? `'${c.price}'` : "null"}, ${c.lat}, ${c.lng}),`);
    tsEntries.push(
      `  {\n    id: "${kebab(c.name)}",\n    title: ${JSON.stringify(c.name)},\n    latitude: ${c.lat},\n    longitude: ${c.lng},\n    serves_alcohol: true,\n    category: "${c.category}",${c.price ? `\n    avg_price_level: ${{ $: 1, $$: 2, $$$: 3, $$$$: 4 }[c.price]},` : ""}\n  },`,
    );
    titles.push(c.name);
    ids[c.name] = { placeId: c.placeId, matchedName: c.name, address: c.address };
    added.push(c.name);
  }
  sqlLines[sqlLines.length - 1] = sqlLines[sqlLines.length - 1].replace(/,$/, ";");
  writeFileSync(join(SCRIPTS, "expansion-seed.sql"), sqlLines.join("\n") + "\n");
  const venuesPath = join(REPO, "src/data/venues.ts");
  const src = readFileSync(venuesPath, "utf8");
  const marker = src.lastIndexOf("];");
  writeFileSync(venuesPath, src.slice(0, marker) + tsEntries.join("\n") + "\n" + src.slice(marker));
  writeFileSync(join(SCRIPTS, "venue-titles.json"), JSON.stringify(titles, null, 2) + "\n");
  writeFileSync(PLACE_IDS_PATH, JSON.stringify(ids, null, 2) + "\n");
  console.log(`Added ${added.length} venues to seed SQL, demo data, titles, and place-ids.`);
  console.log("Next: paste scripts/expansion-seed.sql into the Supabase SQL editor, then run refresh.");
}

function runTest() {
  const place = JSON.parse(readFileSync(join(SCRIPTS, "fixtures/place-details.sample.json"), "utf8"));
  const out = transformPlace(place, "2026-07-06T00:00:00.000Z");
  assert.equal(out.placeId, "ChIJTESTGraftonPlaceId");
  assert.equal(out.rating, 4.5);
  assert.equal(out.userRatingCount, 823);
  assert.equal(out.priceRange, "$10–40");
  assert.equal(out.phone, "(212) 228-8580");
  assert.equal(out.editorialSummary.startsWith("This laid-back Irish bar"), true);
  assert.equal(out.hours.length, 7);
  assert.deepEqual(out.hours[0], { day: 1, openHour: 12, openMinute: 0, closeHour: 2, closeMinute: 0, closeDayOffset: 1 });
  assert.equal(out.happyHour.length, 5);
  assert.deepEqual(out.happyHour[0], { day: 1, openHour: 16, openMinute: 0, closeHour: 19, closeMinute: 0, closeDayOffset: 0 });
  assert.equal("openNow" in out, false);
  console.log("transform test: PASS");
}

const cmd = process.argv[2];
if (cmd === "test") runTest();
else if (cmd === "resolve") await resolve();
else if (cmd === "refresh") await refresh();
else if (cmd === "discover") await discover();
else if (cmd === "expand") await expand();
else { console.error("usage: node scripts/enrich-venues.mjs <test|resolve|refresh|discover|expand> [--popular-times]"); process.exit(1); }
