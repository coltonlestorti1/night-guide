# ENDZ — Next-Session Handoff

_For a fresh session (planned: Fable 5 for design/UI). Read this first, then `CLAUDE.md` and `docs/plans/ENDZ_NEXT_PHASE_ROADMAP.md`._

## How we work
You are Colton's **developer / engineer and design partner** — this is a collaboration, not order-taking. The roadmap and this handoff are **suggestions to discuss**, not a script to execute on autopilot. Bring honest recommendations, lead with your best call + the *why*, and push back (especially on scope creep, premature complexity, or anything that risks the core check-in loop). We decide together before building.

## Where things stand (2026-07-13)
- **Shipped live:** the light social-app redesign of the **map screen** is merged to `main` and deployed at **night-guide.vercel.app**.
  - Warm off-white theme, white cards/nav, charcoal text, ENDZ purple `#6C45FF` for branding/active/selected/primary.
  - **Pins:** white discs; ring **color = live state only** (gray = quiet, orange = trending, pink = hot, purple = selected). Category is shown by the glyph (🍺/🍸/🪩), never the ring.
  - **Responsive:** bottom nav on mobile/tablet → left rail on desktop; venue preview = bottom sheet on mobile / right-side panel on desktop.
  - a11y contrast pass done (amber→amber-700, open-status→emerald-700).
- **Repo:** on `main`, clean tree. `tsc -p tsconfig.app.json --noEmit` + `npm run build` pass; 0 console errors.
- **Docs note:** `CLAUDE.md` and `ENDZ.md` still say "Dark UI by default" — **outdated**, we went light. Worth updating.

## Verification gotcha (important)
Playwright **screenshots don't work here** — MapLibre's live canvas keeps repainting, so the "element stable" wait never settles (5s tool ceiling). Verify visually via **computed styles**, a **WCAG-contrast `evaluate` scan**, or a **non-map route**. Trigger a marker's React handler with `dispatchEvent(new MouseEvent('click',{bubbles:true}))` since real clicks also hit the stability wait.

## What I think is a good first move (let's confirm together)
**De-hardcode East Village into one `src/config/markets.ts` source of truth — with zero visible change.** Keeps EV as the featured beachhead (Colton wants it kept while we expand), and unlocks the whole multi-neighborhood architecture. It's a pure, reversible refactor. Full spec: roadmap **§23–24**. But talk it through first — if there's a higher-value first step, say so.

Other strong early candidates (roadmap has details): real analytics sink (replace the `analytics.ts` no-op), freshness/confidence labels on existing venue/HH data, Find-the-Move v2 (3 explained options), friends-core (the `friendships` table already exists; Social page is a stub).

## Guardrails (discuss before crossing)
- Don't touch Supabase / schema / routes / auth / env vars or the **check-in loop** without talking first.
- No new packages without a reason.
- Keep **East Village** as the marketed beachhead for now.
- Never label anything "live/hot/heating up" without genuinely live data.

## Tooling
- **21st.dev Magic MCP** is connected: search freely (free); **2 `get_component`/day** — reserved for **id 7734 "Place Card"** (venue sheet) and **id 17144 "Astryx Avatar"** (friends-present layer). Don't spend them on tasks that don't need new UI.
- **Model routing:** Fable for design/UI/copy. The moment work moves into Supabase/RLS, the check-in loop, or launch-critical logic, flag it and switch back to **Opus**.
