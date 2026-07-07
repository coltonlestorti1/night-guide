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
else { console.error("usage: node scripts/enrich-venues.mjs <test|resolve|refresh> [--popular-times]"); process.exit(1); }
