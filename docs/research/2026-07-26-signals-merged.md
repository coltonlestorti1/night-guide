# Merged Activity Signals — 2026-07-26

Distilled from two independent runs of `docs/venue-research-brief-2.md`.
Raw output preserved in `2026-07-26-signals-run-a.md` and `-run-b.md` — this
file is the extraction, those are the record.

Every item below traces to a URL in one of the raw files. Nothing is inferred.

## Coverage

| Signal | Venues covered | of 59 |
|---|---|---|
| Weekly events | 13 | 22% |
| Crowd reports | 8 | 14% |
| Capacity | 9 | 15% |
| Meaningful door policy | 7 | 12% |
| Cover charge | 2 | 3% |

The two runs overlapped on only 4 of ~34 events and **zero** of 10 crowd
reports, so this is a sample of what is findable, not the whole of it.

## Weekly events — the strongest peak signal we have

Times come from the venue's own posting.

### Late-night peaks (real "hot now" signals)

| Venue | Night | Event | Start |
|---|---|---|---|
| Berlin | Fri, Sat | Berlin Dance Party | 11:00 PM |
| Bowery Palace | Fri, Sat | Weekend Dance Party | 11:00 PM |
| Otto's Shrunken Head | 2nd Tue | Party City | 11:00 PM |
| Nowhere | Mon | Macho Monday | 10:00 PM |
| Nowhere | Sun | Underwear Night | 10:00 PM |
| Club Cumming | Mon | Mondays in the Club with Lance | 9:30 PM |
| Club Cumming | Sun | Burlesque Open Stage | 9:30 PM |
| Otto's Shrunken Head | 3rd Tue | Dark Waters | 9:00 PM |
| The Wayland | Wed | Live Music | 9:00 PM |

### Early/mid-evening anchors

| Venue | Night | Event | Start |
|---|---|---|---|
| Beauty Bar | Sun | Secret Sauce comedy | 8:00 PM |
| Ace Bar | Tue | Trivia Night | 7:00 PM |
| Ace Bar | Thu | Skee-ball League | — |
| Motel No Tell | Mon | Trivia | 7:00 PM |
| Motel No Tell | Tue | Mixtape Bingo | 7:00 PM |
| Motel No Tell | Wed | Live Music | 7:00 PM |
| Club Cumming | Tue | Make It with Brini Maxwell | 6:00 PM |
| Club Cumming | Sun | Drink & Draw | 5:00 PM |
| Otto's Shrunken Head | 1st Tue | Old 2 Begin | 5:00 PM |

### Dance programming, no posted times

Solas runs a partner-dance calendar: Sun tango, Tue zouk, Wed salsa, Thu
bachata, Fri–Sat DJ. Days are sourced; start times are not posted.

### Not peak signals — recorded but tagged separately

Happy hours: Goodnight Sonny (Mon–Fri 4 PM), The Headless Widow (Sat 4 PM),
Motel No Tell (Sun 4 PM), Sing Sing (daily). These describe early evening, not
peak, and must not be treated as crowd signals.

## Crowd reports — line evidence, both directions

### Line-positive

| Venue | When | Evidence | Date |
|---|---|---|---|
| Death & Co | Fri, from opening | 2-hour wait 15 min after opening; "show up at 7 and they'll already be turning people away" | 2022 |
| Death & Co | Fri | "that wait line gets going fast" | 2022 |
| McSorley's | St. Patrick's Day, 1–2 PM | "the line was around the block" | 2024 |
| The Cock | Weekends, 12–3 AM | "Weekends get so crowded (midnight to 3am) that there's often a cover charge" | 2018 |
| Sing Sing | Weekend | "wouldn't return on a packed weekend" | 2026 |
| The Grafton | Knicks/Yankees playoffs | "becomes a full-on watch party… get there early, or make a reservation" | 2025 |

### Line-negative — equally important

| Venue | When | Evidence | Date |
|---|---|---|---|
| Please Don't Tell | ~midnight | "hasn't been much of a wait" | 2022 |
| Please Don't Tell | Fri/Sat ~3 AM | "you should be able to get in" | 2011 |
| Superbueno | ~2 PM opening | "super easy to get in" | 2025 |
| Amor y Amargo | Fri night | "always easy to get in and standing room" | 2026 |

## Capacity

**Caveat: these are private-event and buyout figures, not legal occupancy.**
A buyout number is generally lower than fire-code maximum. Use as a relative
size proxy only.

| Venue | Figure |
|---|---|
| Webster Hall | 1,350 standing (concerts) |
| Ace Bar | 80–200 (private events) |
| Ten Degrees | ~150 across three rooms (45–50 / 75–80 / 25–30) |
| Solas | ~130 across two rooms (30–50 / 75–100) |
| The Wayland | 110 (full buyout) |
| Romeos | 75 |
| Bowery Palace | 65 (VIP room only, not venue total) |
| Death & Co | 50 (full buyout) |
| Sing Sing | 14 private rooms; VIP 25–40 (room-based model, not a floor) |

## Door policy — only the informative ones

Bare "21+" is recorded in the raw files but carries no signal; every venue here
is 21+. These are the ones that actually affect line behavior:

- **Death & Co** — no standing room. Hard seated cap, which is what produces the
  2-hour wait rather than a door pick.
- **Bowery Palace** — dress code: "Weekends: dancin' shoes / Weeknights: rock n
  roll chic / No sandals." A genuine door-pick signal.
- **Sing Sing** — 21+ after 8 PM; 18+ with guardian before 8 PM. Time-dependent
  door policy, which changes who is there by hour.
- **The Cock** — cash only, plus cover on crowded weekends.
- **McSorley's** — cash only.
- **Barcade** — explicitly no cover.
- **Webster Hall** — bag limits, per-event restrictions, right of refusal.

## Cover charge — effectively unobtainable

Two usable data points across 118 venue-rows: Barcade states no cover, The Cock
has an occasional weekend cover. Treat `cover_charge` as an optional field that
will stay mostly empty; it is not worth further research spend.

## What this changes

1. **Line risk is not one curve.** Three distinct mechanics appear in the
   evidence: capacity-constrained reservation rooms that queue *early* and ease
   *late* (Death & Co, PDT), volume rooms that queue *late* (The Cock, Berlin),
   and occasion-driven rooms whose queue tracks an external calendar entirely
   (The Grafton on playoff nights, McSorley's on St. Patrick's). A single
   time-of-night function would have modeled the first group exactly backwards.
2. **Negative evidence needs a home.** "Always easy to get in" is a real,
   sourced finding for Amor y Amargo and Superbueno. The data model has no way
   to record a confident *absence* of line risk, and it should.
3. **Posted event times outrank estimated windows.** For the 13 venues above, a
   sourced 11:00 PM start is better evidence than any derived curve.
