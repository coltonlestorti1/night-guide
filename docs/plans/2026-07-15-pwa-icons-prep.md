# PWA Icons & Manifest — Launch Prep

Date: 2026-07-15
Branch: `chore/pwa-icons`
Owner: Colton (drop-in art) · prep by engineering

## TL;DR

The manifest + meta tags are now **correct and launch-shaped**. The only thing
still blocking a polished launch is the **actual icon art**: every current
PNG is a magenta→pink gradient with a white "E" that is **off-brand** (ENDZ
purple is `#6C45FF`, a blue-violet — not the pink these use) and the mark is
small/off-center. Those are placeholders. Colton must supply real art at the
sizes in the checklist below; filenames and manifest wiring already match, so
it's a straight file-swap with no code changes required.

---

## What was audited

- `public/manifest.webmanifest`
- `public/` icon assets: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`,
  `favicon-32.png`, `favicon.ico`, `og-image.png`
- `index.html` — icon `<link>` tags, `theme-color`, apple-mobile-web-app meta
- Build setup: **no** vite-plugin-pwa / Workbox. Installability is hand-rolled
  via a minimal `public/sw.js` (network passthrough, no cache) registered in
  `src/main.tsx`. Manifest and icons are plain files in `public/`.

## Current icon inventory (measured)

| File | Actual px | Format | Alpha | Purpose in use |
|---|---|---|---|---|
| `favicon-32.png` | 32×32 | PNG (RGB) | no | browser tab favicon |
| `favicon.ico` | 32×32 | PNG-in-.ico | no | `/favicon.ico` auto-fetch fallback |
| `icon-192.png` | 192×192 | PNG (RGB) | no | manifest any + maskable, favicon 192 |
| `icon-512.png` | 512×512 | PNG (RGB) | no | manifest any + maskable |
| `apple-touch-icon.png` | 180×180 | PNG (RGB) | no | iOS home-screen icon |
| `og-image.png` | 1200×630 | PNG (RGB) | no | social share (not an app icon) |

Measured mark geometry (identical proportions across all three app icons):
the white "E" occupies ~32% of width and ~49% of height, with side margins of
~36% left / ~32% right and ~24% top / ~27% bottom. Max distance from center is
~78% of the maskable safe radius → **the mark is inside the maskable safe zone**
in every size, and the gradient is fully opaque so masks never reveal
transparent corners. Good news for maskable; the flip side is the mark reads a
bit **small and slightly off-center** for the full-bleed `any` use.

## Gaps found

1. **`theme-color` mismatch (real bug — fixed).** `index.html` declared
   `theme-color = #F7F7F4` (light cream) while the manifest declares
   `theme_color = #09090b`. On a dark, nightlife-first app this made the
   install/address-bar chrome flash light. Now `#09090b` in both.
2. **iOS status-bar style wrong for a dark app (fixed).**
   `apple-mobile-web-app-status-bar-style` was `default` (white bar/black text).
   Set to `black` to match the `#09090b` shell.
3. **Maskable declared only at 512 (improved).** A maskable variant is now also
   declared at 192 (verified inside the safe zone), so Android has a maskable
   asset at both common densities.
4. **Manifest metadata thin (improved).** Added `id`, `lang`, `dir`, and
   `categories`. `id` in particular stabilizes PWA identity across future
   `start_url` changes.
5. **Art is off-brand + placeholder (NOT fixed — needs Colton).** Pink gradient
   ≠ ENDZ purple `#6C45FF`; mark is small/off-center. This is brand-art work,
   deliberately left for Colton. No clean SVG rasterizer / PIL / sharp was
   available in-env to regenerate cleanly, and the icon design is a brand call.

## What was fixed on `chore/pwa-icons`

- `index.html`: `theme-color` `#F7F7F4` → `#09090b`; status-bar style
  `default` → `black`.
- `public/manifest.webmanifest`: added `id: "/"`, `lang: "en"`, `dir: "ltr"`,
  `categories`; added a `192×192` `maskable` icon entry.
- No TypeScript touched. No new art generated. No changes to `sw.js`.

---

## Icon assets Colton must supply (drop-in spec)

Keep the **same filenames** so no code changes are needed. Brand: solid ENDZ
purple `#6C45FF` field (or an approved on-brand gradient) with the ENDZ mark.
All PNGs, sRGB, no metadata bloat. Export at exact pixel sizes below.

### Required app icons

| Filename | Size (px) | Purpose | Safe zone | Notes |
|---|---|---|---|---|
| `public/icon-192.png` | 192×192 | `any` + `maskable` | mark within center **80%** (≥19px pad/side) | Full-bleed opaque bg (no transparency). |
| `public/icon-512.png` | 512×512 | `any` + `maskable` | mark within center **80%** (≥51px pad/side) | Primary Android/desktop install icon. |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen | ~10% pad; iOS applies its own squircle | Opaque bg — iOS ignores transparency (renders black). |
| `public/favicon-32.png` | 32×32 | browser tab | keep mark legible at 16px too | Simplified mark; fine detail disappears small. |
| `public/favicon.ico` | 16+32 (multi) | `/favicon.ico` fallback | — | Ideally a real multi-size .ico; a 32×32 PNG-in-.ico works today. |

### Maskable safe-zone rule (important)

Android/desktop masks crop icons to a circle/squircle/rounded-rect. Keep all
essential mark pixels **inside the center circle of radius = 40% of the icon
size** (i.e. within the inner 80% square). Background must extend fully to the
edges with **no transparency**. Ideal to keep the single file usable for both
`any` and `maskable`: pad the mark to the maskable safe zone, accept it reads
slightly smaller full-bleed. If you want the `any` icon to fill more, split into
separate `-any` / `-maskable` files and update the manifest `icons` array.

### Optional / nice-to-have (not blocking)

| Filename | Size | Why |
|---|---|---|
| `public/favicon.svg` | vector | crisp scalable tab icon; add `<link rel="icon" type="image/svg+xml">`. |
| `public/icon-maskable-512.png` | 512×512 | dedicated maskable with extra padding if the shared file looks too small full-bleed. |
| `public/screenshot-mobile.png` | 1080×1920 | manifest `screenshots` → richer Android/desktop install prompt. |
| `og-image.png` refresh | 1200×630 | current one is placeholder-era; refresh with launch art. |

---

## Colton's checklist

- [ ] Approve icon direction: solid `#6C45FF` vs on-brand gradient; final mark
      (the "E" vs a logotype). This decision drives everything below.
- [ ] Export `icon-512.png` (512², opaque, mark inside 80% safe zone).
- [ ] Export `icon-192.png` (192², same layout scaled).
- [ ] Export `apple-touch-icon.png` (180², opaque, ~10% pad).
- [ ] Export `favicon-32.png` (32², simplified mark, legible at 16px).
- [ ] Regenerate `favicon.ico` (multi-size 16+32 ideal).
- [ ] Drop files into `public/` over the placeholders (same names → zero code).
- [ ] (Optional) add `favicon.svg`, dedicated maskable, `screenshots`.
- [ ] Verify: DevTools → Application → Manifest shows no icon warnings; run
      https://maskable.app on the 512 to confirm no clipping; install on a real
      iPhone + Android and eyeball the home-screen icon.

## Verification already done

- Confirmed (pixel-measured) the placeholder mark sits inside the maskable safe
  zone at 512, 192, and 180 — so declaring 192 maskable is safe.
- Confirmed manifest `theme_color`/`background_color` and `index.html`
  `theme-color` now agree at `#09090b`.
