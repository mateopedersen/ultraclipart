import type { PixelImage } from './types';
import { contourPaths } from './contour';
/** Conservative monochrome tracing. Never embeds a bitmap or claims to reconstruct colored artwork. */
export function traceLineArt(image: PixelImage, threshold = 128) {
  const { width, height, data } = image;
  if (width * height > 4_200_000)
    throw new Error(
      'Line tracing supports up to 4.2 million pixels. Use a smaller simple drawing.',
    );
  const mask = new Uint8Array(width * height);
  let visible = 0,
    chromatic = 0,
    ink = 0,
    error = 0;
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4,
      alpha = data[p + 3] / 255;
    if (alpha > 0.25) {
      visible++;
      if (
        Math.max(data[p], data[p + 1], data[p + 2]) - Math.min(data[p], data[p + 1], data[p + 2]) >
        18
      )
        chromatic++;
    }
    const gray =
      (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) * alpha + 255 * (1 - alpha);
    const black = gray < threshold;
    if (black) {
      mask[i] = 255;
      ink++;
    }
    error += Math.abs(gray - (black ? 0 : 255));
  }
  const meanError = error / mask.length;
  if (!visible || !ink || chromatic / visible > 0.01 || meanError > 10)
    throw new Error(
      'This image is not clean monochrome line art. Create and refine a coloring page first; detailed color or gray shading is not preserved by this trace.',
    );
  const paths = contourPaths(mask, width, height),
    pathData = paths.join('');
  if (paths.length > 3000 || pathData.length > 1500000)
    throw new Error(
      'This trace is too complex to edit reliably. Reduce line noise before tracing.',
    );
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width / 600}in" height="${height / 600}in"><title>Monochrome line-art trace, 600 PPI source scale</title><path fill="#000000" fill-rule="evenodd" d="${pathData}"/></svg>`,
    paths: paths.length,
    meanError: Math.round(meanError * 100) / 100,
    inkPercent: Math.round((ink / mask.length) * 100),
  };
}
