self.onmessage = (
  event: MessageEvent<{
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    tolerance: number;
  }>,
) => {
  const { pixels, width, height, tolerance } = event.data;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096 ||
    !(pixels instanceof Uint8ClampedArray) ||
    pixels.length !== width * height * 4 ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    tolerance > 100
  )
    throw new Error('Invalid background cleanup image.');
  // Only remove a light background connected to an image edge. Interior whites stay intact.
  const count = width * height,
    seen = new Uint8Array(count),
    queue = new Uint32Array(count);
  let head = 0,
    tail = 0,
    removed = 0;
  const eligible = (p: number) => {
    const i = p * 4;
    return (
      pixels[i + 3] > 0 &&
      Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >= 255 - tolerance &&
      Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
        Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) <=
        Math.max(12, tolerance * 0.65)
    );
  };
  const visit = (p: number) => {
    if (!seen[p] && eligible(p)) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    pixels[p * 4 + 3] = 0;
    removed++;
    const x = p % width;
    if (x) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p + width < count) visit(p + width);
  }
  self.postMessage({ pixels, removed }, { transfer: [pixels.buffer] });
};
