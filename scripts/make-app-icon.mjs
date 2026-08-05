/**
 * Renders the ENDZ "E" app icon at any size, with no image library.
 *
 * Why hand-rolled: the repo has no vector source for the icon and no
 * rasterizer available (no ImageMagick, no PIL, no librsvg), and upscaling
 * public/icon-512.png to the 1024 Apple requires produced visibly soft edges
 * and a smeared drop shadow — bad on a store listing rendered large.
 *
 * The mark is entirely axis-aligned rectangles on a linear gradient, so every
 * pixel is exact at every size: no anti-aliasing needed, no resampling, no
 * quality loss. PNG encoding is zlib + a CRC table, both in node stdlib.
 *
 * Gradient stops were sampled from the existing icon so this reproduces the
 * shipped art rather than redesigning it (Colton, 2026-08-05: "stick to the
 * E logo for now"). The soft drop shadow under the original E is dropped on
 * purpose — Apple's icon guidance is against baked-in shadows.
 *
 *   node scripts/make-app-icon.mjs <size> <outfile>
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/** Sampled from public/icon-512.png: corners and the anti-diagonal midpoint.
 *  Three stops rather than two — a straight 2-stop lerp lands on #C260BA at
 *  the midpoint where the real art is #BC56B9. */
const STOPS = [
  [0.0, [0x8c, 0x51, 0xed]],
  [0.5, [0xbc, 0x56, 0xb9]],
  [1.0, [0xf9, 0x70, 0x87]],
];

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function gradientAt(t) {
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/**
 * The E, in fractions of the canvas so it scales exactly.
 * Proportions match the original mark; it is re-centred, because the shipped
 * art sits a few pixels right of centre and high.
 */
function bars(S) {
  const barH = 86 / 1024, stemW = 88 / 1024;
  const w = 326 / 1024, midW = 304 / 1024, h = 510 / 1024;
  const x0 = (1 - w) / 2, y0 = (1 - h) / 2, y1 = y0 + h;
  const px = (v) => Math.round(v * S);
  return [
    [px(x0), px(y0), px(x0 + w), px(y0 + barH)],                 // top bar
    [px(x0), px(0.5 - barH / 2), px(x0 + midW), px(0.5 + barH / 2)], // middle bar
    [px(x0), px(y1 - barH), px(x0 + w), px(y1)],                 // bottom bar
    [px(x0), px(y0), px(x0 + stemW), px(y1)],                    // stem
  ];
}

function render(S) {
  const rects = bars(S);
  // Raw scanlines: one filter byte (0 = None) then RGB triples.
  const raw = Buffer.alloc(S * (1 + S * 3));
  const denom = 2 * (S - 1);
  for (let y = 0; y < S; y++) {
    const row = y * (1 + S * 3);
    raw[row] = 0;
    for (let x = 0; x < S; x++) {
      const inE = rects.some(([a, b, c, d]) => x >= a && x < c && y >= b && y < d);
      const [r, g, bl] = inE ? [255, 255, 255] : gradientAt((x + y) / denom);
      const o = row + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = bl;
    }
  }
  return raw;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(S) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  // 8-bit, colour type 2 (truecolour RGB). NO alpha channel — App Store icons
  // are rejected outright if one is present.
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(S), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const size = Number(process.argv[2] || 1024);
const out = process.argv[3] || `icon-${size}.png`;
writeFileSync(out, png(size));
console.log(`wrote ${out} (${size}x${size}, no alpha)`);
