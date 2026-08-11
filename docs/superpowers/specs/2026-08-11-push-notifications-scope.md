# Push notifications — scope

**Date:** 2026-08-11
**Status:** SCOPED, NOT APPROVED, NOT SCHEDULED. Deferred to the native app
launch (§31) by Colton, 2026-08-11.
**Relates to:** §31 (iOS App Store / Capacitor), §21 (plan reminders), §22
(comments), collab tags.

## Why this exists

On 2026-08-11 Colton tagged three people. Nobody saw anything — not them, not
him. Two fixes shipped that night: a tag is now visible as soon as it is made,
and the Social bell carries a badge for tags waiting on you.

Both share one limit. **They only work once the other person opens the app.**
For a product about where people are *tonight*, "you'll find out next time you
launch it" is the wrong latency. That is the gap push closes, and nothing else
does.

## Two corrections to what the tracker currently says

**1. Push does NOT strictly require Capacitor.** The tracker records
"push-notification strategy (needs Capacitor)" (§ full-launch-readiness) and
groups it with auto check-in. That grouping is wrong. Background location
genuinely requires a native shell. Push does not: iOS has supported the Web Push
API since 16.4, for web apps **added to the Home Screen**, which ENDZ already is
(`manifest.webmanifest` declares `"display": "standalone"`, and 13 launch images
shipped 2026-08-10).

**2. Deferring is still the right call, for a different reason.** Not because
web push is impossible, but because it would be **thrown away**. §31 is a
Capacitor wrap. Inside a Capacitor iOS app, notifications go through the native
`@capacitor/push-notifications` plugin and APNs — not the Web Push API. Building
web push now means building a transport, a token store and a send path against
one API, then replacing the client half at launch.

The half that survives either choice is the **server** half: which events are
notifiable, the token table, the send function, the preference model, and the
rule about what a notification may reveal. That is what this document scopes.

## Architecture

Four pieces. Only the first is transport-specific.

### 1. Client registration (transport-specific — build at §31)

Capacitor's plugin asks for permission, receives an APNs device token, and hands
it to the app. Android later gets the same plugin over FCM.

**Permission timing is a product decision, not a technical one.** Asking on
first launch is the standard mistake — iOS gives one prompt per install, and a
denial is effectively permanent for non-technical users. Ask at the first moment
the value is legible: immediately after someone tags a friend, or after the
first accepted friendship.

### 2. `device_tokens` (survives the transport choice)

```
user_id      uuid    references profiles(id) on delete cascade
token        text    the APNs/FCM registration token
platform     text    'ios' | 'android' | 'web'
created_at   timestamptz
last_seen_at timestamptz
```

Owner-only RLS, same posture as every other user-owned table here. One person
has many devices. Tokens expire and get reissued — the send path must delete a
token the provider rejects, or the table fills with dead rows and every send
does wasted work.

**This is a new table written on nearly every app open** (to refresh
`last_seen_at`). That is the same objection the tracker raises against unread
badges. It is acceptable here only because the write is one row per device per
session, not per view — but it should be throttled client-side, not written on
every foreground.

### 3. Send path — a Supabase Edge Function

ENDZ already has Edge Function experience from §21. The function holds the APNs
signing key (never the client), takes a user id and a payload, looks up live
tokens, sends, and prunes rejects.

**It must be invoked from the database, not the client.** A client-invoked
sender is a spam endpoint: any signed-in user could push arbitrary text to
anyone. The trigger for "you were tagged" belongs on `night_post_tags`, where
the insert already happens under RLS.

⚠️ **`supabase_edge_fn_auth` applies:** `verify_jwt` does NOT mean signed-in —
the publishable key passes it. If any part of this is ever callable from the
client, it must resolve the user in-function.

⚠️ **Edge Functions do NOT deploy with `git push`** — `npx supabase functions
deploy`, and there is no Homebrew on this machine.

### 4. Preferences — per-category toggles in Settings

`/settings` now exists and has a Privacy section, so there is a home for this.
Categories should match the events below, not be one master switch: the person
who wants to know a friend is out does not necessarily want a like.

## What is worth a push

Ranked by whether the notification is *actionable* and *time-sensitive*, which
is the only honest test.

| Event | Push? | Reasoning |
|---|---|---|
| **Someone tagged you** | **Yes** | The originating case. Actionable — accept makes it a mutual post. Time-sensitive only loosely, but it is the one with a decision attached. |
| **Friend request** | **Yes** | Actionable, and the app is useless until you have friends. |
| **A friend is out tonight** | **Yes, throttled hard** | The actual product. Also the one that becomes spam fastest — see below. |
| **Plan invite (§21)** | Yes, when plans ship | Genuinely time-critical; a plan has a start time. |
| **Comment on your night** | Probably | Conversational, expected by convention. |
| **Like on your night** | **No** | Not actionable, highest volume, first thing that trains people to disable notifications entirely. |
| **Your tag was accepted** | No | Nothing to do about it. Belongs in the badge. |

**"A friend is out tonight" needs a rule before it is built.** With twelve users
it is delightful; with two hundred it is a buzzing phone every Friday at 11pm. A
starting rule: at most one per person per night, only for accepted friends, only
during the night window that `src/lib/night/window.ts` already defines, and
never for a `ghost_mode` user — ghost mode must suppress pushes about you, not
merely hide the check-in.

## The privacy rule

**A notification may never reveal something the recipient could not already see
in the app.** A push bypasses every screen, and it renders on a locked device
where a third party may read it.

Concretely:

- A push about a post must respect that post's audience. If the recipient could
  not see the night in the feed, they must not learn about it from a banner.
- `ghost_mode` suppresses pushes about that user's whereabouts.
- Blocked pairs get nothing in either direction.
- **Never put a venue rating in a notification.** `venue_ratings` is owner-only,
  and 2026-08-10/11 spent real effort keeping scores off unaccepted tag rows for
  exactly this reason. A push is one more surface that can leak it.

The safest construction is to send the **minimum identifying text** and let the
app fetch the detail under RLS when opened. "Will tagged you in a night" beats
embedding the venue, the note and the score.

## What this does NOT cover

- Android/FCM specifics — same table and function, different client half.
- Notification grouping/threading.
- In-app notification centre. The bell already exists; whether push events also
  need a persistent, readable list is the **unread read-state** question the
  tracker deferred, and it is genuinely a separate design.
- Email or SMS fallback.

## Open decisions, to make at build time

1. Permission-prompt moment (recommendation above, not decided).
2. Whether comments push.
3. The exact throttle on "a friend is out tonight".
4. Whether preferences default on or off per category.
5. Whether a push event also writes a persistent in-app row (the read-state
   question).

## Cost

APNs is free. FCM is free. The Edge Function invocations sit inside the Supabase
free tier at this volume. The real cost is **Apple Developer enrollment**, which
§31 already requires and which is the critical path for the app itself — so push
adds no new spend, only work.

## Prerequisite

**§31 must land first.** This is not schedulable until the Capacitor wrap exists
and Apple enrollment is complete, because the client half cannot be written
against a shell that does not exist.
