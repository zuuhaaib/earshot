// Draws earshot's icon, splash mark and paper textures straight to PNG.
// No image libraries: a tiny rasteriser with supersampling, plus zlib from Node.
//   node scripts/make-assets.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
mkdirSync(join(assets, 'tex'), { recursive: true });

// ---- PNG encoding -------------------------------------------------------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
function png(w, h, rgba) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- rasteriser ---------------------------------------------------------
// paint(u, v) gets coordinates in 0..1 and returns [r,g,b,a] (a in 0..1) or null.
function render(size, paint, ss = 3) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = paint((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          if (c) {
            r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
          }
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        out[i] = Math.round(r / a); out[i + 1] = Math.round(g / a); out[i + 2] = Math.round(b / a);
        out[i + 3] = Math.round((a / (ss * ss)) * 255);
      }
    }
  }
  return out;
}
const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

const INK = '#1F2A6B', TOMATO = '#F0502F', PAPER = '#F6EFDF', YELLOW = '#FFD23F';

// The mark: a record sliding out of a paper sleeve, with three arcs of sound
// printed on the sleeve. `s` scales the whole mark around the centre.
function mark(u, v, s = 1, mono = false) {
  const x = (u - 0.5) / s, y = (v - 0.5) / s;
  const col = (c) => (mono ? hex('#000000') : hex(c));
  // sleeve: square rotated a few degrees, sitting left of centre
  const ang = (-7 * Math.PI) / 180;
  const sx = x + 0.075, sy = y - 0.01;
  const rx = sx * Math.cos(ang) + sy * Math.sin(ang);
  const ry = -sx * Math.sin(ang) + sy * Math.cos(ang);
  const half = 0.265;
  const inSleeve = Math.abs(rx) < half && Math.abs(ry) < half;
  if (inSleeve) {
    const edge = Math.min(half - Math.abs(rx), half - Math.abs(ry));
    if (edge < 0.016) return col(INK);
    // arcs of sound, opening to the right
    const ax = rx + 0.15, ay = ry;
    const d = Math.hypot(ax, ay);
    const t = Math.atan2(ay, ax);
    if (Math.abs(t) < 0.95) {
      for (const [r, w] of [[0.1, 0.022], [0.19, 0.022], [0.28, 0.022]]) {
        if (Math.abs(d - r) < w) return col(r === 0.19 ? TOMATO : INK);
      }
    }
    if (d < 0.04) return col(INK);
    return mono ? null : hex(PAPER);
  }
  // record peeking out to the right
  const dx = x - 0.2, dy = y + 0.005;
  const d = Math.hypot(dx, dy);
  if (d < 0.245) {
    if (d < 0.018) return mono ? null : hex(PAPER);
    if (d < 0.09) return col(YELLOW);
    if (!mono && (Math.abs(d - 0.13) < 0.004 || Math.abs(d - 0.17) < 0.004 || Math.abs(d - 0.21) < 0.004)) return hex('#3A478F');
    return col(INK);
  }
  return null;
}

writeFileSync(join(assets, 'icon.png'), png(1024, 1024, render(1024, (u, v) => mark(u, v, 1.04) ?? hex(TOMATO))));
writeFileSync(join(assets, 'favicon.png'), png(64, 64, render(64, (u, v) => mark(u, v, 1.04) ?? hex(TOMATO), 4)));
writeFileSync(join(assets, 'splash-icon.png'), png(600, 600, render(600, (u, v) => mark(u, v, 1.04))));
writeFileSync(join(assets, 'android-icon-foreground.png'), png(1024, 1024, render(1024, (u, v) => mark(u, v, 0.72))));
writeFileSync(join(assets, 'android-icon-background.png'), png(256, 256, render(256, () => hex(TOMATO), 1)));
writeFileSync(join(assets, 'android-icon-monochrome.png'), png(1024, 1024, render(1024, (u, v) => mark(u, v, 0.72, true))));

// ---- textures (all tile seamlessly) -------------------------------------
let seed = 20261112;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// grain: photocopier speckle. Mostly faint, with the odd fleck of toner.
{
  const n = 192, buf = Buffer.alloc(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const r = rnd();
    const a = r > 0.994 ? 70 + rnd() * 60 : r > 0.93 ? 22 + rnd() * 22 : rnd() * 16;
    buf.set([31, 42, 107, Math.round(a)], i * 4);
  }
  writeFileSync(join(assets, 'tex', 'grain.png'), png(n, n, buf));
}
// graph paper
{
  const n = 24, buf = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (x === 0 || y === 0) buf.set([31, 42, 107, 46], (y * n + x) * 4);
  writeFileSync(join(assets, 'tex', 'grid.png'), png(n, n, buf));
}
// ruled notebook lines
{
  const w = 8, h = 28, buf = Buffer.alloc(w * h * 4);
  for (let x = 0; x < w; x++) buf.set([31, 42, 107, 60], ((h - 1) * w + x) * 4);
  writeFileSync(join(assets, 'tex', 'ruled.png'), png(w, h, buf));
}
// halftone dots
{
  const n = 14;
  writeFileSync(
    join(assets, 'tex', 'dots.png'),
    png(n, n, render(n, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? [31, 42, 107, 0.3] : null), 4)),
  );
}
console.log('assets written');
