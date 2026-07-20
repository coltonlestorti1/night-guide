# §21 Group Plans — Design (approved scope, 2026-07-19)

Gate discussion completed with Colton 2026-07-19. Blueprint basis:
`docs/plans/2026-07-19-social-structure-research.md` item 4 — plans =
Facebook Events compressed to one night × Partiful's frictionless invites.
This doc records the approved design; implementation follows a separate plan
doc + Colton's go-ahead. **No code or Supabase change is authorized by this
doc alone — the DDL and Edge Function deploy each go through Colton.**

## Locked decisions (Colton, 2026-07-19)

1. **Approach B — link-first plan page** via unguessable `share_token` +
   ENDZ's first Edge Function. Non-users view and RSVP with just a name, no
   account. Anon-auth rejected (anon sessions carry the `authenticated` role →
   every existing policy would open to link-holders). Existing RLS is
   untouched; the token surface is additive and isolated.
2. **Guest list visible by default + host "hide guest list" toggle** at create
   time (social proof by default, host control on top).
3. **No voting in MVP** — one declared venue + time, RSVP only. Colton wants
   to see voting later → v2 candidate alongside §17's FTM-for-group hook.
4. **Entry points: Social page ("Make a plan" in the new Plans section) +
   venue detail ("Plan a night here")** — one shared create sheet.
5. **Invites: pick friends at create time + share link.** Checked friends see
   the plan on Social (pull-only + badge); the link covers everyone else.

## What a plan is

One night, one venue (from the active verified list), one time, optional short
note (≤200 chars). Host can edit time/venue/note, toggle guest-list
visibility, or cancel. Plans auto-age into "past" **6 hours after
`planned_at`** (client-derived constant; no archive surface — same one-night
ethos as check-ins). Cancel is a status change so the link renders a graceful "this
plan is over" state; no hard delete in MVP.

## Schema sketch (DDL drafted at implementation time, pasted by Colton)

```
plans
  id             uuid pk default gen_random_uuid()
  creator_id     uuid not null references profiles(id)
  venue_id       uuid not null references venues(id)
  planned_at     timestamptz not null
  note           text check (char_length(note) <= 200)
  hide_guest_list boolean not null default false
  status         text not null default 'active'   -- 'active' | 'cancelled'
  share_token    uuid unique not null default gen_random_uuid()
  created_at     timestamptz not null default now()

plan_rsvps
  id          uuid pk default gen_random_uuid()
  plan_id     uuid not null references plans(id) on delete cascade
  user_id     uuid references profiles(id)        -- ENDZ user…
  guest_name  text check (char_length(guest_name) <= 40)  -- …or link guest
  rsvp        text check (rsvp in ('going','maybe','no')) -- null = invited, no response
  guest_secret uuid                                -- guests only: lets a guest edit their own RSVP
  created_at  timestamptz not null default now()
  -- exactly one of user_id / guest_name; unique (plan_id, user_id)
```

Invited friends = host-inserted rows with `user_id` set and `rsvp` null.
Guests = Edge-Function-inserted rows with `guest_name` + `guest_secret`
(secret returned once, kept in the guest's localStorage so they can change
their RSVP; names are unverified and spoofable — accepted Partiful tradeoff).

## RLS (authenticated side — token side never touches RLS)

- `plans` select: creator, or you have a `plan_rsvps` row on it.
- `plans` insert: `creator_id = auth.uid()`.
- `plans` update: creator only; `creator_id`/`share_token`/`id` immutable via
  the pre-update-snapshot `exists()` pattern already used on `check_ins`/
  `friendships`.
- `plan_rsvps` select: your own row, or plan creator, or plan visible to you
  AND `hide_guest_list = false`. (When hidden: non-hosts see only their own
  row; counts come from the host/function.)
- `plan_rsvps` insert: host inviting (`plan.creator_id = auth.uid()`, target
  must be an accepted friend) or self-RSVP (`user_id = auth.uid()` on a plan
  you can see).
- `plan_rsvps` update: own row, rsvp column only (snapshot pattern).
- `plan_rsvps` delete: own row, or host removing an invite.

**No existing table's policies change. Acceptance-tested explicitly.**

## Edge Function (`plan-guest`) — ENDZ's first server-side code

Service-role function serving the token path only:

- `GET ?token=` → plan (venue name/address, planned time, note, status) +
  host identity-lite (display name, avatar, @username) + guest list (names +
  rsvp) unless `hide_guest_list`, in which case counts only.
- `POST` `{token, rsvp, guest_name}` → creates guest row, returns
  `{rsvp_id, guest_secret}`. If the caller sends a valid Supabase access
  token instead, RSVP lands as that user (signed-in user arriving via link).
- `PATCH` `{rsvp_id, guest_secret, rsvp}` → guest changes their answer.

Abuse guards (MVP-level): guest RSVP cap per plan (~100), name/note length
validation, cancelled/expired plans read-only, invalid token → generic 404.
Real rate limiting rides the launch-readiness item; this endpoint is noted
there as the most abusable surface.

Returns only that plan's data — never bios, friend lists, check-ins, or
anything ghost-mode-adjacent. Deploy via Supabase CLI (new operational
surface; runbook lands in the implementation plan; Colton runs the deploy).

## Surfaces & flow

1. **Create** — from Social ("Make a plan") or venue detail ("Plan a night
   here"): venue + time + note + hide-toggle + check off friends → share
   sheet with `/p/:token` link.
2. **Social Plans section** — your upcoming plans + open invites (badge on
   new), one-tap going/maybe/can't, guest list per visibility rule,
   tap-through to venue + host profile.
3. **`/p/:token` (public route)** — dark, mobile-first plan page: host, venue
   (+ named-directions link), time, note, guest list/count, one-tap RSVP with
   a name field for guests; quiet "ENDZ — see where tonight is happening"
   footer CTA. Works fully signed-out, pre-OAuth-publish.
4. **Night of** — existing out-tonight/check-in flow takes over; no new code.

Analytics: `plan_created`, `plan_rsvp` (+ surface prop) via the existing
fail-safe `logEvent` (no-ops until the events DDL lands — unchanged).

## Privacy

New exposure class, host-intentional: the link shows venue + time + names to
anyone holding it (identical in kind to sending the plan to a group chat).
Tokens unguessable/unenumerable; cancel kills the page; ghost mode untouched
(a plan is a stated intention, not a location fix); coordinates never leave
the device — a plan stores a `venue_id`. Host-invite requires an accepted
friendship, so plans can't be used to spam strangers in-app.

## Acceptance criteria

1. Create → link → guest RSVP round-trip works in a logged-out incognito
   window (pre-OAuth-publish).
2. Invited friend sees the plan on Social with no notification infra and
   RSVPs in one tap; badge clears.
3. Signed-in user arriving via link RSVPs as themselves, not as a guest.
4. Hide-guest-list: guests and non-host users see counts only; host sees
   names.
5. Token surface probed with a second account + logged-out session: nothing
   beyond the single plan leaks; invalid token → 404.
6. Existing tables' RLS behavior verified unchanged (friends/check-in flows
   re-smoke-tested).
7. Host edit propagates; cancelled/expired link renders the "plan is over"
   state; guest edit-via-secret works.
8. Guest cap + validation enforced; `tsc` + build clean; mobile-first
   verified on the dev server.

## Postponed (logged, not lost)

Venue/neighborhood voting + multi-option plans (v2 — Colton wants to see it;
pair with §17 FTM-for-group) · day-of reminders (Capacitor push) · "invite my
crew" (after §16) · plan comments/chat (§22 territory) · guest→account
upgrade (moot until OAuth publish) · multi-stop/recurring plans · venue-TBD
plans (separate declared-intent backlog item) · plan archive/history.

## Files & touchpoints

`src/lib/plans.ts` · `src/hooks/usePlans.ts` · `src/pages/PlanPage.tsx`
(`/p/:token`) · create-plan sheet component · Plans section in `Social.tsx` ·
"Plan a night here" on `VenueDetail.tsx` · route in `App.tsx` ·
`supabase/functions/plan-guest/index.ts` (new dir) · DDL appended to
`~/Documents/endz/endz-schema.sql`.
