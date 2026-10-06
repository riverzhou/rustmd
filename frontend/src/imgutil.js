// Shared image helpers: raw bytes → data: URL and magic-byte MIME
// detection. Moved out of export.js (and de-duplicated against the
// selftest's private copy) so preview.js can inline vault images in HTML
// export without importing export.js — which would create a cycle
// (export.js already imports preview.js).

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

export function guessImageMime(bytes) {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length > 5 && bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (
    bytes.length > 11 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45
  )
    return 'image/webp';
  if (bytes.length > 3 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  return 'application/octet-stream';
}
