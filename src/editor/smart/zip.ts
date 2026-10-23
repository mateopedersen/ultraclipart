const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(bytes: Uint8Array) {
  let n = 0xffffffff;
  for (const b of bytes) n = table[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
/** Store already compressed image/PDF files without another lossy encoding. */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const chunks: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name),
      bytes = new Uint8Array(await file.blob.arrayBuffer()),
      checksum = crc(bytes),
      header = new Uint8Array(30 + name.length),
      view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    chunks.push(header, bytes);
    const entry = new Uint8Array(46 + name.length),
      v = new DataView(entry.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 0x800, true);
    v.setUint32(16, checksum, true);
    v.setUint32(20, bytes.length, true);
    v.setUint32(24, bytes.length, true);
    v.setUint16(28, name.length, true);
    v.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);
    offset += header.length + bytes.length;
  }
  const length = central.reduce((n, v) => n + v.length, 0),
    end = new Uint8Array(22),
    view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, length, true);
  view.setUint32(16, offset, true);
  return new Blob(
    [...chunks, ...central, end].map((v) => new Uint8Array(v)),
    { type: 'application/zip' },
  );
}
