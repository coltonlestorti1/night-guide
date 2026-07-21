# Map Plans — gate prep / discussion record (2026-07-20)

Follows the §21 Group Plans build (shipped to `feat/group-plans`, in live
verification). Colton wants plans to surface on the map, not just in the
Social Plans section. This doc captures the full vision from the 2026-07-20
discussion and proposes a decomposition. **Nothing here is approved to build
— it is the gate's discussion record. The first slice needs explicit sign-off
and its own spec.**

## Current map model (audited)

`useFriendsOutTonight()` → accepted friends with an *active check-in*, RLS-
filtered server-side (ghost mode, visibility, non-friends excluded) → grouped
by venue → rendered as **avatar faces on the venue pin** (`MapPage.tsx`
`friendsByVenue`, `PinFriend`). The live layer answers "who is *here now*."
There is no plan/intent layer on the map today. The app also has **no
friends-of-friends surface** — the schema notes FoF as a future 2-hop query.

## Full vision (Colton, 2026-07-20) — four distinct capabilities

1. **Plan badge on the map (the event).** A plan's venue shows a distinct
   "planning" badge (NOT the here-now avatar faces — see pin treatment). Seen
   by: invitees always; accepted friends when the **host opts the plan in**;
   *maybe* friends-of-friends who share **>5 mutuals**.
2. **"Planning to go" as a live personal signal.** Separate from a formal
   group plan: like out-tonight but future-tense — "X is planning to go to
   Bar Y later." The name shows on the venue. **Superseded** if the person
   actually checks in elsewhere (their real location wins over stated intent).
3. **Custom "approved list."** A per-user allowlist controlling who may see
   where you're planning to go later — distinct from the accepted-friends
   graph. New sharing primitive.
4. **Friends-of-friends reach** with a mutual-count threshold (>5 mutuals) —
   a new graph-visibility tier the app doesn't have yet.

## Pin treatment (recommended: distinct "planning" badge)

"Here now" and "planning to go later" are different states; the map's core
job is *now*. Reusing avatar faces (even faded) makes a venue with both live
check-ins and plans ambiguous ("is that person here or coming?"). A distinct
glyph (clock/calendar) with its own count keeps the live layer legible and
stacks the plan layer as clearly upcoming — "3 here now" + "5 planning" with
no collision. Planned time revealed on tap. (Colton leaned this way; agreed.)

## Proposed decomposition

- **Slice A — Plan "event" badge on the map (invitees + host opt-in →
  friends).** Reuses §21 + a new scoped RLS policy. Distinct event badge on
  the venue pin; **tap the bar → event detail → "Request to join" button**
  (NEW primitive — a non-invited friend asks the host in; today §21 is
  host-invite + link-RSVP only). Ghost-suppressed. Plans drop off 6h after
  `planned_at`. **← recommended first slice.** (Adds the request-to-join flow
  + event-detail surface, so it's bigger than "just a badge.")

**Colton (2026-07-20): wants all four in the eventual MVP, but is fine
building them one-by-one from this to-do.** So A → B → C → D as separate
gated slices toward the full vision; nothing dropped, just sequenced.
- **Slice B — "Planning to go" personal signal** with check-in-supersedes
  logic. Touches the check-in core loop's read model; needs its own design.
- **Slice C — Approved-list sharing primitive.** New table + UI + policy;
  standalone privacy feature, own gate.
- **Slice D — Friends-of-friends (>5 mutuals) tier.** New graph query + a new
  visibility tier reused app-wide; own gate.

Rationale: A is the foundation everything else decorates. B/C/D each add a
new privacy primitive and can layer on once A exists. Shipping A first gets
plans onto the map without committing to the harder privacy/graph work.

## Open questions to resolve before the Slice A spec

1. **Whose names show inside the badge** — just the plan's "going" RSVPs, or
   does Slice B's broader "planning to go" folding in from day one? (Recommend:
   Slice A shows only the plan's going RSVPs, friend-scoped; defer B.)
2. **FoF in scope for A, or defer to D?** (Recommend: defer — A = invitees +
   host-opt-in-to-friends only.)
3. **Opt-in default** — off (recommend, privacy-safe) with a create/edit
   toggle "Show this plan on the map for friends."
4. **Ghost-mode interaction** — confirm ghost suppresses your map-plan
   presence (recommend yes, consistent with the rest of the app).
5. **Attendee consent** — if the host opts a plan onto the map, do the *going
   attendees'* names show to the host's friends automatically, or does each
   attendee control their own appearance? (Privacy-sensitive — needs a call.)

## Status

Gate open. Full vision recorded so it survives. Next: Colton confirms the
decomposition + Slice A scope → then a Slice-A spec + acceptance criteria →
then approval → then build. Tracker: add a Map-Plans row to
`docs/ENDZ_MASTER_TASKS.md`.
