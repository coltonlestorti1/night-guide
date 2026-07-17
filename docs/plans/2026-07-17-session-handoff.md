# ENDZ — Session Handoff (updated 2026-07-17, end of day)

Supersedes the earlier version of this file (which described a 4-branch review
pile — all now merged/shipped). Full detail also lives in Colton's auto-memory
(`endz-overnight-2026-07-15`) and the tracker (`docs/ENDZ_MASTER_TASKS.md`).

## TL;DR
Everything built this cycle is **merged, pushed, and live in production**
(`night-guide.vercel.app`), verified. **One launch gate remains — Google OAuth
publish — and it's Colton's click.**

## Shipped + deployed today (all verified live)
- Root **ErrorBoundary**
- **Ghost-mode toggle** (Profile) — persist round-trip E2E-tested
- **Fable design pass** (Discover / Social / Profile)
- **Favorites "Saved" filter** (map + list, device-local, stacks with filters)
- **`/privacy` + `/terms`** legal pages (ENDZ, New York, 18+, email deletion) + footer links
- **"I'm out tonight" mode** — geolocation → prompt → check-in E2E-tested
- **Venues: 31 active** (activated Motel No Tell, Lucky, Little Rebel)

## The ONE remaining launch gate (Colton)
Publish the Google OAuth app so non-whitelisted users can sign in:
1. Google Cloud Console → project **Endz** (`endz-501306`)
2. **Google Auth Platform → Audience → Publish app** (Testing → In production; ~1 click, reversible, no review)
3. Add to the consent screen: privacy `https://night-guide.vercel.app/privacy`, terms `https://night-guide.vercel.app/terms`
4. Test: sign in with a Google account **not** on the test list → works = **launched**

## On hold (Colton paused)
- **4 new venues** — Drop Off Service, Copper Still, Hidden Tiger, Chloe 81.
  Needs ~4 Google Places lookups (his key) for coords/type → then a `venues`
  INSERT he pastes. **Chloe 81 goes in dormant** (`is_active=false`, it's LES /
  off-beachhead). Do NOT run the bulk `enrich resolve` — it overwrites the
  hand-curated `place-ids.json`; do it surgically.

## To discuss next (tracker items 6–10 — none approved, gate applies)
- **6. Favorites expansion** — count badge, save-from-pin, stack w/ future filters, icon, account-sync (core chip already shipped)
- **7. User onboarding** — value screens, auth options, interest/genre/age, progressive onboarding
- **8. Location permissions** — when/how to ask, denial handling, precise-vs-approx, uses
- **9. User location dot** — already exists on-demand (Locate-me); make it auto-show for opted-in users / more prominent
- **10. App polish** — ongoing premium-feel bucket

## Housekeeping
- 6 older prior-session worktrees (`.claude/worktrees/agent-a1ae67…` etc.) + their merged branches still exist — safe to sweep on request.
- `main` is 1 commit ahead of origin = this tracker/handoff doc update (docs-only, push anytime).

## Working rules (unchanged)
Engineer/partner — lead with recommendations + honest pushback; simple numbered
steps; product-discussion gate before building anything new; verify everything
yourself before calling it good (never relay a subagent's self-report). Nothing
merges, pushes, or touches Supabase without Colton's explicit OK.
