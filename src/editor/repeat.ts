import type { EditorDocument } from './model';
export interface RepeatOptions {
  rows: number;
  columns: number;
  gapX: number;
  gapY: number;
  stagger: boolean;
  expand: boolean;
}
export function repeatSelection(
  doc: EditorDocument,
  ids: string[],
  box: { x: number; y: number; width: number; height: number },
  options: RepeatOptions,
): { doc: EditorDocument; ids: string[] } {
  const { rows, columns, gapX, gapY, stagger, expand } = options;
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 1 ||
    columns < 1 ||
    rows > 10 ||
    columns > 10 ||
    ![gapX, gapY].every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)
  )
    throw new Error('Use 1–10 rows and columns, with gaps between 0 and 1,000.');
  const source = doc.layers.filter((l) => ids.includes(l.id) && l.visible && !l.locked);
  if (!source.length) throw new Error('Select unlocked, visible layers to repeat.');
  if (
    source.some(
      (l) =>
        l.group &&
        doc.layers.some(
          (m) => m.group === l.group && (!ids.includes(m.id) || m.locked || !m.visible),
        ),
    )
  )
    throw new Error('Select and unlock every part of a linked group before repeating it.');
  if (doc.layers.length + source.length * (rows * columns - 1) > 500)
    throw new Error('This arrangement would exceed 500 layers. Reduce the rows or columns.');
  const next = structuredClone(doc),
    result = source.map((l) => l.id);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      if (!row && !col) continue;
      const groups = new Map<string, string>();
      for (const layer of source) {
        const copy = structuredClone(layer);
        copy.id = `repeat-${crypto.randomUUID()}`;
        copy.label = layer.label.slice(0, 80) + ' copy';
        copy.x += (col + (stagger && row % 2 ? 0.5 : 0)) * (box.width + gapX);
        copy.y += row * (box.height + gapY);
        if (copy.group) {
          if (!groups.has(copy.group)) groups.set(copy.group, `group-${crypto.randomUUID()}`);
          copy.group = groups.get(copy.group)!;
        }
        next.layers.push(copy);
        result.push(copy.id);
      }
    }
  if (expand) {
    const width = Math.ceil(
      Math.max(
        next.width,
        box.x +
          columns * box.width +
          (columns - 1) * gapX +
          (stagger && rows > 1 ? (box.width + gapX) / 2 : 0),
      ),
    );
    const height = Math.ceil(Math.max(next.height, box.y + rows * box.height + (rows - 1) * gapY));
    if (width > 4096 || height > 4096)
      throw new Error(
        'The repeated layout exceeds a 4,096-pixel canvas. Use smaller artwork or fewer repeats.',
      );
    next.width = width;
    next.height = height;
    next.crop = null;
  }
  return { doc: next, ids: result };
}
