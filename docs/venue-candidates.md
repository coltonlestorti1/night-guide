# Missing Venue Candidates

Gap analysis against the current 56-venue East Village dataset (`src/data/venues.ts`)
and the 40-row research seed supplied 2026-07-26.

**Verified 2026-07-26** against Google Places (`places:searchText`, `businessStatus`
field). Every row below returned an `OPERATIONAL` listing whose name and address
match the intended venue. Rows where the API returned a *different* business were
re-probed by last-known street address; those results are in "Confirmed closures".

Timing data is **not** included for any candidate — all of it is
**Needs busy-time research**. Nothing here has been guessed.

## Scope

East Village is the only neighborhood going live. The other neighborhoods are
staged here so the busy-time research can happen once, ahead of expansion.

## Confirmed closures — do not add

Google reports these `CLOSED_PERMANENTLY`, or the address is now occupied by a
different business. Several were on my first-pass recommendation list; the
verification pass removed them.

| Venue | Was | Evidence |
|---|---|---|
| **Bar 13** | Union Square club/dance bar | `CLOSED_PERMANENTLY`. **This is in the supplied seed dataset** and is currently load-bearing in the 11 PM–1 AM and 1–3 AM weekend tiers. It must be removed from the seed |
| Eastern Bloc | EV gay bar, 505 E 6th St | `CLOSED_PERMANENTLY` |
| Rue B | EV jazz bar, 188 Ave B | `CLOSED_PERMANENTLY` |
| Proletariat | EV beer bar | `CLOSED_PERMANENTLY` |
| The Slaughtered Lamb | GV pub, 182 W 4th St | `CLOSED_PERMANENTLY` |
| Bagatelle | MPD restaurant/party | `CLOSED_PERMANENTLY` at 1 Little W 12th St |
| Bounce Sporting Club | Flatiron sports bar/club | `CLOSED_PERMANENTLY` at 55 W 21st St |
| The Ainsworth (Chelsea) | Sports bar/lounge | `CLOSED_PERMANENTLY` |
| The Jane Hotel / Jane Ballroom | WV hotel bar | Hotel listing is `CLOSED_PERMANENTLY`; no separate ballroom listing |
| Manitoba's | EV punk dive, 99 Ave B | Address now "Thayer", a coffee shop |
| Percy's Tavern | EV bar, 210 Ave A | Address now **Motel No Tell** — already in our dataset |
| Boilermaker | EV bar, 13 1st Ave | Address now **Superbueno** — already in our dataset |
| Zum Schneider | EV beer hall, 107 Ave C | EV location gone (now "Ayat"); business moved to Greenpoint, Brooklyn — out of scope |

## Renames and relocations to be aware of

| Expected name | Current listing | Note |
|---|---|---|
| The Bowery Electric | **Bowery Palace**, 327 Bowery | Same address, rebranded. Confirm it is the same operation before adding |
| Boom Boom Room | **BOOM**, The Standard High Line | Rebranded |
| Hotel Chantelle | **Chantelle NYC**, 92 Ludlow St | Rebranded |
| Sing Sing Karaoke | **Sing Sing Ave A.**, 81 Ave A | The Ave A branch is the one that matters |
| Angel's Share | 45 Grove St | **Relocated out of the East Village** — it is a West Village venue now |
| Bleecker Street Bar | 648 Broadway | Listed under the Broadway address, not Bleecker |

---

## East Village — live scope, highest priority

Gaps cluster in three areas the current dataset underserves: **large event-driven
venues, LGBTQ+ nightlife, and activity bars.**

| Venue | Type | Price | Rating | Why | Priority | placeId / coords |
|---|---|---|---|---|---|---|
| **Webster Hall** | Live music venue / club | $$$ | 4.2 (3146) | Biggest 21–25 draw in the East Village. Concerts plus club nights. The most conspicuous gap in the dataset. Event-calendar driven, not fixed windows | **High** | `ChIJhRtmUZlZwokRkQOpUZlUGZ8` · 40.73182, -73.98910 |
| **The Cock** | Gay bar / late-night | $$ | 3.8 (282) | 2nd Ave institution, runs very late. Anchors the 1–3 AM "still active" tier | **High** | `ChIJQ8iS8YRZwokRBsrnhO_DFUQ` · 40.72716, -73.98895 |
| **The Boiler Room** | Gay bar | $ | 3.8 (275) | Core EV queer nightlife, dancing, cheap, late | **High** | `ChIJAydFqYRZwokRo1s2sj0i4Rc` · 40.72542, -73.99036 |
| **Sing Sing Ave A.** | Karaoke | $$ | 4.0 (722) | Karaoke is a top-tier group activity for this age band and we have zero coverage | **High** | `ChIJnefAt4JZwokRRvgwpTkPssA` · 40.72518, -73.98448 |
| **7B Horseshoe Bar (Vazac's)** | Dive | $ | 4.3 (460) | Iconic Ave B corner dive, heavy foot traffic, film-famous | **High** | `ChIJ_dHPIXhZwokRjbflLgfCFkM` · 40.72505, -73.98141 |
| **Ace Bar** | Activity dive | $ | 4.0 (718) | Pool, darts, skee-ball. A destination, not just drinks | **High** | `ChIJuddLo4JZwokRdm_oW8FoWN4` · 40.72439, -73.98287 |
| **2A** | DJ bar | $ | 4.2 (242) | Upstairs DJ room at Ave A & 2nd. Strong late-night signal | **High** | `ChIJU5wrU4JZwokRPwj__q1lJ0M` · 40.72300, -73.98604 |
| Sophie's | Cheap dive | $ | 3.9 (441) | Classic cash dive, student-priced | Optional | `ChIJZ1obu4JZwokRIif6X60iJXM` · 40.72480, -73.98384 |
| Nowhere | Gay dive | $ | 3.7 (252) | Low-key 14th St option | Optional | `ChIJZ1fMFZ5ZwokRkYrV85CZorY` · 40.73177, -73.98412 |
| DROM | Live music venue | $$ | 4.1 (1191) | Ave A. **Event-calendar driven** | Optional | `ChIJwUcmtIJZwokREiWU5DTPSJA` · 40.72532, -73.98431 |
| Bowery Palace (fka Bowery Electric) | Music venue / bar | $$ | 4.3 (1169) | **Event-calendar driven.** Confirm the rebrand first | Optional | `ChIJFf-pIIVZwokRPeulXUC6oqU` · 40.72575, -73.99180 |
| Burp Castle | Beer bar | $$ | 4.6 (725) | Quiet-by-design. Useful as a genuine "Quiet" datapoint | Optional | `ChIJBT-bg5xZwokRKJJbJvvRz-w` · 40.72837, -73.98858 |
| Amor y Amargo | Cocktail bar | $$$ | 4.7 (987) | Small, amaro-focused, early peak | Optional | `ChIJObMZS51ZwokR0ffmCsI0qFQ` · 40.72573, -73.98427 |

---

## Lower East Side / Bowery — recommended next neighborhood

**This is the strongest expansion recommendation in this document.** The natural
adjacency to the East Village is the LES, not the West Village: it is contiguous
walking distance from Avenue A, the same age band, and a similar price range.
Nobody walks East Village → Meatpacking.

| Venue | Type | Price | Rating | Why | Priority | placeId / coords |
|---|---|---|---|---|---|---|
| **Pianos** | Bar / live music / DJ | $$ | 3.9 (2439) | The LES anchor for this exact age group | **High** | `ChIJP-xJX4FZwokRyzyQJzIQqXI` · 40.72105, -73.98773 |
| **Sour Mouse** | Activity bar / club | – | 4.6 (780) | Pool, ping-pong, live music, art-space feel. Enormous with 21–25 | **High** | `ChIJeel1edNZwokRj6nwmwLrrTg` · 40.71896, -73.98835 |
| **Mr. Purple** | Rooftop bar | $$$ | 4.1 (3216) | Fills the early-evening rooftop tier | **High** | `ChIJsWUw5YNZwokR141Cz0g9XSw` · 40.72174, -73.98810 |
| **The DL** | Rooftop club | $$ | 4.0 (2426) | Multi-level, real door and line risk | **High** | `ChIJx-YCLIdZwokRWxdzML7Ogw4` · 40.71863, -73.98922 |
| **The Bowery Ballroom** | Live music venue | $$ | 4.6 (1824) | Major room. **Event-calendar driven** | **High** | `ChIJLQUUOYZZwokR1BfSFbM-XB4` · 40.72041, -73.99336 |
| Arlene's Grocery | Live music bar | $$ | 4.4 (1026) | Rock shows and karaoke nights | Optional | `ChIJJU9H_YNZwokRraufOH6MCfM` · 40.72128, -73.98837 |
| Chantelle NYC | Club / rooftop | $$$ | 3.9 (1622) | Rooftop club, late | Optional | `ChIJPb7KLYdZwokRIgG4nSNM6qg` · 40.71832, -73.98895 |
| Mehanata Bulgarian Bar | Nightclub | $$ | 4.1 (431) | Late, chaotic, distinctive | Optional | `ChIJbWNeLYFZwokRUsKnHSHXmjw` · 40.71947, -73.98881 |
| Home Sweet Home | Basement bar/club | $ | 4.2 (584) | Late-night dive-club | Optional | `ChIJb6KTyodZwokRX2TgJbvvvKg` · 40.71949, -73.99335 |
| Attaboy | Cocktail bar | $$$ | 4.2 (1991) | No-menu, no-reservation. Interesting line-risk case: waits without a club door | Optional | `ChIJDbQMBIdZwokRVS4L8B8V5SA` · 40.71888, -73.99138 |
| Ray's | Dive | – | 4.2 (507) | Chrystie St, late | Optional | `ChIJKavF4jxZwokRph6HhofCKJY` · 40.72118, -73.99250 |
| Von | Wine bar | $$ | 4.4 (623) | NoHo. Quiet start-of-night | Optional | `ChIJOcgLF4VZwokR0Sk_RSn9sTo` · 40.72548, -73.99261 |
| The Wren | Bar | $$ | 4.4 (1134) | NoHo, casual | Optional | `ChIJi6b8KIVZwokR0jaGWCEGugw` · 40.72633, -73.99221 |

---

## Greenwich Village — gaps in the supplied seed

The seed covers the MacDougal/Bleecker party corridor well. Missing pieces are
live music and the comedy-bar cluster.

| Venue | Type | Price | Rating | Why | Priority | placeId / coords |
|---|---|---|---|---|---|---|
| **Village Underground** | Live music / comedy / party | $$ | 4.6 (1657) | W 3rd St, late and dense | **High** | `ChIJUzSA1pNZwokRf6TVgNdK0W0` · 40.73073, -74.00090 |
| **Fat Black Pussycat** | Party bar / comedy | $ | 4.4 (751) | Big multi-room spot in the corridor. **Shares 130 W 3rd St with Village Underground** — same building, two listings; decide whether to model as one venue or two | **High** | `ChIJUzSA1pNZwokRXIM_Ln81TZc` · 40.73071, -74.00091 |
| The Grisly Pear | Comedy bar | $ | 4.2 (700) | MacDougal, comedy plus late bar | Optional | `ChIJTZi5KJJZwokRyN39w3qO88s` · 40.72984, -74.00077 |
| Dante NYC | Cocktail bar | $$$ | 4.5 (2789) | Upscale, early peak, dinner-to-drinks | Optional | `ChIJUw68EZJZwokRJ15RD_T4OTw` · 40.72884, -74.00164 |
| The Bitter End | Live music | $$ | 4.5 (1031) | Historic Bleecker room. **Event-driven** | Optional | `ChIJ3fYA6JFZwokREvGpQiCDe-4` · 40.72837, -73.99918 |
| Terra Blues | Blues bar | $$ | 4.7 (1470) | Nightly live sets. **Event-driven** | Optional | `ChIJ5ais55FZwokR78b9lEBgVz4` · 40.72843, -73.99925 |
| Groove | Live music bar | $$ | 4.3 (1270) | Funk/soul nightly, no cover | Optional | `ChIJkUHgeJFZwokRQXNa_wrBAqA` · 40.73060, -74.00020 |
| Vol de Nuit | Belgian beer bar | $$ | 4.4 (578) | Hidden courtyard, lower-key | Optional | `ChIJzyLfYZFZwokRxNX_OjJLoRM` · 40.73135, -74.00065 |
| Amity Hall Downtown | Sports pub | $$ | 4.2 (724) | Fits the NYU sports-pub tier | Optional | `ChIJ1ZCho5FZwokR_5EsRjuyqic` · 40.72972, -73.99887 |
| Bleecker Street Bar | Dive / sports | $ | 4.1 (682) | Cheap and casual | Optional | `ChIJs_vt9I9ZwokRxV5EBoQcB5E` · 40.72669, -73.99554 |
| Blue Note | Jazz club | $$$ | 4.2 (5642) | **Set-time driven, not crowd driven.** Model like Le Poisson Rouge | Optional | `ChIJbfTV15NZwokRSeNM676BEZI` · 40.73091, -74.00066 |

---

## West Village — gaps in the supplied seed

LGBTQ+ coverage in the seed is good but has three notable holes.

| Venue | Type | Price | Rating | Why | Priority | placeId / coords |
|---|---|---|---|---|---|---|
| **Marie's Crisis Café** | Piano / show-tune bar | $ | 4.5 (1332) | Iconic, packed nightly, no substitute in the seed | **High** | `ChIJIWNZgJNZwokRsOATqnluSIk` · 40.73322, -74.00340 |
| **Julius'** | Gay bar | $ | 4.5 (790) | Oldest gay bar in NYC. Historic pair with Stonewall | **High** | `ChIJJ0KwSzBZwokRZBEwqbaFtjU` · 40.73454, -74.00152 |
| **Henrietta Hudson** | Lesbian bar | $$ | 4.1 (651) | The other major lesbian bar. Cubbyhole alone undercovers this | **High** | `ChIJhyhbK-1ZwokRmOnWy-LnDEc` · 40.73107, -74.00642 |
| Angel's Share | Hidden cocktail bar | – | 4.4 (1824) | Relocated here from the East Village. Small room, real waits | Optional | `ChIJiyiwQFdZwokR7rsRrrchLJk` · 40.73298, -74.00426 |
| Employees Only | Cocktail bar | $$$ | 4.2 (3193) | Late-serving, dressed-up crowd | Optional | `ChIJLztrVJNZwokRTmcQJheGNR4` · 40.73343, -74.00611 |
| Little Branch | Speakeasy / jazz | $$$ | 4.4 (917) | Basement, live jazz, line-prone for its size | Optional | `ChIJjY7y6ZJZwokRXF5CA_X4l-I` · 40.73012, -74.00504 |
| White Horse Tavern | Historic pub | $$ | 4.2 (1454) | Landmark, tourist plus local mix | Optional | `ChIJGfAs0ZRZwokR584EB4uBkyU` · 40.73570, -74.00619 |
| Art Bar | Neighborhood bar | $ | 4.4 (1637) | Back-room lounge feel | Optional | `ChIJcUtKK75ZwokR4n1SDLiQPoc` · 40.73847, -74.00350 |
| Kettle of Fish | Sports / neighborhood bar | $ | 4.4 (528) | Packers bar, distinct crowd | Optional | `ChIJk7eGbZRZwokRx6UUE0oExXk` · 40.73380, -74.00239 |
| Ty's Bar | Gay dive | $ | 4.6 (578) | Small, neighborhood-scale | Optional | `ChIJaVvpXJNZwokRT3p02KL_TrY` · 40.73313, -74.00535 |
| Barrow Street Ale House | Pub | $ | 3.8 (199) | Reliable fallback tier | Optional | `ChIJuSb7kZNZwokRyFL7gpKQbfA` · 40.73264, -74.00253 |
| Buvette | Wine bar | $$$ | 4.4 (4372) | Early-evening only, low line risk | Optional | `ChIJEwHZcZNZwokR810IgyQhoZM` · 40.73263, -74.00433 |

---

## Meatpacking / Chelsea — gaps in the supplied seed

| Venue | Type | Price | Rating | Why | Priority | placeId / coords |
|---|---|---|---|---|---|---|
| **BOOM (fka Boom Boom Room)** | Hotel club / lounge | $$$$ | 4.4 (573) | Top of The Standard, directly above Le Bain. Highest door-risk venue in the area — a good stress test for line-risk scoring. **Same building as Le Bain**, worth modeling the relationship | **High** | `ChIJBavmZ8BZwokRA3CH90NwoY0` · 40.74087, -74.00814 |
| **Marquee New York** | Nightclub | $$$ | 2.9 (1200) | Major Chelsea club, natural pair with TAO. Note the low rating — packed does not mean well-liked, which is exactly the recommendation-quality split | **High** | `ChIJBwnlGrdZwokRpf61pMm860c` · 40.75010, -74.00281 |
| Somewhere Nowhere NYC | Rooftop club / pool | $$ | 3.5 (1696) | Chelsea, big draw, rooftop pool | Optional | `ChIJRYx-LctZwokRUGvx8Rg1LQA` · 40.74432, -73.99270 |
| Bathtub Gin | Speakeasy | $$$ | 4.3 (2299) | Hidden entrance, Chelsea | Optional | `ChIJcTnRKLlZwokRT8ZXt9W9cgw` · 40.74357, -74.00316 |
| Slate | Activity bar | $$ | 4.0 (3663) | Pool, ping-pong, bowling. Large group bookings | Optional | `ChIJSZr2ZqNZwokRN89ggdSWGiQ` · 40.74122, -73.99319 |

## Supplied-seed rows now verified good

Three rows I had flagged as uncertain are confirmed open, and can stay in the seed as-is:

- **Electric Room** — `OPERATIONAL`, Dream Downtown lower level. `ChIJDVYuIL9ZwokRG2WcihQAeOs`
- **The Tippler** — `OPERATIONAL`, 425 W 15th St. `ChIJw2ZXYL9ZwokRZblZ0YKQ5QA`
- **Common Ground Bar** — `OPERATIONAL`, 63 Gansevoort St. `ChIJrwjIEcBZwokRFqjDrYjIbK0`

## Data still needed

Already collected above: name, neighborhood, type, price level, rating, review
count, `placeId`, coordinates, verified open/closed status.

Still to gather for every candidate:

1. **Busy window** — needs busy-time research
2. **Peak window** — needs busy-time research
3. **Line likely after / line eases after** — needs busy-time research
4. **Best nights** — needs busy-time research
5. **Description** — one or two sentences on when the venue works best
6. Age skew, and the `is_college_scene` flag
7. Category mapping to our `bar | club | lounge` enum
8. Image
9. For the event-driven venues (Webster Hall, DROM, Bowery Palace, Bowery
   Ballroom, The Bitter End, Terra Blues, Blue Note): a **show-schedule source**
   rather than fixed weekly windows. These cannot be modeled with static busy
   windows and should be treated the same way as Le Poisson Rouge and Nublu 151
   in the supplied seed.

## Open questions

1. Village Underground and Fat Black Pussycat share an address — one venue or two?
2. BOOM and Le Bain share a building — should a line at one influence the other?
3. Is Bowery Palace the same operation as the former Bowery Electric?
