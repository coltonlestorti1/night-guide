# ENDZ — Session Handoff (2026-07-16 → 07-17)

Snapshot so the session can be cleared safely. Everything below is committed to
git (nothing merged, nothing pushed, no Supabase/DDL touched). Full detail also
lives in Colton's auto-memory (`endz-overnight-2026-07-15`).

## TL;DR
Four feature branches are built + verified and **waiting on Colton to review/merge**.
Launch is **not** blocked by any of them — launch is still gated on Colton's two
items (OAuth publish + legal pages). Colton is **not ready to launch yet**.

## Branches ready for review (none merged/pushed)

| Branch | HEAD | What it is | Verification |
|---|---|---|---|
| `feat/error-boundary` | `6e7ab4c` | Root React ErrorBoundary (friendly fallback vs white screen). No vendor/DB. | Live-verified (injected crash → fallback + logged; reverted). tsc+build clean. **Done.** |
| `feat/ghost-mode-toggle` | `1d24275` | Ghost-mode Switch in Profile; `setGhostMode` optimistic write to `profiles.ghost_mode` (RLS already allows; no DDL). | tsc+build clean; signed-out no-regression; signed-in card verified via temp-mock screenshot. **Pending: live persist round-trip (needs a real signed-in session).** |
| `feat/out-tonight-mode` | `4dc35fc` | "I'm out tonight" mode — full 7-task build (see below). | tsc+build clean; logic reviewed line-by-line; **mount+toggle+disclosure+activation live-verified**. **Pending: geolocation→prompt→check-in E2E (needs signed-in session; prompt is correctly gated to signed-in users).** |
| `worktree-agent-a490a0cdb2e0c9fab` | `b4ba053` | Fable design pass on Discover/Social/Profile ("elevate with personality"). Visual-only. Based off `feat/ghost-mode-toggle` so it includes + designs the ghost toggle. | **Independently reviewed by orchestrator:** tsc+build clean, zero logic files touched, ghost toggle intact, all 3 routes render on-brand, 0 console errors. **PASS.** Signed-in states confirmed via code + Fable's committed screenshots. |

## "I'm out tonight" mode — what it does (feat/out-tonight-mode)
Phase-1, PWA-foreground. Spec: `docs/superpowers/specs/2026-07-16-out-tonight-mode-design.md`.
Plan: `docs/superpowers/plans/2026-07-16-out-tonight-mode.md`.
- Toggle on the Map screen → first tap shows a mandatory opt-in disclosure ("…never shown to your friends…"), remembered on-device.
- While on + app foreground: `watchPosition` → `venueProximity` detects the nearest venue confidently (60m radius / 40m accuracy ceiling / 25m runner-up margin / 2-fix hysteresis).
- **Option 4:** logs `venue_presence` to the existing `events` table (venue id + coarse buckets, never raw GPS) — our metrics only.
- **Option 1:** raises a "Looks like you're at {venue} — check in?" prompt → reuses the normal `checkIn()`. "Not here" → pick from the 2–3 nearest.
- No DDL (rides `events` + `check_ins`). Native background tracking = **Phase 2**, deferred.
- Files: `src/lib/venueProximity.ts`, `src/lib/distance.ts` (+`haversineMeters`), `src/store/location.ts` (+watch/stopWatch/accuracy), `src/store/outTonight.ts`, `src/components/OutTonightToggle.tsx`, `src/components/OutTonightPrompt.tsx`, `src/pages/MapPage.tsx`.

## Decisions locked this session
- **Audit #7:** ghost-mode users **DO** count in our own server-side metrics (ghost hides you from friends only). No code change needed.
- **Auto-presence approach:** phased (A) — PWA foreground now, native background later. Behavior = option 4 (silent metrics) + option 1 (confirm-to-check-in).
- **Out-tonight thresholds:** 60m / 40m, tune on-device later. Placement: Map. Cadence: one prompt per venue per session.
- **Track B model:** Sonnet built out-tonight Tasks 1–5 (orchestrator reviewed); Colton OK'd Sonnet.
- **Design direction:** "Elevate with personality."

## Still owned by Colton (launch gates — nothing here is done)
1. **Publish Google OAuth** (project Endz / endz-501306) — the real launch gate, ~1 click, reversible.
2. **6 legal decisions** → then finalize `/privacy` + `/terms`. Draft copy + claims + the 6 blanks are in `docs/plans/2026-07-15-privacy-terms-DRAFT.md` (now includes the out-tonight venue-logging disclosure). Legal entity, contact email, jurisdiction, effective date, age floor (rec 18+), deletion mechanism.
3. Account-deletion path (audit #3) — gated, needs an Edge Function.

## Suggested next steps (resume here)
1. Colton reviews the 4 branches; decide merge order. (`Profile.tsx` is touched by ghost-toggle, design-pass, and NOT by out-tonight — the design branch already sits on top of ghost-toggle, so merge ghost-toggle→design together; error-boundary and out-tonight are independent.)
2. Live signed-in tests: ghost-mode persist + out-tonight geolocation→prompt→check-in.
3. When ready to launch: OAuth publish + legal pages.
4. Out-tonight Phase 2 (native background) — future.

## Housekeeping notes
- Fable's worktree (`.claude/worktrees/agent-a490a0cdb2e0c9fab`) still exists with its own `node_modules` + copied `.env.local`; remove the worktree anytime (`git worktree remove … --force`) — the branch keeps the commits.
- No test runner in this repo (by design) — verify via tsc `-p tsconfig.app.json` + build + browser.
