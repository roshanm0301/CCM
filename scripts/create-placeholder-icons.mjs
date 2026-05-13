// =============================================================================
// CCM — Placeholder PWA icon generator
//
// Run once after first npm install:
//   node scripts/create-placeholder-icons.mjs
//
// Creates minimal valid PNG placeholder icons so the Vite PWA plugin
// does not fail during the initial build.
// Frontend Engineer will replace these with real branded assets.
// =============================================================================

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'apps', 'web', 'public', 'icons');

mkdirSync(iconsDir, { recursive: true });

function uint32BE(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = uint32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crc]);
}

// CRC32 implementation
function crc32(buf) {
  const table = makeCRCTable();
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCRCTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function makePNG(width, height, r = 21, g = 101, b = 192) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // colour type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk('IHDR', ihdrData);

  // IDAT — raw pixel data
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw);
  const idat = pngChunk('IDAT', compressed);

  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const sizes = [192, 512];
for (const size of sizes) {
  const filePath = join(iconsDir, `icon-${size}x${size}.png`);
  writeFileSync(filePath, makePNG(size, size));
  console.log(`Created ${filePath}`);
}

console.log('Placeholder icons created. Replace with real branded assets before production.');
