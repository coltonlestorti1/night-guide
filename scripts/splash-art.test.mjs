/**
 * Tests for the iOS launch-screen art.
 *
 * These are not cosmetic checks. The startup PNG and the inline splash in
 * index.html are two renderings of one design, and iOS shows the PNG and then
 * hands the screen to the HTML — so any disagreement between them appears as
 * the mark jumping, exactly where the blank white screen used to be. That is
 * the property under test.
 *
 * Two real defects motivated every assertion here, both of which passed a
 * typecheck, the build and a visual glance at ONE image:
 *   - the orbiting dot was clipped in half at 12 o'clock, because the SVG box
 *     was the ring's diameter and the dot rides ON the ring;
 *   - the E's gradient ran per-bar instead of across the letter.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BG,
  LAYOUT,
  MARK_BOX,
  gradientAt,
  markHeight,
  wordmarkHeight,
} from "./lib/splash-art.mjs";
import {
  DEVICES,
  layout,
  render,
  expectedInIndexHtml,
} from "./make-splash-image.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Bounding box of every pixel that is not the flat background.
 *
 * Rows are first rejected wholesale with a native Buffer.compare against a
 * background row — on these images all but ~150 rows of 2868 are empty, so the
 * per-pixel loop only ever runs where the artwork actually is.
 */
function inkBox({ raw, W, H }) {
  const stride = 1 + W * 3;
  const bgRow = Buffer.alloc(stride);
  for (let x = 0; x < W; x++) {
    const o = 1 + x * 3;
    bgRow[o] = BG[0]; bgRow[o + 1] = BG[1]; bgRow[o + 2] = BG[2];
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < H; y++) {
    const start = y * stride;
    if (raw.compare(bgRow, 0, stride, start, start + stride) === 0) continue;
    for (let x = 0; x < W; x++) {
      const o = start + 1 + x * 3;
      if (raw[o] !== BG[0] || raw[o + 1] !== BG[1] || raw[o + 2] !== BG[2]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

const pixel = ({ raw, W }, x, y) => {
  const o = y * (1 + W * 3) + 1 + x * 3;
  return [raw[o], raw[o + 1], raw[o + 2]];
};

describe("launch screen geometry", () => {
  it.each(DEVICES.map((d) => [`${d.w}x${d.h}@${d.dpr}x — ${d.models}`, d]))(
    "%s",
    (_name, d) => {
      const img = render(d.w, d.h, d.dpr);
      const L = layout(d.w, d.h);

      // iOS matches the startup image by exact pixel size. One wrong dimension
      // and it silently falls back to the white screen we are fixing.
      expect([img.W, img.H]).toEqual([d.w * d.dpr, d.h * d.dpr]);

      const ink = inkBox(img);

      // The dot rides ON the ring, so the artwork's true top is the ring's top
      // MINUS the dot's radius. This is the assertion that fails if the mark
      // box is ever sized to the ring alone again.
      const expectedTop = (L.ringCy - LAYOUT.ringRadius - LAYOUT.dotRadius) * d.dpr;
      expect(Math.abs(ink.minY - expectedTop)).toBeLessThanOrEqual(1.5);

      // Nothing may touch an edge — that would mean the art is being cropped.
      expect(ink.minX).toBeGreaterThan(0);
      expect(ink.minY).toBeGreaterThan(0);
      expect(ink.maxX).toBeLessThan(img.W - 1);
      expect(ink.maxY).toBeLessThan(img.H - 1);

      // Symmetric about the vertical centre line.
      const leftGap = ink.minX;
      const rightGap = img.W - 1 - ink.maxX;
      expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);

      // The ring is wider than the wordmark, so it sets the horizontal extent.
      const ringOuter = LAYOUT.ringRadius + LAYOUT.ringStroke / 2;
      expect(Math.abs(ink.minX - (L.cx - ringOuter) * d.dpr)).toBeLessThanOrEqual(2);

      // The wordmark's baseline sets the bottom.
      const expectedBottom = (L.wm.y + wordmarkHeight()) * d.dpr;
      expect(Math.abs(ink.maxY - expectedBottom)).toBeLessThanOrEqual(2);
    },
  );

  it("centres the group at exactly 50% on every device", () => {
    // Not taste: the startup image is full-screen while the standalone web view
    // is inset below the status bar, and 0.5 is where that error cancels.
    expect(LAYOUT.centerYFraction).toBe(0.5);
    for (const d of DEVICES) {
      const L = layout(d.w, d.h);
      const groupTop = L.ringCy - MARK_BOX / 2;
      const groupCentre = groupTop + markHeight() / 2;
      expect(Math.abs(groupCentre - d.h / 2)).toBeLessThan(0.001);
    }
  });

  it("draws the dot WHOLE at 12 o'clock — measured, not sampled", () => {
    const d = DEVICES.at(-1);
    const img = render(d.w, d.h, d.dpr);
    const L = layout(d.w, d.h);
    const cx = Math.round(L.dot.x * d.dpr);

    // An earlier version of this test checked the dot's centre pixel and one
    // pixel above its top edge. Both are TRUE when the dot is clipped in half:
    // the centre sits inside a ring-sized box, and clipping only makes the
    // pixel above it more background. So measure the dot's actual height
    // instead — that is the thing that changes when it is cut.
    let purpleRows = 0;
    for (let y = 0; y < img.H; y++) {
      const [r, g, b] = pixel(img, cx, y);
      if (r === 0x6c && g === 0x45 && b === 0xff) purpleRows++;
    }
    const wholeDot = LAYOUT.dotRadius * 2 * d.dpr;
    // Anti-aliasing softens the extreme top and bottom rows.
    expect(purpleRows).toBeGreaterThan(wholeDot - 3);
    expect(purpleRows).toBeLessThanOrEqual(wholeDot);
  });

  it("sweeps the E's gradient across the whole letter, not per bar", () => {
    // objectBoundingBox gradient units resolve PER SHAPE, so an E drawn as four
    // rects gives each bar its own full purple-to-pink sweep.
    //
    // The obvious samples — mid-top-bar and mid-bottom-bar — do NOT catch this:
    // whole-letter and per-bar agree in sign there, and the old assertions
    // ("top is blue-dominant, bottom is red-dominant") passed with the bug
    // present. This samples the right end of the top bar, near its lower edge,
    // where the two interpretations diverge by ~50/255.
    const d = DEVICES.at(-1);
    const img = render(d.w, d.h, d.dpr);
    const L = layout(d.w, d.h);
    // Inside the top bar's ink with room to spare — the bar spans 0..0.169 of
    // the letter's height, and sampling nearer its edge lands on anti-aliasing.
    const fx = 0.82, fy = 0.1;
    const actual = pixel(
      img,
      Math.round((L.e.x + L.e.w * fx) * d.dpr),
      Math.round((L.e.y + L.e.h * fy) * d.dpr),
    );

    // Whole-letter: t is the anti-diagonal across the E's own box.
    const wholeLetter = gradientAt((fx + fy) / 2);
    // Per-bar: the top bar spans only 0..BAR_H of the letter's height, so the
    // same point sits far further along that bar's own diagonal.
    const barH = LAYOUT.eHeight * (86 / 510);
    const perBar = gradientAt((fx + (fy * L.e.h) / barH) / 2);

    const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    expect(dist(actual, wholeLetter)).toBeLessThanOrEqual(4);
    // Guard the guard: if these two ever stop diverging, the test is vacuous
    // again and should be moved to a different sample point.
    expect(dist(wholeLetter, perBar)).toBeGreaterThan(20);
  });
});

describe("index.html cannot drift from the generator", () => {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8");

  // Driven off the guard's own expectation list rather than a second copy of
  // it. A hand-maintained list here would drift from the guard, which is the
  // exact failure mode this whole file exists to prevent — and every value in
  // that list is DERIVED from splash-art.mjs, so none of it checks a literal
  // against itself.
  it.each(expectedInIndexHtml().map(([what, needle]) => [what, needle]))(
    "index.html still carries the %s",
    (_what, needle) => {
      expect(html).toContain(needle);
    },
  );

  it("links one startup image per device configuration", () => {
    for (const d of DEVICES) {
      const media =
        `(device-width: ${d.w}px) and (device-height: ${d.h}px) and ` +
        `(-webkit-device-pixel-ratio: ${d.dpr})`;
      expect(html).toContain(media);
      expect(html).toContain(`/splash/splash-${d.w * d.dpr}x${d.h * d.dpr}.png`);
    }
  });
});
