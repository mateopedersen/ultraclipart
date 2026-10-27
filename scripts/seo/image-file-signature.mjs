import { openSync, readSync, closeSync } from 'node:fs';
import { extname } from 'node:path';
export function imageFileSignature(path) {
  const file = openSync(path, 'r'),
    bytes = Buffer.alloc(4096);
  let length;
  try {
    length = readSync(file, bytes, 0, bytes.length, 0);
  } finally {
    closeSync(file);
  }
  const data = bytes.subarray(0, length),
    extension = extname(path).toLowerCase();
  const text = data.toString('utf8');
  const matches = {
    '.webp': data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP',
    '.png': data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    '.jpg': data[0] === 255 && data[1] === 216 && data[2] === 255,
    '.jpeg': data[0] === 255 && data[1] === 216 && data[2] === 255,
    '.gif': /^GIF8[79]a/.test(data.toString('ascii', 0, 6)),
    '.svg': /<svg[\s>]/i.test(text) && !/^\s*<!doctype html|<html[\s>]/i.test(text),
    '.avif':
      data.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(data.toString('ascii', 8, 32)),
  };
  return { extension, valid: matches[extension] ?? false };
}
