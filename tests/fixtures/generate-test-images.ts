/**
 * Programmatic test image generation.
 *
 * Generates minimal valid PNG buffers with known dimensions so we don't need
 * binary fixture files checked into the repository.
 */

/**
 * Generate a minimal PNG image buffer at the requested pixel dimensions.
 *
 * The PNG spec requires:
 *   1. 8-byte signature
 *   2. IHDR chunk (width × height × 8-bit RGBA)
 *   3. IDAT chunk with deflate-compressed pixel data
 *   4. IEND chunk
 *
 * Uses Node.js built-in `zlib` for deflate so no external deps needed.
 */
import zlib from 'node:zlib';

type RGBAPixel = [number, number, number, number]; // [R, G, B, A]

// Pre-canned CRC32 table (standard PNG polynomial)
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const element of buf) {
    c = crcTable[(c ^ element) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const crcTable: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export function generatePng(
  width: number,
  height: number,
  fill: RGBAPixel = [255, 0, 0, 255] // default: solid red
): Buffer {
  // IHDR: width, height, bit depth (8), colour type (6 = RGBA), 3×0 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // [10], [11], [12] are already 0 (compression, filter, interlace)

  // Raw pixel data: each row = filter byte (0 = None) + RGBA pixels
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const offset = rowOffset + 1 + x * 4;
      rawData[offset] = fill[0]; // R
      rawData[offset + 1] = fill[1]; // G
      rawData[offset + 2] = fill[2]; // B
      rawData[offset + 3] = fill[3]; // A
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflated),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Named test images
// ---------------------------------------------------------------------------

/** 1920×1080 — valid 16:9, above typical min width */
export function valid16x9(): Buffer {
  return generatePng(1920, 1080, [0, 100, 200, 255]);
}

/** 1024×768 — valid 4:3, above typical min width */
export function valid4x3(): Buffer {
  return generatePng(1024, 768, [200, 100, 0, 255]);
}

/** 500×500 — square, rejected when rules expect 16:9 or 4:3 */
export function invalidSquare(): Buffer {
  return generatePng(500, 500, [100, 200, 100, 255]);
}

/** 320×180 — 16:9 ratio but below typical min width of 800 */
export function validRatioSmallWidth(): Buffer {
  return generatePng(320, 180, [200, 200, 0, 255]);
}
