// Generates Tauri app icons (PNG + ICO) with zero external dependencies.
// Usage: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'icons');
mkdirSync(outDir, { recursive: true });

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

// pixelAt(x, y) -> [r, g, b, a]
function encodePNG(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      const o = rowStart + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- SDF helpers (normalized [0,1] space, y down) ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function sdRoundBox(x, y, cx, cy, hx, hy, r) {
  const qx = Math.abs(x - cx) - (hx - r);
  const qy = Math.abs(y - cy) - (hy - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSeg(x, y, p1, p2) {
  const px = x - p1[0];
  const py = y - p1[1];
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const t = clamp((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - dx * t, py - dy * t);
}
// coverage from a signed distance in pixel units (1px anti-alias band)
const cov = (sdPx) => clamp(0.5 - sdPx, 0, 1);

// ---------- Icon design ----------
// Rounded gradient square + white document card with folded corner,
// an "M" stroke and three text lines.
function makePixelFn(S) {
  const docX0 = 0.24, docY0 = 0.19, docX1 = 0.76, docY1 = 0.81;
  const fold = 0.16;
  const mTop = 0.28, mBot = 0.54, mL = 0.35, mR = 0.65, mCx = 0.5, mCy = 0.48;
  const mSegs = [
    [[mL, mBot], [mL, mTop]],
    [[mL, mTop], [mCx, mCy]],
    [[mCx, mCy], [mR, mTop]],
    [[mR, mTop], [mR, mBot]],
  ];
  const mRadius = 0.026 * S;
  const lines = [[0.6, 0.34], [0.66, 0.3], [0.72, 0.22]];
  const lineH = 0.016;
  const lineColor = [195, 200, 232];
  const mColor = [67, 56, 202];
  const gradTop = [99, 102, 241];
  const gradBottom = [139, 92, 246];

  return (px, py) => {
    const x = (px + 0.5) / S;
    const y = (py + 0.5) / S;

    const bgSd = sdRoundBox(x, y, 0.5, 0.5, 0.48, 0.48, 0.2) * S;
    const bgCov = cov(bgSd);
    if (bgCov <= 0) return [0, 0, 0, 0];

    let col = mix(gradTop, gradBottom, clamp(y, 0, 1));

    // document card
    const docSd = sdRoundBox(x, y, 0.5, 0.5, 0.26, 0.31, 0.035) * S;
    let docCov = cov(docSd);

    // cut the top-right corner above the fold diagonal
    const cutSd = Math.max(docX1 - fold - x, y - (docY0 + fold), y - docY0 - (x - (docX1 - fold))) * S;
    docCov *= 1 - cov(cutSd);

    col = mix(col, [255, 255, 255], docCov);

    // fold flap: the triangle below the diagonal inside the corner square
    const flapSd = Math.max(docX1 - fold - x, y - (docY0 + fold), x - (docX1 - fold) - (y - docY0)) * S;
    col = mix(col, [217, 221, 243], cov(flapSd));

    // "M" strokes
    let sdM = Infinity;
    for (const [a, b] of mSegs) sdM = Math.min(sdM, sdSeg(x, y, a, b));
    const mCov = clamp(mRadius - sdM * S + 0.5, 0, 1);
    col = mix(col, mColor, mCov);

    // text lines
    for (const [ly, lw] of lines) {
      const sd = sdRoundBox(x, y, 0.5, ly, lw / 2, lineH, lineH) * S;
      col = mix(col, lineColor, cov(sd));
    }

    return [
      Math.round(col[0]),
      Math.round(col[1]),
      Math.round(col[2]),
      Math.round(bgCov * 255),
    ];
  };
}

// ---------- ICO encoding (PNG-compressed entries) ----------
function encodeICO(sizes, pngs) {
  const count = sizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const entries = [];
  const datas = [];
  sizes.forEach((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s;
    e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    entries.push(e);
    datas.push(pngs[i]);
  });
  return Buffer.concat([header, ...entries, ...datas]);
}

const png32 = encodePNG(32, makePixelFn(32));
const png128 = encodePNG(128, makePixelFn(128));
const png256 = encodePNG(256, makePixelFn(256));

writeFileSync(join(outDir, '32x32.png'), png32);
writeFileSync(join(outDir, '128x128.png'), png128);
writeFileSync(join(outDir, '128x128@2x.png'), png256);
writeFileSync(join(outDir, 'icon.png'), png256);

const icoSizes = [16, 24, 32, 48, 64, 256];
const icoPngs = icoSizes.map((s) => encodePNG(s, makePixelFn(s)));
writeFileSync(join(outDir, 'icon.ico'), encodeICO(icoSizes, icoPngs));

console.log('icons written to', outDir);
