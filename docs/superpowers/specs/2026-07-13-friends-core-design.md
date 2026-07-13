# Friends Core — Design Spec

_Date: 2026-07-13 · Status: approved by Colton in session (sections 1–4) · Next step: writing-plans skill → implementation on branch `feat/friends-core`_

## What this is

The base friends layer for ENDZ: username search → request → accept, a real Social page replacing the 34-line stub, a "friends here" row on the venue sheet, and a per-check-in visibility toggle. The add-friend UX must feel native to how Instagram/Snapchat do it (verbs, optimistic flips, share-handle, suggestions).

**v1 scope (locked):** Social page + venue-sheet friends row. **No map-pin avatars in v1** (fast follow — Map.tsx marker code is fragile). **No new packages. No schema changes in this branch.**

## Hard prerequisite before merge (separate Opus session)

The `friendships` RLS needs a small patch — the UI is built against these semantics and decline/cancel/remove will fail without it:

1. **DELETE policy:** a user may delete a friendships row they are party to (`auth.uid() = user_id or auth.uid() = friend_id`), **except** a `blocked` row where they are the blocked side (`friend_id`). Blocker is always `user_id` by convention (see block semantics below).
2. **UPDATE `WITH CHECK`:** only the recipient (`friend_id`) may set `pending → accepted`; row identities (`user_id`, `friend_id`) immutable.
3. **INSERT hardening:** deny inserting a request when a reverse `blocked` row exists (`exists (select 1 from friendships where user_id = new.friend_id and friend_id = new.user_id and status = 'blocked')`).
4. Record the DDL in `~/Documents/endz/endz-schema.sql` and verify with the two-account matrix (below).

Enum reality: `friend_status = pending | accepted | blocked` — there is no `declined`. Decline/cancel/remove are **row deletes**.

**Block semantics (schema records no "who blocked"):** blocking = delete any existing row between the pair, then insert `(blocker, blocked, 'blocked')` so `user_id` is always the blocker. Client performs delete-then-insert; policies above make it safe.

## Social page (`/social`, existing tab and route)

Top-to-bottom sections, light theme (white cards, hairline `#E8E8E5`, purple `#6C45FF` for actions/active only). `Social.tsx` stays a thin composition; new components in `src/components/social/`: `RequestRow`, `FriendRow`, `OutTonightRow`, `ShareHandleCard`, `SuggestedList`.

1. **Header** — "Social" + existing tagline "Find out where your friends are tonight."
2. **Requests** (renders only when non-empty) — incoming rows: avatar, `@username` + display name, Accept (filled purple) / Decline (ghost). Outgoing ("Requested") folded in, collapsed by default, with cancel.
3. **Out tonight** — friends with an active check-in: avatar + green presence dot, name, venue name, vibe chip, time since check-in. Tap row → fly map to that venue (reuse search fly-to). Contents are exactly what RLS returns — the UI never filters "extra" rows in.
4. **Find friends** (Instagram/Snapchat-native block):
   - Search bar — debounced (PickUsername pattern), matches username + display name, excludes self.
   - **Share-handle card** — "You're `@handle` — send it to the crew." Copy + native Share (Web Share API, falls back to copy).
   - **Suggested for you** — newest `profiles.created_at` first, excluding self and anyone with an existing friendships row. Row: avatar, `@handle` + name, **Add** button → flips to **Requested** optimistically; small ✕ dismisses (persisted on-device, localStorage). No mutual-friend subtitles in v1 — RLS only exposes your own friendships; a backend function can add mutuals later without UI rework.
   - Contacts sync: intentionally absent until the Capacitor/native phase (iOS Safari has no contact picker; matching needs new privacy-sensitive backend).
5. **Your friends** — list with count; row tap → action sheet (Remove / Block). Designed to accept a "Your crew" strip on top later (crew = IG-Close-Friends analog, separate spec, needs `close_groups` tables).

**Language:** "Add" is the verb (Snapchat), never "request/connect." Button states: Add → Requested. Accept / Decline on incoming.

**Empty states:** 0 friends → Requests/Out-tonight collapse; Find friends leads the page. Friends but nobody out → "Nobody's out yet — someone's gotta go first." Signed out → existing sign-in prompt unchanged.

## Venue sheet: "friends here" row

On `VenuePreview` (bottom sheet mobile / side panel desktop), between title block and check-in card: overlapping avatar cluster (max 4 shown, then "+N") + "Sam and 2 friends are here." Renders only when ≥1 friend visibly checked in. Tap expands names inline. Implementation pulls the reserved 21st.dev component **id 17144 "Astryx Avatar"** (one of the two daily `get_component` budget slots — the other, id 7734 Place Card, is NOT part of this feature).

## Check-in visibility toggle

On the check-in card, under the button: quiet line "Visible to: **Friends** ▾" → 3-option sheet (Everyone / Friends / Nobody). Defaults `friends`; last choice remembered on-device and used as the new default. Never adds a required step — one-tap check-in preserved. `checkIn()` gains optional `visibility` param (default `'friends'` = current behavior).

## Data layer

Mirror the check-in stack. No Zustand for server state; React Query owns it.

- **`src/lib/friends.ts`** — plain functions: `searchProfiles(q)`, `suggestedProfiles()`, `sendRequest(friendId)`, `acceptRequest(rowId)`, `declineRequest(rowId)`, `cancelRequest(rowId)`, `removeFriend(rowId)`, `blockUser(profileId)` (delete-then-insert per block semantics), `listFriends()`, `listPending()` (incoming + outgoing), `friendsOutTonight()` (accepted friend ids ∩ `active_check_ins`, joined with `profiles` + venue).
- **`src/hooks/useFriends.ts`** — React Query hooks + optimistic mutations (Add→Requested instant, rollback on error). Query keys scoped by user id.
- **Freshness:** "out tonight" + "friends here" use 60s poll + refetch-on-focus + one added invalidation in the existing `subscribeActivity` poke handler (AppLayout) → ~2s updates on any check-in. No new realtime channels; the poke stays content-free.
- **Reads** go through `active_check_ins` (never raw `check_ins`).

## Privacy rules (non-negotiable)

- RLS is the only privacy boundary; client renders exactly what queries return.
- Ghost mode + per-check-in visibility enforced by the existing `checkins visible per rules` policy — no client re-implementation.
- Venue-level presence only, never coordinates. Content-free realtime poke preserved.

## Verification before merge

- `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op) + `npm run build`; 0 new console errors.
- **Two-account matrix** (Playwright on deployed preview; Social is a non-map route so the MapLibre screenshot gotcha doesn't apply): request→accept round-trips across accounts · stranger cannot see a friends-visibility check-in · ghost mode hides an active check-in from an accepted friend · Nobody-visibility hides from friends · blocked user cannot re-request · sender cannot self-accept · Social renders all four states (0 friends / pending / friends-none-out / friends-out).
- Venue sheet verified at 390 / 768 / 1440; check-in still one tap.

## Out of scope (queued separately)

- **Crew** (IG-Close-Friends analog, 5–8 people, visibility tier + recommendations) — next spec; needs `close_groups`/`close_group_members` (Opus).
- **Night Recap** (location-first onboarding, assisted check-in, morning recap + bar ranking) — next spec; blocked by `checkIn()`/`checkOut()` deleting history (delete→expire change touches the protected core loop — Opus) + ratings table. Recap trail is private-to-self, never visible to others.
- Map-pin friend avatars · mutual-friend ranking/subtitles · contacts sync (native phase) · friends-of-friends · feed/DMs/gamification.
