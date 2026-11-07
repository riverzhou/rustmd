// Shared image helpers: raw bytes → data: URL and magic-byte MIME
// detection. Lives here (not in export.js) so preview.js can inline vault
// images in HTML export without importing export.js — which would create a
// cycle (export.js already imports preview.js). Used by export.js,
// preview.js and selftest.js.

/// Base64 data: URL from raw bytes (chunked: String.fromCharCode.apply
/// on 25 MB of bytes would overflow the call stack).
export function bytesToDataUrl(bytes, mime) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

const ascii = (bytes, start, end) =>
  String.fromCharCode(...bytes.subarray(start, end));

export function guessImageMime(bytes) {
  if (!bytes || bytes.length < 4) return 'application/octet-stream';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45
  ) {
    return 'image/webp';
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return 'image/x-icon';
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  // SVG has no magic number. The backend supplies the extension-derived MIME
  // for vault files; this is the fallback for remote/mock bytes.
  if (bytes.length >= 5) {
    const head = new TextDecoder()
      .decode(bytes.subarray(0, Math.min(bytes.length, 512)))
      .trimStart()
      .toLowerCase();
    if (head.startsWith('<?xml') || head.startsWith('<svg') || head.includes('<svg')) {
      return 'image/svg+xml';
    }
  }
  return 'application/octet-stream';
}
