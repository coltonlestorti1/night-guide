# ENDZ Premium UI Polish (Map-First) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ENDZ read as a premium, professional, social-grade nightlife app by landing a shared design-system pass (typography, elevation, glass, motion, icons) and refining the map chrome — without touching MapLibre marker logic.

**Architecture:** Foundation-first. Land shared tokens + fonts so every surface lifts at once, then refine each map surface (search, filter chips, Map/List toggle, venue sheet) and the VibeFinder on top of that foundation. All changes are React component + CSS/Tailwind token edits; no map-marker positioning code is touched.

**Tech Stack:** Vite + React + TypeScript, Tailwind CSS 3.4, shadcn/ui, lucide-react 0.462, vaul Drawer, MapLibre GL (untouched), `@fontsource-variable` for self-hosted fonts.

## Global Constraints

- Typecheck ONLY with `npx tsc --noEmit -p tsconfig.app.json` — bare `npx tsc` is a silent no-op.
- No unit-test runner exists. Per-task verification = typecheck + `npm run build` + Playwright screenshot of the touched surface (before/after).
- NEVER touch MapLibre marker geo-anchoring: no edits to `src/components/Map.tsx` marker creation/positioning, no inline `position` on marker wrappers, no rebuilding markers each render.
- Map **pin glyphs** (🍺 🍸 🪩) stay. Emoji are removed everywhere else in the chrome, replaced with lucide line icons at `h-4 w-4`.
- Fonts self-hosted (no Google-Fonts CDN): body = Inter, display = Space Grotesk (Clash Display optional swap, Task 9).
- Dark UI only. Keep the violet `--primary` (262 83% 58%) as the brand accent.
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (repo convention).
- Work on branch `polish/map-premium`. Commit after each task.

---

### Task 1: Self-hosted fonts (Inter + Space Grotesk)

**Files:**
- Modify: `package.json` (add deps)
- Modify: `src/main.tsx` (import font CSS)
- Modify: `tailwind.config.ts:20-70` (add `fontFamily`)
- Modify: `src/pages/MapPage.tsx:66-68` (wordmark uses display font)

**Interfaces:**
- Produces: Tailwind utilities `font-sans` (Inter, now the default body) and `font-display` (Space Grotesk). Later tasks apply `font-display` to headings/section titles.

- [ ] **Step 1: Install the self-hosted font packages**

Run:
```bash
cd ~/Documents/night-guide && npm i @fontsource-variable/inter @fontsource-variable/space-grotesk
```
Expected: both packages added to `dependencies`, no peer errors.

- [ ] **Step 2: Import the fonts once at app entry**

In `src/main.tsx`, add at the very top (before other imports):
```ts
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
```

- [ ] **Step 3: Wire the families into Tailwind**

In `tailwind.config.ts`, inside `theme.extend` (alongside `borderRadius`), add:
```ts
fontFamily: {
  sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  display: ['"Space Grotesk Variable"', '"Inter Variable"', 'ui-sans-serif', 'sans-serif'],
},
```

- [ ] **Step 4: Point the wordmark at the display font**

In `src/pages/MapPage.tsx`, the `<h1>` ENDZ wordmark (currently `className="text-2xl font-bold tracking-tight bg-gradient-to-r ..."`) — add `font-display` and tighten tracking:
```tsx
<h1 className="text-2xl font-display font-bold tracking-tight bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent">
  ENDZ
</h1>
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: both pass, no errors.

- [ ] **Step 6: Visual verify + commit**

Start dev server (`npm run dev`), open the map in Playwright, screenshot the header. Confirm body text is Inter (not system) and the ENDZ wordmark is Space Grotesk.
```bash
git add -A && git commit -m "feat(ui): self-host Inter (body) + Space Grotesk (display) fonts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Design tokens — elevation, glass, shadow/glow, motion

**Files:**
- Modify: `src/index.css:5-75` (CSS vars, `.glass`, keyframe)
- Modify: `tailwind.config.ts` (`boxShadow`, `keyframes`, `animation`)

**Interfaces:**
- Produces: CSS vars `--surface-1`, `--surface-2`; Tailwind utilities `shadow-float`, `shadow-sheet`, `shadow-glow`, `animate-fade-in`, `animate-slide-up`; upgraded `.glass`. Later tasks consume these.

- [ ] **Step 1: Add surface-tier + shadow tokens to `:root`**

In `src/index.css`, inside `:root` (after `--card` block), add:
```css
    --surface-1: 240 6% 12%;   /* raised cards */
    --surface-2: 240 6% 15%;   /* sheets / popovers */
    --shadow-color: 240 30% 2%;
```

- [ ] **Step 2: Upgrade the `.glass` utility**

In `src/index.css`, replace the `.glass` rule with:
```css
  .glass {
    @apply bg-card/80 backdrop-blur-xl backdrop-saturate-150 border border-border/50;
    border-top-color: hsl(0 0% 100% / 0.08);
    box-shadow: 0 8px 30px -12px hsl(var(--shadow-color) / 0.7);
  }
```

- [ ] **Step 3: Add the fade-in / slide-up keyframes (fix the current no-op)**

In `src/index.css`, after the `endz-pulse` keyframe, add:
```css
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 4: Register shadows + animations in Tailwind**

In `tailwind.config.ts`, inside `theme.extend`:
```ts
boxShadow: {
  float: '0 8px 30px -12px hsl(240 30% 2% / 0.7)',
  sheet: '0 -8px 40px -12px hsl(240 30% 2% / 0.8)',
  glow: '0 0 20px -2px hsl(262 83% 58% / 0.45)',
},
```
And extend the existing `keyframes` and `animation` objects (do NOT remove accordion entries):
```ts
// keyframes: add
'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
// animation: add
'fade-in': 'fade-in 0.2s ease-out',
'slide-up': 'slide-up 0.25s ease-out',
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: pass.

- [ ] **Step 6: Visual verify + commit**

Playwright screenshot: open a venue drawer and the search dropdown — confirm the glass now has a faint top highlight and soft shadow, and `animate-fade-in` visibly fades content in.
```bash
git add -A && git commit -m "feat(ui): elevation/glass/shadow/glow tokens + working fade-in/slide-up motion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: VibeFinder — de-emoji + restyle ("Find the move")

**Files:**
- Modify: `src/components/VibeFinder.tsx`

**Interfaces:**
- Consumes: `font-display`, `animate-slide-up`, `shadow-glow` (Tasks 1–2).
- Produces: none downstream.

- [ ] **Step 1: Replace emoji option labels with lucide icons**

At top of `src/components/VibeFinder.tsx`, import icons and change the option arrays to carry an `icon`:
```tsx
import { Sofa, TrendingUp, Flame, Beer, Martini, Shuffle, Zap, Moon, Sparkles } from "lucide-react";

const VIBES = [
  { value: "chill", label: "Chill", Icon: Sofa },
  { value: "lively", label: "Lively", Icon: TrendingUp },
  { value: "packed", label: "Packed", Icon: Flame },
] as const;
const DRINKS = [
  { value: "beer", label: "Cheap beers", Icon: Beer },
  { value: "cocktails", label: "Cocktails", Icon: Martini },
  { value: undefined, label: "Whatever", Icon: Shuffle },
] as const;
const WHENS = [
  { value: "now", label: "Right now", Icon: Zap },
  { value: "later", label: "Later tonight", Icon: Moon },
] as const;
```

- [ ] **Step 2: Render the icon inside each Chip**

Update the three `.map(...)` blocks to pass icon + label, e.g. for VIBES:
```tsx
{VIBES.map((o) => (
  <Chip key={o.value} active={vibe === o.value} onClick={() => setVibe(vibe === o.value ? undefined : o.value)}>
    <o.Icon className="h-4 w-4" /> {o.label}
  </Chip>
))}
```
Apply the same pattern to DRINKS (`key={o.label}`) and WHENS.

- [ ] **Step 3: Make the Chip lay out icon + label and use the glow token**

Replace the `Chip` component's `className` so content is inline-flex and the active state uses `shadow-glow`:
```tsx
className={cn(
  "inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
  active
    ? "bg-primary text-primary-foreground border-transparent shadow-glow"
    : "bg-secondary border-border hover:bg-secondary/70",
)}
```

- [ ] **Step 4: De-emoji the title + apply display font**

Change the heading from `✨ Find the move` to an icon + display font:
```tsx
<h2 className="text-lg font-display font-bold mb-1 flex items-center gap-2">
  <Sparkles className="h-4 w-4 text-primary" /> Find the move
</h2>
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: pass.

- [ ] **Step 6: Visual verify + commit**

Playwright: tap the "Find the move" chip on the map to open the drawer. Confirm zero emoji, icons render, active chips glow, title uses the display font. Screenshot for before/after.
```bash
git add -A && git commit -m "feat(ui): de-emoji + restyle VibeFinder with lucide icons + display title

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Filter chips + VenueQuickInfo — de-emoji + chip polish

**Files:**
- Modify: `src/pages/MapPage.tsx` (`FilterChips`, lines ~136-218)
- Modify: `src/components/VenueQuickInfo.tsx`

**Interfaces:**
- Consumes: `shadow-glow` (Task 2), lucide icons.
- Produces: none downstream.

- [ ] **Step 1: Give each primary filter an icon**

In `src/pages/MapPage.tsx`, import the icons (extend the existing lucide import): `Flame, Music, Sparkles, Wine`. Change `PRIMARY_FILTERS` entries to carry an optional `Icon`:
```tsx
const PRIMARY_FILTERS: { label: string; value: VenueCategory | "all" | "hot" | "music" | "vibe-finder" | "happy-hour"; Icon?: React.ComponentType<{ className?: string }> }[] = [
  { label: "Find the move", value: "vibe-finder", Icon: Sparkles },
  { label: "All", value: "all" },
  { label: "Happy hour", value: "happy-hour", Icon: Wine },
  { label: "Bars", value: "bar" },
  { label: "Clubs", value: "club" },
  { label: "Lounges", value: "lounge" },
  { label: "Hot Tonight", value: "hot", Icon: Flame },
  { label: "Music", value: "music", Icon: Music },
];
```

- [ ] **Step 2: Render icon instead of the emoji prefixes**

In the `FilterChips` `.map`, replace the emoji-prefix block (the `{f.value === "hot" && "🔥 "}` … lines) and wrap content inline-flex:
```tsx
<button
  key={f.value}
  onClick={() => handle(f.value)}
  className={cn(
    "shrink-0 inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-all whitespace-nowrap",
    active
      ? "bg-primary text-primary-foreground border-transparent shadow-glow"
      : "bg-card/80 backdrop-blur-xl text-foreground border-border/60 hover:bg-secondary"
  )}
  aria-pressed={active}
>
  {f.Icon && <f.Icon className="h-4 w-4" />}
  {f.label}
  {f.value === "music" && musicVibe ? `: ${musicVibe}` : ""}
</button>
```

- [ ] **Step 3: Add a scroll-fade mask to the chip row**

Wrap the scrolling `flex` row with an edge fade. On the existing `<div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">`, add a mask via inline style so both edges fade:
```tsx
style={{ maskImage: "linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)", WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)" }}
```

- [ ] **Step 4: Swap the 🥂 emoji in VenueQuickInfo for the Wine icon**

In `src/components/VenueQuickInfo.tsx`, import `{ Wine } from "lucide-react"` and replace each `🥂 ` prefix in the happy-hour `<p>` lines with `<Wine className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />`. Keep the open-state `●` status dot (it is a status indicator, not emoji) — leave it.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: pass.

- [ ] **Step 6: Visual verify + commit**

Playwright: on the map, confirm filter chips show line icons (no emoji), active chip glows, the row fades at both edges; open a venue with happy-hour data and confirm the Wine icon. Screenshot.
```bash
git add -A && git commit -m "feat(ui): de-emoji filter chips + VenueQuickInfo, add chip glow + scroll-fade

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Search header polish (`TopHeader`)

**Files:**
- Modify: `src/pages/MapPage.tsx` (`TopHeader`, lines ~48-133)

**Interfaces:**
- Consumes: `.glass` (upgraded), `animate-fade-in`, `font-display`.
- Produces: none downstream.

- [ ] **Step 1: Elevate the search input + focus glow**

Change the `<Input>` className to add focus glow and use the elevated surface:
```tsx
className="pl-9 h-10 rounded-xl bg-card/80 backdrop-blur-xl border-border/60 transition-shadow focus-visible:shadow-glow focus-visible:border-primary/50"
```

- [ ] **Step 2: Elevate the results dropdown**

On the results container (`<div className="absolute top-full ... glass shadow-2xl ...">`), swap `shadow-2xl` for the token `shadow-float` and ensure `animate-fade-in` (now functional) stays. Rows: change `hover:bg-accent/15` to `hover:bg-surface-2/60` is not needed — keep hover but bump row padding for tap comfort: `px-3 py-3`.

- [ ] **Step 3: Tighten the tagline to the type scale**

The tagline `<p className="text-xs text-muted-foreground -mt-0.5">` — leave copy, no change needed beyond confirming it reads under the display wordmark. (No code change if already correct.)

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: pass.

- [ ] **Step 5: Visual verify + commit**

Playwright: focus the search box (confirm glow ring), type "gr" (confirm dropdown floats with elevation + fade). Screenshot.
```bash
git add -A && git commit -m "feat(ui): polish map search header — focus glow + elevated dropdown

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Animated Map/List segmented toggle

**Files:**
- Modify: `src/pages/MapPage.tsx` (toggle block, lines ~300-325)

**Interfaces:**
- Consumes: `.glass`, `--primary`.
- Produces: none downstream.

- [ ] **Step 1: Convert the toggle to a sliding-indicator segmented control**

Replace the two-button toggle with a relative container holding an absolutely-positioned sliding pill that translates on `view`:
```tsx
<div className="fixed left-1/2 -translate-x-1/2 z-40" style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}>
  <div className="relative flex rounded-full glass shadow-float overflow-hidden p-1">
    <span
      className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-200 ease-out"
      style={{ transform: view === "map" ? "translateX(0)" : "translateX(100%)" }}
      aria-hidden="true"
    />
    {(["map", "list"] as const).map((v) => (
      <button
        key={v}
        onClick={() => setView(v)}
        className={cn(
          "relative z-10 px-5 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors",
          view === v ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {v === "map" ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}
        {v === "map" ? "Map" : "List"}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: pass.

- [ ] **Step 3: Visual verify + commit**

Playwright: toggle Map↔List, confirm the violet pill slides smoothly under the active label. Screenshot the transition.
```bash
git add -A && git commit -m "feat(ui): animated sliding Map/List segmented toggle

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Venue bottom sheet refine + DrawerTitle a11y fix

**Files:**
- Modify: `src/pages/MapPage.tsx` (venue `Drawer`, lines ~383-467)
- Modify: `src/components/VibeFinder.tsx` (its `Drawer`)
- Modify: `src/components/ui/drawer.tsx` (only if `DrawerTitle` not already exported — verify first)

**Interfaces:**
- Consumes: `DrawerTitle`/`DrawerHeader` from `@/components/ui/drawer`, `font-display`, `animate-slide-up`, `shadow-sheet`.
- Produces: none downstream.

- [ ] **Step 1: Verify DrawerTitle is exported**

Run: `grep -n "DrawerTitle\|DrawerHeader\|DrawerDescription" src/components/ui/drawer.tsx`
Expected: exports exist (standard shadcn drawer). If missing, add the shadcn `DrawerTitle`/`DrawerHeader` primitives before continuing.

- [ ] **Step 2: Add an accessible (visually-hidden) title to both drawers**

In `MapPage.tsx` venue drawer, import `DrawerTitle` and add just inside `<DrawerContent>`:
```tsx
<DrawerTitle className="sr-only">{selected?.title ?? "Venue details"}</DrawerTitle>
```
In `VibeFinder.tsx`, add inside its `<DrawerContent>`:
```tsx
<DrawerTitle className="sr-only">Find the move</DrawerTitle>
```
This clears the known vaul "missing DialogTitle" a11y warning.

- [ ] **Step 3: Add a legibility gradient over the hero image**

In the venue drawer hero block (`<div className="relative w-full h-44 ...">`), add a bottom-up scrim overlay after the `<img>`:
```tsx
<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
```

- [ ] **Step 4: Apply display font + entrance motion to the sheet body**

On the venue title `<h2 className="text-xl font-bold leading-tight truncate">`, add `font-display`. On the sheet body wrapper (`<div className="px-4 pt-2 pb-6 ... animate-fade-in">`), change `animate-fade-in` to `animate-slide-up` for a subtle rise.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: pass. Also confirm the browser console no longer logs the DialogTitle warning.

- [ ] **Step 6: Visual verify + commit**

Playwright: open a venue sheet, confirm the hero has a legibility scrim, the title is display font, the sheet slides up, and the console DialogTitle warning is gone. Screenshot.
```bash
git add -A && git commit -m "feat(ui): refine venue bottom sheet + fix DrawerTitle a11y warning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Full-surface verification pass

**Files:** none (verification only)

- [ ] **Step 1: Clean typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: both pass with no errors or new warnings.

- [ ] **Step 2: Playwright regression sweep**

With `npm run dev` running, drive the map screen end to end: search → open dropdown → pick a venue → open sheet → close → toggle List/Map → open each filter chip → open VibeFinder → run the 3-tap flow. Confirm no console errors and that markers still sit on their correct geo positions (regression check for the untouched map).

- [ ] **Step 3: Before/after screenshot set**

Capture the final state of: header/search, filter chips, Map/List toggle, venue sheet, VibeFinder. Save under `docs/superpowers/screenshots/2026-07-07-after/` for user review.

- [ ] **Step 4: Commit the screenshots**

```bash
git add -A && git commit -m "docs: after-screenshots for premium UI polish round

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9 (OPTIONAL): Swap Space Grotesk → Clash Display

Only if the user prefers Clash Display's edge after seeing Space Grotesk live. Clash Display is not on npm/@fontsource, so it must be self-hosted manually.

**Files:**
- Create: `public/fonts/ClashDisplay-Variable.woff2`
- Modify: `src/index.css` (add `@font-face`)
- Modify: `tailwind.config.ts` (`fontFamily.display`)

- [ ] **Step 1:** Download the Clash Display variable `woff2` from Fontshare (fontshare.com/fonts/clash-display) into `public/fonts/ClashDisplay-Variable.woff2`.
- [ ] **Step 2:** Add to `src/index.css`:
```css
@font-face {
  font-family: "Clash Display";
  src: url("/fonts/ClashDisplay-Variable.woff2") format("woff2");
  font-weight: 200 700;
  font-display: swap;
}
```
- [ ] **Step 3:** In `tailwind.config.ts`, set `fontFamily.display` first entry to `'"Clash Display"'`.
- [ ] **Step 4:** `npx tsc --noEmit -p tsconfig.app.json && npm run build`, Playwright screenshot the wordmark, commit.

---

## Verification summary

Every task: `npx tsc --noEmit -p tsconfig.app.json` → `npm run build` → Playwright screenshot of the touched surface. Task 8 is the integration sweep. No MapLibre marker code is touched in any task; the marker regression check in Task 8 Step 2 confirms geo-anchoring is intact.
