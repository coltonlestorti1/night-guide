#!/usr/bin/env node
/**
 * ENDZ venue enrichment pipeline (Google Places API (New), free-tier batch).
 *   node scripts/enrich-venues.mjs test      — transform against the fixture (no key needed)
 *   node scripts/enrich-venues.mjs resolve   — venue titles -> place IDs
 *   node scripts/enrich-venues.mjs refresh   — place IDs -> src/data/enrichment/enrichment.json
 * Never call this from the app at runtime; data ships bundled.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformPlace } from "./lib/transform.mjs";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

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
else if (cmd === "resolve" || cmd === "refresh") { console.error(`${cmd}: not implemented yet (Task 2)`); process.exit(1); }
else { console.error("usage: node scripts/enrich-venues.mjs <test|resolve|refresh>"); process.exit(1); }
