# Dynamic Happy Hours — Discussion Prep (2026-07-15)

Prep doc for tracker item 2. **Nothing here is approved or built.**

---

## How it works today

`src/components/HappyHourRail.tsx` (105 lines) — and it's genuinely
time-aware already, not a static list:

- Monday-first day tabs, defaulting to today. Only venues with real Google
  happy-hour periods participate; the rail hides itself entirely when none
  exist.
- **Today tab = live urgency:** active happy hours first, sorted ends-soonest
  ("🥂 til 7 PM" in amber), then upcoming-today sorted starts-soonest
  ("🥂 starts 5 PM"). Re-renders every minute via `useMinuteTick`, so a deal
  moves from upcoming → active → gone in real time.
- Other-day tabs: that weekday's windows sorted by start time.
- **Expired deals are structurally impossible** — everything is computed from
  weekly periods in `src/data/enrichment` (`getHappyHourState`,
  `getHappyHourPeriodsForDay`); there's no cached "deals" list that could go
  stale intra-day. On top of that, `getEnrichment()` treats any record >30
  days old as absent (Google ToS cap), so a whole venue's data silently
  drops out rather than showing stale.
- Reached from: **Discover page, "Happy Hours" tab (the default tab)**. The
  map has a separate "Happy hour" chip (`MapPage.tsx` `hhActiveIds`) that
  narrows pins to active-HH venues and cross-links to Discover when empty —
  same data, different surface.

So the tracker's first three inputs (day/time, active-or-soon, venue hours)
and its hardest rule (never show expired deals) are already handled. What's
missing is everything contextual: location, preferences, attributes,
sections, verification display, cooldowns.

## What data actually exists to build on

| Signal | Status |
|---|---|
| Happy-hour windows (when) | **14/47 venues** — per-day counts Sun→Sat: 6, 10, 11, 14, 14, 13, 5. Weekends are the thin days. |
| Deal content (what/price) | **0/47 — `specials.json` is empty.** We know *when*, never *what the deal is*. "Deal quality" and "Best value" are unrankable today. |
| Weekly hours / rating / price range | 42, 43, 41 of 47 (enrichment.json holds 43 venues) |
| Outdoor / patio / rooftop attributes | **Nothing.** Zero fields, zero keyword hits in `venues.ts`. "Rooftop happy hours" has no data at all. |
| User location / distance | Infra exists and is proven — opt-in `useLocationStore` + `haversineMiles`/`formatMiles` already power Find the Move's "Around me". Just not wired to this rail. |
| Verification / freshness | One batch `fetchedAt` (all 43 records: 2026-07-07) + the silent 30-day expiry. **Nothing is displayed to users**, and the current batch goes dark ~Aug 6 unless the enrich script reruns. |
| Preferences / group size / weather | Nothing |
| Recently viewed/dismissed | Nothing — tracker item 5, **PARKED** |

## The realistic approaches

**A. Sectioned, location-aware rail from existing data. (Recommended MVP)**
Restructure the Today tab into labeled sections computed from data we have:
*Happening now* / *Ending soon* (active, <45–60 min left) / *Starting soon* /
*Nearby right now* (opt-in location, reuse the FTM location store — sorted by
distance among active). Per-row explanation labels are 80% built (the 🥂
timing lines); extend to the tracker's label style ("Active for the next 45
minutes", "0.2 mi away"). Add a freshness footer ("Times from Google, checked
Jul 7") and fallback copy for thin days (Sat has 5 venues, Sun 6). No new
schema, no new data source, no randomness — sections differ across the day
by construction. Skip "Best value"/"Rooftop" honestly: no data.

**B. A + a manual data pass on the 14 HH venues (fast follow, unlocks the
rest of the tracker).** Collect actual deal text ("$5 drafts, half-price
apps") into the already-existing-but-empty `specials.json`, plus
`outdoor/rooftop/patio` flags and a per-venue `verifiedAt` for all 47. That's
one afternoon of legwork for a walkable neighborhood, and it's what makes
*Best value*, *Outdoor*, *Rooftop*, and "Verified by venue this week" honest
instead of fabricated. Needs a decision on re-verification cadence (who
checks, how often, what happens when stale → "Information may need
reconfirmation" label).

**C. Full dynamic system — preferences, group size, weather, cooldowns.**
What the tracker ultimately describes. Cooldowns/recently-dismissed are
blocked on item 5 (PARKED until post-launch), weather is a new external
dependency needing its own price/freshness discussion, and group-size
preferences need a real user base to matter. Not now.

**Recommendation: A now, B as a deliberate data errand right behind it, C
post-launch when item 5 unparks.** A is honest with current data; B is the
cheapest possible unlock because the bottleneck is data collection, not code.

## Hard constraints (from the tracker — apply to any approach)

- No random rotation as fake variety — sections must differ because context
  differs (time of day, location, day of week), never by shuffle.
- Impression cooldowns require item 5, which is **parked until post-launch**
  — design section logic to slot cooldowns in later, don't build them now.
- Every shown venue carries an explanation label.
- Never show expired deals — already true by construction; any refactor must
  preserve the compute-from-periods model (no cached deal lists).

## Open product questions

1. Do we do the manual data pass (B: deal text + outdoor/rooftop flags +
   verified-at, ~1 afternoon for 47 venues) before or after shipping the
   sectioned rail? It gates half the tracker's sections.
2. Which sections for v1? (My starter set: Happening now / Ending soon /
   Starting soon / Nearby — value & rooftop wait for B's data.)
3. Should the rail request location, or inherit it only if the user already
   granted it elsewhere (FTM/map)? It'd be the first passive surface to ask.
4. Freshness display: one rail footer, or per-card "checked Jul 7" lines?
5. Weekend thinness (Sat = 5 venues): fallback copy only, or actively
   research whether more of the 47 have unlisted weekend happy hours?

## Files & risks

- Touch: `HappyHourRail.tsx`, `src/data/enrichment/index.ts` (maybe an
  "ending soon" helper), `src/store/location.ts` consumption; approach B also
  fills `specials.json` + adds venue attribute fields (schema-in-JSON only,
  no Supabase change).
- Risks: **the whole rail goes dark ~2026-08-06** when the single 2026-07-07
  enrichment batch hits the 30-day expiry — a refresh cadence for
  `scripts/enrich-venues.mjs` is a prerequisite for anything here; 14-venue
  pool means sections will overlap venues (per-venue section cap needed, and
  the tracker explicitly asks to avoid same-venues-in-every-section); Google
  happy-hour times are unverified ground truth — without B's verification
  pass, "Verified" labels must not appear.
