type ArtworkFacts = {
  id: string;
  style: string;
  width: number;
  height: number;
  productionMethod?: string;
  layered?: boolean;
};

const techniques: [RegExp, string][] = [
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
  [/embroidery|felt|knitted/, 'Textile illustration'],
  [/realistic/, 'Realistic illustration'],
  [/pastel/, 'Pastel'],
  [/stained-glass|mosaic/, 'Decorative glass'],
  [/pixel-art/, 'Pixel art'],
  [/low-poly|geometric/, 'Geometric illustration'],
  [/storybook/, 'Storybook illustration'],
  [/cartoon|kawaii/, 'Character illustration'],
  [/screenprint|risograph/, 'Print illustration'],
  [/silhouette/, 'Silhouette'],
];

export function artworkDetails(item: ArtworkFacts) {
  const technique = techniques.find(([pattern]) => pattern.test(item.id))?.[1];
  const style = technique ?? (item.style === 'Color' ? 'Full-color illustration' : item.style);
  const aiGenerated = item.productionMethod === 'generated-raster';
  const generatedOrigin = aiGenerated
    ? 'AI-generated artwork'
    : item.productionMethod === 'owner-supplied'
      ? 'Supplied catalog artwork'
      : 'Catalog artwork';
  const originDescription = aiGenerated
    ? 'Created with AI image generation. The source artwork is retained in the collection.'
    : 'Supplied to the UltraClipart collection. AI generation is not documented in this file’s source record.';
  const inches = (px: number) => (px / 300).toFixed(2);
  const centimeters = (px: number) => ((px / 300) * 2.54).toFixed(1);
  return {
    style,
    aiGenerated,
    origin: generatedOrigin,
    originDescription,
    orientation:
      item.width === item.height ? 'Square' : item.width > item.height ? 'Landscape' : 'Portrait',
    printInches: `${inches(item.width)} × ${inches(item.height)} in`,
    printCentimeters: `${centimeters(item.width)} × ${centimeters(item.height)} cm`,
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
