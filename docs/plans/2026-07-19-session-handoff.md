# ENDZ — Session Handoff (2026-07-19)

Supersedes the 2026-07-18 handoff. Tracker: `docs/ENDZ_MASTER_TASKS.md`.

## TL;DR
**Profile MVP phase 1 is built, reviewed, live-verified, merged to main, and
pushed** (Colton pre-authorized the full pipeline). The tracker also absorbed
Colton's 2026-07-18 product-depth list as items §14–§22. **Avatars-bucket DDL
was pasted by Colton and photo upload is verified live end-to-end** (incl. the
second-upload cleanup path; his avatar now self-hosted in the bucket at 512px).
Google OAuth publish remains the only launch gate, deliberately deferred.

## What shipped this session (on origin/main)
- **Tracker merge:** Colton's to-do list → items §14–§22 + folds into §1/§3/§11,
  a visible Next Up (Top 10), Decisions Needing Discussion, and a venue
  verification queue (Coopers & Swifts, verify-first).
- **§14 Profile MVP phase 1** (full gate: discussed → approved → planned →
  built → 8-angle review → fixes → live-verified → merged `--no-ff` → pushed):
  - Edit Profile dialog: display name, username (changeable freely, shared
    debounced availability hook, duplicate-safe), photo upload (client
    downscale → Supabase Storage `avatars` bucket).
  - Saved spots section (device-local store → rows → venue detail), age-band
    preference chips (syncs with Weekend Favorites), Privacy section (ghost
    mode moved in), Account & support (report/delete mailtos via shared
    `SUPPORT_EMAIL`, sign out).
  - Review fixes worth knowing: avatar cleanup only after the DB repoint;
    dialog seeds only on open; availability errors → unknown (never false
    "available"); Save blocked during upload; field-scoped optimistic revert.
- Verified live against Colton's real signed-in session (dev server, real
  second account for the taken-handle path). tsc + build + eslint clean.

## Colton's next steps (in order)
1. ~~Paste the avatars-bucket DDL~~ **DONE 2026-07-19** — bucket + policies
   live, upload verified E2E in the real app (downscale → storage → profiles
   repoint → old-file cleanup). DDL recorded in `endz-schema.sql`.
2. **Deploy check:** main is pushed; confirm Vercel picked it up, then test
   Profile on your iPhone against production (username edit, photo upload,
   saved spots, age chips).
3. **Google OAuth publish** — still the only launch gate, still your click,
   still deliberately deferred (2026-07-18: "I don't want to OAuth yet").
   Nobody nags; raise it when ready.
4. **Next discussions** (gate applies, per the tracker's Next Up): Social /
   crew / plans / DMs scope (§15/§16/§21/§22), then Find the Move inputs
   (§3/§17/§20). Profile phase 2 (bio, viewable profile) rides with §15/§16.

## Deferred from the §14 review (logged in Decision Log, not bugs)
- ProfileAvatar reuse inside the edit dialog (visual-risk refactor).
- Shared age-band hook (remount keeps Profile/Weekend Favorites in sync
  today; revisit when Find the Move consumes age).
- Deep updateProfile/refreshProfile sequencing (pre-existing pattern;
  mitigated by post-success re-assert).

## State facts
- 31 active venues. Supabase untouched this session (avatars bucket DDL is
  written + recorded but NOT run — Colton's paste). No schema changes.
- ⏰ Enrichment refresh deadline ~Aug 6 still standing (backlog).
- Known pre-existing map-page console warning ("Expected value to be of type
  number, but found null" ×3) — untriaged, cosmetic, predates the halo.

## Working rules (unchanged)
Engineer/partner — lead with recommendations + honest pushback; simple
numbered steps; product-discussion gate before building anything new; verify
everything myself; nothing merges, pushes, or touches Supabase without
Colton's explicit OK (this session's merge+push was explicitly pre-authorized).
