# Google Venue Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grafton-style venue cards fed by an official Google Places API (New) batch pipeline — hours/open-now, price range, rating, happy hour, phone, website — plus a curated-specials slot and a provider-agnostic popular-times chart.

**Architecture:** A zero-dependency Node script fetches Place Details for the 19 seeded venues and writes a committed `enrichment.json` keyed by venue title (identical across Supabase seed and demo data). The app reads it synchronously via a small module that also computes open/closed state client-side from stored weekly periods (Google's `openNow` is never displayed — stale at cache time). UI: a `VenueInfoCard` + `PopularTimesChart` on `VenueDetail`, one compact line on `BarCard`.

**Tech Stack:** Node ≥18 (`node:fetch`, `node:assert`), Vite + React + TS + Tailwind/shadcn (existing), no new npm dependencies.

## Global Constraints

- Verification (no test runner in repo): `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc --noEmit` is a silent no-op), `npm run build`, `node scripts/enrich-venues.mjs test`, Playwright browser pass.
- Shipped app data files start empty: `enrichment.json` = `{}`, `specials.json` = `{}`. Fixtures live only under `scripts/fixtures/` and never ship into app data. No fabricated stats for real venues.
- Attribution line must render wherever Google-sourced content (rating, editorial summary, hours, price) is displayed: "Hours, price & rating data: Google".
- Records with `fetchedAt` older than 30 days are treated as absent (ToS caching limit).
- Script guards: abort if venue list > 100; 200ms between calls; 1 retry on 5xx; abort loudly on any 4xx printing the response body. Never called from the app at runtime.
- Copy tone: direct, casual; no banned marketing phrases (see CLAUDE.md).
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Day convention everywhere: `0 = Sunday … 6 = Saturday` (matches Google periods and JS `Date.getDay()`).

---

### Task 1: Fetch transform + fixture + `test` harness

**Files:**
- Create: `scripts/venue-titles.json`
- Create: `scripts/fixtures/place-details.sample.json`
- Create: `scripts/lib/transform.mjs`
- Create: `scripts/enrich-venues.mjs` (test subcommand only in this task)

**Interfaces:**
- Produces: `transformPlace(place, fetchedAt)` → enrichment record `{ placeId, fetchedAt, rating?, userRatingCount?, priceRange?, editorialSummary?, phone?, websiteUri?, googleMapsUri?, businessStatus?, hours?, happyHour? }`; `WeeklyPeriod = { day, openHour, openMinute, closeHour, closeMinute, closeDayOffset }`. Task 2 wires it into `refresh`; Task 3 mirrors these shapes in TS.

- [ ] **Step 1: Write `scripts/venue-titles.json`** — the 19 titles exactly as in `src/data/venues.ts`:

```json
["The Grafton", "Standings", "International Bar", "Coyote Ugly Saloon", "Niagara Bar", "Paul's Cocktail Lounge", "Lucy's Bar", "Doc Holliday's", "Cienfuegos", "The Library", "Manitoba's", "Death & Co", "The Summit Bar", "Alphabet City Beer Co", "The Bourgeois Pig", "KGB Bar", "McSorley's Old Ale House", "Angel's Share", "Beauty Bar"]
```

- [ ] **Step 2: Write the fixture** `scripts/fixtures/place-details.sample.json` — realistic Places API (New) Place Details response shaped like The Grafton (test-only; never ships):

```json
{
  "id": "ChIJTESTGraftonPlaceId",
  "displayName": { "text": "The Grafton", "languageCode": "en" },
  "rating": 4.5,
  "userRatingCount": 823,
  "businessStatus": "OPERATIONAL",
  "nationalPhoneNumber": "(212) 228-8580",
  "websiteUri": "https://thegraftonnyc.com/",
  "googleMapsUri": "https://maps.google.com/?cid=123",
  "editorialSummary": { "text": "This laid-back Irish bar offers pub grub, pints & plenty of TVs for catching the game.", "languageCode": "en" },
  "priceRange": { "startPrice": { "currencyCode": "USD", "units": "10" }, "endPrice": { "currencyCode": "USD", "units": "40" } },
  "regularOpeningHours": {
    "periods": [
      { "open": { "day": 1, "hour": 12, "minute": 0 }, "close": { "day": 2, "hour": 2, "minute": 0 } },
      { "open": { "day": 2, "hour": 12, "minute": 0 }, "close": { "day": 3, "hour": 2, "minute": 0 } },
      { "open": { "day": 3, "hour": 12, "minute": 0 }, "close": { "day": 4, "hour": 2, "minute": 0 } },
      { "open": { "day": 4, "hour": 12, "minute": 0 }, "close": { "day": 5, "hour": 2, "minute": 0 } },
      { "open": { "day": 5, "hour": 12, "minute": 0 }, "close": { "day": 6, "hour": 3, "minute": 0 } },
      { "open": { "day": 6, "hour": 11, "minute": 0 }, "close": { "day": 0, "hour": 3, "minute": 0 } },
      { "open": { "day": 0, "hour": 11, "minute": 0 }, "close": { "day": 1, "hour": 1, "minute": 0 } }
    ]
  },
  "regularSecondaryOpeningHours": [
    {
      "secondaryHoursType": "HAPPY_HOUR",
      "periods": [
        { "open": { "day": 1, "hour": 16, "minute": 0 }, "close": { "day": 1, "hour": 19, "minute": 0 } },
        { "open": { "day": 2, "hour": 16, "minute": 0 }, "close": { "day": 2, "hour": 19, "minute": 0 } },
        { "open": { "day": 3, "hour": 16, "minute": 0 }, "close": { "day": 3, "hour": 19, "minute": 0 } },
        { "open": { "day": 4, "hour": 16, "minute": 0 }, "close": { "day": 4, "hour": 19, "minute": 0 } },
        { "open": { "day": 5, "hour": 16, "minute": 0 }, "close": { "day": 5, "hour": 19, "minute": 0 } }
      ]
    }
  ]
}
```

- [ ] **Step 3: Write `scripts/lib/transform.mjs`:**

```js
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
  };
  // drop undefined keys so the committed JSON stays clean
  return Object.fromEntries(Object.entries(rec).filter(([, v]) => v !== undefined));
}
```

- [ ] **Step 4: Write `scripts/enrich-venues.mjs` with the `test` subcommand** (resolve/refresh are Task 2 — for now they print "not implemented" and exit 1):

```js
#!/usr/bin/env node
/**
 * ENDZ venue enrichment pipeline (Google Places API (New), free-tier batch).
 *   node scripts/enrich-venues.mjs test      — transform against the fixture (no key needed)
 *   node scripts/enrich-venues.mjs resolve   — venue titles -> place IDs (Task 2)
 *   node scripts/enrich-venues.mjs refresh   — place IDs -> src/data/enrichment/enrichment.json (Task 2)
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
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `node scripts/enrich-venues.mjs test` → `transform test: PASS`

- [ ] **Step 6: Commit**

```bash
git add scripts/ && git commit -m "feat: add Places transform, fixture, and test harness for venue enrichment"
```

---

### Task 2: CLI `resolve` + `refresh` + dormant SerpApi provider

**Files:**
- Modify: `scripts/enrich-venues.mjs`
- Create: `scripts/providers/serpapi.mjs`

**Interfaces:**
- Consumes: `transformPlace` (Task 1), `scripts/venue-titles.json`.
- Produces: `scripts/place-ids.json` (`Record<title, { placeId, matchedName, address } | null>`); writes `src/data/enrichment/enrichment.json` (`Record<title, record>`), preserving existing `popularTimes`/`popularTimesSource` keys on merge. `fetchPopularTimes(query, apiKey)` in serpapi.mjs → `PopularTimesDay[] | null`.

- [ ] **Step 1: Replace the resolve/refresh stubs** in `scripts/enrich-venues.mjs` with the real implementation (test subcommand unchanged):

```js
// --- add below the imports from Task 1 ---
import { writeFileSync, existsSync } from "node:fs";

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
```

And the dispatcher at the bottom becomes:

```js
const cmd = process.argv[2];
if (cmd === "test") runTest();
else if (cmd === "resolve") await resolve();
else if (cmd === "refresh") await refresh();
else { console.error("usage: node scripts/enrich-venues.mjs <test|resolve|refresh> [--popular-times]"); process.exit(1); }
```

- [ ] **Step 2: Write `scripts/providers/serpapi.mjs`** (dormant until SERPAPI_KEY exists; defensive about response shape — needs a live-shape check on first enable):

```js
/**
 * SerpApi popular-times provider (DORMANT until SERPAPI_KEY is set).
 * SerpApi scrapes Google Maps; using it is ToS-gray — enabling is a user
 * decision, documented in the 2026-07-06 enrichment spec. Long-term the
 * provider is our own check-in history.
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
```

- [ ] **Step 3: Verify behavior without a key**

Run: `node scripts/enrich-venues.mjs test` → PASS (unchanged).
Run: `node scripts/enrich-venues.mjs refresh` → exits 1 with the GOOGLE_PLACES_API_KEY setup instructions (or proceeds if the user's key already landed — then STOP and review the resolve mapping before committing any real data).

- [ ] **Step 4: Commit**

```bash
git add scripts/ && git commit -m "feat: add resolve/refresh CLI and dormant SerpApi popular-times provider"
```

---

### Task 3: App-side enrichment module

**Files:**
- Create: `src/data/enrichment/types.ts`
- Create: `src/data/enrichment/enrichment.json` (`{}`)
- Create: `src/data/enrichment/specials.json` (`{}`)
- Create: `src/data/enrichment/index.ts`
- Check/Modify: `tsconfig.app.json` (ensure `resolveJsonModule: true`)

**Interfaces:**
- Produces (consumed by Tasks 4–6):
  - `getEnrichment(title: string): VenueEnrichment | undefined` (undefined when absent or >30d old)
  - `getSpecials(title: string): Special[]`
  - `computeOpenState(hours: WeeklyPeriod[] | undefined, now?: Date): { open: boolean; closesAt?: string; opensAt?: string } | null`
  - `formatPeriodRange(p: WeeklyPeriod): string` (e.g. `"4–7 PM"`), `describeWeeklyPeriods(ps: WeeklyPeriod[]): string[]` (e.g. `["Mon–Fri 4–7 PM"]`), `DAY_SHORT: string[]`

- [ ] **Step 1: `src/data/enrichment/types.ts`:**

```ts
export type WeeklyPeriod = {
  day: number; // 0 = Sunday … 6 = Saturday
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  closeDayOffset: 0 | 1;
};

export type PopularTimesDay = {
  day: number; // 0 = Sunday … 6 = Saturday
  hours: { hour: number; busyness: number }[]; // busyness 0–100
};

export type VenueEnrichment = {
  placeId: string;
  fetchedAt: string; // ISO; records >30 days old are treated as absent (Google ToS)
  rating?: number;
  userRatingCount?: number;
  priceRange?: string; // e.g. "$10–40"
  editorialSummary?: string;
  phone?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  hours?: WeeklyPeriod[];
  happyHour?: WeeklyPeriod[];
  popularTimes?: PopularTimesDay[];
  popularTimesSource?: "serpapi";
};
```

- [ ] **Step 2: empty data files** — `src/data/enrichment/enrichment.json` and `src/data/enrichment/specials.json` both containing exactly `{}`.

- [ ] **Step 3: `src/data/enrichment/index.ts`:**

```ts
/**
 * Bundled Google-enrichment data (see scripts/enrich-venues.mjs and the
 * 2026-07-06 enrichment spec). Synchronous by design — no network at runtime.
 * Open/closed is computed here from weekly periods; Google's stale openNow
 * boolean is never stored or shown.
 */
import type { Special } from "@/data/types";
import type { VenueEnrichment, WeeklyPeriod } from "./types";
import enrichmentJson from "./enrichment.json";
import specialsJson from "./specials.json";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // Google ToS caching limit
const WEEK_MIN = 7 * 24 * 60;

const enrichment = enrichmentJson as Record<string, VenueEnrichment>;
const specials = specialsJson as Record<string, Special[]>;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isExpired(e: VenueEnrichment): boolean {
  return Date.now() - Date.parse(e.fetchedAt) > MAX_AGE_MS;
}

export function getEnrichment(title: string): VenueEnrichment | undefined {
  const e = enrichment[title];
  if (!e) return undefined;
  if (isExpired(e)) {
    if (import.meta.env.DEV) console.warn(`enrichment for "${title}" is >30d old — rerun scripts/enrich-venues.mjs refresh`);
    return undefined;
  }
  return e;
}

export function getSpecials(title: string): Special[] {
  return specials[title] ?? [];
}

export function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${h}${m} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatPeriodRange(p: WeeklyPeriod): string {
  const open = formatTime(p.openHour, p.openMinute);
  const close = formatTime(p.closeHour, p.closeMinute);
  const [oT, oM] = open.split(" ");
  const [cT, cM] = close.split(" ");
  return oM === cM ? `${oT}–${cT} ${cM}` : `${open}–${close}`;
}

/** Group identical time ranges over runs of days: [Mon..Fri 4–7 PM] -> "Mon–Fri 4–7 PM". */
export function describeWeeklyPeriods(ps: WeeklyPeriod[]): string[] {
  const ordered = [...ps].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)); // Monday-first
  const groups: { days: number[]; range: string }[] = [];
  for (const p of ordered) {
    const range = formatPeriodRange(p);
    const last = groups[groups.length - 1];
    const lastDay = last?.days[last.days.length - 1];
    if (last && last.range === range && lastDay !== undefined && (lastDay + 1) % 7 === p.day) last.days.push(p.day);
    else groups.push({ days: [p.day], range });
  }
  return groups.map((g) =>
    g.days.length === 1
      ? `${DAY_SHORT[g.days[0]]} ${g.range}`
      : `${DAY_SHORT[g.days[0]]}–${DAY_SHORT[g.days[g.days.length - 1]]} ${g.range}`,
  );
}

export type OpenState = { open: boolean; closesAt?: string; opensAt?: string };

export function computeOpenState(hours: WeeklyPeriod[] | undefined, now: Date = new Date()): OpenState | null {
  if (!hours || hours.length === 0) return null;
  const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
  let nextOpen: { at: number; p: WeeklyPeriod } | null = null;
  for (const p of hours) {
    const start = p.day * 1440 + p.openHour * 60 + p.openMinute;
    const end = (p.day + p.closeDayOffset) * 1440 + p.closeHour * 60 + p.closeMinute;
    const inWindow = (start <= nowMin && nowMin < end) || (end > WEEK_MIN && nowMin < end - WEEK_MIN);
    if (inWindow) return { open: true, closesAt: formatTime(p.closeHour, p.closeMinute) };
    const wait = (start - nowMin + WEEK_MIN) % WEEK_MIN;
    if (!nextOpen || wait < (nextOpen.at - nowMin + WEEK_MIN) % WEEK_MIN) nextOpen = { at: start, p };
  }
  if (!nextOpen) return null;
  const sameDay = nextOpen.p.day === now.getDay();
  const t = formatTime(nextOpen.p.openHour, nextOpen.p.openMinute);
  return { open: false, opensAt: sameDay ? t : `${DAY_SHORT[nextOpen.p.day]} ${t}` };
}
```

- [ ] **Step 4: Ensure `resolveJsonModule`** — `grep resolveJsonModule tsconfig.app.json`; if absent add `"resolveJsonModule": true` to `compilerOptions`.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit -p tsconfig.app.json` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/data/enrichment tsconfig.app.json && git commit -m "feat: add bundled enrichment data module with client-side open-state"
```

---

### Task 4: `VenueInfoCard` + VenueDetail integration (info, About fallback, specials)

**Files:**
- Create: `src/components/VenueInfoCard.tsx`
- Modify: `src/pages/VenueDetail.tsx` (body section, currently lines 88–98)

**Interfaces:**
- Consumes: `getEnrichment`, `getSpecials`, `computeOpenState`, `describeWeeklyPeriods` (Task 3).
- Produces: `<VenueInfoCard venue={Venue} />` — renders null without enrichment.

- [ ] **Step 1: `src/components/VenueInfoCard.tsx`:**

```tsx
/**
 * Grafton-style reference info: live-computed open state, weekly hours,
 * price range, rating, happy hour, phone, website. Renders nothing without
 * enrichment data. Attribution line is required wherever this shows (Google ToS).
 */
import { useState } from "react";
import { Venue } from "@/data/types";
import { getEnrichment, computeOpenState, describeWeeklyPeriods } from "@/data/enrichment";
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

      {e.happyHour && (
        <div className="flex items-start gap-2 text-sm">
          <Martini className="h-4 w-4 text-primary mt-0.5" />
          <span><span className="font-medium text-primary">Happy hour</span>{" "}
            <span className="text-muted-foreground">{describeWeeklyPeriods(e.happyHour).join(" · ")}</span></span>
        </div>
      )}

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
```

(If `Martini` doesn't exist in the installed lucide-react version, use `Wine` — check with a quick import + tsc.)

- [ ] **Step 2: Integrate in `VenueDetail.tsx`** — replace the body block (`{/* Body */}` div, lines 88–98) with:

```tsx
{/* Body */}
<div className="container pt-5 space-y-5 max-w-2xl">
  <VenueStatTiles venue={data} />
  <CheckInCard venueId={data.id} />
  {getSpecials(data.title).length > 0 && (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Specials</h2>
      <ul className="space-y-2">
        {getSpecials(data.title).map((s) => (
          <li key={s.title} className="rounded-xl bg-secondary/60 p-3">
            <p className="text-sm font-medium">{s.title}</p>
            {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  )}
  {(data.description || getEnrichment(data.title)?.editorialSummary) && (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">About</h2>
      <p className="text-sm leading-relaxed text-foreground/90">
        {data.description ?? getEnrichment(data.title)?.editorialSummary}
      </p>
      {!data.description && <p className="text-[10px] text-muted-foreground/70 mt-1">Description: Google</p>}
    </div>
  )}
  <VenueInfoCard venue={data} />
</div>
```

with imports added at the top: `import VenueInfoCard from "@/components/VenueInfoCard";` and `import { getEnrichment, getSpecials } from "@/data/enrichment";`

- [ ] **Step 3: Typecheck + build** — `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/VenueInfoCard.tsx src/pages/VenueDetail.tsx && git commit -m "feat: add venue info card, specials section, and About fallback to detail page"
```

---

### Task 5: `PopularTimesChart`

**Files:**
- Create: `src/components/PopularTimesChart.tsx`
- Modify: `src/pages/VenueDetail.tsx` (insert below `CheckInCard`, above Specials)

**Interfaces:**
- Consumes: `PopularTimesDay` type, `formatTime`, `DAY_SHORT` (Task 3); venue enrichment via `getEnrichment(venue.title)?.popularTimes` at the call site.
- Produces: `<PopularTimesChart data={PopularTimesDay[]} />` — renders null on empty data.

- [ ] **Step 1: `src/components/PopularTimesChart.tsx`** (dataviz rules applied: single series → uniform muted bars, height carries magnitude; current-hour bar in primary accent; day tabs = filter row above; readout line instead of per-bar number labels; text in text tokens; 4px rounded data ends; 2px bar gaps; per-bar tap targets with aria labels):

```tsx
/**
 * "Popular times" histogram — historical busyness pattern (0–100 per hour).
 * Provider-agnostic: renders whatever popularTimes data exists (see the
 * 2026-07-06 enrichment spec). Live "right now" stays the check-in counts.
 */
import { useState } from "react";
import { PopularTimesDay } from "@/data/enrichment/types";
import { formatTime, DAY_SHORT } from "@/data/enrichment";
import { cn } from "@/lib/utils";

const busynessLabel = (b: number) =>
  b >= 85 ? "usually as busy as it gets" : b >= 60 ? "usually busy" : b >= 30 ? "usually steady" : "usually quiet";

const TAB_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, like the reference UI

export default function PopularTimesChart({ data }: { data: PopularTimesDay[] }) {
  const now = new Date();
  const [day, setDay] = useState(now.getDay());
  const [picked, setPicked] = useState<number | null>(null);
  if (!data || data.length === 0) return null;
  const dayData = data.find((d) => d.day === day);
  const isToday = day === now.getDay();
  const readoutHour = picked ?? (isToday && dayData?.hours.some((h) => h.hour === now.getHours()) ? now.getHours() : null);
  const readout = readoutHour != null ? dayData?.hours.find((h) => h.hour === readoutHour) : undefined;

  return (
    <div className="rounded-2xl glass p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Popular times</h2>
      <div role="tablist" aria-label="Day of week" className="flex gap-1 mb-3">
        {TAB_ORDER.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={day === d}
            onClick={() => { setDay(d); setPicked(null); }}
            className={cn(
              "flex-1 text-[11px] font-medium py-1 rounded-lg uppercase tracking-wide",
              day === d ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent/10",
            )}
          >
            {DAY_SHORT[d]}
          </button>
        ))}
      </div>
      {dayData ? (
        <>
          <p className="text-xs text-muted-foreground h-4 mb-2" aria-live="polite">
            {readout ? `${formatTime(readout.hour, 0)}: ${busynessLabel(readout.busyness)}` : " "}
          </p>
          <div className="flex items-end gap-0.5 h-24" role="img"
            aria-label={`Busyness by hour, ${DAY_SHORT[day]}. Tap a bar for details.`}>
            {dayData.hours.map((h) => (
              <button
                key={h.hour}
                onClick={() => setPicked(h.hour === picked ? null : h.hour)}
                aria-label={`${formatTime(h.hour, 0)}: ${busynessLabel(h.busyness)}`}
                className="flex-1 flex items-end h-full min-w-[6px]"
              >
                <span
                  className={cn(
                    "w-full rounded-t",
                    isToday && h.hour === now.getHours() ? "bg-primary" : "bg-muted-foreground/35",
                    picked === h.hour && "ring-2 ring-ring",
                  )}
                  style={{ height: `${Math.max(h.busyness, 4)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 mt-1">
            {dayData.hours.map((h) => (
              <span key={h.hour} className="flex-1 text-center text-[9px] text-muted-foreground/70">
                {h.hour % 3 === 0 ? formatTime(h.hour, 0).replace(" ", "").replace("M", "").toLowerCase() : ""}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No data for {DAY_SHORT[day]} yet.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate in `VenueDetail.tsx`** — directly after `<CheckInCard venueId={data.id} />`:

```tsx
{getEnrichment(data.title)?.popularTimes && (
  <PopularTimesChart data={getEnrichment(data.title)!.popularTimes!} />
)}
```

with `import PopularTimesChart from "@/components/PopularTimesChart";` added.

- [ ] **Step 3: Typecheck + build** — both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/PopularTimesChart.tsx src/pages/VenueDetail.tsx && git commit -m "feat: add popular-times chart (provider-agnostic, renders only real data)"
```

---

### Task 6: `BarCard` compact open/rating line

**Files:**
- Modify: `src/components/BarCard.tsx` (meta row, lines 66–80)

**Interfaces:**
- Consumes: `getEnrichment`, `computeOpenState` (Task 3).

- [ ] **Step 1:** Add imports and, inside the component body, `const e = getEnrichment(venue.title); const openState = computeOpenState(e?.hours);` then insert as the FIRST children of the meta row div (before the `hereCount` span):

```tsx
{openState && (
  <span className={openState.open ? "text-emerald-400" : undefined}>
    ● {openState.open ? `Open${openState.closesAt ? ` til ${openState.closesAt}` : ""}` : "Closed"}
  </span>
)}
{e?.rating != null && <span>★ {e.rating.toFixed(1)}</span>}
```

- [ ] **Step 2: Typecheck + build** — both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/BarCard.tsx && git commit -m "feat: show open state and rating on venue list cards"
```

---

### Task 7: Browser verification (empty + fixture-injected) and data reset

**Files:**
- Temporarily modify: `src/data/enrichment/enrichment.json`, `src/data/enrichment/specials.json` (MUST be restored to `{}` before commit)

- [ ] **Step 1: Empty-state pass** — `npm run dev`, Playwright: open map → drawer → The Grafton detail. Expect: no Info card, no chart, no Specials, no open/rating line, no console errors. (Everything renders exactly as before this feature.)

- [ ] **Step 2: Fixture inject** — write a temporary enrichment.json entry for `"The Grafton"` using `transformPlace(fixture)` output plus a hand-made `popularTimes` array (e.g. Saturday hours 12–26 mapped to 0–23 with a 22:00 peak of 95) and one temporary specials.json entry (`{"The Grafton": [{"title": "TEST ENTRY — do not ship"}]}`). Reload detail page. Expect: Info card with "● Open · Closes 2 AM" (time-dependent — assert against `computeOpenState` result, not a hardcoded string), happy hour "Mon–Fri 4–7 PM", "$10–40 per person", "★ 4.5 · 823 reviews", phone + website rows, attribution line; Popular times chart with day tabs and tappable bars; Specials section; BarCard line in the drawer. Screenshot for the user.
- [ ] **Step 3: RESTORE both JSON files to `{}`** — then `git status` must show no diff on either file. This is the no-fake-data gate; do not skip.
- [ ] **Step 4: Final typecheck + build + script test** — all three clean/PASS.
- [ ] **Step 5: Commit anything remaining (docs/plan checkboxes) and stop.**

---

## Deferred to the user's return (not in this plan)

1. `GOOGLE_PLACES_API_KEY` into `.env.local` → run `resolve` (review mapping!) → `refresh` → commit real `enrichment.json` → live browser pass with real data.
2. SerpApi opt-in decision for popular times (ToS-gray; adapter is dormant).
3. Hand-curate first real specials/happy-hour deal text.
4. Later: migrate enrichment storage to a Supabase table when refresh cadence must decouple from deploys; own-check-in-history popular-times provider.
