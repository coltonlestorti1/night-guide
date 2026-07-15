# Analytics Wiring — Discussion Prep (2026-07-15)

Prep doc for making the north-star metric measurable. **Nothing here is
approved or deployed.** Client wiring is staged on branch
`feat/analytics-wiring`; the Supabase DDL below is **not run** — Colton pastes it
in the SQL editor when we agree on the shape.

North star: **unprompted check-ins per active user per night.** It is currently
**unmeasurable** — we log nothing that survives a page reload.

---

## Current state (audit)

`src/lib/analytics.ts` was a no-op. `track(name, payload)` only did a
`console.debug` in dev; in production it did nothing. Two call sites existed,
both on the public waitlist page, and both evaporated at runtime:

| Existing call site | Event | File |
|---|---|---|
| Waitlist page view | `waitlist_view` | `src/pages/Join.tsx:39` |
| Waitlist form submit | `join_submit` | `src/pages/Join.tsx:46` |

**Everything in the core loop was uninstrumented.** Where events *should* fire
(grepped across `src/`):

| Signal | Where it happens today | Was logged? |
|---|---|---|
| Check-in | `CheckInCard.tsx` `doCheckIn` → `checkIn()` (`lib/checkins.ts`) | no |
| Check-out | `CheckInCard.tsx` `doCheckOut` → `checkOut()` | no |
| Vibe set | `CheckInCard.tsx` `doVibe` → `setVibe()` | no |
| Venue card open | `VenuePreview.tsx` (map pin / search / list / Find-the-move / Social spotlight all funnel here) | no |
| Directions tap | `DirectionsButton.tsx` → `openDirections()` (used by `VenuePreview` + `VenueDetail`) | no |
| Find the move | `VibeFinder.tsx` "Show me the move" (`MapPage` opens it) | no |
| Sign-in | `store/auth.ts` `signInWithGoogle` / OAuth redirect completion | no |
| Search | `MapPage.tsx` `TopHeader` search input | no |
| Filter use | `MapPage.tsx` `FilterChips` (category / hot / music / happy-hour) | no |

Identity note: the app has no anonymous-user concept. Auth is Google OAuth only
(`store/auth.ts`); signed-out visitors have no id at all. Attribution needs a
device-scoped anonymous id, which this work introduces.

---

## Proposed `events` table (DDL — for Colton to run, NOT run yet)

Follows the waitlist-table pattern: RLS on, **INSERT-only for anon +
authenticated, no SELECT policy** — the client can write events but can never
read them back. Add to `~/Documents/endz/endz-schema.sql` after it's agreed.

```sql
-- ---------- events ----------
-- Append-only product analytics (check-ins, opens, directions, etc.).
-- One row per user action. user_id is null for signed-out visitors;
-- anonymous_id (a device-scoped uuid from localStorage) always present.
-- Written by src/lib/analytics.ts (logEvent). Read only server-side /
-- dashboards via the service role — never from the client.

create table events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  anonymous_id  text not null,
  event_name    text not null,
  venue_id      uuid references venues (id) on delete set null,
  props         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index events_created_idx on events (created_at);
create index events_name_idx    on events (event_name);
create index events_venue_idx    on events (venue_id);
create index events_user_idx     on events (user_id);

alter table events enable row level security;

-- INSERT only. with_check pins user_id to the caller so a client can't
-- attribute events to someone else (anon → auth.uid() is null → user_id
-- must be null; authenticated → user_id null or their own uid).
create policy "anyone can log events"
  on events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Deliberately NO select / update / delete policy: the list stays private
-- and immutable from the client, exactly like waitlist.

-- Belt-and-suspenders; may be redundant if Supabase default privileges
-- already grant insert to these roles (they do for the waitlist table).
grant insert on events to anon, authenticated;
```

Rollback: `drop table events;`

---

## Event taxonomy (v1)

`logEvent(name, props?)` lifts `venue_id` out of props into its own column;
everything else lands in `props` jsonb. Names are `snake_case`.

| Event | Fires when | props (besides venue_id) | Wired? |
|---|---|---|---|
| `check_in` | Check-in succeeds | `visibility` | ✅ |
| `check_out` | Check-out succeeds | — | ✅ |
| `vibe_set` | Vibe saved on active check-in | `vibe` | ✅ |
| `venue_open` | Venue card/preview shown | `category` | ✅ |
| `directions_tap` | Apple/Google Maps chosen | `provider` | ✅ |
| `find_the_move` | "Show me the move" tapped | `vibe, drinks, when, near, happy_hour, age` | ✅ |
| `waitlist_view` | `/join` viewed | `source` | ✅ (pre-existing, now persisted) |
| `join_submit` | Waitlist form submitted | `source` | ✅ (pre-existing, now persisted) |
| `sign_in` | Google OAuth completes | — | ⛔ deferred |
| `search` | Search yields a pick / query settles | `has_results` | ⛔ deferred |
| `filter_use` | A filter chip toggled on | `filter` | ⛔ deferred |

`venue_open` is deliberately logged from `VenuePreview` mount — the single choke
point every open path funnels through — so we get one clean event per open
regardless of entry (map pin, search, list, Find-the-move pick, Social
spotlight).

---

## What I wired vs. deferred

**Wired on `feat/analytics-wiring` (6 core-loop events + the 2 pre-existing):**
- `src/lib/analytics.ts` — rewritten: real `logEvent(name, props?)`, fail-safe
  INSERT via the shared `getSupabase()`, device `anonymous_id` in localStorage
  (`endz:anon-id`), `track()` kept as a deprecated alias.
- `CheckInCard.tsx` — `check_in`, `check_out`, `vibe_set` (only after the write
  succeeds).
- `VenuePreview.tsx` — `venue_open` on mount.
- `DirectionsButton.tsx` — `directions_tap` (added optional `venueId` prop;
  passed from `VenuePreview` + `VenueDetail`).
- `VibeFinder.tsx` — `find_the_move`.
- `Join.tsx` — repointed `track` → `logEvent` (now actually persists).

**Deferred (documented, not wired):** `sign_in`, `search`, `filter_use`. Lower
signal for the north star and each needs a small design call (where exactly to
fire `search` without spamming per keystroke; whether `sign_in` fires on the
attempt or on redirect completion). Easy fast-follows once the table exists.

---

## Privacy notes

- **No PII in events.** Only `user_id` (a uuid FK to auth.users), a device
  `anonymous_id`, `venue_id`, and low-cardinality descriptors (`visibility`,
  `vibe`, `provider`, `category`, Find-the-move preference chips). No names,
  emails, phones, or raw GPS — consistent with the "at this venue, never raw
  GPS" principle.
- **Write-only from the client.** No SELECT policy, so the event log is never
  readable from the browser; RLS `with_check` stops a client from attributing
  events to another user.
- **Fail-safe / non-blocking.** `logEvent` never awaits, never throws, and
  silently no-ops when the backend is unconfigured or the table is missing — so
  shipping the client ahead of the DDL is harmless, and analytics can never
  break a check-in.
- `anonymous_id` is a random uuid, not a fingerprint; it resets if the user
  clears storage. It exists so we can compute per-device funnels pre-sign-in.
- Open question: honor **ghost mode** for analytics? Ghost mode governs
  *broadcasting location to other users*, not our own server-side product
  metrics — but we should decide explicitly (see below).

---

## Acceptance criteria

1. `npx tsc --noEmit -p tsconfig.app.json` passes. ✅ (verified on branch)
2. With no `events` table, the app behaves exactly as before — no console
   errors, no blocked check-ins (fail-safe no-op). ✅ by construction
3. After Colton runs the DDL: a check-in, check-out, venue open, and directions
   tap each insert exactly one row with the right `event_name`, `venue_id`, and
   `user_id`/`anonymous_id`.
4. Signed-out visitor events land with `user_id` null and a stable
   `anonymous_id`.
5. No client can read `events` back (SELECT returns 0 rows / denied).
6. A query like
   `select count(*) from events where event_name='check_in' and created_at > now() - interval '1 day'`
   returns a real number — i.e. the north-star metric is finally computable.

---

## Open product questions

1. **Ghost mode + analytics** — count check-ins from ghost-mode users in our
   own metrics (recommended: yes, it's not a broadcast), or exclude them?
2. **Session / night boundary** — "per night" needs a definition (e.g. 6pm–6am
   local bucket). Compute at query time from `created_at`, or stamp a
   `night_date` on insert?
3. **Retention** — do we ever prune raw events (e.g. keep 90 days, roll up the
   rest)? Not urgent pre-launch, but worth deciding before volume.
4. **`venue_open` noise** — should rapid open/close/open of the same venue be
   de-duped, or is raw-open volume itself a useful curiosity signal?
5. **Wire the deferred three now or later** — `sign_in`, `search`,
   `filter_use`: worth it for v1, or keep the surface minimal until we're
   reading the first six?
```
