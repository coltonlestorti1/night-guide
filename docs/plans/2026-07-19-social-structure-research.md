# Social-structure research — how the majors did it, what ENDZ steals (2026-07-19)

Two research passes (subagent, web-sourced): (A) big platforms — Instagram,
Facebook, Snapchat, BeReal, TikTok; (B) structural cousins — Snap Map, Zenly,
Foursquare/Swarm, Partiful, IRL, DICE/Posh, Life360/Find My. Full citations in
the session transcript; this doc is the distilled, implementable version.

## The blueprint (where both passes converged)

1. **Keep the symmetric, small friend graph.** Asymmetric follow graphs model
   *attention*, not trust (Instagram's follower-status games); "where I am
   tonight" is intimacy data. BeReal proved small mutual graphs drive honest
   sharing; its later decline came from feature bloat diluting the core loop.
   → No follower counts as status. No growth-hacked adds. Protect the one loop:
   *where are my friends / where should we go.*

2. **Profiles are functional identity, not performance surfaces.** Instagram's
   converged anatomy: avatar, @username, ~150-char bio, one action button.
   Facebook's Wall→Timeline arc shows public activity archives on profiles
   decay into noise and invasiveness.
   → ENDZ profile = who is this, are we friends, are they out tonight. No
   counts, no public archive, nightlife-native content later (usual spots).

3. **"Out tonight" is ENDZ's Instagram Notes.** Notes (ephemeral, mutuals-only,
   zero-media status line) is IG's stickiest Gen-Z primitive — ~5x more used by
   Gen Z. → Add an optional short text/emoji payload to out-tonight ("EV crawl,
   who's in?") that expires with the status.

4. **Plans = FB Events compressed to one night × Partiful's frictionless
   invites.** Events won via one-tap RSVP + visible guest list as social proof
   (seeing "who's going" drives attendance). Partiful won the 20s by making the
   *guest* pay zero cost: link/SMS plan pages, no app or account needed to RSVP
   — and every invite is an acquisition vector for a beachhead app.
   → Plan MVP: "heading to X around 11" + same/maybe + invitee-visible guest
   list + shareable link that renders without login. Day-of reminders mitigate
   flake culture (push needs Capacitor — later).

5. **Crew (§16) = Close Friends done right.** Close Friends succeeded because
   membership is *invisible* — nobody knows the list exists or who's on it —
   and unilaterally editable. Gen Z posts to Close Friends 2.5x more.
   → Crew's real job is an **audience tier** for out-tonight/check-ins/plans,
   not a visible group object. Private by default (already Colton's rule).

6. **Map: friends-together clusters + graduated visibility (Zenly's legacy).**
   What Zenly's eulogies missed most: playful cartography, "friends are hanging
   out together" clusters, and graduated ghost mode (precise/blurred/frozen).
   → "2+ friends at Mister Paradise" as a distinct pin state is the single
   highest-leverage map change. A middle visibility state ("out tonight, venue
   hidden") between visible and ghost. Map whimsy is brand surface.

7. **Privacy is the moat — say it in-product.** Snap Map: ghost-by-default,
   view-before-share onboarding, periodic re-consent ("still sharing with 14
   friends — still good?"). Life360 is the anti-model (data sales, surveillance
   feel). ENDZ's venue-granularity, coords-never-leave-device model is
   *stronger* than all of them. → State it loudly; add periodic re-consent.

8. **Coincidence engine (Swarm's durable win).** "A friend just checked in two
   blocks away" triggered real meetups; per-friend notification granularity
   (always/nearby/never). Venue-to-venue distance only — no raw coords.
   Needs push → Capacitor phase.

## Hard avoids (both passes, emphatic)

- **Streaks / loss-framed going-out stats** — Snapchat streak backlash
  (obligation, adolescent stress). "4 weekends straight" is a hazard, not a
  feature. Any stats private + non-loss-framed.
- **Public relationship-strength or co-presence rankings** — Snapchat killed
  public Best Friends in 2015 for a reason. Never expose "X and Y go out
  together a lot" to third parties. (Extends Colton's no-auto-ranking rule.)
- **Algorithmic stranger-surfacing** — no discovery feed of non-friends'
  nights, no "people near you." TikTok's interest graph is fine for *venue*
  recs, never for the social layer.
- **Mayorship/leaderboard gamification** — decays in ~18 months, invites fake
  check-ins (Foursquare's arc).
- **Public heat maps at small scale** — deanonymizes individuals in a
  one-neighborhood beachhead (constraint on §13).
- **App-install-required invites** — kills the first plan; the first plan is
  the funnel (IRL's bot-density fraud also warns: real density in a real place
  or nothing).

## Mapping to the tracker

- **Profiles slice (now, pre-§15):** blueprint item 2 → route + page + bio.
- **§21 Group Plans (next major):** blueprint item 4; link-first is also the
  growth loop. Discuss auth model for no-login RSVP.
- **§16 Crew:** reframe as invisible audience tier (blueprint 5) before
  building group objects.
- **§15 Social page:** out-tonight payload (3), re-consent (7); no feed.
- **§13 Heat map:** small-scale deanonymization risk recorded.
- **§22 DMs:** research supports the existing lean — plans + shares before
  messaging; Notes-style payload covers most "DM lite" needs.
- **Map/§19:** friends-together pin state, graduated visibility, cartography
  personality — queue for the map walk-through.
