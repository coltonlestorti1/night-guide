# ENDZ — Wire the App to the Live Supabase Backend

**Date:** 2026-07-03
**Status:** Approved
**Scope:** Connect `night-guide` to the live Supabase project (`https://nqafzgryzjbtwpvzjagr.supabase.co`): shared client, real venue data via `SupabaseDataSource`, Google sign-in, and first-login profile creation with a pick-a-username screen.

---

## Context

The backend now exists: schema + 19 East Village venues seeded, RLS enabled, Google OAuth configured (in Google testing mode — only allowlisted test users can sign in). The app still runs entirely on the static demo dataset; `SupabaseDataSource` is a stub, `@supabase/supabase-js` isn't installed, and no auth code exists anywhere.

Credentials live in `.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is public by design; RLS is the security boundary.

## Product decisions (locked with user)

**1. Public map, sign in to interact.** Venues become publicly readable (one RLS policy change — they're a bar directory, not sensitive data). Anyone with the link sees the real live map instantly. Sign-in is required only for the social layer (profiles now; check-ins/friends in later plans). **Why:** Google OAuth testing mode means non-allowlisted visitors (investors, curious friends) *cannot* sign in — a fully auth-gated app would be a dead end for exactly the people the pitch link goes to.

**2. Pick-a-username screen on first sign-in** (not silent auto-generation). One field, pre-filled from the email local-part (e.g. `colton.lestorti` → `colton_lestorti`), live availability check, one tap to confirm. **Why:** `profiles.username` is unique/not-null and is how friends find each other — auto-generated `name_4821`-style usernames would leak into friend search permanently.

**3. Profile row created client-side at onboarding completion** (not a DB trigger). After OAuth redirect, the app checks for the user's `profiles` row; missing → username screen → insert (already permitted by the `users insert own profile` RLS policy). **Why:** the row can't be complete until the user picks a username; a trigger would insert a placeholder and immediately need an update — worse than just waiting one screen.

**4. Config via env vars,** same pattern as `VITE_MAPBOX_TOKEN`: build-time env vars are primary; the existing Profile-page `supabaseUrl`/`supabaseAnonKey` config-store fields remain as a manual fallback. The resolver prefers Supabase whenever a client can be constructed; the static demo dataset remains only as the no-config fallback.

## UX quality bar (user-stated, binding on all new screens)

The app competes for 18-30 attention against Instagram/TikTok/Hinge-grade polish. Concretely, for the surfaces this plan adds:

- **No flash of wrong state.** While the session is being restored on load, auth-dependent UI (Profile tab) shows a skeleton — never a signed-out flash that flips to signed-in.
- **Username screen feels native:** dark themed like the rest of the app, input autofocused, availability feedback inline and debounced (subtle ✓/✗ next to the field — no submit-and-see-error round trips), primary button disabled until valid, whole screen completable in ~10 seconds.
- **Map never blocks on data.** The map renders immediately; venue pins appear when the query resolves. List view keeps its existing skeleton cards during load.
- **OAuth round-trip feels seamless:** "Continue with Google" shows a pressed/loading state immediately; on return, the user lands back where they were (Profile tab), not on a blank page.
- Existing app conventions apply: big tap targets, fast transitions, shadcn/ui components, existing dark theme tokens, copy per the ENDZ tone rules (no corporate/AI voice).

---

## Design

### 1. Shared Supabase client — `src/lib/supabase.ts` (new)

- `@supabase/supabase-js` added as a dependency.
- Exports `getSupabase(): SupabaseClient | null` — constructs a singleton from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, falling back to the config-store `supabaseUrl`/`supabaseAnonKey`; returns `null` when neither source is configured.
- Everything (data source, auth store) goes through this module; nothing else constructs clients.

### 2. Real venue data — implement `src/data/sources/SupabaseDataSource.ts`

- `getVenues(q)`: `select * from venues`, with query filters applied server-side where the schema supports it (bbox via `lat`/`lng` range filters, category via `type in (...)`, price via mapped tier list, search via `ilike` on name) and the rest client-side (music vibe substring, age range) to keep parity with `DemoDataSource` filtering behavior.
- `getVenue(id)`: single-row fetch by uuid.
- **Row mapping (DB → app `Venue`), same rules as the seed transcription:**
  - `name`→`title`; `lat`/`lng`→`latitude`/`longitude`; `description` verbatim; `id` uuid string passes through
  - `type`→`category`: `bar`/`club`/`lounge` pass through; any other enum value (`college_spot`, `upscale`, `other`) maps to `bar`
  - `price`: `$`→1, `$$`→2, `$$$`→3, `$$$$`→4, null→undefined
  - `age_range` `"21-30"`→`age_range_min: 21, age_range_max: 30`; unparseable/null→both undefined
  - `music`: `'none'`/null→`music_type` omitted; otherwise title-cased with `/` spacing (`latin/jazz`→`Latin / Jazz`)
  - `serves_alcohol: true` (all rows are bars/lounges); no fabricated fields — `buzz_score`, `hot_tonight`, `editors_pick`, `venue_stats`, `open_now`, `cover_charge`, `image_url` all stay undefined per the no-fabrication rule
- `src/data/resolver.ts`: order becomes — explicit `apiBaseUrl` → `ApiDataSource`; Supabase client constructible → `SupabaseDataSource`; else `DemoDataSource`.

### 3. Backend-side changes (user runs in dashboard; SQL delivered via clipboard at implementation time)

- **RLS:** drop the `venues readable by authenticated` policy, create `venues readable by everyone` (`for select using (true)`). Profiles/check-ins/friendships policies unchanged.
- **Auth redirect allowlist:** in Supabase Auth → URL Configuration, add `http://localhost:8080` (dev) — and later the Vercel production URL when it exists — so `signInWithOAuth` can round-trip back to the app.

### 4. Auth layer — `src/store/auth.ts` (new) + Profile tab rework

- Zustand store: `{ session, user, profile, status: 'loading' | 'signedOut' | 'signedIn' | 'needsUsername' }`, initialized from `supabase.auth.getSession()`, kept current via `onAuthStateChange`. After sign-in it fetches the user's `profiles` row; row missing → `status: 'needsUsername'`.
- `signInWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/profile' } })`; `signOut()` wraps `supabase.auth.signOut()`.
- **`src/pages/Profile.tsx` rework:** signed out → ENDZ-toned intro + "Continue with Google" button; signed in → avatar (Google photo), display name, `@username`, sign-out button. The existing developer config inputs (Mapbox token, API base URL, Supabase URL/key) move into a collapsed "Developer settings" section — kept functional, out of the way. When `status === 'loading'`, skeleton.
- No route guards anywhere — map/discover/venue pages stay public.

### 5. First-login onboarding — `src/pages/PickUsername.tsx` (new route `/welcome`)

- Rendered when `status === 'needsUsername'` (auth store redirects there after OAuth if no profile row).
- One field, pre-filled suggestion: email local-part lowercased, non-`[a-z0-9_]` chars → `_`, consecutive underscores collapsed to one, leading/trailing underscores trimmed. Validation: 3-20 chars, `^[a-z0-9_]+$`.
- Debounced (~400ms) availability check (`select id from profiles where username = ...`), inline ✓/✗ indicator.
- Confirm → insert `profiles` row (`id = auth.uid()`, `username`, `display_name` from Google metadata, `avatar_url` from Google metadata) → status flips to `signedIn` → navigate to the map.
- Insert failures (race on username uniqueness, network) surface inline on the field, not as toasts — the user fixes and retries in place.

## Verification approach

No test runner exists in the repo. Verification: `npx tsc --noEmit -p tsconfig.app.json` (the root `tsc --noEmit` is a silent no-op — never trust it), `npm run build`, and live Playwright browser checks: (a) signed-out map shows the 19 real venues fetched from Supabase (network tab hits `/rest/v1/venues`), (b) full Google sign-in round-trip as an allowlisted test user, (c) first-login username screen → profile row visible in the Supabase table editor, (d) sign out returns Profile tab to signed-out state without a reload.

## Out of scope (explicitly deferred)

- Check-ins (write path, map pin activity levels, auto-expiry UI) — next plan; it's the core loop and deserves its own spec
- Friends/friendships UI, ghost mode toggle, per-check-in visibility
- Apple Sign-In (native phase), Vercel deploy, taking Google OAuth out of testing mode
- Any `Venue` type shape changes; any use of fabricated venue stats
