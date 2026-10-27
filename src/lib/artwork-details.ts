type ArtworkFacts = {
  id: string;
  style: string;
  visualStyle?: string;
  width: number;
  height: number;
  productionMethod?: string;
  layered?: boolean;
  pdfPrint?: { width: number; height: number; ppi: number; pagePoints: number[] };
};

const techniques: [RegExp, string][] = [
  [/3d/, '3D illustration'],
  [/watercolor/, 'Watercolor'],
  [/colored-pencil/, 'Colored pencil'],
  [/crayon/, 'Crayon illustration'],
  [/botanical/, 'Botanical illustration'],
  [/gouache/, 'Gouache'],
  [/ink-wash/, 'Ink wash'],
  [/engraving/, 'Engraving'],
  [/charcoal/, 'Charcoal drawing'],
  [/fine-line|line-art|outline/, 'Line art'],
  [/linocut/, 'Linocut'],
  [/dotwork|stipple/, 'Stipple illustration'],
  [/paper-cut|papercut|cut-paper|papercraft|paper-craft/, 'Paper craft'],
  [/clay|ceramic|porcelain/, 'Sculpted illustration'],
  [/embroidery|felt|knitted|crochet|amigurumi/, 'Textile illustration'],
  [/carved-wood|wooden/, 'Carved wood illustration'],
  [/paper-quilling/, 'Paper quilling illustration'],
  [/airbrush/, 'Airbrush illustration'],
  [/oil-painting/, 'Oil painting illustration'],
  [/digital-graphic|digital-painting|lineless/, 'Digital illustration'],
  [/realistic/, 'Realistic illustration'],
  [/pastel/, 'Pastel'],
  [/stained-glass|mosaic/, 'Decorative glass'],
  [/pixel-art/, 'Pixel art'],
  [/low-poly|geometric/, 'Geometric illustration'],
  [/storybook/, 'Storybook illustration'],
  [/cartoon|kawaii/, 'Cartoon illustration'],
  [/screenprint|risograph/, 'Print illustration'],
  [/silhouette/, 'Silhouette'],
];

export function artworkDetails(item: ArtworkFacts) {
  const technique = techniques.find(([pattern]) => pattern.test(item.id))?.[1];
  const style =
    item.visualStyle?.trim() ||
    technique ||
    (item.style === 'Color' ? 'Full-color illustration' : item.style);
  const aiGenerated = item.productionMethod === 'generated-raster';
  const generatedOrigin = 'Catalog artwork';
  const originDescription = 'Source illustration retained in the UltraClipart collection.';
  const inches = (px: number) => (px / 300).toFixed(2);
  const centimeters = (px: number) => ((px / 300) * 2.54).toFixed(1);
  return {
    style,
    aiGenerated,
    origin: generatedOrigin,
    originDescription,
    orientation:
      item.width === item.height ? 'Square' : item.width > item.height ? 'Landscape' : 'Portrait',
    printInches: item.pdfPrint
      ? `${(item.pdfPrint.pagePoints[0] / 72).toFixed(2)} × ${(item.pdfPrint.pagePoints[1] / 72).toFixed(2)} in`
      : `${inches(item.width)} × ${inches(item.height)} in`,
    printCentimeters: item.pdfPrint
      ? `${((item.pdfPrint.pagePoints[0] / 72) * 2.54).toFixed(1)} × ${((item.pdfPrint.pagePoints[1] / 72) * 2.54).toFixed(1)} cm`
      : `${centimeters(item.width)} × ${centimeters(item.height)} cm`,
    pdfPpi: item.pdfPrint?.ppi ?? null,
    printPixels: item.pdfPrint
      ? `${item.pdfPrint.width.toLocaleString('en-US')} × ${item.pdfPrint.height.toLocaleString('en-US')} px`
      : null,
    editing: item.layered
      ? 'Edit the source’s individual vector layers, colors and shapes in Clipart Studio.'
      : 'Opens as one image layer. Resize, rotate, mask and recolor it, or add your own text and artwork. Objects inside the image are not separate vector layers.',
  };
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 100_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
