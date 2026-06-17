// ======================================================================
// Generates GeoTask AI app icons as PNGs — pure Node, no dependencies.
// Run:  node tool/gen_icons.js
// Output:
//   assets/icon/app_icon.png     (1024² teal bg + white pin + teal check)
//   assets/icon/app_icon_fg.png  (1024² transparent + white pin, adaptive/splash)
// ======================================================================
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SIZE = 1024;
const TEAL = [14, 159, 142]; // #0E9F8E
const WHITE = [255, 255, 255];

// ---- geometry helpers -------------------------------------------------
function inCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}
function sign(ax, ay, bx, by, cx, cy) {
  return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
}
function inTriangle(x, y, a, b, c) {
  const d1 = sign(x, y, a[0], a[1], b[0], b[1]);
  const d2 = sign(x, y, b[0], b[1], c[0], c[1]);
  const d3 = sign(x, y, c[0], c[1], a[0], a[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Color (straight RGBA) at a sub-pixel point for the chosen variant.
function colorAt(x, y, transparentBg) {
  const cx = 512;
  const R = transparentBg ? 150 : 215;
  const ccy = transparentBg ? 430 : 420;
  const apexY = transparentBg ? 751 : 880;

  const sideL = [cx - R * 0.866, ccy + R * 0.5];
  const sideR = [cx + R * 0.866, ccy + R * 0.5];
  const apex = [cx, apexY];

  const pin = inCircle(x, y, cx, ccy, R) || inTriangle(x, y, sideL, sideR, apex);
  if (pin) {
    // teal check mark inside the circle
    const p1 = [cx - 0.44 * R, ccy + 0.02 * R];
    const p2 = [cx - 0.12 * R, ccy + 0.34 * R];
    const p3 = [cx + 0.49 * R, ccy - 0.30 * R];
    const hw = 0.12 * R;
    const onCheck =
      distToSeg(x, y, p1[0], p1[1], p2[0], p2[1]) <= hw ||
      distToSeg(x, y, p2[0], p2[1], p3[0], p3[1]) <= hw;
    return onCheck ? [...TEAL, 255] : [...WHITE, 255];
  }
  return transparentBg ? [0, 0, 0, 0] : [...TEAL, 255];
}

// 2x2 supersampling for smooth edges.
function render(transparentBg) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  let o = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[o++] = 0; // filter byte: none
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const oy of [0.25, 0.75]) {
        for (const ox of [0.25, 0.75]) {
          const c = colorAt(x + ox, y + oy, transparentBg);
          r += c[0]; g += c[1]; b += c[2]; a += c[3];
        }
      }
      raw[o++] = Math.round(r / 4);
      raw[o++] = Math.round(g / 4);
      raw[o++] = Math.round(b / 4);
      raw[o++] = Math.round(a / 4);
    }
  }
  return raw;
}

// ---- PNG encoding -----------------------------------------------------
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(raw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- write ------------------------------------------------------------
const outDir = path.join(__dirname, "..", "assets", "icon");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "app_icon.png"), encodePng(render(false)));
fs.writeFileSync(path.join(outDir, "app_icon_fg.png"), encodePng(render(true)));
console.log("Wrote app_icon.png and app_icon_fg.png to assets/icon/");
