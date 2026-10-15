/**
 * Tiny, dependency-free image helpers: decode the PNGs Chromium writes, encode ICO and ICNS, and
 * read the pixel size of PNG / JPEG / ICO / ICNS files (for the size check).
 */
import { inflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------- PNG decode

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG to { width, height, rgba }. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8 || (colorType !== 6 && colorType !== 2) || data[12] !== 0) {
        throw new Error(`unsupported PNG (depth ${depth}, colour type ${colorType}, interlace ${data[12]})`);
      }
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 0xff;
    }
  }
  if (bpp === 4) return { width, height, rgba: pixels };
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgba[j] = pixels[i];
    rgba[j + 1] = pixels[i + 1];
    rgba[j + 2] = pixels[i + 2];
    rgba[j + 3] = 255;
  }
  return { width, height, rgba };
}

// ---------------------------------------------------------------------------- ICO

/** 32-bit BMP (DIB) image as stored inside an .ico: bottom-up BGRA plus an all-zero AND mask. */
function icoBitmap({ width, height, rgba }) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(width, 4);
  header.writeInt32LE(height * 2, 8); // XOR + AND masks
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16); // BI_RGB
  const xor = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = ((height - 1 - y) * width + x) * 4;
      xor[d] = rgba[s + 2];
      xor[d + 1] = rgba[s + 1];
      xor[d + 2] = rgba[s];
      xor[d + 3] = rgba[s + 3];
    }
  }
  const maskStride = Math.ceil(width / 32) * 4;
  const and = Buffer.alloc(maskStride * height);
  header.writeUInt32LE(xor.length + and.length, 20);
  return Buffer.concat([header, xor, and]);
}

/**
 * Build an .ico from PNG buffers. Sizes below 256 are stored as classic 32-bit bitmaps (read by
 * every Windows version and by Steam), 256 as PNG.
 * @param {{size:number, png:Buffer}[]} images
 */
export function encodeIco(images) {
  const sorted = [...images].sort((a, b) => a.size - b.size);
  const entries = sorted.map(({ size, png }) => (size >= 256 ? png : icoBitmap(decodePng(png))));
  const dir = Buffer.alloc(6 + 16 * sorted.length);
  dir.writeUInt16LE(0, 0);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(sorted.length, 4);
  let offset = dir.length;
  sorted.forEach(({ size }, i) => {
    const e = 6 + i * 16;
    dir[e] = size >= 256 ? 0 : size;
    dir[e + 1] = size >= 256 ? 0 : size;
    dir[e + 2] = 0;
    dir[e + 3] = 0;
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(entries[i].length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += entries[i].length;
  });
  return Buffer.concat([dir, ...entries]);
}

// ---------------------------------------------------------------------------- ICNS

// PNG-carrying icon types and the pixel size each holds.
const ICNS_TYPES = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];

/** Build a macOS .icns from PNG buffers keyed by pixel size. */
export function encodeIcns(pngBySize) {
  const chunks = [];
  for (const [type, size] of ICNS_TYPES) {
    const png = pngBySize.get(size);
    if (!png) continue;
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    chunks.push(head, png);
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

// ---------------------------------------------------------------------------- size readers

/** Pixel sizes in an image file: [{ width, height }] (several for .ico / .icns). */
export function imageSizes(buf, name = '') {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    const colorType = buf[25];
    return [{ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), alpha: colorType === 6 || colorType === 4 }];
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length) {
      if (buf[off] !== 0xff) throw new Error(`${name}: bad JPEG marker`);
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return [{ width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) }];
      }
      off += 2 + len;
    }
    throw new Error(`${name}: no JPEG frame header`);
  }
  if (buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1) {
    const n = buf.readUInt16LE(4);
    return Array.from({ length: n }, (_, i) => ({ width: buf[6 + i * 16] || 256, height: buf[7 + i * 16] || 256 }));
  }
  if (buf.toString('ascii', 0, 4) === 'icns') {
    const sizes = [];
    let off = 8;
    while (off < buf.length) {
      const type = buf.toString('ascii', off, off + 4);
      const len = buf.readUInt32BE(off + 4);
      const inner = buf.subarray(off + 8, off + len);
      if (inner.length > 24 && inner.readUInt32BE(0) === 0x89504e47) sizes.push({ type, width: inner.readUInt32BE(16), height: inner.readUInt32BE(20) });
      off += len;
    }
    return sizes;
  }
  throw new Error(`${name}: unknown image format`);
}
