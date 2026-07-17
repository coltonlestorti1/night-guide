# Effective date + account deletion — plain-English explainer

Written 2026-07-17 for Colton to review. Covers the two things you weren't sure
about when we finalized the Privacy Policy / Terms: the **effective date** and
**how account deletion works**.

---

## 1. What "effective date" means (and why you don't wait for it)

The effective date (a.k.a. "Last updated") is simply **the date this version of
the policy takes effect** — the day it goes live on the site. It is *not* a
deadline, a legal filing, or something you schedule in advance.

- **When to set it:** the day the `/privacy` and `/terms` pages actually deploy
  to production. If we build today but push next week, the date should read the
  **push day**.
- **What I did:** set it to a working value (today, 2026-07-17). When we deploy,
  I bump it to the real deploy date — a one-line edit, 10 seconds.
- **You do NOT need to wait for anything.** There's no review, no approval body.
  You publish the pages, and that date says "this is when these terms started."

### When it changes later
You update the date **only when you change the policy in a way that matters** —
e.g. you start collecting a new kind of data, add a paid tier, or ship the
self-serve delete button. Minor wording fixes don't require it. When you do make
a material change, best practice is:
1. Update the copy.
2. Bump the "Last updated" date.
3. If it's a big change and you have real users, tell them (email/in-app notice).

That's the whole lifecycle. It's a living document, not a one-time legal event.

---

## 2. How account deletion works

### Today (interim — what the policy promises now)
The policy says: *email us at clsneaks01@gmail.com to delete your account.* When
someone does:
- You (or I, helping you) delete their row from Supabase. Because the schema uses
  `on delete cascade`, removing their `profiles` row automatically removes their
  `check_ins` and `friendships` too — nothing orphaned.
- Practically: it's a 30-second action in the Supabase dashboard per request.

**Why this is fine for launch:** deletion requests are rare, and at MVP scale
you'll have very few users. Regulators (and app stores) require that a deletion
path *exists and is honored* — email is a legitimate one. Big companies use
email-based deletion too; the self-serve button is a convenience, not a legal
requirement.

### Later (Phase 2 — the self-serve button)
When it's worth it, we ship a "Delete my account" button in Profile backed by a
Supabase Edge Function that runs the same cascade delete automatically. At that
point:
- The email path becomes optional/backup.
- We update the policy copy to point at the button + bump the effective date.

This is already tracked as a gated audit item (#3A) — not built yet, deliberately.

### On your inbox concern
- **Volume is near-zero at first.** You will likely get *no* deletion emails for a
  good while.
- It goes to the same `clsneaks01@gmail.com` that's already your contact address,
  so no new inbox to check.
- If it ever gets noisy: a one-time Gmail filter (label "ENDZ deletion",
  skip inbox / star) keeps it out of your face. Or, later, a dedicated address
  like `privacy@<yourdomain>` once you have a domain. Neither is needed now.

---

## TL;DR
- **Effective date** = the day the pages go live. No waiting. I'll set it to the
  real deploy date when we push. Update it only on material policy changes.
- **Deletion** = email → you delete the row in Supabase (cascade cleans the rest).
  Rare, low-volume, legally sufficient. Self-serve button comes later.
