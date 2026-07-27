# Seed Activity Dataset — supplied 2026-07-26

Colton's original researched activity table, supplied verbatim at the start of
the activity/heat design. **This is the source of the ten researched venues in
`src/data/activity/baseline.json`** — busy windows, peak windows, line times and
best nights all trace here.

Preserved because it existed only in the conversation. Everything downstream
depends on it.

`source_type = research_estimate`. Not live data — the baseline predictive layer.

## Corrections applied since

- **Bar 13 is CLOSED PERMANENTLY** (verified against Google Places 2026-07-27).
  It appears below as supplied but must not be used. It was load-bearing in the
  original weekend tiers.
- Naming: *Niagara* is **Niagara Bar** in the app; *Downtown Social / 13th Step*
  is **Downtown Social**.
- Electric Room, The Tippler and Common Ground were all verified OPERATIONAL.

## The table

| Venue | Neighborhood | Type | Price | Best nights | Busy window | Peak window | Line likely after | Line eases after | Description | Heatmap logic |
|---|---|---|---|---|---|---|---|---|---|---|
| Phebe's Tavern | East Village | Sports bar / party bar | $$ | Thu, Fri, Sat | 8:30 PM to 2:00 AM | 10:30 PM to 1:00 AM | Fri/Sat after 10:30 PM | after 1:30 AM | High-energy East Village sports bar that turns into a young, social weekend spot. Best for games, groups, and a classic NYU-area night out. | Strong group/sports bar. Heat rises early and stays high. |
| Downtown Social / 13th Step | East Village | Party bar / sports bar | $$ | Thu, Fri, Sat | 9:00 PM to 2:30 AM | 11:00 PM to 1:30 AM | Fri/Sat after 10:45 PM | after 2:00 AM | Loud East Village party bar with sports, DJs, and late-night group energy. Good for a rowdy night, not a quiet drink. | Rowdy party-bar energy. Strong weekend line-risk. |
| St. Dymphna's | East Village | Irish pub | $$ | Thu, Fri, Sat | 6:30 PM to 12:30 AM | 8:30 PM to 11:00 PM | Low, occasional Fri/Sat | after midnight | Relaxed Irish-style pub with casual drinks, food, trivia, and a backyard. Best for easy group hangs before the night picks up. | Better early-night or group hang than late-night peak. |
| Joyface | East Village | Lounge / dance bar | $$$ | Thu, Fri, Sat | 9:00 PM to 2:00 AM | 11:00 PM to 1:30 AM | Fri/Sat after 10:30 PM | after 1:45 AM | Stylish retro lounge with cocktails, DJs, and a dance-friendly crowd. Best for a dressed-up but still fun East Village night. | Stylish lounge/dance energy. Heat should spike late. |
| Niagara | East Village | Dive bar | $$ | Fri, Sat | 9:30 PM to 2:30 AM | 11:30 PM to 1:30 AM | Fri/Sat after 11:00 PM | after 2:00 AM | Classic East Village dive with late-night music, casual drinks, and downtown energy. Good when you want something unpolished and social. | Classic late-night downtown spot. Good "still going" signal. |
| Doc Holliday's | East Village | Dive bar | $ | Thu, Fri, Sat | 8:30 PM to 2:00 AM | 10:30 PM to 1:00 AM | Medium Fri/Sat | after 1:30 AM | No-frills dive bar with cheap drinks, pool, jukebox energy, and a laid-back crowd. Best for a casual, low-pressure night. | Casual dive. Hot when the group wants low-pressure drinks. |
| Wiggle Room | East Village | Dance bar | $$ | Thu, Fri, Sat | 10:00 PM to 3:00 AM | 11:30 PM to 2:00 AM | Fri/Sat after 11:15 PM | after 2:15 AM | Two-level East Village dance bar with DJs and a basement floor. Usually gets going late and is best for groups that want dancing without going full nightclub. | Dance bar. Should rank high late-night on weekends. |
| Nublu 151 | East Village | Music venue / lounge | $$ | Event-based, Fri, Sat | 8:00 PM to 2:00 AM | 10:00 PM to 1:00 AM | Event-dependent | after 1:30 AM | Music-focused East Village venue with live shows, DJs, jazz, and electronic programming. Best for a night built around the music. | Heat should depend heavily on event calendar. |
| The Ready Rooftop | East Village | Rooftop bar | $$$ | Thu, Fri, Sat, Sun | 5:00 PM to 11:30 PM | 7:00 PM to 10:00 PM | Fri/Sat after 7:30 PM | after 10:30 PM | Casual rooftop at Moxy East Village with frozen drinks, group seating, and upbeat party energy. Best for birthdays, day drinks, or a fun first stop. | Rooftop. Earlier heat than clubs, strong for day/evening plans. |
| The Library | East Village | Dive bar | $ | Fri, Sat | 9:30 PM to 2:30 AM | 11:30 PM to 1:30 AM | Medium Fri/Sat | after 2:00 AM | Dark East Village dive with cheap drinks, loud music, and a gritty downtown feel. Best for a casual late-night stop. | Late-night dive. Good after other places thin out. |
| Josie Woods Pub | Greenwich Village | Sports pub | $$ | Thu, Fri, Sat | 7:30 PM to 1:30 AM | 9:30 PM to 12:30 AM | Low/medium Fri/Sat | after 1:00 AM | Straightforward Greenwich Village sports pub with TVs, games, and a student-friendly feel. Best for easy drinks near NYU. | Easy NYU-area sports pub. Good early/midnight crowd. |
| Off the Wagon | Greenwich Village | Party bar | $ | Thu, Fri, Sat | 8:30 PM to 2:30 AM | 10:30 PM to 1:30 AM | Fri/Sat after 10:30 PM | after 2:00 AM | Classic MacDougal Street party bar with drink specials, sports, and a college-heavy crowd. Best for a loud bar-crawl night. | College-heavy party bar. High heat for bar crawls. |
| Down the Hatch | Greenwich Village | Basement party bar | $ | Thu, Fri, Sat | 8:30 PM to 2:30 AM | 10:30 PM to 1:30 AM | Fri/Sat after 10:45 PM | after 2:00 AM | Basement party bar known for wings, beer pong, drink deals, and late-night groups. Best for a messy, casual Village night. | Basement party bar. Strong late-night group signal. |
| Wicked Willy's | Greenwich Village | Party bar | $$ | Thu, Fri, Sat | 8:00 PM to 2:00 AM | 10:00 PM to 1:00 AM | Medium/high Fri/Sat | after 1:30 AM | Lively Bleecker Street party bar with tropical drinks, games, brunch, and group energy. Best for birthdays or a fun, unserious night. | Birthday/group energy. Heat is best for casual party nights. |
| The Red Lion | Greenwich Village | Live music bar | $$ | Thu, Fri, Sat | 8:00 PM to 1:30 AM | 9:30 PM to 12:30 AM | Medium when music is strong | after 1:00 AM | Live-music bar with nightly bands, soccer, and a high-energy crowd. Best when you want entertainment without going to a club. | Live music drives heat. Event-aware scoring needed. |
| Peculier Pub | Greenwich Village | Beer pub | $$ | Fri, Sat | 7:00 PM to 12:30 AM | 8:30 PM to 11:30 PM | Low | after midnight | Casual beer-focused pub with a large selection and an old-school Village feel. Best for conversation, beers, and a lower-key night. | Lower-key beer spot. Should rarely show as "hottest." |
| Bar 13 ⚠️ CLOSED | Greenwich Village / Union Square | Club / dance bar | $$ | Thu, Fri, Sat | 10:00 PM to 3:30 AM | 11:30 PM to 2:30 AM | Fri/Sat after 11:00 PM | after 2:30 AM | Multi-level bar and club near Union Square with DJs, dancing, and rooftop space. Best when the group wants a real dance spot. | **DO NOT USE — verified CLOSED_PERMANENTLY 2026-07-27.** |
| Madame X | Greenwich Village | Lounge | $$ | Thu, Fri, Sat | 9:00 PM to 2:00 AM | 10:30 PM to 1:00 AM | Medium/high Fri/Sat | after 1:30 AM | Red-lit Greenwich Village lounge with cocktails, DJs, and a more intimate nightlife feel. Best for a moody, dressed-up night. | Lounge feel. Good for moodier, dressed-up nights. |
| Le Poisson Rouge | Greenwich Village | Music venue / nightlife | $$ | Event-based | 8:00 PM to 2:00 AM | Event start to 12:30 AM | Event-dependent | after event ends | Music venue and nightlife space with concerts, DJ events, and late-night programming. Best when you want a planned event instead of bar hopping. | Should be calendar-driven, not generic crowd-driven. |
| The Half Pint | Greenwich Village | Pub | $$ | Thu, Fri, Sat | 7:30 PM to 1:00 AM | 9:30 PM to 12:00 AM | Low/medium | after 12:30 AM | Casual West 3rd pub with beer, sports, brunch, and group-friendly seating. Best as a reliable Village fallback. | Reliable fallback. Good "busy" but not usually "line likely." |
| The Spaniard | West Village | Bar / gastropub | $$$ | Thu, Fri, Sat | 7:00 PM to 1:30 AM | 9:00 PM to midnight | Fri/Sat after 8:30 PM | after 12:30 AM | Polished West Village bar with cocktails, whiskey, food, and a young-professional crowd. Best for a social but put-together night. | Polished young-professional bar. Earlier line risk. |
| Wilfie & Nell | West Village | Bar / gastropub | $$ | Thu, Fri, Sat | 7:00 PM to 1:00 AM | 8:30 PM to 11:30 PM | Medium Fri/Sat | after midnight | Cozy West Village bar with cocktails, beer, food, and a first-job crowd. Best for smaller groups, dates, or a casual start to the night. | Smaller/cozier. Heat should peak before club hours. |
| Due West | West Village | Gastropub / cocktail bar | $$$ | Thu, Fri, Sat | 7:00 PM to 1:00 AM | 8:30 PM to 11:30 PM | Medium Fri/Sat | after midnight | Stylish West Village gastropub with cocktails, food, sports, and occasional live music. Best for a polished group drink without club energy. | Good group drink spot. More "busy" than "wild." |
| The Happiest Hour | West Village | Cocktail bar | $$ | Thu, Fri, Sat | 7:30 PM to 2:00 AM | 9:30 PM to 12:30 AM | Fri/Sat after 9:30 PM | after 1:00 AM | Playful West Village cocktail bar with tropical drinks, burgers, and a young social crowd. Best earlier in the night before it turns into a packed pregame spot. | Upbeat cocktail/group spot. Strong pregame heat. |
| WXOU Radio Bar | West Village | Neighborhood bar | $$ | Fri, Sat | 8:30 PM to 1:30 AM | 10:00 PM to 12:30 AM | Low/medium | after 1:00 AM | Low-key West Village bar with retro jukebox energy and a neighborhood feel. Best for casual late-night drinks without a scene. | Casual late-night option. Good when nearby scenes are too much. |
| Stonewall Inn | West Village | LGBTQ+ bar / nightlife | $$ | Thu, Fri, Sat, Sun | 8:00 PM to 2:30 AM | 10:00 PM to 1:30 AM | Fri/Sat after 10:00 PM | after 2:00 AM | Historic LGBTQ+ bar with drag, piano, dancing, and late-night programming. Best for a lively, cultural, and social West Village night. | Programming matters. Drag/dancing nights should boost heat. |
| Pieces Bar | West Village | Gay bar / drag bar | $ | Thu, Fri, Sat, Sun | 8:30 PM to 2:30 AM | 10:30 PM to 1:30 AM | Fri/Sat after 10:30 PM | after 2:00 AM | High-energy Christopher Street gay bar with drag, games, and cheap-drink energy. Best for a fun, interactive night out. | Interactive/event-heavy. Strong nightlife signal when shows are on. |
| The Monster | West Village | Gay bar / club | $$ | Thu, Fri, Sat, Sun | 9:00 PM to 3:00 AM | 11:00 PM to 2:00 AM | Fri/Sat after 11:00 PM | after 2:15 AM | Multi-level gay bar and club with piano-bar energy upstairs and dancing downstairs. Best when the group wants entertainment and a dance floor. | Piano-to-club flow. Strong late-night heat. |
| The Duplex | West Village | Piano bar / cabaret | $$ | Thu, Fri, Sat, Sun | 8:00 PM to 2:00 AM | 9:30 PM to 12:30 AM | Medium/event-dependent | after 1:00 AM | Historic piano bar and cabaret space with performances, singing, and classic Village personality. Best for a night with built-in entertainment. | Entertainment-led. Heat should follow show schedule. |
| Cubbyhole | West Village | Lesbian bar | $ | Thu, Fri, Sat, Sun | 7:30 PM to 1:30 AM | 9:00 PM to midnight | Medium/high Fri/Sat | after 12:30 AM | Small, festive lesbian bar with a colorful, welcoming crowd. Best for casual queer nightlife and a more intimate room. | Small room means line/crowding can happen earlier. |
| Le Bain | Meatpacking | Rooftop club | $$$$ | Thu, Fri, Sat, Sun | 10:00 PM to 4:00 AM | midnight to 2:30 AM | Fri/Sat after 11:00 PM | after 2:45 AM | Rooftop club at The Standard with DJs, skyline views, and a strong weekend scene. Best for a dressed-up Meatpacking night. | One of the highest late-night heat scores. Door risk high. |
| The Standard Biergarten | Meatpacking | Beer garden | $$ | Thu, Fri, Sat, Sun | 5:00 PM to midnight | 7:00 PM to 10:30 PM | Medium Fri/Sat | after 11:00 PM | Large indoor-outdoor beer garden with communal tables, drinks, and casual group energy. Best for an easy Meatpacking meet-up. | Big group meet-up. Earlier heat, less clubby. |
| Brass Monkey | Meatpacking | Multi-floor bar | $$ | Thu, Fri, Sat | 7:30 PM to 2:00 AM | 9:30 PM to 12:30 AM | Medium/high Fri/Sat | after 1:00 AM | Multi-floor Meatpacking bar with casual drinks, a roof terrace, and rowdy weekend energy. Best for a straightforward party-bar crowd. | Casual party-bar option in Meatpacking. Good group heat. |
| Gansevoort Rooftop | Meatpacking | Rooftop lounge | $$$ | Thu, Fri, Sat, Sun | 6:00 PM to 1:30 AM | 8:30 PM to midnight | Fri/Sat after 8:30 PM | after 12:30 AM | Upscale rooftop lounge with cocktails, DJs, and skyline views. Best for a more polished Meatpacking night. | Upscale rooftop. Heat starts earlier than clubs. |
| Common Ground | Meatpacking | Bar / lounge | $$ | Thu, Fri, Sat | 7:00 PM to 2:00 AM | 9:30 PM to 12:30 AM | Medium Fri/Sat | after 1:00 AM | Group-friendly Meatpacking bar with happy hour, open-air seating, and weekend music. Best when you want the area without the full club scene. | Good non-club Meatpacking option. |
| PHD Rooftop Lounge | Meatpacking | Rooftop lounge / club | $$$$ | Thu, Fri, Sat | 10:00 PM to 4:00 AM | midnight to 2:30 AM | Fri/Sat after 11:00 PM | after 2:45 AM | High-end rooftop lounge with DJs, skyline views, and VIP/table energy. Best for a dressed-up, scene-heavy night. | High scene/door risk. Strong "hot now" late-night. |
| TAO Downtown Nightclub | Meatpacking | Nightclub | $$$$ | Fri, Sat | 11:00 PM to 4:00 AM | 12:30 AM to 2:30 AM | Fri/Sat after 11:30 PM | after 2:45 AM | Large Meatpacking nightclub with DJs, dancing, and VIP service. Best for groups looking for a full club experience. | Full club. Should rank high only late. |
| Electric Room | Meatpacking | Lounge | $$$$ | Thu, Fri, Sat | 10:30 PM to 3:30 AM | midnight to 2:00 AM | Fri/Sat after 11:30 PM | after 2:30 AM | Intimate lounge at Dream Downtown with rock-and-roll design and late-night music. Best for a smaller, more exclusive-feeling night. | Smaller lounge. High exclusivity/door-risk score. |
| Catch Roof | Meatpacking | Rooftop lounge | $$$$ | Thu, Fri, Sat, Sun | 7:00 PM to 2:00 AM | 9:30 PM to 12:30 AM | Fri/Sat after 9:30 PM | after 1:00 AM | Polished rooftop lounge tied to Catch NYC with cocktails, dinner-to-nightlife energy, and a see-and-be-seen crowd. Best for an upscale night out. | Dinner-to-nightlife flow. Earlier heat than clubs. |
| The Tippler | Meatpacking / Chelsea | Cocktail bar | $$ | Thu, Fri, Sat | 7:00 PM to 1:00 AM | 8:30 PM to 11:30 PM | Medium Fri/Sat | after midnight | Subterranean cocktail bar below Chelsea Market with a relaxed, group-friendly layout. Best for Meatpacking drinks without a hard club door. | Good cocktail fallback. Less likely to be "line likely." |

## Global weekend heat logic (as supplied)

**Fri/Sat 7–9 PM — should start heating up:** The Ready Rooftop, The Standard
Biergarten, Gansevoort Rooftop, Catch Roof, The Spaniard, Wilfie & Nell,
The Happiest Hour, St. Dymphna's.

**Fri/Sat 9–11 PM — Busy or Building:** Phebe's Tavern, Downtown Social,
Off the Wagon, Down the Hatch, Wicked Willy's, The Happiest Hour, Brass Monkey,
Catch Roof, Joyface, Stonewall Inn, Pieces Bar.

**Fri/Sat 11 PM–1 AM — Hot Now or Line Likely:** Wiggle Room, Joyface, ~~Bar 13~~,
Le Bain, PHD Rooftop Lounge, TAO Downtown, Electric Room, The Monster,
Off the Wagon, Down the Hatch, Downtown Social.

**Fri/Sat 1–3 AM — still active:** Le Bain, PHD Rooftop Lounge, TAO Downtown,
Electric Room, ~~Bar 13~~, Wiggle Room, Niagara, The Library, The Monster,
Downtown Social.

## Supplied score thresholds

0–29 Quiet · 30–54 Building · 55–74 Busy · 75–89 Hot Now · 90–100 Line Likely.

Implemented as 0–29 / 30–54 / 55–74 / 75–100, with **Line Likely as an overlay**
rather than a band — see the spec for why.
