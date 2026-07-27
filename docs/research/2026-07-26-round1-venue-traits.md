# Round 1 — Venue Traits Research (2026-07-26)

Output of `docs/venue-research-brief.md`, run against all 46 live East Village
venues lacking timing data plus the 13 candidate additions.

**Preserved because it existed only in the conversation.** Not yet ingested into
`src/data/venues.ts` or Supabase.

## What this round established

Timing came back **93% empty** — 4 of 59 venues returned a busy window, 2 a peak
window, 1 any line data. That is the finding, not a failure: the anti-guessing
rule worked, and it proved busy windows are not published as text for ordinary
bars. The only systematic source is Google popular-times, which is why
`popularTimes` is 0/56 and why the archetype-curve approach exists.

**What is usable here:** `type`, `best_nights`, `music_type`, `age_skew`,
`college_scene` and `description` for all 59. These fill real gaps —
`music_type` was missing on 38 venues, `age_range` on 27, `description` on 27,
`is_college_scene` on 54.

## Caveats before ingesting

- Confidence is **low or medium** on almost every row (one `high`: Ace Bar).
- **The sources column is unusable** — footnote numbers, no URLs survived. Treat
  descriptive content as judgment, not sourced fact.
- Timing fields below are ignored by the ingest: the confidence gating already
  assumes they are absent.
- Berlin is the basement room beneath 2A (same address, 25 Avenue A).
- Deluxx Fluxx shares 125 E 11th St with Webster Hall.

## Venues with any timing data (the only four)

| Venue | Busy window | Peak window | Line | Confidence |
|---|---|---|---|---|
| The Cock | Fri/Sat 12:00 AM–3:00 AM | Fri/Sat 12:00 AM–3:00 AM | after 12 AM, eases ~3 AM | medium (source dated 2018) |
| Mona's | Tue 9:00 PM–late | Tue 11:00 PM–1:00 AM | — | medium |
| Motel No Tell | Fri/Sat 9:00 PM–3:00 AM | — | — | medium |
| Deluxx Fluxx | Fri/Sat 10:00 PM–4:00 AM | — | — | medium |

## Traits — live East Village venues

| Venue | Type | Best nights | Music | Ages | College | Description | Conf |
|---|---|---|---|---|---|---|---|
| The Grafton | Irish pub / sports bar | Fri, Sat, match days | Sports audio / none | 23-34 | no | Best when there is a match worth watching or when you want a weekend sports-pub stop that stays open late. Less useful as a dancing or DJ-led room. | low |
| Standings | Sports bar / beer bar | Game nights; Fri, Sat, Sun | Game audio / TV | 24-35 | no | Works best for a game-first crowd rather than a generic night out. The room is tiny, so the sports calendar matters more than the day. | medium |
| International Bar | Dive bar | Thu, Fri, Sat | Jukebox | 24-38 | no | Best as an unstructured late-night dive stop. Suits people who want a long-hours neighborhood room rather than a programmed party venue. | medium |
| Coyote Ugly Saloon | Party bar | Fri, Sat | DJ / party tracks | 21-29 | no | Best for a branded party-bar experience and group energy, especially on weekends. Less suited to a quieter sit-down drinks plan. | low |
| Lucy's Bar | Neighborhood dive | Thu, Fri, Sat | Jukebox / none | 24-40 | no | Best as a neighborhood dive and a sentimental East Village stop rather than a highly programmed nightlife play. | medium |
| Death & Co | Cocktail bar | Thu, Fri, Sat | None | 24-35 | no | Best as a reservations-led cocktail destination, especially early evening or for a planned small group. Not a volume-driven party stop. | medium |
| The Summit Bar | Cocktail bar / cafe bar | Thu, Fri, Sat | None | 24-35 | no | Best for drinks before heavier nightlife or for a lower-key Avenue C night. | low |
| Alphabet City Beer Co | Craft beer bar | Wed, Thu, Fri | None | 24-36 | no | Best for beer-focused nights and smaller groups rather than a party circuit. Reads more as a craft-beer local than a line-heavy destination. | low |
| KGB Bar | Literary bar / cocktail | Event-dependent | Live readings | 25-40 | no | Works best when the upstairs Red Room programming matches what you want. More calendar-led than generic-weekend-led. | low |
| McSorley's Old Ale House | Historic ale house | Fri, Sat, Sun | None | 24-45 | no | Best as a classic New York tavern stop, especially earlier in the evening or during the day on weekends. A draw for history more than nighttime programming. | medium |
| Beauty Bar | Dance bar / party bar | Fri, Sat, Sun | DJ; some comedy | 21-29 | **yes** | Best on weekends if you want a party bar that leans event-led rather than cocktail-led. Sunday matters because of recurring comedy programming. | medium |
| Please Don't Tell | Cocktail speakeasy | Thu, Fri, Sat | None | 24-35 | no | Best as a planned cocktail stop, especially if you book ahead or will wait for limited walk-in bar seats. Suits pairs and small groups more than roaming crews. | medium |
| The Wayland | Cocktail bar / live music | Wed, Thu, Fri, Sat | Live music Wed | 24-34 | no | Best when Wednesday live music is part of the plan, or for a polished neighborhood cocktail bar with some room energy. Stronger early-to-mid-evening than late. | medium |
| d.b.a. | Beer / whiskey bar | Thu, Fri, Sat | None | 25-38 | no | Best for beer and whiskey drinkers who want a serious bar rather than a party room. | low |
| Juke Bar | Cocktail bar / late-night | Fri, Sat | Bar playlist / DJ | 22-30 | **yes** | Best as a late-night East Village stop with long hours rather than a fixed-event venue. Suits smaller groups looking for a default weekend bar room. | low |
| Holiday Cocktail Lounge | Cocktail bar | Thu, Fri, Sat | None / playlist | 24-35 | no | Best for a deliberate cocktail stop on St. Marks rather than a loud party room. Fits dates and small groups better than bar-crawl throughput. | medium |
| Ten Degrees | Wine bar / cocktail bar | Fri, Sat | None / playlist | 22-30 | **yes** | Works best for a lively but not fully clubby St. Marks bar night. Weekends carry the strongest room energy. | medium |
| The Headless Widow | Themed cocktail bar | Thu, Fri, Sat | None / playlist | 24-35 | no | Best for themed cocktails and date-night energy, especially around happy hour or early evening. | low |
| Wonderland Bar | Cocktail / themed restaurant-bar | Fri, Sat | None / playlist | 22-32 | no | Best for a themed drinks night, birthdays, or a date-oriented stop rather than a true late-night room. Hours cap the nightlife ceiling versus nearby bars open to 2 or 4 AM. | medium |
| Bua | Neighborhood bar / pub | Fri, Sat, Sun | Playlist / none | 22-32 | **yes** | Best as a classic St. Marks bar that can anchor a weekend run without needing a specific event. More social-pub than destination cocktail bar. | medium |
| Superbueno | Cocktail bar | Thu, Fri, Sat | None | 24-35 | no | Best for a planned cocktail visit with dinner or snacks rather than a spontaneous high-volume party stop. | medium |
| Sweet Linda | Cocktail bar / dinner bar | Thu, Fri, Sat | None / DJ signals | 23-33 | no | Best for drinks that can turn into dinner and then a later night. Reads more as a polished late-night cocktail room than a no-frills bar. | medium |
| Motel No Tell | Party bar / restaurant-bar | Fri, Sat; Mon-Tue events | Live DJ Fri/Sat; trivia, bingo, live music weekdays | 21-29 | **yes** | Best Friday and Saturday for DJ-led energy, or earlier in the week for activity nights without a full party-bar crush. One of the stronger structured-signal venues. | medium |
| Solas | Dance bar / multi-level | Wed–Sun | Salsa, zouk, bachata, DJs | 21-30 | **yes** | Best when the dance format matches the night: partner-dance nights midweek, DJs Friday and Saturday. More programming-led than open-format. | medium |
| Paradise Lost | Tiki / cocktail bar | Thu, Fri, Sat | Bar playlist | 24-35 | no | Best as a destination cocktail stop for a smaller group that wants design and drinks over speed. Less useful for fast bar-hopping. | medium |
| Goodnight Sonny | Cocktail bar / oyster bar | Thu, Fri, Sat | None / playlist | 24-34 | no | Best for early-evening happy hour or a weekend neighborhood cocktail bar with food. Arrive earlier in the week to avoid weekend crowding. | medium |
| Deluxx Fluxx | Nightclub / dance club | Fri, Sat | DJ / dance | 21-29 | **yes** | Best as a committed late-night dance stop rather than a casual drop-in. Reads as planned nightlife, especially Friday and Saturday. | medium |
| Lucky | Dive bar / live music dive | Fri, Sat; live-music nights | Live music; jukebox | 23-35 | no | Best if you want a real dive with occasional live music rather than a polished cocktail stop. Suits locals and repeat visits. | low |
| Mona's | Neighborhood bar / jazz bar | **Tue**; Fri, Sat secondary | Live trad jazz Tuesdays | 24-38 | no | Tuesday is the clearest signal: the long-running hot-jazz session starts at 9 PM and seats are scarce by 11. Outside Tuesday it is a neighborhood bar. | medium |
| The York | Neighborhood pub | Fri, Sat | None / playlist | 24-34 | no | Best as an Avenue B pub with a strong happy-hour identity rather than a line-dependent hot spot. Works for a relaxed weekend stop or early-evening meal-and-drinks. | medium |
| The Spotted Owl Tavern | Tavern / neighborhood bar | Thu, Fri, Sat | Playlist / sports | 24-35 | no | Best for a tavern-style night with food, drinks, and some game-watching rather than a packed dance room. | low |
| Accidental Bar | Sake bar | **Thu**; Fri, Sat secondary | None / event-led | 24-35 | no | Best for sake-focused nights and specific community events rather than generic weekend bar-hopping. Thursday stands out for recurring bingo. | medium |
| Berlin | Live music venue / dance bar | Fri, Sat | Live bands; weekend dance parties | 21-30 | **yes** | A downstairs venue beneath 2A, best chosen off the calendar. Show nights start early evening; weekend dance parties carry the later-night use case. | medium |
| Little Rebel | Restaurant-bar / neighborhood | **Sun**; Fri, Sat secondary | None / trivia | 23-33 | no | Best for dinner-plus-drinks or Sunday trivia rather than a late-night line scene. More restaurant-bar than pure nightlife room. | medium |
| Romeos | Cocktail lounge | Fri, Sat | Bar playlist | 22-30 | **yes** | Best for a St. Marks cocktail-lounge stop that stays open later on weekends. Suits dates and small groups more than a sports or dive crowd. | medium |
| Club Cumming | Cabaret bar / performance venue | Thu, Fri, Sat | Cabaret, comedy, live music, DJs | 24-38 | no | Best when you pick a specific performance, comedy, or cabaret night from the schedule. Calendar-led nightlife, not a stable weekly pattern. | medium |
| Big Bar | Cocktail bar / neighborhood | Fri, Sat | Vinyl / soul-leaning | 25-38 | no | Best as a smaller, moodier East Village bar rather than a high-throughput weekend destination. | low |
| Two Perrys | Cafe-bar / wine bar | Thu, Fri, Sat | None / playlist | 23-34 | no | Best for a lower-intensity Avenue C drinks stop rather than a party-led venue. | low |
| 96 Tears | Rock bar / dive bar | Fri, Sat | Rock / emo-leaning | 21-30 | **yes** | Best for a later-night Avenue A room with a rock-forward identity, especially on weekends. | low |
| Double Down Saloon | Punk dive bar | Thu, Fri, Sat | Jukebox / punk | 24-38 | no | Best for an intentionally grimy punk-dive stop that does not need a themed event to work. A style play, not a reservations room. | medium |
| Lovers of Today | Cocktail lounge | Thu, Fri, Sat | Bar playlist | 24-34 | no | Best as a late-night cocktail lounge and one-last-drink room. More intimate and music-focused than action-packed. | medium |
| Banshee | Irish bar / oyster bar | Fri, Sat | None / playlist | 24-35 | no | Best for weekend pub energy or a casual food-and-drinks stop. Newer venue, so crowd-pattern history is still light. | low |
| Sake Bar Decibel | Sake bar | Thu, Fri, Sat | None | 24-35 | no | Best for a focused drinking stop and small groups that care about sake rather than nightlife throughput. Happy hour is a clear early-evening signal. | medium |
| Barcade | Arcade bar | Fri, Sat | Arcade sound / playlist | 21-30 | **yes** | Best for a low-friction group hang that mixes games and drinks. More dependable for activity-driven nights than club-style peak tracking. | medium |
| Blue & Gold Tavern | Dive bar | Thu, Fri, Sat | Jukebox | 23-38 | no | Best as a true East Village dive, especially for a low-planning late stop. | medium |
| Otto's Shrunken Head | Tiki bar / live music venue | Event-dependent; Fri, Sat | Live bands / DJs | 23-38 | no | Best when the live calendar lines up with what you want. A programming room with a tiki shell, not a stable weekly pattern. | medium |

## Traits — candidate additions (not yet in the app)

| Venue | Type | Best nights | Music | Ages | College | Description | Conf |
|---|---|---|---|---|---|---|---|
| Webster Hall | Live music venue / club | Event-dependent; Fri, Sat | Live acts; DJs | 21-30 | no | Activity depends on the booked show or late-night. Use show doors and ticketed programming, not a static weekly pattern. | medium |
| The Cock | Gay bar / late-night | Fri, Sat | DJs; go-go / themed parties | 24-38 | no | One of the few venues with a directly stated crowd window: weekends crowded midnight to 3 AM. Suits a deliberately late plan rather than an early stop. | medium |
| The Boiler Room | Gay dive bar | Fri, Sat | Jukebox | 24-40 | no | Best as a low-frills queer neighborhood bar and late stop rather than a line-driven party venue. Refers to the relocated 45 2nd Ave venue. | medium |
| Sing Sing Ave A. | Karaoke bar | Fri, Sat | Karaoke | 21-29 | **yes** | Best for groups that want a planned karaoke night rather than an open-floor party bar. Consistently late-night. | medium |
| 7B Horseshoe Bar (Vazac's) | Dive bar | Thu–Sun | Jukebox / sports | 23-38 | no | Best as a long-hours dive with classic East Village texture rather than a hype destination. Works well as a fallback. | medium |
| Ace Bar | Activity dive bar | Tue, Thu, Fri, Sat | Playlist / activity-led | 21-30 | **yes** | Best if the night benefits from pool, darts, or Skee-Ball, especially on trivia and league nights. One of the clearer activity-driven baselines. | **high** |
| 2A | Dive bar / DJ bar | Fri, Sat | DJs; downstairs live music | 21-30 | **yes** | Best for a bar night that can turn into dancing without changing address. The strongest late-night signal comes from Berlin downstairs. | medium |
| Sophie's | Cheap dive bar | Thu, Fri, Sat | Jukebox / pool | 22-34 | **yes** | Best as an uncomplicated cheap-dive option with pool and long hours. More reliable as a casual fallback than a tracked peak-demand venue. | medium |
| Nowhere | Queer dive / underground gay bar | Thu, Fri, Sat | DJs / playlist | 23-38 | no | Best for a lower-slung queer night that is more neighborhood and subcultural than mainstream-club. | medium |
| DROM | Live music venue | Event-dependent | Live music; DJs vary | 22-35 | no | Use the event calendar, not a static weekly assumption. Many nights open around 8 PM but the room shape depends on the act. | medium |
| Bowery Palace | Live music / dance-party venue | Event-dependent | Live music; DJs | 22-35 | no | A renamed, relaunched venue, so the calendar matters more than inherited assumptions from Bowery Electric. | medium |
| Burp Castle | Beer bar | Thu, Fri, Sat | None | 25-40 | no | Best for beer-focused conversation and a quieter room than most bars nearby. Not the right input for a loud-party heat map. | medium |
| Amor y Amargo | Cocktail bar | Thu, Fri, Sat | None | 24-38 | no | Best as a very specific bitters-and-amari cocktail stop, usually early or mid-evening. Less suited to large groups or a spontaneous late search. | medium |
