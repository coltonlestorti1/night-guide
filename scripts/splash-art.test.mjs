/**
 * Tests for the iOS launch-screen art.
 *
 * These are not cosmetic checks. The startup PNG and the inline splash in
 * index.html are two renderings of one design, and iOS shows the PNG and then
 * hands the screen to the HTML — so any disagreement between them appears as
 * the mark jumping, exactly where the blank white screen used to be. That is
 * the property under test.
 *
 * The mark is a single 270-degree arc with round caps — no track behind it and
 * nothing inside it. The assertions below exist because the earlier mark
 * shipped two defects that passed a typecheck, the build, AND a visual glance
 * at one image: art clipped by a too-small box, and a gradient that resolved
 * per shape. Both were invisible except in the one frame nobody looked at.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BG,
  PURPLE,
  LAYOUT,
  MARK_BOX,
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

      // The arc's ink reaches half a stroke beyond its centreline, and its
      // round cap at 12 o'clock reaches exactly as far. This fails if the mark
      // box is ever sized to the centreline and shaves the line's outer edge.
      const expectedTop =
        (L.ringCy - LAYOUT.ringRadius - LAYOUT.arcStroke / 2) * d.dpr;
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

      // The arc is wider than the wordmark, so it sets the horizontal extent.
      const ringOuter = LAYOUT.ringRadius + LAYOUT.arcStroke / 2;
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

  it("draws the arc where it should be, and the GAP where it should not", () => {
    const d = DEVICES.at(-1);
    const img = render(d.w, d.h, d.dpr);
    const L = layout(d.w, d.h);

    // A point on the arc's centreline, `deg` clockwise from 12 o'clock.
    const onCentreline = (deg) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return pixel(
        img,
        Math.round((L.cx + LAYOUT.ringRadius * Math.cos(a)) * d.dpr),
        Math.round((L.ringCy + LAYOUT.ringRadius * Math.sin(a)) * d.dpr),
      );
    };

    // The sweep runs 12 -> 3 -> 6 -> 9 o'clock. Checking only that "some arc
    // exists" would pass for a full ring, so the OPEN quadrant is the load
    // bearing half of this test.
    for (const deg of [0, 45, 90, 180, 270]) {
      expect(onCentreline(deg), `${deg} deg should be on the arc`).toEqual(PURPLE);
    }
    for (const deg of [300, 315, 330]) {
      expect(onCentreline(deg), `${deg} deg should be the gap`).toEqual(BG);
    }
  });

  it("leaves the centre of the mark empty", () => {
    // The E used to sit here. It was removed deliberately (two competing
    // purples, and the arc visibly hugged the letter) — so the emptiness is a
    // decision, not an oversight, and something reappearing here should fail.
    const d = DEVICES.at(-1);
    const img = render(d.w, d.h, d.dpr);
    const L = layout(d.w, d.h);
    const r = LAYOUT.ringRadius - LAYOUT.arcStroke;
    for (const [fx, fy] of [[0, 0], [-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]) {
      expect(
        pixel(
          img,
          Math.round((L.cx + r * fx) * d.dpr),
          Math.round((L.ringCy + r * fy) * d.dpr),
        ),
      ).toEqual(BG);
    }
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
