# Full-Launch Readiness — Audit & Discussion Prep (2026-07-15)

**Nothing here is approved or built.** This is the gate's audit phase for the
"Full-launch readiness checklist" backlog item Colton added 2026-07-15. It
answers: *what's actually missing before we open ENDZ to strangers, and how
severe is each gap?* Each item has options + a recommendation to walk through
together. No code, DB, or config was changed to produce this.

Audited against `main` at commit `3ae6a4d` (venue is_active filter merged).

---

## Severity ranking (worst first)

| # | Gap | Severity | Why |
|---|-----|----------|-----|
| 1 | Google OAuth still in Testing mode | 🔴 HARD BLOCKER | Strangers literally cannot sign in. Already known — your click. |
| 2 | No Privacy Policy / Terms pages | 🔴 Blocker (legal + store) | You collect emails, check-ins, location-derived data, analytics. Google OAuth consent + app stores require a privacy URL. |
| 3 | No account deletion / data export | 🔴 Blocker (legal) | GDPR/CCPA + App/Play store policy require a way to delete your account & data. None exists. |
| 4 | `ghost_mode` has no UI toggle | 🟠 High (privacy promise) | The switch exists in schema + RLS enforces it, but users can't reach it. We market "opt-in/consensual only" — this makes it real. |
| 5 | No error monitoring | 🟠 High (ops) | Nothing catches prod exceptions. A white-screen crash for real users would be invisible to us. |
| 6 | No rate limiting on writable tables | 🟡 Medium (abuse) | `events`, `check_ins`, `waitlist` accept unbounded client inserts. A script could flood them. |
| 7 | Analytics doesn't honor ghost mode | 🟡 Medium (decide) | Open question from the analytics prep — we log check-ins from ghost users to our own metrics. Not a broadcast, but decide explicitly. |
| 8 | Custom domain | 🟢 Low (polish) | `night-guide.vercel.app` works but reads as a placeholder, not "ENDZ". |
| 9 | App Store vs PWA-only for v1 | 🟢 Low (strategy) | Decide distribution; not blocking a soft launch. |

**What's already solid (no action):** CSP + security headers (`vercel.json`),
PKCE auth flow, RLS on every table, write-only `waitlist`/`events` (no client
SELECT), `venue_activity()` leak-audited, SPA rewrite + PWA manifest.

---

## Item-by-item

### 1. Google OAuth publish — 🔴 known blocker
Already documented (`endz-security-prelaunch`). ~1-click, no Google review
(identity scopes only), reversible. **Your click** — I won't do it for you.
Everything below assumes this is done.

### 2. Privacy Policy + Terms — 🔴
**Current:** neither page exists (`src/pages/` has no privacy/terms route).
Google's OAuth consent screen wants a privacy-policy URL; both app stores
require it later.
**Options:**
- **(A, rec)** Add two static routes `/privacy` + `/terms` (plain React pages,
  same as `/join`), plus footer links. I draft plain-English copy tailored to
  what we actually collect (email, username, check-ins, opt-in location that
  never leaves the device except as a venue check-in, anonymous analytics id).
  You review/lawyer-check before publish. ~half a day, no backend.
- **(B)** Use a generator (Termly/iubenda) embed. Faster, but external script
  fights our CSP `script-src 'self'` and looks generic.
**Rec:** A. We know exactly what we collect; honest first-person copy fits the
brand and dodges the CSP problem. **Needs a discussion on data-handling claims
before I write final copy.**

### 3. Account deletion + data export — 🔴
**Current:** `Profile.tsx` has sign-out only; no delete path; no `deleteAccount`
anywhere. Deleting a user must cascade check-ins, friendships, profile, and
null-out their events.
**Options:**
- **(A, rec)** "Delete my account" button in Profile → a Supabase Edge Function
  (service role) that deletes `auth.users` row; existing `on delete cascade`
  FKs handle profiles/check_ins/friendships, and `events.user_id` is already
  `on delete set null`. Export = a "download my data" query bundle.
- **(B)** Manual: user emails us, we delete by hand. Fine for <50 users, not
  for launch scale, and stores may reject "email us to delete".
**Rec:** A, but it needs an Edge Function (first serverless piece — small
scope discussion) because the anon client can't delete auth users. **Gated.**

### 4. `ghost_mode` UI toggle — 🟠
**Current:** `profiles.ghost_mode` column exists, is read into the auth store,
and `friends.ts` confirms RLS already excludes ghost users from check-in
broadcasts. **But there is no switch in the UI** — it's permanently the default
(false). Our privacy positioning ("no covert tracking, opt-in only") is
half-delivered.
**Options:**
- **(A, rec)** Add a toggle in Profile that flips `profiles.ghost_mode`. Pure
  UI + one update call; RLS already does the enforcement. Small, high
  trust-payoff, no schema change.
- **(B)** Defer to post-launch.
**Rec:** A — cheapest credibility win on the list. This one is arguably build-
now once you approve; it's a toggle over existing, already-enforced state.

### 5. Error monitoring — 🟠
**Current:** no `ErrorBoundary`, no Sentry, no `window.onerror`. Toast infra
(sonner) exists for handled errors, but an unhandled render crash = silent
white screen for the user, invisible to us.
**Options:**
- **(A, rec)** React `ErrorBoundary` at the app root with a friendly fallback +
  a "reload" button (no dependency, no cost). Catches the white-screen case.
- **(B)** A + Sentry free tier for real telemetry. Adds a `connect-src` CSP
  entry and a dependency; free tier is generous. Charge-averse note: Sentry
  free tier is $0.
- **(C)** Reuse our own `events` table: log a `client_error` event from the
  boundary. $0, no new vendor, but we'd have to build the read/alert side.
**Rec:** A now (trivial, no vendor), C as a cheap telemetry layer, revisit
Sentry (B) only if volume justifies it.

### 6. Rate limiting on writable tables — 🟡
**Current:** `events`, `check_ins`, `waitlist` take unbounded authenticated/anon
inserts. RLS controls *who* and *shape*, not *how many*. A bored user could
spam check-ins or inflate analytics.
**Options:**
- **(A, rec)** Postgres-side: a `before insert` trigger or RLS `with_check`
  that caps inserts per user per interval (e.g. ≤1 check-in per venue per
  10 min; ≤N events/min). $0, no infra.
- **(B)** Supabase edge rate-limiting / API gateway. More robust, more setup.
**Rec:** A for launch — a simple check-in cooldown trigger also improves data
quality (kills accidental double-taps). **Touches DB → gated + your paste.**

### 7. Analytics + ghost mode — 🟡 (decision, not build)
Open question carried from the analytics prep: do we count ghost-mode users'
check-ins in *our own* server-side metrics? It's not a broadcast to other
users, so I lean **yes, count them** (north-star accuracy) — but it's your
privacy call. No code either way until you decide.

### 8. Custom domain — 🟢
`night-guide.vercel.app` is fine functionally. A real domain (endz.app / getendz
/ whatever's available) is a ~$12/yr + Vercel DNS step, mostly brand polish.
Non-blocking. Flag for whenever you want to spend the $12.

### 9. App Store vs PWA-only — 🟢 strategy
PWA is installable today. Native (via Capacitor) unlocks background location /
push but is a real project. **Recommendation: launch PWA-only**, revisit native
after you have traction + the analytics to justify it. Pure discussion item.

---

## Bonus 1 — Rooftop shortlist (your "verify before adding")
Google verified **outdoor seating** for 10 of the active 28. Google has **no
rooftop field** — so these are the outdoor-confirmed candidates; you mark which
are actually *rooftop* vs street-level/patio (local knowledge):

- The Summit Bar · 96 Tears · Romeos · Double Down Saloon · Niagara Bar ·
  The Grafton · Alphabet City Beer Co · d.b.a. · Downtown Social · The Wayland

Once you flag the true rooftops, we can add a `rooftop`/`outdoor` trait and a
filter chip — but that's a small gated feature, not done here.

## Bonus 2 — Analytics query pack (events are live now)
Run these in the Supabase SQL editor to read what's flowing. Read-only.

```sql
-- North star: unprompted check-ins per active user, last night (6pm–6am ET)
select count(*) filter (where event_name='check_in')::float
     / nullif(count(distinct coalesce(user_id::text, anonymous_id)),0) as checkins_per_active_user
from events
where created_at > now() - interval '18 hours';

-- Event volume by type, last 7 days
select event_name, count(*)
from events where created_at > now() - interval '7 days'
group by event_name order by count(*) desc;

-- Open → check-in funnel per venue (last 7 days)
select venue_id,
       count(*) filter (where event_name='venue_open') as opens,
       count(*) filter (where event_name='check_in')  as checkins
from events where created_at > now() - interval '7 days'
group by venue_id order by opens desc;

-- Directions provider split
select props->>'provider' as provider, count(*)
from events where event_name='directions_tap'
group by 1 order by 2 desc;
```

---

## Suggested walk-through order when you're back
1. Confirm severity ranking / reprioritize.
2. Legal (2,3) — biggest blockers after OAuth; decide A vs B and I draft copy.
3. Quick wins we can green-light fast: ghost toggle (4A), error boundary (5A).
4. Gated DB items: rate-limit trigger (6A), account-deletion Edge Function (3A).
5. Decisions only: ghost+analytics (7), domain (8), PWA-vs-native (9).
