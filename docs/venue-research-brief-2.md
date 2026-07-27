# Research Brief 2 — Observable Activity Signals

Second research pass. Round 1 asked directly for busy/peak windows and came back
93% empty, which established that those windows are not published as text for
ordinary bars. This pass asks instead for the **observable, published facts that
imply busyness** — event schedules, door policy, capacity, dated crowd reports —
each with a source URL. The busy windows get derived from those facts on our
side, so provenance survives into `source_type`.

Round 1 output lives in `docs/research/`. This brief does not re-ask for
type, music, age skew, college scene, or description — those came back complete.

---

## THE PROMPT — copy everything below this line

I need published, verifiable facts about a set of New York City bars and
nightlife venues, almost all in the East Village. This feeds a nightlife map
app for 21-25 year olds. I am NOT asking you to estimate how busy these places
are. I am asking you to find things that are actually written down somewhere.

THE ONE RULE THAT MATTERS: every non-empty cell must be backed by a URL you
actually visited. If you have no URL, leave the cell empty. Do not infer, do not
reason from venue type, do not fill gaps with what is typical for a dive bar or
a club. An empty table is a useful result. A plausible-sounding invented result
is worse than useless to me, because it gets baked into an algorithm and I
permanently lose the ability to tell which numbers are real.

Specifically forbidden:
- Inferring a busy time from a venue's category, price, or closing hour.
- Repeating a claim from a listing aggregator that has no primary source.
- Saying "typically" or "usually" about crowd levels without a citation.
- Filling a cell because the row looks empty.

Return THREE separate tables.

=== TABLE 1: VENUE FACTS ===
One row per venue. Columns:

venue | closing_time_by_night | cover_charge | door_policy | capacity | reservation_policy | stated_busy_claim | stated_busy_source_url

- closing_time_by_night: actual last call / close per night if posted.
- cover_charge: dollar amount and which nights, or "none" if the venue states
  there is no cover. Empty if not stated anywhere.
- door_policy: is there a bouncer, a guest list, a dress code, a door pick, an
  ID policy stricter than 21+. Empty if nothing published.
- capacity: legal or stated occupancy. Look at liquor license filings, fire code
  records, venue-rental or private-event pages, press coverage. This is often
  findable on event-rental pages even when nowhere else.
- reservation_policy: walk-in only, reservations required, waitlist app, etc.
- stated_busy_claim: ONLY fill this if a source explicitly states when the place
  gets busy or crowded. Quote the sentence. Example of a valid fill: a venue's
  own Instagram saying "we get packed after midnight on Saturdays." An invalid
  fill: your own sense that it is probably busy then.
- stated_busy_source_url: the URL for that quote. If empty, stated_busy_claim
  must also be empty.

=== TABLE 2: RECURRING WEEKLY EVENTS ===
One row per event, so a venue with four weekly events gets four rows. This is
the most valuable table in this brief — a posted 10 PM show start is a real
peak-time signal, unlike a guess. Columns:

venue | day_of_week | event_name | start_time | end_time | cover | recurring_or_oneoff | source_url

- Include trivia, bingo, karaoke nights, drag shows, comedy, live music
  residencies, DJ residencies, dance nights, game-day specials, happy hours that
  are unusually late or unusually promoted.
- start_time must come from the posting. If a listing says "Trivia Tuesdays" but
  gives no time, put the venue and day in and leave start_time empty.
- Mark recurring_or_oneoff as "recurring" only if the source indicates it repeats
  weekly. A single dated event is "oneoff".

=== TABLE 3: DATED CROWD REPORTS ===
One row per report. These are individually weak but collectively meaningful, so
I want the raw observations rather than your synthesis. Columns:

venue | report_date | day_and_time_described | quote | wait_or_line_mentioned | source_url

- Pull from Google reviews, Yelp reviews, Reddit threads, blog posts, press.
- Only include reports that name a specific day, time, or wait. "Great vibes"
  is useless. "Showed up at 11:30 on a Saturday and waited 25 minutes outside"
  is exactly what I want.
- report_date is when the report was written or the visit happened. If you can
  only tell the year, give the year.
- Quote the relevant sentence directly. Do not paraphrase.
- Prefer reports from the last 24 months. Older is acceptable if you label it.
- It is fine to return several rows for one venue and zero for another. Zero is
  an honest answer.

FORMAT NOTES:
- Times in 12-hour format with AM/PM. Late nights continue into the next
  morning, e.g. "10:00 PM to 3:00 AM".
- Every source_url must be a real, complete, working URL. Not a footnote number,
  not a site name. If you cannot produce the URL, leave the row out.
- Output the three tables and nothing else. No preamble, no summary, no
  methodology section.

AFTER the three tables, add exactly two short lists:
- Venues where you found no usable data at all.
- Venues that appear closed, renamed, or relocated, with the URL showing it.

Two notes on the addresses below:
- "Loisaida Ave" is Google's rendering of Avenue C. Same street.
- Deluxx Fluxx and Webster Hall are both at 125 E 11th St, and Berlin is the
  basement room beneath 2A at 25 Avenue A. Research each separately.

Here are the venues.

### Group A — live East Village venues (46)

1. The Grafton — 126 1st Ave (NY 10009)
2. Standings — 43 E 7th St (NY 10003)
3. International Bar — 102 1st Ave (NY 10009)
4. Coyote Ugly Saloon — 233 E 14th St (NY 10003)
5. Lucy's Bar — 135 Avenue A (NY 10009)
6. Death & Co — 433 E 6th St (NY 10009)
7. The Summit Bar — 133 Loisaida Ave (NY 10009)
8. Alphabet City Beer Co — 96 Loisaida Ave (NY 10009)
9. KGB Bar — 85 E 4th St (NY 10003)
10. McSorley's Old Ale House — 15 E 7th St (NY 10003)
11. Beauty Bar — 231 E 14th St (NY 10003)
12. Please Don't Tell — 113 St Marks Pl (NY 10009)
13. The Wayland — 700 E 9th St (NY 10009)
14. d.b.a. — 41 1st Ave (NY 10003)
15. Juke Bar — 196 2nd Ave (NY 10003)
16. Holiday Cocktail Lounge — 75 St Marks Pl (NY 10003)
17. Ten Degrees — 121 St Marks Pl (NY 10009)
18. The Headless Widow — 99 1st Ave (NY 10003)
19. Wonderland Bar — 96 2nd Ave (NY 10003)
20. Bua — 122 St Marks Pl (NY 10009)
21. Superbueno — 13 1st Ave (NY 10003)
22. Sweet Linda — 29 2nd Ave (NY 10003)
23. Motel No Tell — 210 Avenue A (NY 10009)
24. Solas — 232 E 9th St #1 (NY 10003)
25. Paradise Lost — 100 2nd Ave (NY 10003)
26. Goodnight Sonny — 134 1st Ave (NY 10009)
27. Deluxx Fluxx — 125 E 11th St (NY 10003)
28. Lucky — 168 Avenue B (NY 10009)
29. Mona's — 224 Avenue B Unit 14 (NY 10009)
30. The York — 186 Avenue B (NY 10009)
31. The Spotted Owl Tavern — 211 Avenue A (NY 10009)
32. Accidental Bar — 98 Loisaida Ave (NY 10009)
33. Berlin — 25 Avenue A (NY 10009)
34. Little Rebel — 219 2nd Ave (NY 10003)
35. Romeos — 118 St Marks Pl (NY 10009)
36. Club Cumming — 505 E 6th St (NY 10009)
37. Big Bar — 75 E 7th St (NY 10003)
38. Two Perrys — 127 Loisaida Ave (NY 10009)
39. 96 Tears — 110 Avenue A (NY 10009)
40. Double Down Saloon — 14 Avenue A (NY 10009)
41. Lovers of Today — 132 1/2 E 7th St (NY 10009)
42. Banshee — 143 1st Ave (NY 10003)
43. Sake Bar Decibel — 240 E 9th St (NY 10003)
44. Barcade — 6 St Marks Pl (NY 10003)
45. Blue & Gold Tavern — 79 E 7th St (NY 10003)
46. Otto's Shrunken Head — 538 E 14th St (NY 10009)

### Group B — East Village venues we are considering adding (13)

1. Webster Hall — 125 E 11th St — live music venue / club — HIGH priority
2. The Cock — 93 2nd Ave — gay bar / late-night — HIGH priority
3. The Boiler Room — 45 2nd Ave — gay bar — HIGH priority
4. Sing Sing Ave A. — 81 Avenue A — karaoke — HIGH priority
5. 7B Horseshoe Bar (Vazac's) — 108 Avenue B — dive bar — HIGH priority
6. Ace Bar — 531 E 5th St — activity dive (pool/darts) — HIGH priority
7. 2A — 25 Avenue A — DJ bar — HIGH priority
8. Sophie's — 507 E 5th St — cheap dive — optional priority
9. Nowhere — 322 E 14th St — gay dive — optional priority
10. DROM — 85 Avenue A — live music venue — optional priority
11. Bowery Palace (fka Bowery Electric) — 327 Bowery — music venue / bar — optional priority
12. Burp Castle — 41 E 7th St — beer bar — optional priority
13. Amor y Amargo — 443 E 6th St — cocktail bar — optional priority

END OF PROMPT

---

## How the results get used

Round 2 output is raw evidence, not final values. The pipeline is:

1. Save the returned tables verbatim to `docs/research/ev-signals-<date>.md`.
2. Weekly events become the primary peak-time signal. A posted 10 PM drag show
   on Thursdays sets a Thursday peak far more defensibly than any estimate.
3. Capacity plus door policy drive `line_risk_score`. A small room with a
   bouncer lines up early; a large room with no cover rarely lines up at all.
4. Dated crowd reports are aggregated, not taken individually. Several reports
   naming 11 PM–1 AM on Saturdays constitute evidence; one does not.
5. Anything still empty falls back to the type-based default curve and carries a
   low `confidence_score`, which suppresses specific public claims like
   "Line likely after 11:15 PM".

Nothing in this pipeline invents a number. Every derived window traces to either
a posted schedule, a capacity figure, or a quoted dated report.
