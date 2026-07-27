# Research — activity & heat system

Everything gathered for the activity/heat system, 2026-07-26 to 2026-07-27.
Raw outputs are preserved verbatim; extractions are marked as such.

| File | What it is | Status |
|---|---|---|
| `2026-07-26-seed-activity-dataset.md` | Colton's original 40-venue activity table | **Source of the 10 researched venues** in `baseline.json` |
| `2026-07-26-round1-venue-traits.md` | Type, best-nights, music, ages, college-scene, descriptions for 59 venues | **Not yet ingested** |
| `2026-07-26-signals-run-a.md` | Round-2 run A, raw | Extracted below |
| `2026-07-26-signals-run-b.md` | Round-2 run B, raw | Extracted below |
| `2026-07-26-signals-merged.md` | Round-2 extraction: events, crowd reports, capacity, door policy | **Ingested** into `baseline.json` line patterns |

Briefs that produced these: `docs/venue-research-brief.md` (round 1),
`docs/venue-research-brief-2.md` (round 2).
Verified candidate venues: `docs/venue-candidates.md`.

## The three findings that shaped the design

**1. Busy windows are not published for ordinary bars.** Round 1 asked directly
across 59 venues; 43 of 46 live venues came back empty. This is a property of
the world, not a prompt failure. The only systematic source of hourly busyness
is Google popular-times, which is why `popularTimes` is 0/56 and why the
archetype-curve approach exists at all. Do not spend more research budget
asking for busy windows directly.

**2. Line behaviour has three distinct mechanics.** A single time-of-night curve
models one of them exactly backwards:

- *Capacity-constrained rooms queue EARLY and ease LATE.* Death & Co: a 2-hour
  wait 15 minutes after opening, "show up at 7 and they'll already be turning
  people away". PDT: easier around midnight, and you can get in at 3 AM.
- *Volume rooms queue LATE.* The Cock: crowded midnight–3 AM.
- *Occasion rooms track an external calendar, not the hour.* The Grafton on
  playoff nights; McSorley's on St. Patrick's Day.

This is why `line_pattern` exists as a per-venue field.

**3. Confident negative evidence is as valuable as positive.** Amor y Amargo
"always easy to get in and standing room" (2026); Superbueno "super easy to get
in" (2025). Without somewhere to record a known *absence* of line risk, the
model invents it. That is what `line_pattern: none` means — not "unknown", but
"we know this place does not queue".

## Two things NOT worth researching again

- **Cover charge.** Two usable data points across 118 venue-rows.
- **Busy/peak windows for ordinary bars.** See finding 1.

## What round 2 asked for instead, and why it worked

Round 1 asked for judgments ("when is it busy"). Round 2 asked for published
facts that *imply* busyness — event schedules, door policy, capacity, dated
crowd reports — and required a URL for every filled cell. That structural
requirement is what stopped the fabrication: no URL, no cell.

Two independent runs of the same round-2 prompt overlapped on only 4 of ~34
events and **zero** of 10 crowd reports. Each run samples a fraction of what is
findable. If more is wanted, re-run the same prompt and union the results
rather than writing a new prompt.
