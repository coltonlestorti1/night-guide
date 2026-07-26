# Venue Activity Research Brief

Paste-ready prompt for a deep-research session. Purpose: collect the baseline
activity layer (`source_type = research_estimate`) for every East Village venue
so the heat system does not launch with 46 of 56 venues sitting inert.

Companion docs: `docs/venue-candidates.md` (verified candidate list).

Addresses are included for every venue because East Village bar names collide
constantly — research the venue at the given address, not a same-named bar
elsewhere.

---

## THE PROMPT — copy everything below this line

I need researched nightlife activity data for a set of New York City bars, all
in the East Village / Lower East Side area. This feeds the baseline predictive
layer of a nightlife map app whose audience is 21–25 year olds.

For EACH venue listed below, return these fields:

| Field | Meaning |
|---|---|
| `venue` | Name exactly as I gave it |
| `type` | e.g. dive bar, party bar, cocktail bar, dance bar, gay bar, karaoke, live music venue |
| `best_nights` | Which nights it is actually worth going, e.g. "Thu, Fri, Sat" |
| `busy_window` | When it starts being busy to when it empties, e.g. "9:00 PM to 2:00 AM" |
| `peak_window` | The genuine peak, e.g. "11:30 PM to 1:30 AM" |
| `line_likely_after` | When a wait at the door becomes likely, and on which nights. "None" if it never really has a line |
| `line_eases_after` | When the door gets easy again |
| `music_type` | e.g. DJ, live bands, jukebox, hip-hop, indie, none |
| `age_skew` | Typical age range, e.g. "21-26" |
| `college_scene` | yes / no — is it NYU-student heavy |
| `description` | 1–2 sentences, professional tone, saying WHEN the bar works best and who it suits. No hype, no adjective stacking |
| `confidence` | high / medium / low — how well sourced is this |
| `sources` | Where the timing came from |

RULES — these matter more than completeness:

1. **Do not invent timing data.** If you cannot find real evidence for a
   venue's busy or peak window, write exactly `Needs busy-time research` in
   that cell. A blank is far more useful to me than a plausible guess, because
   guesses get baked into an algorithm and I lose the ability to tell which
   numbers are real.
2. **Mark confidence honestly.** `low` is a perfectly good answer.
3. **Flag closures.** If a venue appears permanently closed, relocated, or
   renamed, say so instead of returning timing data.
4. **Event-driven venues** (music venues, clubs with programming — Webster
   Hall, DROM, Bowery Palace, Nublu 151) often have no stable weekly pattern.
   If activity depends on who is playing, say so explicitly and give the
   typical show-night shape (doors, set time, letout) rather than a fake
   weekly window.
5. Prefer evidence in this order: the venue's own posted schedule and socials,
   Google/Yelp popular-times data, recent local press and event listings,
   Reddit/forum reports with dates. Say which one you used.
6. Times in 12-hour format with AM/PM. Nights that run past midnight should be
   expressed as continuing into the next morning, e.g. "10:00 PM to 3:00 AM".
7. Return results as a **single markdown table**, one row per venue, columns in
   the order listed above. No prose before or after the table.

Additionally, after the table, list separately:

- Any venue you believe is **closed / renamed / relocated**, with evidence.
- Any venue where the **name is ambiguous** and you may have researched the
  wrong place.
- Any venue with a notable **recurring weekly event** (drag night, trivia,
  karaoke night, DJ residency) with the night and time — these are strong
  activity signals.

Two notes on the addresses below:

- "Loisaida Ave" is Google's rendering of **Avenue C**. They are the same street.
- Deluxx Fluxx and Webster Hall are both at 125 E 11th St — Deluxx Fluxx is a
  separate basement bar in the Webster Hall building. Research them separately.

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

## What to do with the results

1. Save the returned table verbatim to `docs/research/ev-activity-<date>.md` —
   keep the raw research output, never overwrite it with edited values.
2. Rows marked `Needs busy-time research` stay empty in the dataset. They fall
   back to the type-based default curve rather than getting a fabricated window.
3. `confidence` maps onto `confidence_score`, which gates how specific the
   public-facing copy is allowed to get. A `low` confidence venue should never
   render "Line likely after 11:15 PM".

## Fields NOT to research — already covered

These are already in the dataset or derivable, so don't spend research effort on them:

- Hours — Google Places, all 56 venues, refreshed 2026-07-26
- Price level — Google `priceRange`, 51 of 56
- Rating and review count — Google, all 56
- Coordinates, `placeId` — all 56
- Neighborhood — derived from coordinates
- Outdoor seating / rooftop — Google, 48 of 56
