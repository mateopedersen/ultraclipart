/** Read dimensions before decoding a user file; SVG and animated inputs use separate workflows. */
export function localImageHeader(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 4_000_000)
    throw new Error('Choose a PNG or WebP up to 4 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    text = (i: number, n: number) => String.fromCharCode(...bytes.subarray(i, i + n));
  let width = 0,
    height = 0,
    mime = '';
  if (bytes.length > 32 && bytes[0] === 137 && text(1, 3) === 'PNG' && text(12, 4) === 'IHDR') {
    mime = 'image/png';
    width = view.getUint32(16);
    height = view.getUint32(20);
    for (let pos = 8; pos + 12 <= bytes.length;) {
      const size = view.getUint32(pos);
      if (text(pos + 4, 4) === 'acTL')
        throw new Error('Use a still PNG rather than an animated image.');
      if (size > bytes.length - pos - 12) throw new Error('The PNG file is incomplete.');
      pos += size + 12;
    }
  } else if (bytes.length > 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    mime = 'image/webp';
    const kind = text(12, 4);
    if (kind === 'VP8X') {
      if (bytes[20] & 2) throw new Error('Use a still WebP rather than an animation.');
      width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536;
      height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536;
    } else if (kind === 'VP8L' && bytes[20] === 47) {
      width = 1 + bytes[21] + ((bytes[22] & 63) << 8);
      height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10);
    } else if (kind === 'VP8 ' && text(23, 3) === '\x9d\x01\x2a') {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    }
  }
  if (!mime || !width || !height || width > 4096 || height > 4096)
    throw new Error('Use a valid, still PNG or WebP with each side at most 4096 pixels.');
  return { width, height, mime };
}
