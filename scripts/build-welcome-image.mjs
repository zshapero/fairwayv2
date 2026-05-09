/**
 * Generate the onboarding welcome background as a synthetic PNG.
 *
 * Visual intent: a quieter, more atmospheric variant of the home hero —
 * the same palette but pushed warmer and lighter, as if shot 30 minutes
 * later in the morning. The bottom third fades fully to cream so the
 * tagline + CTA always sit on a solid surface.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const W = 720;
const H = 1280;
const OUT = path.resolve("assets/images/welcome-bg.png");

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
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

const SKY = hexToRgb("#2D5F4A");
const SAGE = hexToRgb("#6F9B82");
const HAZE = hexToRgb("#D9DDC8");
const CREAM = hexToRgb("#FAF6EE");
const SUN = hexToRgb("#E2C28A");

function pixelAt(x, y) {
  const u = x / W;
  const v = y / H;

  // Vertical wash with a sharper top-to-cream descent.
  const veased = easeInOut(v);
  let base;
  if (veased < 0.30) {
    base = mix(SKY, SAGE, veased / 0.30);
  } else if (veased < 0.55) {
    base = mix(SAGE, HAZE, (veased - 0.30) / 0.25);
  } else {
    base = mix(HAZE, CREAM, Math.min(1, (veased - 0.55) / 0.45));
  }

  // Sun glow near the top right, slightly off-centre for editorial feel.
  const sunDx = u - 0.62;
  const sunDy = v - 0.15;
  const sunDist = Math.sqrt(sunDx * sunDx + sunDy * sunDy);
  const sunStrength = Math.max(0, 1 - sunDist / 0.5);
  base = mix(base, SUN, sunStrength * sunStrength * 0.32);

  // Distant ridge silhouette, very low contrast.
  const ridgeY = 0.50 + 0.04 * Math.sin(u * Math.PI * 1.6 + 0.8);
  if (v > ridgeY && v < ridgeY + 0.22) {
    const t = (v - ridgeY) / 0.22;
    base = mix(base, mix(SAGE, SKY, 0.35), 0.18 * (1 - t));
  }

  // Bottom 30% fades fully to cream so the CTA sits on solid surface.
  if (v > 0.62) {
    const fadeT = (v - 0.62) / 0.38;
    base = mix(base, CREAM, fadeT * fadeT);
  }

  // Quantize to keep the PNG small.
  base.r = Math.round(base.r / 2) * 2;
  base.g = Math.round(base.g / 2) * 2;
  base.b = Math.round(base.b / 2) * 2;

  return [
    Math.max(0, Math.min(255, Math.round(base.r))),
    Math.max(0, Math.min(255, Math.round(base.g))),
    Math.max(0, Math.min(255, Math.round(base.b))),
  ];
}

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
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const raw = Buffer.alloc(H * (1 + W * 3));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0;
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
