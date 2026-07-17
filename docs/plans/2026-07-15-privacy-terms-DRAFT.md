# Privacy Policy + Terms — DRAFT copy for Colton's review

**Status: DRAFT. Not published, not wired to any route, not committed.** This is
the gate's discussion input for audit items #2 (Privacy) and #3 (Terms). Read the
"Claims I'm asserting" and "Decisions I need from you" sections first — if a data
claim is wrong, the copy is wrong. Everything below is written from what the code
actually does (verified 2026-07-15 against `analytics.ts`, `store/location.ts`,
`supabase.ts`, the RLS in `endz-schema.sql`), not boilerplate.

**Not legal advice.** I'm an engineer, not a lawyer. This is honest, plain-English
copy that accurately describes our data flows. Have a lawyer skim it before you
publish — especially the jurisdiction/liability boilerplate in the Terms.

---

## Claims I'm asserting (confirm each is true, or correct me)

1. **Sign-in is Google-only.** We receive your Google email + basic profile
   (name/avatar) via OAuth. No password is stored by us.
2. **We store:** your email, the username you pick, your check-ins (venue + vibe +
   time), your friendships, your ghost-mode preference, and analytics events.
3. **Location never leaves your device.** It's opt-in; coords stay in memory for
   the session to show distance/rank nearby. A *check-in* is the only thing that
   ties you to a place, and you initiate every check-in. (Verified: `location.ts`
   never sends coords to the server.)
4. **Analytics is ids only — no PII.** We log a device id, your user id when
   signed in, the event name, and a venue id. No names/emails/phones/raw GPS.
   (Verified: `analytics.ts` comment + insert shape.)
5. **Public crowd counts are anonymous aggregates** — "N here now" via a
   security-definer function that returns counts, never identities.
6. **Third parties that touch data:** Supabase (database + auth hosting), Google
   (OAuth identity), Vercel (app hosting), OpenFreeMap (map tiles — your IP +
   map viewport reach them when tiles load, standard for any web map).
7. **Waitlist** (`/join`): if you gave us a name + phone/email there, we hold it
   to tell you about launch, nothing else.
8. **"Out tonight" venue logging (opt-in).** If a user turns on Out tonight, we
   log which venues they're detected at (venue id + coarse distance/accuracy
   buckets, never raw GPS) to OUR metrics only — never shown to friends. Off by
   default; disclosed at opt-in.

## Decisions I need from you (placeholders in [brackets] below)

- **Legal entity name** — "ENDZ", a personal name, or an LLC if you've formed one?
- **Contact email** for privacy/deletion requests (e.g. privacy@… or your Gmail).
- **Governing law / jurisdiction** — likely New York, USA. Confirm.
- **Effective date** — the date you publish.
- **Age floor** — Terms should state a minimum age. Recommend **18+** (nightlife;
  also sidesteps children's-privacy law like COPPA). Confirm 18 vs 21.
- **Deletion mechanism to name** — this copy says "email us to delete" as the
  interim path. When audit item #3A (self-serve delete button) ships, we update
  the copy to point at it. OK to launch with email-based deletion?

---

# ENDZ — Privacy Policy

_Last updated: [EFFECTIVE DATE]_

ENDZ ("we", "us") runs a live nightlife map for [LEGAL ENTITY]. This policy
explains, in plain terms, what we collect and why. We built ENDZ on one rule:
**no covert tracking — everything is opt-in and you can see what you share.**

### What we collect

- **Account info.** You sign in with Google. We receive your email address and
  basic Google profile (name, profile picture). We never see or store your Google
  password. You also choose a **username** shown to friends.
- **Your activity.** When you check in to a venue, we store that check-in (the
  venue, the vibe you picked, and the time). When you add friends, we store those
  connections.
- **Location — only on your device.** If you turn on location, your coordinates
  are used **on your device** to show distance and sort nearby spots. **Your
  coordinates are never sent to our servers.** The only way a place is linked to
  you is a check-in you tap yourself.
- **Usage analytics.** We log basic events (which venues get opened, check-ins,
  vibe changes, directions taps) to understand what's useful. These records
  contain a device identifier, your account id when you're signed in, the event
  name, and a venue id — **never your name, email, phone, or raw location.**
- **Waitlist.** If you signed up at an ENDZ event or link, we kept the name and
  phone/email you gave so we could tell you when we launch.
- **"Out tonight" (opt-in).** When you turn on Out tonight, ENDZ records which
  venues you're near that night — a venue id and coarse distance, never your raw
  coordinates — to understand where people go. It's never shown to your friends,
  it's off by default, and you can turn it off anytime.

### What we do NOT do

- We do **not** track your location in the background or when the app is closed.
- We do **not** sell your data.
- We do **not** show other users your identity in public crowd counts — those are
  anonymous totals ("12 here now"), not name lists.

### Who else is involved

We use trusted providers to run ENDZ: **Supabase** (database and sign-in),
**Google** (sign-in), **Vercel** (hosting), and **OpenFreeMap** (map tiles; your
device requests map imagery from them, which involves your IP address as with any
online map). Each handles data under its own policy.

### Ghost mode

You can turn on **ghost mode** to keep your check-ins from being shared with
friends. [NOTE: this is honest once audit item #4 — the ghost toggle — ships. Do
not publish this paragraph until the toggle is live, or soften to "coming soon".]

### Your choices and rights

- **See or delete your data.** Email us at **[CONTACT EMAIL]** to request a copy
  of your data or to delete your account. Deleting your account removes your
  profile, check-ins, and friendships. [Update to the in-app button when it ships.]
- **Location.** You can revoke location access any time in your browser/OS.
- Depending on where you live (e.g. EU/UK GDPR, California CCPA), you may have
  additional rights to access, correct, or delete your data — the email above is
  how you exercise them.

### Children

ENDZ is for adults aged **[18 / 21]+**. We don't knowingly collect data from
anyone under that age.

### Changes

We'll update this page and the "Last updated" date when things change materially.

### Contact

Questions? **[CONTACT EMAIL]**.

---

# ENDZ — Terms of Service

_Last updated: [EFFECTIVE DATE]_

By using ENDZ, you agree to these terms. If you don't agree, don't use ENDZ.

### Who can use ENDZ

You must be at least **[18 / 21]** years old and able to form a binding
agreement. ENDZ shows nightlife venues and live activity; drink and act
responsibly and follow all local laws.

### Your account

You sign in with Google and pick a username. You're responsible for activity on
your account. Don't impersonate others, harass anyone, or pick an offensive
username. We can suspend accounts that abuse ENDZ or these terms.

### Check-ins and content

Check-ins and vibe reports you post are your own. Keep them honest — don't spam,
fake activity, or try to manipulate crowd counts. We may remove content or limit
activity that degrades the experience for others.

### What ENDZ is (and isn't)

ENDZ shows **user-reported and estimated** activity — crowd counts, vibes, happy
hours, and hours pulled from public sources. **We don't guarantee any of it is
accurate or current.** Venue hours, specials, and crowds change; confirm with the
venue. ENDZ is provided "as is," without warranties, to the fullest extent the
law allows.

### Third-party venues and data

Venue names, hours, ratings, and details come from public sources (including
Google) and may be wrong or out of date. Listing a venue is not an endorsement,
partnership, or guarantee of entry, safety, or service.

### Limitation of liability

To the fullest extent permitted by law, ENDZ and [LEGAL ENTITY] are not liable
for indirect, incidental, or consequential damages arising from your use of ENDZ,
including anything that happens at a venue you found through ENDZ.

### Changes and termination

We may update ENDZ or these terms. Continued use after changes means you accept
them. We may suspend or end access for abuse or legal reasons. You can stop using
ENDZ and delete your account at any time (see the Privacy Policy).

### Governing law

These terms are governed by the laws of **[STATE, e.g. New York], USA**, without
regard to conflict-of-laws rules.

### Contact

**[CONTACT EMAIL]**.

---

## When you approve (audit item 2A/3A build steps — NOT done yet)

1. You confirm the 7 claims + fill the 6 bracketed decisions.
2. I finalize this copy and split it into `src/pages/Privacy.tsx` +
   `src/pages/Terms.tsx` (plain React pages, same pattern as `/join`).
3. Add routes `/privacy` + `/terms` above the catch-all in `App.tsx`, plus footer
   links (and the privacy URL into the Google OAuth consent screen).
4. tsc + build + live-load both routes, 0 console errors, before you merge.
