// gen-icons.mjs — render the Forge anvil icon to PNGs with zero dependencies.
// Rasterizes the same shapes as icons/icon.svg (defined in a 512 coordinate space),
// supersampled for smooth edges, and writes icon-{512,192,180}.png. Run: node scripts/gen-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG_A = hex('#101a2b'), BG_B = hex('#0a0f18');
const AN_A = hex('#5cf0b0'), AN_B = hex('#23b87f');
const SPARK = hex('#fbbf24'), WHITE = [255, 255, 255];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function inRR(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const dx = Math.min(px - x, x + w - px), dy = Math.min(py - y, y + h - py);
  if (dx < r && dy < r) { const ax = r - dx, ay = r - dy; return ax * ax + ay * ay <= r * r; }
  return true;
}
function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const SPARK_PTS = [[386, 150], [396, 176], [422, 186], [396, 196], [386, 222], [376, 196], [350, 186], [376, 176]];
const HORN = [[104, 214], [176, 192], [176, 238], [104, 238]];
const WAIST = [[236, 238], [312, 238], [296, 300], [252, 300]];

// src-over compositing onto an opaque base color
function over(base, src, sa) { return [lerp(base[0], src[0], sa), lerp(base[1], src[1], sa), lerp(base[2], src[2], sa)]; }

// sample one point in 512-space → [r,g,b,a]
function sample(sx, sy) {
  if (!inRR(sx, sy, 0, 0, 512, 512, 112)) return [0, 0, 0, 0];
  let c = mix(BG_A, BG_B, Math.max(0, Math.min(1, (sx + sy) / 1024)));
  if (inPoly(sx, sy, SPARK_PTS)) c = over(c, SPARK, 0.9);
  const at = Math.max(0, Math.min(1, (sy - 192) / 164));
  const anv = mix(AN_A, AN_B, at);
  if (inPoly(sx, sy, HORN) || inRR(sx, sy, 168, 192, 214, 46, 8) || inPoly(sx, sy, WAIST) || inRR(sx, sy, 164, 300, 220, 40, 10)) c = anv;
  if (inRR(sx, sy, 140, 340, 268, 16, 8)) c = over(c, anv, 0.85);
  if (inRR(sx, sy, 178, 200, 150, 8, 4)) c = over(c, WHITE, 0.3);
  return [c[0], c[1], c[2], 255];
}

function render(size, ss = 3) {
  const px = Buffer.alloc(size * size * 4);
  const scale = 512 / size;
  const n = ss * ss;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, cov = 0;
    for (let oy = 0; oy < ss; oy++) for (let ox = 0; ox < ss; ox++) {
      const sx = (x + (ox + 0.5) / ss) * scale, sy = (y + (oy + 0.5) / ss) * scale;
      const s = sample(sx, sy);
      const k = s[3] / 255; // coverage of this subsample
      r += s[0] * k; g += s[1] * k; b += s[2] * k; cov += k;
    }
    const i = (y * size + x) * 4;
    px[i] = cov > 0 ? Math.round(r / cov) : 0;
    px[i + 1] = cov > 0 ? Math.round(g / cov) : 0;
    px[i + 2] = cov > 0 ? Math.round(b / cov) : 0;
    px[i + 3] = Math.round((cov / n) * 255);
  }
  return px;
}

// ---- minimal PNG encoder ----
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePNG(size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [512, 192, 180]) {
  const buf = encodePNG(size, render(size, size <= 192 ? 4 : 3));
  const name = size === 180 ? 'icon-180.png' : `icon-${size}.png`;
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('wrote', name, buf.length, 'bytes');
}
