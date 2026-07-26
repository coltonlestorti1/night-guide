# ENDZ Nightlife Dataset — Downtown Manhattan

> **Status: INFO / RESEARCH ONLY. Not wired into the app.**
> This is a retained reference for ENDZ product work. Nothing here is implemented in
> `src/data/venues.ts`, Supabase, or recommendation logic. When we later expand ENDZ
> beyond the East Village, this doc is the source pool for **rooftops, outdoor seating,
> age range, drink prices, and hotspot times/days**. Implementation is gated per `CLAUDE.md`.
>
> Last updated: 2026-07-25.

## Zone model (5 general zones)

ENDZ groups venues into **5 general, walk-navigable zones** anchored on an East/West
split, instead of a dozen granular neighborhoods. Granular neighborhoods are kept as a
sub-tag inside each zone.

| Zone | Rolls up these neighborhoods | Character |
|---|---|---|
| **East** | East Village, Lower East Side, NoHo / Nolita | Divey → DJ → dance-bar; student + local mix |
| **West** | Greenwich Village, West Village | Classic student bar-crawl + Christopher St queer nightlife |
| **Meatpacking & Chelsea** | Meatpacking, West Chelsea, SoHo / Tribeca hotel clubs | Dress-up, lines, rooftops, table/VIP |
| **Flatiron & Midtown** | Flatiron, Midtown | Promoter-driven / table clubs |
| **Brooklyn** | Williamsburg, Bushwick | Warehouse dance + jazz |

The 40-venue **research set** fills **East** (East Village), **West** (Greenwich + West
Village), and **Meatpacking & Chelsea** (Meatpacking). **Flatiron & Midtown** and
**Brooklyn** currently hold only **PDF backlog** venues (lower confidence).

## Age display rule (how ENDZ shows who-goes)

Every venue carries a numeric age band, **except** the youngest/college cohort, which is
never shown as a number.

- **Show the numeric range** for venues that skew 21+ — e.g. `21–27`, `24–32`.
- **Show the badge `College scene`** (no number) for venues whose crowd is the under-21 /
  just-turned-21 college cohort. Lean these toward venues with legit **18+/19+ door or 18+
  event nights**. The string "18–21" never renders anywhere.
- **Mixed venues show both** — `College scene · 21–25` — so the college skew is signaled
  and the older reach is visible, while no sub-21 number ever prints.

> **Honesty note:** the numeric bands are **ENDZ heuristic estimates derived from each
> venue's crowd description** ("college", "21-25 post-grad", "local", "tourist-heavy"),
> not sourced/verified ages. Music and activity tags are derived from the stated vibe, not
> invented. `unknown` fields are left blank on purpose — do not fabricate on import.

## Sources (and how they relate)

Two independent sources, merged here. They are **not** the same document.

1. **Research dataset** — 40 currently-operating venues (East Village, Greenwich Village,
   West Village, Meatpacking), each verified open in 2026 from official sites / IG /
   reservation pages / event calendars. **The structured spine.**
2. **User PDF** — `~/Downloads/NYC NIGHTLIFE 2025.pdf` (4 pages, hand-made personal list).
   Neighborhood-grouped names with terse annotations ("cheap drinks", "need promoter, 20
   cover", "backyard", "go early", "wednesdays", "jazz"). Covers a **much wider footprint**
   — LES, Chelsea/SoHo, Tribeca, Flatiron, NoHo, Midtown, Brooklyn. **The taste +
   reality-check + expansion layer**; lower-confidence on facts, high-signal on
   vibe/door/timing.

Conflict rule: **research wins on facts** (address, type, open status); **PDF wins on
personal signal** (door friction, "go early", day-of-week, vibe). Conflicts are flagged,
not silently resolved.

## Current ENDZ coverage (baseline)

ENDZ today = **52 venues, 100% in the East zone** (East Village sub-areas only). This
dataset expands into **West** and **Meatpacking & Chelsea** (research set) and, via the
PDF, into **Flatiron & Midtown** and **Brooklyn** (backlog).

**Already in ENDZ (do NOT duplicate on import):** Doc Holliday's · The Library · Niagara ·
Wiggle Room · Downtown Social (= "The 13th Step") · KGB Bar · Paradise Lost · Mona's.
**East-zone research adds not yet in ENDZ:** Phebe's · Joyface · St. Dymphna's · Nublu 151
· The Ready Rooftop.

## Cross-check: PDF vs research dataset

- **Confirmations:** Doc Holliday's, St. Dymphna's, Joyface, Nublu ("Trublu/151"),
  Spaniard, Le Bain, PHD all match. PDF confirms **Home Sweet Home → Fig 19** rename and
  that **Little Sister Lounge** is at *Moxy East Village* (not Meatpacking) — research
  correctly excluded it.
- **Prior neighborhood conflicts now collapse under the 5-zone model:** Wiggle Room & The
  Library (EV-vs-LES) are both **East**; Red Lion (GV-vs-WV, PDF pairs it with "Carroll's
  Place") is **West** either way. Resolved: "Carroll's Place" (157 Bleecker) is a separate
  venue adjacent to Red Lion (151 Bleecker) — now closed, so it drops from the set.

---

# Enriched venue profiles (40 verified)

Format per venue: type · price · zone (neighborhood) · address, then Age / Prices+deals /
Music+floor+live / Tags / Busiest+door+HH / Occasion / Description / Tagline / IG +
internal flags. `_internal:_` notes never render publicly.

## ZONE: EAST — East Village

Verified core cluster: Avenue A / E 7th–9th near Tompkins Square. Weekend density leaders:
Phebe's, 13th Step, Joyface, Niagara, Wiggle Room. Feeders: Astor Pl (6), 8 St–NYU (R/W),
Union Sq, 1 Av (L). *(LES + NoHo/Nolita venues in this zone are in the backlog.)*

**Phebe's Tavern** · bar · $$ · East (East Village) · 359 Bowery / E 4th St, 10003
- **Age:** College scene · 21–25
- **Prices/deals:** $$ · Burger Mondays, Taco Tuesdays
- **Music:** DJ / top-40 · Dance floor Y (weekends) · Live music N
- **Tags:** sports · big-group
- **Busiest:** Fri–Sat, ~10pm–late · HH unknown
- **Occasion:** pregame · watch-the-game · birthday
- **Desc:** Sports bar by day that flips into a DJ-and-dance-floor student party on weekends, thick with NYU regulars and just-graduated locals. Best for a rowdy group pregame or a game-day start — get there before 11 on Fri/Sat or you're squeezing through a wall of people.
- **Tagline:** "Starts like a game bar, ends like a dorm pregame that got too successful."
- **IG:** @phebesnyc · _internal: bro-heavy/overcrowded rep_

**The 13th Step / Downtown Social** · bar · East (East Village) · 149 2nd Ave, 10003
- **Age:** College scene · 21–25
- **Prices/deals:** unknown
- **Music:** DJ / party · Dance floor Y · Live music N
- **Tags:** sports · big-group
- **Busiest:** weekend-skew · HH unknown
- **Occasion:** rowdy night · pregame
- **Desc:** A loud, high-volume sports-and-DJ party bar that reopened under the Downtown Social name in 2023, pulling a college and just-post-grad crowd. Best when the group wants TVs, a dance floor, and no chill — not a place for conversation.
- **Tagline:** "Loud TVs, louder music, zero dignity by 1am."
- **IG:** unknown · _internal: bro-heavy rep; renamed/reopened 2023; student party-bar family_

**St. Dymphna's** · bar · East (East Village) · 117 Ave A, 10009
- **Age:** 23–33
- **Prices/deals:** unknown · Mon–Fri happy hour
- **Music:** pub / Irish jukebox · Dance floor N · Live music N
- **Tags:** pool · trivia · **backyard/outdoor**
- **Busiest:** Tue (trivia) · HH Mon–Fri
- **Occasion:** chill hang · pre-night · trivia
- **Desc:** An easygoing Irish-style pub with a pool table, Tuesday trivia, and a backyard that swallows whole evenings. Best as a low-key group anchor before the night ramps up, or a warm-weather backyard session.
- **Tagline:** "Post up in the backyard and accidentally stay six hours."
- **IG:** unknown

**Joyface** · lounge · East (East Village) · 104 Ave C, 10009
- **Age:** 21–27
- **Prices/deals:** unknown
- **Music:** disco / funk / dance · Dance floor Y · Live music N
- **Tags:** dancing · retro decor
- **Busiest:** Sat (Thu–Sat); early party 5–10pm, late to 3am · HH unknown
- **Occasion:** dance · dressed-up-fun · date-ish
- **Desc:** A 1970s rec-room-styled lounge with disco-forward DJs and an early Saturday "Matinee Disco" that gets moving well before midnight. Best for a dressed-up-but-still-fun night when the group actually wants to dance.
- **Tagline:** "Austin Powers' basement, in the best possible way."
- **IG:** @joyfacenyc

**Niagara** · bar · $$ · East (East Village) · 112 Ave A, 10009
- **Age:** 21–30
- **Prices/deals:** $$ · daily happy hour to 7pm
- **Music:** rock / punk DJ · Dance floor Y · Live music N
- **Tags:** dive · queer-history · dancing
- **Busiest:** Sat, 10pm–4am · HH daily to 7pm
- **Occasion:** late-night · dive crawl
- **Desc:** A rocker/gay-dive institution on the Avenue A strip with a late-night Saturday dance party and DJ energy that runs to close. Best for the "one drink" that turns into a 3am night.
- **Tagline:** "One drink and suddenly it's 3:17am."
- **IG:** @niagaranyc

**Doc Holliday's** · bar · $ · East (East Village) · 141 Ave A, 10009
- **Age:** 23–35
- **Prices/deals:** $ · cheap pitchers · weekday HH Mon–Fri ~4:30–7
- **Music:** country / rock jukebox (honky-tonk) · Dance floor N · Live music N
- **Tags:** dive · pool · Big Buck Hunter · jukebox
- **Busiest:** unknown · HH Mon–Fri ~4:30–7
- **Occasion:** cheap casual · dive crawl
- **Desc:** A no-frills honky-tonk dive with cheap pitchers, a country jukebox, pool, and Big Buck Hunter. Best for a low-pressure, low-cost night when nobody wants a scene.
- **Tagline:** "Cheap pitchers, country jukebox, and one friend taking Big Buck Hunter too seriously."
- **IG:** @dochollidaysnyc (3.5K+)

**Wiggle Room** · club · East (East Village) · 9 Ave A, 10009
- **Age:** 21–27
- **Prices/deals:** no cover cited
- **Music:** DJ / house / hip-hop · Dance floor Y (2 floors) · Live music N
- **Tags:** dancing
- **Busiest:** Thu–Sat, busier later, to 4am · HH unknown
- **Occasion:** dance
- **Desc:** A two-level dance bar with a basement floor and DJs Thursday through Saturday, no cover cited. Best when the group wants to actually dance without committing to a full nightclub.
- **Tagline:** "Upstairs to flirt, downstairs to throw it back."
- **IG:** @wiggleroom.bar (8.5K+) · _note: 9 Ave A sits on the EV/LES line_

**Nublu 151** · club · East (East Village) · 151 Ave C, 2F, 10009
- **Age:** 21–30
- **Prices/deals:** event-dependent cover
- **Music:** jazz / electronic / live · Dance floor Y · Live music Y
- **Tags:** live shows · music-focused
- **Busiest:** Mon (Producer Mondays), 10pm+ · HH unknown
- **Occasion:** music night · chill alternative
- **Desc:** A live-music and electronic/jazz club (home of "Producer Mondays") that leans music-credible rather than party-bar. Best for a night built around the room's sound instead of drink specials.
- **Tagline:** "More music-kid than bro-bar."
- **IG:** @nublunyc

**The Ready Rooftop** · lounge · East (East Village) · 112 E 11th St (Moxy), 10003
- **Age:** 21–28
- **Prices/deals:** unknown
- **Music:** DJ / party · Dance floor Y (darty) · Live music N
- **Tags:** **rooftop** · beer pong · frozen cocktails · big-group
- **Busiest:** afternoon/weekend darty · HH unknown
- **Occasion:** birthday · day-drink · first-stop
- **Desc:** A TAO-run rooftop at the Moxy with frozen cocktails, beer pong, and daytime-party energy. Best as a birthday or day-drink first stop before the group heads somewhere darker.
- **Tagline:** "'Roof, shots, and chaos' that the group chat actually followed through on."
- **IG:** @thereadycantina · _TAO Group_

**The Library** · bar · $ · East (East Village) · 7 Ave A, 10009
- **Age:** 21–30
- **Prices/deals:** $
- **Music:** rock / metal jukebox · Dance floor N · Live music N
- **Tags:** dive · jukebox · B-movies
- **Busiest:** nightly · HH unknown
- **Occasion:** casual late-night
- **Desc:** A dark, book-lined punky dive with a loud jukebox and B-movies on the screens. Best for a cheap, gritty late-night stop that pretends to be chill and isn't.
- **Tagline:** "'Somewhere chill' that ends with yelling over metal."
- **IG:** @librarybarnyc · _note: 7 Ave A sits on the EV/LES line_

## ZONE: WEST — Greenwich Village

Cluster: MacDougal / W 3rd / W 4th / Bleecker. Weekend leaders: Off the Wagon, Down the
Hatch, Wicked Willy's, Bar 13, Red Lion. Feeders: W 4 St–Wash Sq, 8 St–NYU, Astor Pl /
Union Sq.

**Josie Woods Pub** · bar · West (Greenwich Village) · 11 Waverly Pl, 10003
- **Age:** College scene · 21–25
- **Prices/deals:** unknown · daily specials / happy hour
- **Music:** jukebox / sports · Dance floor N · Live music N
- **Tags:** sports · pool · darts · big-group
- **Busiest:** unknown · HH daily
- **Occasion:** easy group drinks · watch-the-game
- **Desc:** A straightforward sports pub near NYU with pool, darts, TVs, and daily specials. Best when the group just wants an easy, student-friendly spot and nobody wants to overthink it.
- **Tagline:** "The safe 'we can all agree on this' pub."
- **IG:** unknown

**Off the Wagon** · bar · West (Greenwich Village) · 109 MacDougal St, 10012
- **Age:** College scene
- **Prices/deals:** unknown · Half-Price Hump Day (Wed) · daily beer+shot · Mon–Fri HH
- **Music:** DJ / top-40 · Dance floor Y (wknd) · Live music N
- **Tags:** sports · games · big-group
- **Busiest:** Wed; Fri–Sat · HH Mon–Fri
- **Occasion:** bar-crawl · rowdy night · pregame
- **Desc:** A two-story MacDougal party bar built on cheap specials, sports, and a heavily NYU crowd. Best for a loud bar-crawl night — Wednesday's half-price deal and weekends are peak.
- **Tagline:** "Pure NYU-core in bar form."
- **IG:** @offthewagonnyc · _student party-bar family; bro-heavy rep_

**Down the Hatch** · bar · West (Greenwich Village) · 179 W 4th St, 10014
- **Age:** College scene · 21–25
- **Prices/deals:** unknown · nightly drink deals · Unlimited Basement Brunch (wknd)
- **Music:** DJ / party · Dance floor Y · Live music N
- **Tags:** beer pong · wings · basement · big-group
- **Busiest:** weekends · HH unknown
- **Occasion:** messy casual · birthday · pregame
- **Desc:** A literal basement party bar known for wings, beer pong, and late-night group chaos. Best for a messy, unserious night — the weekend bottomless brunch is its own event.
- **Tagline:** "Underground, messy, wings-and-beer-pong energy."
- **IG:** unknown · _student party-bar family; bro-heavy rep_

**Wicked Willy's** · bar · West (Greenwich Village) · 149 Bleecker St, 10012
- **Age:** College scene · 21–26
- **Prices/deals:** unknown · bottomless brunch
- **Music:** DJ / party (Caribbean) · Dance floor Y · Live music N
- **Tags:** games · tropical/frozen drinks · big-group
- **Busiest:** weekend-skew · HH unknown
- **Occasion:** birthday · unserious fun
- **Desc:** A Caribbean-themed Bleecker party bar with frozen drinks, games, and brunch energy that skews touristy-in-a-fun-way. Best for a birthday or a night where subtlety isn't the goal.
- **Tagline:** "Touristy in a fun way — frozen drinks, zero subtlety."
- **IG:** @wickedwillysnyc

**The Red Lion** · bar · West (Greenwich Village) · 151 Bleecker St, 10012
- **Age:** 21–33
- **Prices/deals:** unknown · no cover Mon–Thu · cover Fri/Sat/holidays
- **Music:** live bands (rock / covers) · Dance floor N · Live music Y
- **Tags:** live music · soccer · big-group
- **Busiest:** nightly, Fri–Sat strongest, 7pm–4am · HH unknown
- **Occasion:** live-music night
- **Desc:** A live-music and soccer bar with cover bands every night from 7pm and a wide age spread. Best when the group wants entertainment and a room already singing along, without a club.
- **Tagline:** "A cover band and a room already singing."
- **IG:** @redlionnyc (9.7K+) · _resolved: "Carroll's Place" (157 Bleecker) is a separate adjacent venue, now closed — not the same room_

**Peculier Pub** · bar · $ · West (Greenwich Village) · 145 Bleecker St, 10012
- **Age:** 21–32
- **Prices/deals:** $ · Mon–Fri happy hour 4–7
- **Music:** none / conversation · Dance floor N · Live music N
- **Tags:** big beer list · board games
- **Busiest:** unknown · HH Mon–Fri 4–7
- **Occasion:** chill beers · conversation
- **Desc:** An old-school beer bar with a huge selection and board games, built for talking rather than dancing. Best as a reset bar when the MacDougal strip feels too feral.
- **Tagline:** "For the friend who wants 'a beer bar' and means it."
- **IG:** @peculierpub

**Bar 13** · club · West (Greenwich Village) · 121 University Pl, 10003
- **Age:** College scene · 21–25
- **Prices/deals:** cover ~$10–20 many nights
- **Music:** reggaeton / hip-hop / house / Latin · Dance floor Y · Live music N
- **Tags:** **rooftop** · dancing · 18+ event nights · table (some)
- **Busiest:** Fri–Sat, late · HH unknown
- **Occasion:** dance
- **Desc:** A multi-floor bar/club/lounge with a rooftop and a Latin/hip-hop/house mix, running reggaeton weekends and promoter-driven 18+ parties. Best when the group wants one real dance spot — expect a $10–20 cover.
- **Tagline:** "The 'one dancey place' answer."
- **IG:** unknown

**Madame X** · lounge · West (Greenwich Village) · 94 W Houston St, 10012
- **Age:** 21–28
- **Prices/deals:** unknown
- **Music:** R&B / DJ · Dance floor Y · Live music N
- **Tags:** red-lit lounge · date-spot
- **Busiest:** Fri–Sat, late · HH unknown
- **Occasion:** date · dressed-up
- **Desc:** A red-lit, bordello-styled lounge with R&B and weekend DJ dance nights. Best for a moodier, dressed-up night that leans date-ish rather than rowdy.
- **Tagline:** "Red-lit, a little chaotic, 'dressed cute for no reason.'"
- **IG:** @madamexnyc

**Le Poisson Rouge** · club · $$–$$$ · West (Greenwich Village) · 158 Bleecker St, 10012
- **Age:** 21–32
- **Prices/deals:** $$–$$$ · event-dependent ticketing
- **Music:** live music (eclectic) · Dance floor Y (show-dep.) · Live music Y
- **Tags:** concerts · planned events
- **Busiest:** show-dependent, late shows · HH unknown
- **Occasion:** planned event / show
- **Desc:** An eclectic live-music venue that turns into a late-night destination on the right bill. Best when you want a planned show to anchor the night instead of bar-hopping.
- **Tagline:** "More concert-kid, less vodka-soda bro."
- **IG:** @lprnyc (66.9K)

**The Half Pint** · bar · West (Greenwich Village) · 76 W 3rd St, 10012
- **Age:** 21–30
- **Prices/deals:** unknown · brunch
- **Music:** sports / mixed · Dance floor N · Live music N
- **Tags:** craft beer · sports · brunch · Ernie's side room · big-group
- **Busiest:** unknown · HH unknown
- **Occasion:** fallback group drinks · watch-the-game
- **Desc:** A craft-beer pub/sports-bar hybrid with brunch and a side room (Ernie's). Best as a reliable downtown fallback when you want energy without the MacDougal madness.
- **Tagline:** "The fallback when MacDougal feels too feral."
- **IG:** @thehalfpintnyc

## ZONE: WEST — West Village

Cluster: Christopher St / 7th Ave S / Grove (Stonewall, Pieces, Duplex, Monster) + cocktail
side (Spaniard, Due West, Wilfie & Nell, Happiest Hour). Feeders: Christopher St–Stonewall
(1), W 4 St, 8 St–NYU. Greenwich + West Village are continuous on foot — one zone.

**The Spaniard** · bar · West (West Village) · 190 W 4th St, 10014
- **Age:** 21–27
- **Prices/deals:** unknown
- **Music:** mixed / low · Dance floor N · Live music N
- **Tags:** whiskey-forward · gastropub · food
- **Busiest:** every night; all day weekends · HH unknown
- **Occasion:** social but put-together
- **Desc:** A whiskey-forward West Village gastropub that stays crowded with a young-professional crowd. Best when someone wants "somewhere fun but not trashy."
- **Tagline:** "Fun, but not trashy."
- **IG:** @thespaniardnyc · _team behind Wilfie & Nell; can get bro-heavy/crowded_

**Wilfie & Nell** · bar · $$ · West (West Village) · 228 W 4th St, 10014
- **Age:** 21–28
- **Prices/deals:** $$
- **Music:** mixed / low · Dance floor N · Live music N
- **Tags:** cozy · late-night food (to 2am) · small-group
- **Busiest:** unknown · HH unknown
- **Occasion:** date · small group · casual start
- **Desc:** A cozy beer-and-cocktail spot with food running late into the night. Best for a smaller group, a date, or an easy first stop before the night gets bigger.
- **Tagline:** "First-job West Village flirting energy."
- **IG:** @wilfieandnell (4,883)

**Due West** · bar · West (West Village) · 189 W 10th St, 10014
- **Age:** 21–28
- **Prices/deals:** unknown
- **Music:** mixed + Tue live music · Dance floor N · Live music Y (Tue)
- **Tags:** gastropub · cocktails · sports
- **Busiest:** Tue (live music) · HH unknown
- **Occasion:** polished group drink
- **Desc:** A polished West Village gastropub with cocktails, sports, and Tuesday live music. Best for a put-together group drink that stays short of club energy.
- **Tagline:** "Cute, not cheesy."
- **IG:** @duewestnyc · _can skew bro-heavy_

**The Happiest Hour** · bar · West (West Village) · 121 W 10th St, 10011
- **Age:** 21–28
- **Prices/deals:** unknown
- **Music:** DJ / pop · Dance floor Y · Live music N
- **Tags:** tropical cocktails · burgers · lively
- **Busiest:** unknown · **door: valid physical ID after 7pm, 21+ from 9pm** · HH unknown
- **Occasion:** pre-going-out group drinks
- **Desc:** A playful, tropical cocktail bar with a burger-and-drinks scene and a lively crowd (physical ID after 7pm, 21+ from 9pm). Best for upbeat group drinks before heading out.
- **Tagline:** "Florida-on-purpose, with better lighting."
- **IG:** @thehappiesthournyc

**WXOU Radio Bar** · bar · West (West Village) · 558 Hudson St, 10014
- **Age:** 21–30
- **Prices/deals:** unknown · Sunday late happy hour
- **Music:** jukebox · Dance floor N · Live music N
- **Tags:** retro/radio theme · neighborhood dive · cash-friendly
- **Busiest:** Sunday late (10pm–close noted) · HH Sun late
- **Occasion:** casual late drinks
- **Desc:** A low-key, retro radio-themed neighborhood bar with jukebox energy and a late Sunday happy hour. Best for casual late drinks with no scene attached.
- **Tagline:** "Always a better idea than it sounds at 11:30."
- **IG:** @wxouradiobar

**Stonewall Inn** · bar · West (West Village) · 53 Christopher St, 10014
- **Age:** 21–35
- **Prices/deals:** unknown
- **Music:** DJ / drag / piano / dance · Dance floor Y (Sat) · Live music Y (piano)
- **Tags:** **LGBTQ+** · historic · drag · piano
- **Busiest:** Sat/Sun; Tue–Wed active; 9pm+ · HH unknown
- **Occasion:** cultural/lively night · dance · drag
- **Desc:** The historic LGBTQ+ landmark, running piano nights (Tue/Wed), a Saturday dance party, and Sunday's "The Invasion." Best for a night that mixes history, drag, and chaos in one stop.
- **Tagline:** "History, drag, and chaos in one stop."
- **IG:** @thestonewallinn · _queer-friendly_

**Pieces Bar** · bar · West (West Village) · 8 Christopher St, 10014
- **Age:** 21–30
- **Prices/deals:** unknown · daily/weekday happy hour
- **Music:** drag / pop / DJ · Dance floor Y · Live music N
- **Tags:** **LGBTQ+** · nightly drag · bingo · games
- **Busiest:** weeknights active, weekends densest · HH daily/weekday
- **Occasion:** fun/interactive · drag
- **Desc:** A high-energy Christopher Street gay dive with nightly drag, bingo, and cheap-drink energy. Best for a fun, interactive night with a drag host running the room.
- **Tagline:** "Camp, cheap drinks, and a drag host yelling at you lovingly."
- **IG:** @piecesbar · _queer-friendly_

**The Monster** · club · West (West Village) · 80 Grove St, 10014
- **Age:** 21–35
- **Prices/deals:** club (cover likely)
- **Music:** piano upstairs / DJ dance downstairs · Dance floor Y · Live music Y (piano)
- **Tags:** **LGBTQ+** · multi-level · piano · dancing
- **Busiest:** weekend, late · HH unknown
- **Occasion:** dance + entertainment
- **Desc:** A multi-level gay institution with a piano bar/cabaret upstairs and a nightclub downstairs. Best when the group wants both old-school Village character and a real dance floor.
- **Tagline:** "Icon energy upstairs, full send downstairs."
- **IG:** @monsterbarnyc (17.1K) · _queer-friendly_

**The Duplex** · bar · West (West Village) · 61 Christopher St, 10014
- **Age:** 21–38
- **Prices/deals:** unknown
- **Music:** piano / cabaret · Dance floor N · Live music Y
- **Tags:** **LGBTQ+** · historic · piano · cabaret · singalong · **outdoor (upstairs)**
- **Busiest:** unknown · HH unknown
- **Occasion:** entertainment / singalong
- **Desc:** A historic gay piano bar and cabaret with upstairs nightlife and a built-in singalong. Best for a night where the entertainment is the point and you stay longer than planned.
- **Tagline:** "Come for the singalong, stay for the whole weirdly perfect night."
- **IG:** @theduplex_nyc · _queer-friendly_

**Cubbyhole** · bar · West (West Village) · 281 W 12th St, 10014
- **Age:** 21–35
- **Prices/deals:** unknown
- **Music:** jukebox / pop · Dance floor N · Live music N
- **Tags:** **LGBTQ+** · lesbian bar · cozy · small-room
- **Busiest:** weekends · HH unknown
- **Occasion:** casual queer nightlife · intimate
- **Desc:** A tiny, festive lesbian bar and longtime neighborhood favorite. Best for casual queer nightlife in a warm, packed little room.
- **Tagline:** "Everyone looks like they're having the exact right amount of fun."
- **IG:** @cubbyholebar · _queer-friendly_

## ZONE: MEATPACKING & CHELSEA — Meatpacking / Chelsea

Cluster: Gansevoort / Washington / W 13th (Le Bain, Standard Biergarten, Gansevoort Rooftop,
Common Ground, Brass Monkey, Catch Roof) → northward hop to Dream Downtown (TAO, PHD,
Electric Room). Weekend leaders: Le Bain, PHD, TAO Downtown, Catch Roof, Gansevoort
Rooftop. Feeders: 14 St/8 Av (A/C/E/L), 14 St–Union Sq. Clearest guest-list/table zone.

**Le Bain** · club · Meatpacking & Chelsea (Meatpacking) · 444 W 13th St (The Standard), 10014
- **Age:** 21–29
- **Prices/deals:** event-dependent cover
- **Music:** house / electronic DJ · Dance floor Y · Live music N
- **Tags:** **rooftop** · plunge pool · dancing · dress code · table-adjacent
- **Busiest:** Wed–Sat, Fri–Sat peak, late to 4am · **door: 21+, dress code** · HH unknown
- **Occasion:** dressed-up night · dance
- **Desc:** The Standard's rooftop discothèque, with big-DJ nightlife, sunset sets, and skyline views (dress code, 21+). Best for a dressed-up Meatpacking night — expect a real door.
- **Tagline:** "The rooftop people 'casually' go to and then take 40 photos of."
- **IG:** @lebainnyc · _Standard Hotels; selective door / dress-code complaints_

**The Standard Biergarten** · bar · Meatpacking & Chelsea (Meatpacking) · 848 Washington St @ 13th, 10014
- **Age:** 21–30
- **Prices/deals:** unknown
- **Music:** mixed / none · Dance floor N · Live music N
- **Tags:** beer garden · **outdoor** · ping-pong · communal tables · big-group
- **Busiest:** Fri–Sat, game days · HH unknown
- **Occasion:** easy meet-up · groups
- **Desc:** A big indoor/outdoor beer garden with communal tables and ping-pong under The Standard. Best as a no-explanation Meatpacking default when the group just wants space and beer.
- **Tagline:** "The no-explanation Meatpacking default."
- **IG:** unknown · _Standard Hotels_

**Brass Monkey** · bar · Meatpacking & Chelsea (Meatpacking) · 55 Little W 12th St, 10014
- **Age:** College scene · 21–26
- **Prices/deals:** unknown
- **Music:** DJ / mixed · Dance floor Y · Live music N
- **Tags:** three-floor · **roof terrace / outdoor** · big-group
- **Busiest:** Fri–Sat · HH unknown
- **Occasion:** party-bar crowd
- **Desc:** A three-floor Meatpacking bar with a roof terrace and straightforward rowdy weekend energy. Best as the answer to "where are the rowdy twenty-somethings?"
- **Tagline:** "Where are the rowdy twenty-somethings? Here."
- **IG:** unknown · _bro-heavy rep_

**Gansevoort Rooftop** · lounge · Meatpacking & Chelsea (Meatpacking) · 18 9th Ave, 10014
- **Age:** 21–30
- **Prices/deals:** unknown
- **Music:** DJ (house / open format) · Dance floor Y · Live music N
- **Tags:** **rooftop** · skyline · upscale · table-adjacent
- **Busiest:** weekend nights · HH unknown
- **Occasion:** polished night · scene · date
- **Desc:** An upscale, chic hotel rooftop with skyline views and weekend DJs in warmer months. Best for a more polished Meatpacking night than the party bars.
- **Tagline:** "Dress like you planned this."
- **IG:** unknown

**Common Ground** · bar · Meatpacking & Chelsea (Meatpacking) · 63 Gansevoort St, 10014
- **Age:** 21–28
- **Prices/deals:** unknown · Mon–Fri happy hour
- **Music:** DJ / mixed (weekend) · Dance floor Y (wknd) · Live music N
- **Tags:** open windows/doors · **outdoor-ish** · big-group
- **Busiest:** Fri 2pm–4am, Sat 12pm–4am · HH Mon–Fri
- **Occasion:** the area without the club scene
- **Desc:** An actual neighborhood bar in Meatpacking with open windows, happy hour, and weekend music. Best when you want the district without the tables and velvet rope.
- **Tagline:** "For when Meatpacking feels too table-y."
- **IG:** @commongroundbar

**PHD Rooftop Lounge** · lounge · Meatpacking & Chelsea (Chelsea) · Dream Downtown, 355 W 16th St, 10011
- **Age:** 21–30
- **Prices/deals:** unknown · VIP/table-heavy
- **Music:** open-format DJ / hip-hop · Dance floor Y · Live music N
- **Tags:** **rooftop** · skyline · VIP/table · bottle service
- **Busiest:** Thu–Sat, 10pm–4am · **door: VIP-heavy** · HH unknown
- **Occasion:** dressed-up · scene
- **Desc:** A TAO-run rooftop lounge atop Dream Downtown with DJs, skyline views, and heavy table/VIP culture. Best for a dressed-up, scene-forward night — it's bottle-service-adjacent and doesn't pretend otherwise.
- **Tagline:** "Bottle-service-adjacent, no pretending otherwise."
- **IG:** @phdrooftopny (75.1K) · _TAO Group; selective/VIP door_

**TAO Downtown Nightclub** · club · Meatpacking & Chelsea (Chelsea) · 92 9th Ave, 10011
- **Age:** 21–32
- **Prices/deals:** tickets nightly · VIP reservations
- **Music:** open-format / hip-hop / EDM · Dance floor Y · Live music N
- **Tags:** nightclub · VIP/table · bottle service
- **Busiest:** weekend-skew · HH unknown
- **Occasion:** full club experience · groups
- **Desc:** The clearest actual nightclub in the district — a lounge/nightclub with VIP, cocktails, and a dance focus. Best for groups who want the full club experience with ticketing and tables.
- **Tagline:** "The actual nightclub part of Meatpacking."
- **IG:** unknown · _TAO Group_

**Electric Room** · lounge · Meatpacking & Chelsea (Chelsea) · Dream Downtown, 355 W 16th St, 10011
- **Age:** 21–32
- **Prices/deals:** unknown
- **Music:** rock-and-roll DJ · Dance floor Y (small) · Live music N
- **Tags:** intimate · exclusive-feeling · VIP-adjacent
- **Busiest:** unknown · HH unknown
- **Occasion:** smaller, exclusive-feeling night
- **Desc:** An intimate rock-and-roll lounge/nightclub at Dream Downtown with fashion-week-afterparty energy. Best for a smaller, more exclusive-feeling night than the big rooftops.
- **Tagline:** "Fashion-week-afterparty energy on a normal weekend."
- **IG:** @electricroomnyc (5,551) · _TAO Group_

**Catch Roof** · lounge · Meatpacking & Chelsea (Meatpacking) · 21 9th Ave, 10014
- **Age:** 21–32
- **Prices/deals:** unknown · VIP-heavy
- **Music:** open-format DJ · Dance floor Y · Live music N
- **Tags:** **rooftop** · dinner-to-nightlife · see-and-be-seen · VIP/table
- **Busiest:** unknown · **door: VIP-heavy** · HH unknown
- **Occasion:** upscale night · dinner-to-nightlife
- **Desc:** A see-and-be-seen rooftop lounge tied to Catch NYC, with a dinner scene that rolls into glossy roof nightlife. Best for an upscale night out where the room is the point.
- **Tagline:** "Dinner scene upstairs, glam roof after."
- **IG:** unknown

**The Tippler** · bar · Meatpacking & Chelsea (Chelsea) · 425 W 15th St (below Chelsea Market), 10011
- **Age:** 21–30
- **Prices/deals:** unknown
- **Music:** DJ / mixed · Dance floor N · Live music N
- **Tags:** subterranean cocktail bar · group-friendly
- **Busiest:** unknown · HH unknown
- **Occasion:** group drinks · no hard door
- **Desc:** A subterranean cocktail bar below Chelsea Market with room for groups. Best for Meatpacking-adjacent drinks without the velvet-rope headache.
- **Tagline:** "Meatpacking-adjacent without the velvet-rope headache."
- **IG:** unknown

## ZONE: FLATIRON & MIDTOWN
No research-verified venues yet — **backlog only** (see below).

## ZONE: BROOKLYN
No research-verified venues yet — **backlog only** (see below).

---

# Signal rollups (for future ENDZ filters)

### Rooftop / outdoor
- **Rooftops:** The Ready Rooftop (East) · Bar 13 (West) · Le Bain, Gansevoort Rooftop, PHD
  Rooftop, Catch Roof, Brass Monkey (roof terrace) (Meatpacking & Chelsea).
- **Outdoor / backyard / open-air:** St. Dymphna's (backyard), Niagara, Hi-Note (PDF:
  "backyard") (East) · The Duplex (upstairs) (West) · The Standard Biergarten (beer
  garden), Common Ground (open windows) (Meatpacking & Chelsea).

### "College scene" venues (youngest tier — no number shown for the young portion)
Off the Wagon (College scene only) · Phebe's · 13th Step · Down the Hatch · Wicked Willy's
· Bar 13 · Josie Woods · Brass Monkey — all `College scene · 21–2x` except Off the Wagon.

### Table / VIP / bottle-service
Le Bain · PHD · TAO Downtown · Catch Roof · Electric Room · Gansevoort Rooftop · Bar 13 (some).

### Queer-friendly
Stonewall · Pieces · The Monster · The Duplex · Cubbyhole (West) · Niagara (history, East).

### Live music / music-first
Nublu (East) · Red Lion, Le Poisson Rouge, Due West-Tue (West) · Stonewall/Monster/Duplex
piano (West). Jazz-heavy options live mostly in the backlog (KGB, Zinc, Smalls, Mezzrow…).

### Happy-hour windows (feeds `HappyHourRail`)
Niagara (daily to 7) · Doc Holliday's (Mon–Fri ~4:30–7) · Off the Wagon (Mon–Fri) · Peculier
Pub (Mon–Fri 4–7) · St. Dymphna's (Mon–Fri) · Common Ground (Mon–Fri) · Pieces
(daily/weekday) · WXOU (Sun late) · Josie Woods (daily). PDF adds Boho Karaoke ("until 9,
go early").

### Drink price / deal signals (only where sourced)
$ (cheap): Doc Holliday's, The Library, Peculier Pub · $$: Phebe's, Niagara, Wilfie & Nell ·
$$–$$$: Le Poisson Rouge · Cover: Bar 13 (~$10–20), Red Lion (Fri/Sat/hol), TAO (tickets),
Le Bain (event) · Deals: Off the Wagon (Half-Price Wed, beer+shot), Down the Hatch (nightly
+ bottomless brunch), Wicked Willy's (bottomless brunch). *(Literal per-drink prices are
rarely in the sources — most are `unknown`.)*

### Occasion index
- **Pregame / rowdy:** Phebe's, 13th Step, Off the Wagon, Down the Hatch, Brass Monkey
- **Dance:** Joyface, Wiggle Room, Bar 13, Madame X, Le Bain, PHD, TAO, Monster, Stonewall
- **Date / dressed-up:** Madame X, Joyface, Gansevoort Rooftop, Wilfie & Nell, Spaniard
- **Watch-the-game:** Phebe's, Josie Woods, Half Pint, Due West
- **Chill / conversation:** St. Dymphna's, Peculier Pub, WXOU, Wilfie & Nell, Nublu
- **Birthday / groups:** The Ready, Down the Hatch, Wicked Willy's, Standard Biergarten, Tippler
- **Show / planned:** Le Poisson Rouge, Nublu, Red Lion

### Reputational flags (INTERNAL — never render publicly)
"Bro-heavy / overcrowded": Phebe's, 13th Step, Spaniard, Due West, Off the Wagon, Down the
Hatch, Brass Monkey. Selective-door/table culture: Le Bain, PHD.

### Operator / promoter clusters (transferable expectations)
- **Student party-bar family:** Off the Wagon · Down the Hatch · 3 Sheets · (historically) The 13th Step.
- **TAO Group:** The Ready · PHD Rooftop · TAO Downtown · Electric Room.
- **Standard Hotels:** Le Bain · The Standard Biergarten.
- **Same team:** The Spaniard ← team behind Wilfie & Nell.

### Academic-calendar effect
Strongest student / young-post-grad density when NYU + The New School are in session: early
fall, Halloweekend, post-finals windows, first warm weeks of spring. Summer shifts toward
intern / tourist / recent-grad traffic.

### Cross-zone hop map
| Zone | Tightest cluster | Fri/Sat densest | Feeder stops | Natural hop |
|---|---|---|---|---|
| **East** | Ave A / E 7th–9th | Phebe's, 13th Step, Joyface, Niagara, Wiggle Room | Astor Pl (6), 8 St–NYU, Union Sq, 1 Av (L) | West / (LES within zone) |
| **West** | MacDougal + Christopher St | Off the Wagon, Down the Hatch, Bar 13, Spaniard, Stonewall, Pieces, Monster | W 4 St, 8 St–NYU, Christopher St (1) | East / Meatpacking & Chelsea |
| **Meatpacking & Chelsea** | Gansevoort / Washington / W 13th | Le Bain, PHD, TAO Downtown, Catch Roof, Gansevoort Rooftop | 14 St/8 Av (A/C/E/L), 14 St–Union Sq | West / Flatiron & Midtown |
| **Flatiron & Midtown** | *(backlog)* | *(backlog)* | 23 St, 14 St–Union Sq | Meatpacking & Chelsea |
| **Brooklyn** | *(backlog)* | *(backlog)* | L to Williamsburg/Bushwick | — |

---

# Expansion backlog — venues only in the user PDF (lower confidence), by zone

Not verified against official sources; names/spellings/neighborhoods as written in the PDF.
Annotations preserved — strong vibe/timing/door signals for later enrichment.

### ZONE: EAST — Lower East Side
Boho Karaoke *(INSANE happy hour until 9 — go early)* · 169 Bar *(cheap drinks)* · Le Dive ·
Only Love Strangers *(jazz)* · Somm Time *(wine)* · Casetta *(terrible service)* · Early
Terrible · Time Again · The Flower Shop · Bar Revival · Bar Gitano / Bohemia *(tin bldg)* ·
The Library · The Back Room *(speakeasy)* · Mr. Fong's · Ray's LES *(try)* · Public · Bar
Louis → 205 Club · Mr. Purple · Virgo *(EDM, 2 rooms, Clifford)* · Hotel Chantelle *(mid,
need promoter, 20 cover)* · Home Sweet Home → Fig 19 · Loosie's Nightclub · The Box · Gospel
*(Nolita)* · Ketchy Shuby *(Little Italy)* · Wiggle Room · The Blond · Pianos · The Palace ·
La Caverna · Outer Heaven · The Downstairs · The DL · Nurse Bettie *(burlesque Wed & Thurs)*
· The Slipper Room *(burlesque)* · Laissez Faire *(FiDi — jazz in Sept)*.

### ZONE: EAST — East Village (PDF additions)
Hi-Note *(backyard, listening lounge)* · Doc Holliday's · Old Flings · Tile Bar *(dive)* ·
A-10 *(kitchen)* · KGB Bar *(jazz most nights upstairs)* · Welcome to the Johnson's · Temple
Bar · Mona's Bar · Paradise Lost *(tiki speakeasy)* · The Wayland *(casual)* · Commodore II
*(2 Palm)* · Little Sister Lounge · The Blind Barber *(speakeasy behind barber shop)* · St.
Dymphna's · Yuca Bar · Make Believe · Joyface · Trublu/151 *(= Nublu)* · Jean's *(NoHo —
moved here from the PDF's Midtown grouping; NoHo rolls up to East)*.

### ZONE: WEST — West / Greenwich Village (PDF additions)
Zinc Bar *(jazz)* · The Bitter End · Mezzrow *(jazz)* · Smalls *(jazz)* · The Cellar Dog ·
The Spaniard · Fiddlesticks. *(Red Lion → verified profile above; "Carroll's Place" =
closed, see exclusions.)*

### ZONE: MEATPACKING & CHELSEA — Meatpacking / Chelsea / SoHo / Tribeca *(PDF: "it's all west to me")*
Le Bain · PHD Rooftop · Paul's Baby Grand *(Tribeca)* · Club Room @ SoHo Grand Hotel ·
SubMercer *(beneath Mercer Hotel)* · Marquee *(the Edge)* · The Fleur Room · Petite Disco ·
Amber Room · The Nines · Saint Tuesdays *(speakeasy, free jazz every night — Francisco,
Venezuelan bartender)* · All Blues *(jazz)* · Paul's Casablanca.

### ZONE: FLATIRON & MIDTOWN
Somewhere Nowhere · Georgia Room · Bar Calico · Nebula *(Tuesday Baby Tuesday → need
promoter)* · Blue Midtown · Paradise Club. *(PDF: average cover ~$30 with a table.)*

### ZONE: BROOKLYN
Ornithology Jazz Club · Jolene Sound Room · Bar Lunático *(cool lighting, jazz)* · The
Brooklyn Mirage · Bossa Nova Civic Club · Suono · Market Hotel · Signal · Woods Bar
*(Wednesdays)* · Dead Letter No. 9 · Ciao Ciao Disco.

### Excluded by the research pass (with reason)
- **Bandits** — official site "on a break" vs. IG "relaunched": contradiction, unverified.
- **Bowery Electric** — out of business; Time Out reported a 2026 transition to **Bowery
  Palace** (replacement not cleanly ENDZ-fit yet).
- **Keybar** — relocated from East Village to Bushwick.
- **The Woodstock** — out of business.
- **Carroll Place** (157 Bleecker, next to Red Lion) — out of business (closed as of July
  2026). PDF had listed it as "Carroll's Place / Red Lion"; the two are separate venues.
- **Sour Mouse, Blue Haven South** — outside the requested neighborhoods.
- **Little Sister Lounge** — at Moxy *East Village*, not Meatpacking (PDF agrees).
