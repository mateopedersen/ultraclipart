import { readFileSync } from 'node:fs';
import { parsePath } from '../../src/editor/pdf-math.ts';

// One path interpreter governs browser editing and production PDF geometry.
// Normalize only the path vocabulary; preserve named groups and all actual shapes.
const source = readFileSync(0, 'utf8');
if (source.length > 2_000_000) throw new Error('SVG exceeds source limit');
process.stdout.write(
  source.replace(
    /\bd="([^"]*)"/g,
    (_, path) =>
      'd="' +
      parsePath(path)
        .map(
          ({ op, c }) =>
            (op === 'h' ? 'Z' : op.toUpperCase()) +
            c
              .map((n) => {
                if (!Number.isFinite(n)) throw new Error('Invalid path coordinate');
                return String(n);
              })
              .join(' '),
        )
        .join(' ') +
      '"',
  ),
);
