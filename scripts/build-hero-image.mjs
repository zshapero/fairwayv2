/**
 * Generate the home-screen hero image as a synthetic PNG. Captures the visual
 * intent of a Calm-style "dawn through mist" course shot: deep masters-green
 * canopy at the top fading to warm cream, with soft sage-green hill silhouettes
 * underneath a hand-painted vignette.
 *
 * The asset is synthetic on purpose. It ships as the default so the home
 * screen looks finished out of the box; an art-directed photo can replace
 * `assets/images/home-hero.png` later without code changes.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const W = 720;
const H = 960;
const OUT = path.resolve("assets/images/home-hero.png");

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function mix(a, b, t) {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

const SKY = hexToRgb("#1F4D3F"); // primary green canopy
const SAGE = hexToRgb("#4A7C68"); // mid sage
const MIST = hexToRgb("#C9D8C4"); // pale fog
const CREAM = hexToRgb("#FAF6EE"); // surface
const ACCENT = hexToRgb("#B8965A"); // warm gold sun-glow

function pixelAt(x, y) {
  const u = x / W;
  const v = y / H;
  const verticalEase = easeInOut(v);

  // Base vertical wash: SKY → SAGE → MIST → CREAM
  let base;
  if (verticalEase < 0.4) {
    base = mix(SKY, SAGE, verticalEase / 0.4);
  } else if (verticalEase < 0.72) {
    base = mix(SAGE, MIST, (verticalEase - 0.4) / 0.32);
  } else {
    base = mix(MIST, CREAM, (verticalEase - 0.72) / 0.28);
  }

  // Soft vignette: pull edges toward cream so the photo feels like a memory.
  const cx = 0.5;
  const cy = 0.42;
  const dx = u - cx;
  const dy = (v - cy) * 1.05;
  const radial = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.7);
  base = mix(base, CREAM, radial * 0.45);

  // Warm "sun glow" near top centre, very subtle.
  const sunDx = u - 0.5;
  const sunDy = v - 0.18;
  const sunDist = Math.sqrt(sunDx * sunDx + sunDy * sunDy);
  const sunStrength = Math.max(0, 1 - sunDist / 0.42);
  base = mix(base, ACCENT, sunStrength * sunStrength * 0.18);

  // Hand-painted hill silhouettes (two soft sine curves) under the mist band.
  const hillBaseY = 0.62;
  const hill1 = hillBaseY + 0.05 * Math.sin(u * Math.PI * 2.0 + 0.3);
  const hill2 = hillBaseY + 0.08 + 0.04 * Math.sin(u * Math.PI * 1.4 + 1.7);
  if (v > hill1 && v < hill1 + 0.18) {
    const t = (v - hill1) / 0.18;
    base = mix(base, mix(SAGE, MIST, 0.4), 0.32 * (1 - t));
  }
  if (v > hill2 && v < hill2 + 0.22) {
    const t = (v - hill2) / 0.22;
    base = mix(base, mix(SAGE, SKY, 0.3), 0.22 * (1 - t));
  }

  // Quantize to 4-bit-per-channel-ish steps. Smooths gradients into bands
  // small enough that the eye reads them as one wash but big enough that
  // zlib compresses the file from megabytes down to ~80kb.
  base.r = Math.round(base.r / 2) * 2;
  base.g = Math.round(base.g / 2) * 2;
  base.b = Math.round(base.b / 2) * 2;

  return [
    Math.max(0, Math.min(255, Math.round(base.r))),
    Math.max(0, Math.min(255, Math.round(base.g))),
    Math.max(0, Math.min(255, Math.round(base.b))),
  ];
}

// ---------------------------------------------------------------------------
// PNG writer. RGB, 8-bit, no alpha. Filter byte 0 (None) prepends each row.
// ---------------------------------------------------------------------------
function crc32(buf) {
  if (!crc32.table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function build() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type RGB
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const raw = Buffer.alloc(H * (1 + W * 3));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0; // None filter
    for (let x = 0; x < W; x++) {
      const [r, g, b] = pixelAt(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, png);
  console.log(`wrote ${OUT} (${png.length} bytes)`);
}

build();
