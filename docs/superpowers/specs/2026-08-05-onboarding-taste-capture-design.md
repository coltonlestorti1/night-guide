# Onboarding taste capture — design

**Date:** 2026-08-05
**Status:** approved by Colton 2026-08-05, not yet implemented
**Tracker:** advances §11 (sign-up demographics) and §7 (onboarding experience);
touches §6 (favorites / saved venues)

## Purpose

Capture three things at signup that the app cannot infer later:

1. **Birthday** — powers the age-band personalization that already exists.
2. **Gender** — collected as standard profile data at Colton's direction.
3. **Favourite venues, plus bars ENDZ does not carry yet** — the first is a
   cold-start fix, the second is an expansion signal and a future re-engagement
   hook.

The favourites are the point. A brand-new user currently lands on an empty
social layer: no saves, no friend facepile, nothing personalised. Five taps at
signup makes the features that shipped 2026-08-05 non-empty on day one.

## Decisions taken (2026-08-05)

| Question | Decision |
|---|---|
| Primary job | Personalisation + instant friend-facing data; notifications are a later re-engagement layer |
| Gender | **In.** Colton wants standard sign-up demographics (Instagram/Snap/Beli shape) |
| Age format | **Birthday**, not a band — band is derived in code |
| Screens | **Two**, not one |
| Favourites framing | "Which of these are your spots?" — likes *or* wants-to-try |
| Minimum picks | **None.** A forced minimum produces random taps and poisons the signal |
| Off-menu bars | **Real Google search**, not free text — an exact place ID is what makes the future notification matchable |
| Age gate | **None for alcohol.** ENDZ is informational; it does not serve drinks |
| Under-13 floor | **Added — see below.** Not an alcohol gate; a data-protection floor |

### The under-13 floor (addition, flagged)

Colton's "no gate" decision was about alcohol, and it stands: nobody is turned
away for being under 21 or under 18.

A **13** floor is added anyway, for a different reason. Collecting a birthday
and a gender from a child under 13 without verifiable parental consent is a
COPPA problem in the US regardless of what the app is about — it is a rule
about children's data, not about alcohol. Every consumer app in this category
carries the same floor. It also keeps the App Store age rating coherent for a
nightlife app under the §31 submission.

Practical impact is near zero: no real ENDZ user is 12. If Colton wants it
removed, it is one constant.

## Flow

```
/welcome            username + school        (existing)
/welcome/about      birthday + gender        (NEW)
/welcome/spots      favourites + requests    (NEW)
/welcome/location   location primer          (existing)
/                   map
```

The permission ask stays last. The two low-friction screens come first, so a
user who abandons at the location prompt has still given us everything else.

### Screen A — About you

- **Birthday**: required. Native date input; no scroll-wheel picker.
- **Gender**: optional. `Woman / Man / Non-binary / Prefer not to say`.
- No self-describe free-text field in v1 — it is a moderation surface with no
  personalisation payoff. Revisit if users ask.
- Under-13 birthday → inline message, no account data written.

### Screen B — Your spots

- "Which of these are your spots?" — grid of the 55 active venues, tap to
  toggle. No minimum, no maximum, soft nudge at three.
- Framing is deliberately present/aspirational, not past-tense. The autumn
  beachhead is HWS students new to the East Village; "pick your favourites"
  would collect nothing from exactly the users worth hooking.
- Second section: "Somewhere we're missing?" — Google-backed search, add as
  many as they like.
- Both sections skippable.

## Data

```sql
alter table profiles
  add column if not exists birthday date,
  add column if not exists gender   text
    check (gender in ('woman','man','nonbinary','prefer_not_to_say'));

-- Makes a future "we added your bar" match exact instead of fuzzy string work.
-- Backfill from scripts/place-ids.json, which already holds all 56.
alter table venues
  add column if not exists google_place_id text unique;

create table if not exists venue_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  google_place_id    text not null,
  name               text not null,
  address            text,
  created_at         timestamptz not null default now(),
  fulfilled_venue_id uuid references venues (id),
  unique (user_id, google_place_id)
);
```

### Privacy posture

**`birthday` and `gender` are self-only.** This is a departure from the other
profile columns, which are readable by any signed-in user (that is how
`class_year` behaves today). Neither field is rendered anywhere, so exposing
them buys nothing and costs a real privacy surface. Enforced with a restricted
column-level read path rather than the blanket profiles SELECT policy.

`venue_requests`: users insert and read their own rows; admins read all through
the existing `is_admin()`. No update, no delete from the client.

Venue picks are written through `src/lib/saves.ts` into `venue_saves` and
inherit `profiles.save_visibility`, which defaults to `friends`. Onboarding
picks are therefore visible to accepted friends, not to the whole app. That is
the intended cold-start behaviour and needs no new control.

## Places search proxy

`supabase/functions/places-search/` — proxies Google Places Autocomplete.

- **The API key stays server-side.** It is absent from the production bundle
  today (verified in the 2026-08-05 pre-launch check) and must remain so.
- **Requires a valid JWT.** Without that it is an open proxy pointed at
  Colton's Google quota.
- Returns only `placeId`, `name`, `address` — nothing else is needed and
  nothing else should be stored.
- Session-token based, per Google's autocomplete billing model.

## Error handling

Nothing on these screens may trap a user mid-signup.

| Failure | Behaviour |
|---|---|
| Places proxy unreachable | Search section disables with "Search unavailable — you can add spots later". Rest of the screen still submits. |
| Save batch fails | Onboarding completes. Picks retry on next app open; they are not a signup blocker. |
| `venue_requests` insert fails | Same — logged, non-blocking. |
| Duplicate request | Absorbed by the unique constraint, treated as success. |
| Profile write fails | Surfaced inline with retry; this one *does* block, because it is the required field. |

## Testing

Vitest, alongside the existing 215:

- Age-band derivation from a birthday across boundaries — leap day, birthday
  today, birthday tomorrow.
- Under-13 rejection at the exact boundary (13 today passes, 13 tomorrow fails).
- `venue_requests` dedup on resubmission of the same place ID.
- Save-batch partial failure leaves onboarding completable.
- Both skip paths leave a valid, usable profile.
- Gender check constraint rejects unknown values.

## Obligations this creates

1. **Privacy policy must be updated again.** Birthday and gender are new
   personal data. The policy was revised 2026-08-05 for the App Store, and the
   privacy nutrition label has to match what is collected.
2. **Admin surface for `venue_requests`.** Without one the requests are
   invisible. The stubbed "Bar events" nav slot is the natural home. Follow-up,
   not a blocker.
3. **`venues.google_place_id` backfill** from `scripts/place-ids.json`.

## Explicitly out of scope

**The notification itself.** There is no delivery channel: `public/sw.js` is
cache-only with no push handler, there is no email service, and `profiles` has
no email column. This design makes "a new favourite bar has been added"
*buildable* by capturing matchable data. Sending it is a separate project,
most likely gated behind the Capacitor path (see the mobile-app-path note),
since iOS PWA push is severely limited.

Also out of scope: self-describe gender text, gender-based venue ranking (the
tracker's own rule is that demographics are preference/context, not identity
labelling), and any age-based access restriction.
