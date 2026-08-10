/**
 * Renders the `apple-touch-startup-image` launch screens.
 *
 * WHY THIS EXISTS: launched from the iPhone home screen, a standalone web app
 * shows a blank white screen from the moment you tap the icon until the HTML
 * document paints — about two seconds on a cold start (Colton, 2026-08-09).
 * The inline splash in index.html cannot cover that window, because it *is*
 * the document. A startup image is the only thing iOS will draw there, and it
 * needs a pixel-exact PNG per device: if a single dimension is wrong, iOS
 * silently falls back to white, which is the bug we are fixing.
 *
 * Everything is drawn by hand — the repo has no image library on purpose (see
 * make-app-icon.mjs). The arc and wordmark curves are supersampled 4x4, but
 * ONLY inside their own
 * bounding boxes: at 1320x2868 the artwork covers about 2% of the canvas, and
 * supersampling the flat background would be ~50M wasted samples per image.
 *
 *   node scripts/make-splash-image.mjs          # write all sizes
 *   node scripts/make-splash-image.mjs --check  # verify index.html agrees
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { encodePNG } from "./lib/png.mjs";
import {
  BG,
  PURPLE,
  WORDMARK,
  hex,
  WORDMARK_PATH,
  WORDMARK_VIEWBOX,
  LAYOUT,
  MARK_BOX,
  arcPath,
  ORBIT_PERIOD_MS,
  markHeight,
  wordmarkHeight,
} from "./lib/splash-art.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/splash");

/**
 * Every distinct portrait (device-width, device-height, DPR) an iPhone
 * presents to Safari. Checked against published device tables rather than
 * recalled — pixel dimensions are always points x scale, and the arithmetic is
 * asserted at startup below.
 *
 * Cross-check any addition against a SECOND source. iosref.com/res, which this
 * table was first built from, omits the iPhone Air entirely; a single source
 * would have shipped a white launch screen for that device.
 *
 * Models sharing a configuration share one image: the X, XS, 11 Pro, 12 mini
 * and 13 mini are all 375x812 @3x.
 */
export const DEVICES = [
  { w: 320, h: 568, dpr: 2, models: "SE (1st gen)" },
  { w: 375, h: 667, dpr: 2, models: "SE 2nd/3rd gen, 8" },
  { w: 414, h: 736, dpr: 3, models: "8 Plus" },
  { w: 375, h: 812, dpr: 3, models: "X, XS, 11 Pro, 12 mini, 13 mini" },
  { w: 414, h: 896, dpr: 2, models: "XR, 11" },
  { w: 414, h: 896, dpr: 3, models: "XS Max, 11 Pro Max" },
  { w: 390, h: 844, dpr: 3, models: "12, 13, 14, 16e" },
  { w: 428, h: 926, dpr: 3, models: "12/13 Pro Max, 14 Plus" },
  { w: 393, h: 852, dpr: 3, models: "14 Pro, 15, 15 Pro, 16" },
  { w: 430, h: 932, dpr: 3, models: "14 Pro Max, 15 Plus/Pro Max, 16 Plus" },
  { w: 402, h: 874, dpr: 3, models: "16 Pro, 17, 17 Pro" },
  { w: 440, h: 956, dpr: 3, models: "16 Pro Max, 17 Pro Max" },
  // The Air is its own size and is MISSING from iosref's table — found only by
  // checking a second source. Without this row an Air owner gets exactly the
  // white launch screen this whole file exists to remove.
  { w: 420, h: 912, dpr: 3, models: "Air (2025)" },
];

/* ---------------------------------------------------------------- geometry */

/**
 * Where every piece sits, in CSS pixels, for a given screen.
 * The live splash in index.html centres the same group with flexbox; these
 * numbers must produce the same result, which is what --check enforces.
 */
export function layout(cssW, cssH) {
  const cx = cssW / 2;
  const groupTop = cssH * LAYOUT.centerYFraction - markHeight() / 2;
  // The arc's centre sits at the centre of the MARK_BOX, which is padded by
  // half a stroke so the line's outer edge is never shaved off.
  const ringCy = groupTop + MARK_BOX / 2;
  const wmW = LAYOUT.wordmarkWidth;
  const wmH = wordmarkHeight();
  return {
    cx,
    ringCy,
    wm: {
      x: cx - wmW / 2,
      y: groupTop + MARK_BOX + LAYOUT.wordmarkGap,
      w: wmW,
      h: wmH,
    },
  };
}

/* ------------------------------------------------------- path rasterisation */

/** Parse the wordmark's M/L/Q/Z path into flattened polygons in its own
 *  1000-wide coordinate box. Quadratics get 16 segments, which is far below
 *  one device pixel at these sizes. */
function flattenPath(d) {
  const contours = [];
  let cur = null;
  let x = 0, y = 0, startX = 0, startY = 0;
  const tokens = d.match(/[MLQZ][^MLQZ]*/g) || [];

  for (const tok of tokens) {
    const cmd = tok[0];
    const n = (tok.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
    if (cmd === "M") {
      if (cur && cur.length) contours.push(cur);
      [x, y] = n;
      startX = x; startY = y;
      cur = [[x, y]];
    } else if (cmd === "L") {
      for (let i = 0; i < n.length; i += 2) {
        x = n[i]; y = n[i + 1];
        cur.push([x, y]);
      }
    } else if (cmd === "Q") {
      for (let i = 0; i < n.length; i += 4) {
        const [qx, qy, ex, ey] = n.slice(i, i + 4);
        for (let s = 1; s <= 16; s++) {
          const t = s / 16, u = 1 - t;
          cur.push([
            u * u * x + 2 * u * t * qx + t * t * ex,
            u * u * y + 2 * u * t * qy + t * t * ey,
          ]);
        }
        x = ex; y = ey;
      }
    } else if (cmd === "Z") {
      if (cur && cur.length) contours.push(cur);
      cur = null;
      x = startX; y = startY;
    }
  }
  if (cur && cur.length) contours.push(cur);
  return contours;
}

/**
 * Where the outline crosses one horizontal line, sorted left to right, with
 * the direction of each crossing.
 *
 * Cached per scanline: within a row of subsamples `py` is constant while `px`
 * varies, so walking all ~400 segments for every single subsample was doing the
 * same work hundreds of times. The crossings depend only on the path, which
 * never changes, so the cache is valid across images too.
 */
const crossingCache = new Map();

/**
 * Deliberately closed over WORDMARK_CONTOURS rather than taking the contours as
 * an argument: the cache is keyed on `py` ALONE, so a second caller passing a
 * different outline would silently receive this one's crossings. There is only
 * ever one path to fill, and this keeps that a fact rather than an assumption.
 */
function wordmarkCrossingsAt(py) {
  const hit = crossingCache.get(py);
  if (hit) return hit;
  const xs = [];
  for (const c of WORDMARK_CONTOURS) {
    for (let i = 0; i < c.length; i++) {
      const [x1, y1] = c[i];
      const [x2, y2] = c[(i + 1) % c.length];
      // Half-open rule: a vertex sitting exactly on the scanline is counted
      // once, not twice, and a horizontal segment is skipped entirely (both
      // ends compare equal). Parenthesised because `<=` binds tighter than
      // `===`, and the intent should not rest on remembering that.
      if ((y1 <= py) === (y2 <= py)) continue;
      xs.push({
        x: x1 + ((py - y1) / (y2 - y1)) * (x2 - x1),
        dir: y2 > y1 ? 1 : -1,
      });
    }
  }
  xs.sort((a, b) => a.x - b.x);
  crossingCache.set(py, xs);
  return xs;
}

/** Non-zero winding, which is what TrueType outlines assume — the counters in
 *  D and the bowl of the E depend on it. */
function insideWordmark(px, py) {
  const xs = wordmarkCrossingsAt(py);
  let winding = 0;
  for (let i = 0; i < xs.length && xs[i].x <= px; i++) winding += xs[i].dir;
  return winding !== 0;
}

const WORDMARK_CONTOURS = flattenPath(WORDMARK_PATH);

/* ------------------------------------------------------------------ render */

const SS = 4; // 4x4 subsamples inside the artwork's bounding boxes

export function render(cssW, cssH, dpr) {
  const W = Math.round(cssW * dpr);
  const H = Math.round(cssH * dpr);
  const L = layout(cssW, cssH);

  // Flat background first; the artwork is a rounding error of the canvas.
  // One row is built by hand and then memcpy'd down the image — at 1320x2868
  // that is 2868 native copies instead of 3.8M JS loop iterations.
  const stride = 1 + W * 3;
  const raw = Buffer.alloc(H * stride);
  const bgRow = Buffer.alloc(stride);
  bgRow[0] = 0; // PNG filter: None
  for (let x = 0; x < W; x++) {
    const o = 1 + x * 3;
    bgRow[o] = BG[0]; bgRow[o + 1] = BG[1]; bgRow[o + 2] = BG[2];
  }
  for (let y = 0; y < H; y++) bgRow.copy(raw, y * stride);

  const half = LAYOUT.arcStroke / 2;
  const arcInner = LAYOUT.ringRadius - half;
  const arcOuter = LAYOUT.ringRadius + half;
  // Endpoints of the arc's centreline, for the round caps. Angles run clockwise
  // from 12 o'clock, matching arcPath() in splash-art.mjs.
  const capAngle = (deg) => ((deg - 90) * Math.PI) / 180;
  const caps = [LAYOUT.arcStartDeg, LAYOUT.arcStartDeg + LAYOUT.arcSweepDeg].map(
    (deg) => {
      const a = capAngle(deg);
      return [
        L.cx + LAYOUT.ringRadius * Math.cos(a),
        L.ringCy + LAYOUT.ringRadius * Math.sin(a),
      ];
    },
  );

  /** Colour of one subsample, in CSS-pixel space. The centre of the mark is
   *  deliberately empty — there is nothing to composite against. */
  const sampleMark = (sx, sy) => {
    const dx = sx - L.cx, dy = sy - L.ringCy;
    const r = Math.hypot(dx, dy);
    if (r >= arcInner && r <= arcOuter) {
      // Clockwise degrees from 12 o'clock, 0..360.
      const deg = (((Math.atan2(dx, -dy) * 180) / Math.PI) + 360) % 360;
      const from = (LAYOUT.arcStartDeg + 360) % 360;
      const travelled = (deg - from + 360) % 360;
      if (travelled <= LAYOUT.arcSweepDeg) return PURPLE;
    }
    // Round caps: a disc of half the stroke width at each end of the
    // centreline. Without these the arc ends in a hard chisel, which is the
    // detail that makes a spinner look unfinished.
    for (const [capX, capY] of caps) {
      if (Math.hypot(sx - capX, sy - capY) <= half) return PURPLE;
    }
    return BG;
  };

  const sampleWordmark = (sx, sy) => {
    const u = ((sx - L.wm.x) / L.wm.w) * WORDMARK_VIEWBOX.w;
    const v = ((sy - L.wm.y) / L.wm.h) * WORDMARK_VIEWBOX.h;
    return insideWordmark(u, v) ? WORDMARK : BG;
  };

  /** Supersample `sampler` over a CSS-pixel rect, writing averaged pixels. */
  const paint = (box, sampler) => {
    const x0 = Math.max(0, Math.floor(box.x * dpr));
    const y0 = Math.max(0, Math.floor(box.y * dpr));
    const x1 = Math.min(W, Math.ceil((box.x + box.w) * dpr));
    const y1 = Math.min(H, Math.ceil((box.y + box.h) * dpr));
    for (let y = y0; y < y1; y++) {
      const row = y * (1 + W * 3);
      for (let x = x0; x < x1; x++) {
        let r = 0, g = 0, b = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const cx = (x + (sx + 0.5) / SS) / dpr;
            const cy = (y + (sy + 0.5) / SS) / dpr;
            const c = sampler(cx, cy);
            r += c[0]; g += c[1]; b += c[2];
          }
        }
        const n = SS * SS;
        const o = row + 1 + x * 3;
        raw[o] = Math.round(r / n);
        raw[o + 1] = Math.round(g / n);
        raw[o + 2] = Math.round(b / n);
      }
    }
  };

  const pad = 2;
  paint(
    {
      x: L.cx - arcOuter - pad,
      y: L.ringCy - arcOuter - pad,
      w: (arcOuter + pad) * 2,
      h: (arcOuter + pad) * 2,
    },
    sampleMark,
  );
  paint(
    { x: L.wm.x - pad, y: L.wm.y - pad, w: L.wm.w + pad * 2, h: L.wm.h + pad * 2 },
    sampleWordmark,
  );

  return { raw, W, H };
}

/* ------------------------------------------------------------------- guard */

/**
 * The live splash and these images have to agree, or the handoff from the
 * startup image to the HTML jumps — a new visible defect exactly where the
 * white screen used to be. index.html cannot import this module (it is static
 * markup), so instead we assert the numbers it hardcodes are still these ones.
 */
export function expectedInIndexHtml() {
  const c = MARK_BOX / 2;
  return [
    ["wordmark path", WORDMARK_PATH],
    ["mark box viewBox", `viewBox="0 0 ${MARK_BOX} ${MARK_BOX}"`],
    ["mark box size", `width="${MARK_BOX}" height="${MARK_BOX}"`],
    // The arc, starting at 12 o'clock — the frame the startup PNG paints.
    ["spinner arc path", arcPath(c, c)],
    ["orbit origin", `transform-origin: ${c}px ${c}px`],
    ["orbit period", `${ORBIT_PERIOD_MS}ms`],
    ["wordmark width", `width="${LAYOUT.wordmarkWidth}"`],
    ["splash gap", `gap: ${LAYOUT.wordmarkGap}px`],
    // Everything below drifted SILENTLY until a review mutation-tested this
    // list: each constant was changed one at a time and the guard still passed.
    // Every value here is DERIVED from splash-art.mjs — a literal repeated here
    // would only be checking itself, which is exactly what `"#F7F7F4"` was
    // doing while hex() sat unused.
    ["arc stroke width", `stroke-width="${LAYOUT.arcStroke}"`],
    ["arc round caps", 'stroke-linecap="round"'],
    // The arc's ink lands exactly ON the viewBox edge, so without this the
    // outermost anti-aliased pixel is clipped in the live SVG but not in the
    // PNG — a hairline difference right at the handoff.
    ["mark not clipped at its own edge", 'overflow="visible"'],
    ["arc colour", `stroke="${hex(PURPLE)}"`],
    ["wordmark colour", `fill="${hex(WORDMARK)}"`],
    ["wordmark viewBox", `viewBox="0 0 ${WORDMARK_VIEWBOX.w} ${WORDMARK_VIEWBOX.h}"`],
    ["wordmark height", `height="${Math.round(wordmarkHeight() * 100) / 100}"`],
    ["background", hex(BG)],
  ];
}

function checkIndexHtml() {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
  const missing = expectedInIndexHtml().filter(
    ([, needle]) => !html.includes(needle),
  );

  // The link set has to match the device table too. A row added to DEVICES
  // without its <link> produces an image nothing ever loads; a <link> without
  // its row points at a file that does not exist. Either way: white screen.
  for (const d of DEVICES) {
    const media =
      `(device-width: ${d.w}px) and (device-height: ${d.h}px) and ` +
      `(-webkit-device-pixel-ratio: ${d.dpr})`;
    if (!html.includes(media)) missing.push([`startup link for ${d.models}`]);
    if (!html.includes(`/splash/splash-${d.w * d.dpr}x${d.h * d.dpr}.png`)) {
      missing.push([`startup image href for ${d.models}`]);
    }
  }

  if (missing.length) {
    console.error("index.html has drifted from scripts/lib/splash-art.mjs:");
    for (const [what] of missing) console.error(`  missing: ${what}`);
    process.exit(1);
  }
  console.log(`index.html matches splash-art.mjs ✓ (${DEVICES.length} devices)`);
}

/**
 * Are the committed PNGs actually what the current source renders?
 *
 * Without this, changing the geometry and hand-editing index.html to match
 * passes every other check while `public/splash/*.png` stay stale — and stale
 * images are the one failure the whole design is built to avoid, because they
 * are what iOS paints before the HTML takes over.
 */
function checkImagesCurrent() {
  let stale = 0;
  for (const d of DEVICES) {
    const { raw, W, H } = render(d.w, d.h, d.dpr);
    const path = resolve(OUT_DIR, `splash-${W}x${H}.png`);
    let onDisk;
    try {
      onDisk = readFileSync(path);
    } catch {
      console.error(`  missing image: splash-${W}x${H}.png (${d.models})`);
      stale++;
      continue;
    }
    if (!onDisk.equals(encodePNG(raw, W, H))) {
      console.error(`  stale image: splash-${W}x${H}.png (${d.models})`);
      stale++;
    }
  }
  if (stale) {
    console.error(`${stale} launch image(s) out of date — run: npm run make:splash`);
    process.exit(1);
  }
  console.log(`${DEVICES.length} launch images match the current source ✓`);
}

/* -------------------------------------------------------------------- main */

function main() {
  // A duplicate configuration means one image silently shadows another and a
  // whole class of device gets the wrong art. (The previous guard here checked
  // Number.isInteger(w * dpr), which for integer inputs can never be false —
  // it read like a safety net and was dead code. Nothing here can validate the
  // table against real hardware; only a device can.)
  const seen = new Map();
  for (const d of DEVICES) {
    const key = `${d.w}x${d.h}@${d.dpr}`;
    if (seen.has(key)) {
      throw new Error(
        `duplicate device configuration ${key}: "${seen.get(key)}" and "${d.models}"`,
      );
    }
    seen.set(key, d.models);
  }

  if (process.argv.includes("--check")) {
    checkIndexHtml();
    checkImagesCurrent();
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  for (const d of DEVICES) {
    const { raw, W, H } = render(d.w, d.h, d.dpr);
    const buf = encodePNG(raw, W, H);
    const name = `splash-${W}x${H}.png`;
    writeFileSync(resolve(OUT_DIR, name), buf);
    total += buf.length;
    console.log(
      `${name.padEnd(22)} ${String(Math.round(buf.length / 1024)).padStart(4)} KB  ${d.models}`,
    );
  }
  console.log(`\n${DEVICES.length} images, ${Math.round(total / 1024)} KB total`);
  checkIndexHtml();
}

// Only when run directly — importing this module must not write files, so that
// the renderer can be exercised on its own.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
