/* Draws the MOKI face into a pixel buffer and writes a real PNG with zlib.
   No image library, no external asset - keeps the project self-contained. */
const fs = require('fs');
const zlib = require('zlib');
const OUT = 'C:/Users/gshet/OneDrive/Pictures/Screenshots/moki/public/icons/';

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // colour type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;   // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* draw the MOKI mark: rounded purple field, two eyes, a gold smile */
function draw(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size;
  const pad = maskable ? S * 0.10 : 0;      // safe zone for maskable icons
  const inner = S - pad * 2;

  const px = (x, y, r, g, b, a) => {
    const i = (y * S + x) * 4;
    const na = a / 255;
    buf[i]     = Math.round(buf[i]     * (1 - na) + r * na);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - na) + g * na);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - na) + b * na);
    buf[i + 3] = Math.min(255, buf[i + 3] + a);
  };

  // background: rounded square with a vertical gradient
  const radius = inner * 0.24;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const lx = x - pad, ly = y - pad;
      if (lx < 0 || ly < 0 || lx >= inner || ly >= inner) continue;
      // rounded corner test
      const cx = Math.min(lx, inner - 1 - lx), cy = Math.min(ly, inner - 1 - ly);
      if (cx < radius && cy < radius) {
        const dx = radius - cx, dy = radius - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      const t = ly / inner;
      px(x, y,
        Math.round(124 + (58 - 124) * t),
        Math.round(77 + (26 - 77) * t),
        Math.round(255 + (150 - 255) * t), 255);
    }
  }

  const cxm = S / 2, cym = S / 2;
  const disc = (ox, oy, r, cr, cg, cb) => {
    for (let y = Math.floor(oy - r - 1); y <= oy + r + 1; y++) {
      for (let x = Math.floor(ox - r - 1); x <= ox + r + 1; x++) {
        if (x < 0 || y < 0 || x >= S || y >= S) continue;
        const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
        if (d <= r - 0.7) px(x, y, cr, cg, cb, 255);
        else if (d <= r + 0.5) px(x, y, cr, cg, cb, Math.round(255 * (r + 0.5 - d)));
      }
    }
  };

  // eyes
  const eyeR = inner * 0.085;
  disc(cxm - inner * 0.16, cym - inner * 0.10, eyeR, 255, 255, 255);
  disc(cxm + inner * 0.16, cym - inner * 0.10, eyeR, 255, 255, 255);
  disc(cxm - inner * 0.145, cym - inner * 0.08, eyeR * 0.5, 34, 32, 58);
  disc(cxm + inner * 0.175, cym - inner * 0.08, eyeR * 0.5, 34, 32, 58);

  // smile: a gold arc
  const smileR = inner * 0.20, thick = inner * 0.055;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cxm, dy = y + 0.5 - (cym + inner * 0.045);
      const d = Math.hypot(dx, dy);
      if (dy < 0) continue;                       // lower half only
      const off = Math.abs(d - smileR);
      if (off <= thick / 2) px(x, y, 255, 201, 60, 255);
      else if (off <= thick / 2 + 1) px(x, y, 255, 201, 60, Math.round(255 * (thick / 2 + 1 - off)));
    }
  }
  return buf;
}

fs.mkdirSync(OUT, { recursive: true });
/* render at 3x and box-filter down - clean edges without a graphics library */
function downsample(src, big, out) {
  const f = big / out;
  const dst = Buffer.alloc(out * out * 4);
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = Math.floor(y * f); sy < (y + 1) * f; sy++) {
        for (let sx = Math.floor(x * f); sx < (x + 1) * f; sx++) {
          const i = (sy * big + sx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++;
        }
      }
      const o = (y * out + x) * 4;
      dst[o] = Math.round(r / n); dst[o + 1] = Math.round(g / n);
      dst[o + 2] = Math.round(b / n); dst[o + 3] = Math.round(a / n);
    }
  }
  return dst;
}

[[192, false], [512, false], [512, true]].forEach(([size, maskable]) => {
  const name = maskable ? 'moki-maskable-512.png' : 'moki-' + size + '.png';
  const SS = 3;
  const data = png(size, downsample(draw(size * SS, maskable), size * SS, size));
  fs.writeFileSync(OUT + name, data);
  console.log(name, data.length + ' bytes');
});
