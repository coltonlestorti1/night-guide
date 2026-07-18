# ENDZ Pre-Launch Ultra Review Instructions

You are doing a full pre-launch code review of ENDZ, a mobile-first nightlife
map PWA (React + TypeScript + Vite, Zustand, MapLibre GL, Supabase backend).
This is READ-ONLY — do not edit code. ENDZ is about to open to the public, so
rank ruthlessly by real user impact.

Review the whole app, prioritized in this order:

1. **SECURITY** — Supabase Row-Level Security and auth: can any user read/write/
   delete another user's data (profiles, check_ins, friendships, blocks, events,
   waitlist)? Check every query in src/lib and src/store against the RLS model.
   Any writable table with no abuse/rate guard? Any secret/service key in client
   code (only the anon key should exist client-side)?
2. **PRIVACY** — ENDZ's hard rule is "raw coordinates NEVER leave the device."
   Verify store/location.ts, the out-tonight venue-presence logging, and
   analytics only ever send venue_id + coarse buckets, never raw lat/lng. Flag
   any path that could leak precise location or over-collect.
3. **THE PROTECTED CORE LOOP** — checkIn()/checkOut()/setVibe() in
   src/lib/checkins.ts and the active_check_ins view: correctness of the live
   crowd/activity count, any way it can be inflated, double-counted, or desync
   from reality.
4. **CORRECTNESS BUGS** — auth/session, ghost mode, favorites, "I'm out
   tonight," the new live location dot (Map.tsx + store/location.ts, incl. the
   reference-counted watchPosition), directions, recommendations.
5. **LAUNCH-READINESS & QUALITY** — error handling/boundaries, loading/empty
   states, accessibility, obvious performance issues, dead code, and product/UX
   polish gaps that would feel unfinished to a first-time user.

Notes: This project has NO test runner by design — verification is
`npx tsc --noEmit -p tsconfig.app.json` + `npm run build`. Absence of unit
tests is NOT a finding. The database DDL/schema lives in this repo at
`docs/endz-schema.sql` — use it to reason about RLS.

Output: findings ranked most-severe first, each with severity
(Critical/Important/Minor), file:line, a concrete failure scenario (specific
input/state → wrong outcome), and a suggested fix. Group by the 5 areas above.
Call out anything that should block launch. Be concrete, skip praise.
