/** Pixel-edge contours, with collinear vertices removed. This is a cut guide, not artwork tracing. */
export function contourPaths(mask: Uint8Array, width: number, height: number): string[] {
  const edges = new Map<number, number[]>(),
    stride = width + 1;
  let edgeCount = 0;
  const add = (a: number, b: number) => {
    if (++edgeCount > 1000000)
      throw new Error('This contour has too much edge noise. Clean up the mask before exporting.');
    const list = edges.get(a) || [];
    list.push(b);
    edges.set(a, list);
  };
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] >= 128;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (inside(x, y)) {
        const p = y * stride + x;
        if (!inside(x, y - 1)) add(p, p + 1);
        if (!inside(x + 1, y)) add(p + 1, p + stride + 1);
        if (!inside(x, y + 1)) add(p + stride + 1, p + stride);
        if (!inside(x - 1, y)) add(p + stride, p);
      }
  const paths: string[] = [];
  let vertices = 0;
  while (edges.size) {
    const start = edges.keys().next().value!,
      points: number[] = [start];
    let current = start;
    do {
      const next = edges.get(current);
      if (!next?.length) break;
      const target = next.pop()!;
      if (!next.length) edges.delete(current);
      current = target;
      points.push(current);
      if (++vertices > 2_000_000)
        throw new Error(
          'Cut contour is too complex. Increase cleanup or use a simpler silhouette.',
        );
    } while (current !== start);
    if (points.length < 4) continue;
    const simple = points.filter((p, i) => {
      if (i === 0 || i === points.length - 1) return true;
      const a = points[i - 1],
        b = points[i + 1];
      return !(
        (a % stride === p % stride && b % stride === p % stride) ||
        (Math.floor(a / stride) === Math.floor(p / stride) &&
          Math.floor(b / stride) === Math.floor(p / stride))
      );
    });
    paths.push(
      simple.map((p, i) => `${i ? 'L' : 'M'}${p % stride} ${Math.floor(p / stride)}`).join('') +
        'Z',
    );
  }
  return paths;
}
