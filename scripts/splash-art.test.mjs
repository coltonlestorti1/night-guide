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
  WORDMARK_PATH,
  ORBIT_PERIOD_MS,
  ePath,
  markHeight,
  wordmarkHeight,
} from "./lib/splash-art.mjs";
import { DEVICES, layout, render } from "./make-splash-image.mjs";

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

  it("draws the dot at 12 o'clock, fully inside the canvas", () => {
    const d = DEVICES.at(-1);
    const img = render(d.w, d.h, d.dpr);
    const L = layout(d.w, d.h);
    // Dead centre of the dot must be solid purple, and one pixel above its top
    // edge must be background — i.e. it is whole, not clipped.
    const cx = Math.round(L.dot.x * d.dpr);
    const cy = Math.round(L.dot.y * d.dpr);
    expect(pixel(img, cx, cy)).toEqual([0x6c, 0x45, 0xff]);
    const aboveDot = Math.round((L.dot.y - LAYOUT.dotRadius) * d.dpr) - 2;
    expect(pixel(img, cx, aboveDot)).toEqual(BG);
  });

  it("sweeps the E's gradient across the whole letter, not per bar", () => {
    // The bug this catches: objectBoundingBox gradient units resolve per shape,
    // so an E drawn as four rects gave EACH BAR its own purple-to-pink sweep.
    // Across the letter, the top bar must still be in the purple half and the
    // bottom bar in the pink half.
    const d = DEVICES.at(-1);
    const img = render(d.w, d.h, d.dpr);
    const L = layout(d.w, d.h);
    const sample = (fx, fy) =>
      pixel(
        img,
        Math.round((L.e.x + L.e.w * fx) * d.dpr),
        Math.round((L.e.y + L.e.h * fy) * d.dpr),
      );
    const topBar = sample(0.5, 0.02);
    const bottomBar = sample(0.5, 0.98);
    // Purple end is blue-dominant; pink end is red-dominant.
    expect(topBar[2]).toBeGreaterThan(topBar[0]);
    expect(bottomBar[0]).toBeGreaterThan(bottomBar[2]);
  });
});

describe("index.html cannot drift from the generator", () => {
  const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
  const c = MARK_BOX / 2;

  it.each([
    ["wordmark outlines", WORDMARK_PATH],
    ["E path", ePath(c, c)],
    ["mark box viewBox", `viewBox="0 0 ${MARK_BOX} ${MARK_BOX}"`],
    ["ring", `cx="${c}" cy="${c}" r="${LAYOUT.ringRadius}"`],
    ["dot at 12 o'clock", `cx="${c}" cy="${LAYOUT.dotRadius}" r="${LAYOUT.dotRadius}"`],
    ["orbit origin", `transform-origin: ${c}px ${c}px`],
    ["orbit period", `${ORBIT_PERIOD_MS}ms`],
    ["gap under the mark", `gap: ${LAYOUT.wordmarkGap}px`],
  ])("index.html still carries the %s", (_what, needle) => {
    expect(html).toContain(needle);
  });

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
