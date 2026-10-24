import type { EditorDocument } from '../editor/model';

export interface AiPdfOptions {
  paper?: 'letter' | 'a4';
  /** Only set after the visitor explicitly chooses a larger, lossless PDF. */
  allowLargePdf?: boolean;
}
export interface AiPdfResult {
  blob: Blob;
  widthPixels: number;
  heightPixels: number;
  printWidthInches: number;
  printHeightInches: number;
  effectivePpi: number;
  paper: 'letter' | 'a4';
}
/** A real 300-pixel-per-inch placement, not a resolution label or an upscale. */
export function aiPdfLayout(width: number, height: number, paper: 'letter' | 'a4' = 'letter') {
  if (![width, height].every((n) => Number.isInteger(n) && n > 0 && n <= 4096))
    throw new Error('PDF export needs a valid image with each side at most 4096 pixels.');
  if (paper !== 'letter' && paper !== 'a4') throw new Error('Choose US Letter or A4 paper.');
  const pageWidth = paper === 'letter' ? 612 : 595.2756;
  const pageHeight = paper === 'letter' ? 792 : 841.8898;
  const canvasWidth = (pageWidth / 72 - 1) * 300;
  const canvasHeight = (pageHeight / 72 - 1) * 300;
  const scale = Math.min(1, canvasWidth / width, canvasHeight / height);
  return {
    canvasWidth,
    canvasHeight,
    scale,
    x: (canvasWidth - width * scale) / 2,
    y: (canvasHeight - height * scale) / 2,
    printWidthInches: (width * scale) / 300,
    printHeightInches: (height * scale) / 300,
    effectivePpi: 300 / scale,
  };
}
/** Reuse Studio's actual CMYK conversion, exact alpha mask and default 1 MB output guard. */
export async function createAiPdf(image: Blob, options: AiPdfOptions = {}): Promise<AiPdfResult> {
  if (options.allowLargePdf !== undefined && typeof options.allowLargePdf !== 'boolean')
    throw new Error('The larger-PDF option must be explicitly enabled.');
  const [{ studioImageBlob }, { registerLocalImage }, { blankDocument }, { exportPdf }] =
    await Promise.all([
      import('./transfer'),
      import('../editor/raster'),
      import('../editor/creation'),
      import('../editor/pdf'),
    ]);
  const normalized = await studioImageBlob(image);
  const layer = await registerLocalImage(new Uint8Array(await normalized.arrayBuffer()));
  const paper = options.paper ?? 'letter';
  const layout = aiPdfLayout(layer.width, layer.height, paper);
  const doc: EditorDocument = blankDocument('my-clipart', layout.canvasWidth, layout.canvasHeight);
  doc.version = 2;
  doc.print = { paper, orientation: 'portrait', margin: 0.5, scale: 'fit' };
  doc.exportPreferences = {
    width: layer.width,
    quality: 1,
    allowLargePdf: options.allowLargePdf === true,
    size: 'original',
  };
  layer.label = 'AI clipart';
  layer.x = layout.x;
  layer.y = layout.y;
  layer.scaleX = layer.scaleY = layout.scale;
  doc.layers = [layer];
  const blob = await exportPdf(doc);
  return {
    blob,
    paper,
    widthPixels: layer.width,
    heightPixels: layer.height,
    printWidthInches: layout.printWidthInches,
    printHeightInches: layout.printHeightInches,
    effectivePpi: layout.effectivePpi,
  };
}
export async function downloadAiPdf(image: Blob, name = 'ai-clipart', options: AiPdfOptions = {}) {
  const result = await createAiPdf(image, options);
  const { download } = await import('../editor/svg');
  const basename =
    String(name)
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 90) || 'ai-clipart';
  download(result.blob, `${basename}.pdf`);
  return result;
}
