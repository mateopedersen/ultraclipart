const titleCase = (s) => s.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// These are the media named by the owner in the supplied archive, longest first.
const media = [
  'black-and-white-minimal-outline',
  'black-and-white-engraved-illustration',
  'black-and-white-ink-illustration',
  'black-and-white-coloring-outline',
  'black-and-white-ornamental-ink',
  'black-and-white-colored-pencil',
  'black-and-white-graphite',
  'black-and-white-charcoal',
  'black-and-white-linocut',
  'black-and-white-crosshatch',
  'black-and-white-engraving',
  'black-and-white-coloring',
  'black-and-white-drybrush',
  'black-and-white-stipple-ink',
  'black-and-white-stipple',
  'black-and-white-cartoon',
  'black-and-white-woodcut',
  'black-and-white-line-art',
  'black-and-white-brush-ink',
  'botanical-illustration',
  'printed-illustration',
  'painted-illustration',
  'detailed-illustration',
  'digital-illustration',
  'digital-painting',
  'retro-illustration',
  'vintage-storybook',
  'felt-applique',
  'colored-engraving',
  'colored-linocut',
  'colored-charcoal',
  'color-etching',
  'color-stipple',
  'color-stamp',
  'fine-line-color',
  'fabric-collage',
  'layered-paper-cut',
  'layered-paper',
  'paper-quilling',
  'ink-and-wash',
  'wood-marquetry',
  'glazed-ceramic',
  'painted-porcelain',
  'painted-wood',
  'colored-glass',
  'realistic-render',
  'detailed-render',
  'vintage-poster',
  'traditional-tattoo',
  'textured-pastel',
  'soft-3d',
  'chalk-pastel',
  'oil-painting',
  'oil-pastel',
  'palette-knife',
  'colored-pencil',
  'stained-glass',
  'pointillist',
  'risograph',
  'woodblock',
  'pixel-art',
  'comic-book',
  'retro-comic',
  'storybook-digital',
  'cute-cartoon',
  'glossy-gel',
  'acrylic',
  'airbrush',
  'crayon',
  'enamel',
  'embroidery',
  'gouache',
  'mosaic',
  'origami',
  'watercolor',
  'low-poly',
  'linocut',
  'knitted',
  'clay-sculpture',
  'brush-pen',
].sort((a, b) => b.length - a.length);

export function fireLeafMetadata(sourceTopic, id) {
  if (
    !['fire', 'leaf'].includes(sourceTopic) ||
    !id.startsWith(sourceTopic + '-') ||
    !id.endsWith('-clipart')
  )
    throw Error('Unexpected fire or leaf identity: ' + id);
  const originalBody = id.slice(sourceTopic.length + 1, -'-clipart'.length);
  const body = originalBody === 'knitted-campfire' ? 'campfire-knitted' : originalBody;
  const medium = media.find((part) => body.endsWith('-' + part));
  if (!medium) throw Error('Unreviewed illustration medium: ' + id);
  const subject = body.slice(0, -medium.length - 1);
  if (!subject) throw Error('Missing illustrated subject: ' + id);
  const label = sourceTopic === 'leaf' ? 'Leaf' : 'Fire';
  const humanSubject = titleCase(subject).replace(/\b3d\b/i, '3D');
  const humanMedium = titleCase(medium)
    .replace(/\b3d\b/i, '3D')
    .replace(/Black And White/i, 'Black & White');
  const title = `${label} ${humanSubject} (${humanMedium})`;
  const alt = `${humanSubject.toLowerCase()} ${sourceTopic === 'leaf' ? 'leaf illustration' : 'fire illustration'} in ${medium.replaceAll('-', ' ')} style on a transparent background.`;
  const use =
    sourceTopic === 'leaf'
      ? 'Use it in a personal botanical journal, seasonal card or classroom leaf comparison.'
      : 'Use it on a personal campfire page, cozy scene or classroom light and heat activity.';
  const description = `${humanSubject} shown as a ${medium.replaceAll('-', ' ')} illustration. ${use} Download the transparent WebP image or matching printable PDF.`;
  const style = medium.includes('black-and-white')
    ? 'Black & White'
    : medium.includes('watercolor')
      ? 'Watercolor'
      : medium.includes('coloring') || medium.includes('outline')
        ? 'Outline'
        : 'Color';
  if (title.length > 160 || alt.length > 420 || description.length > 500)
    throw Error('Metadata length needs review: ' + id);
  return { title, alt, description, style };
}

export const fireLeafContexts = {
  fire: {
    lead: 'A warm little spark for your project.',
    intro:
      'Explore flames, campfires, candles, lanterns and glowing hearths in richly varied illustration styles. Choose a clear single flame for a symbol, a lit candle for a cozy card, or a full campfire for a larger scene.',
    related: ['winter', 'halloween', 'leaves'],
    chips: [
      { label: 'Campfires', query: 'fire campfire' },
      { label: 'Flames', query: 'fire flame' },
      { label: 'Candles & lanterns', query: 'fire candle lantern' },
    ],
    paragraphs: [
      'For a small label or icon, begin with a single flame or simple candle. For a larger poster or story scene, try a campfire, fire bowl or lantern so the light source stays easy to recognize.',
      'The set includes textured painting, paper, glass and monochrome approaches. Leave breathing room around fine line work; a bright flame is easier to read against a dark preview background.',
      'Open a design in Clipart Studio to place it beside a separate caption or other shapes. Check the preview at the final size before downloading the transparent image or printable PDF.',
    ],
  },
  leaves: {
    lead: 'Botanical details from every season.',
    intro:
      'Browse leaf shapes from fern fronds and herb sprigs to maple, ginkgo, monstera and tropical palm. The collection mixes green, autumn and black-and-white designs for nature journals, personal cards and classroom plant comparisons.',
    related: ['butterfly', 'fox', 'fire'],
    chips: [
      { label: 'Autumn leaves', query: 'leaf autumn maple' },
      { label: 'Botanical leaves', query: 'leaf botanical' },
      { label: 'Leaf outlines', query: 'leaf black and white' },
    ],
    paragraphs: [
      'For a classroom comparison, place broad maple or monstera leaves beside narrow olive, rosemary or pine foliage. Keep the labels outside the artwork so the vein and edge shapes remain visible.',
      'Warm maple and ginkgo illustrations make seasonal accents, while fern, palm and herb sprigs suit green garden pages. The black-and-white designs also work for coloring and line-focused activities.',
      'Preview a leaf against your chosen page color before downloading. Open it in Clipart Studio to resize, crop and add separate text or shapes, then save the project if you plan to revise it.',
    ],
  },
};

export function fireLeafCollectionCopy(topic, items) {
  const context = fireLeafContexts[topic];
  if (!context || items.length !== 50) throw Error('Incomplete fire or leaf collection');
  return {
    description: `Explore 50 ${topic === 'leaves' ? 'leaf' : 'fire'} clipart designs for personal and classroom projects. Edit online and download matching transparent WebP or CMYK PDF files.`,
    lead: context.lead,
    intro: context.intro,
    featured: [
      ...items.filter((item) => !/black-and-white/.test(item.id)).slice(0, 4),
      ...items.filter((item) => /black-and-white/.test(item.id)).slice(0, 2),
    ].map((item) => item.id),
    chips: context.chips,
    heading:
      topic === 'leaves'
        ? 'Pick a leaf by shape, color and season'
        : 'Choose the right glow for your page',
    paragraphs: context.paragraphs,
    print:
      'Each illustration includes a transparent WebP and a matching CMYK PDF. The supplied PDF places its image at 300 pixels per inch; exact dimensions vary by design and appear on each artwork page. Print at actual size to keep that scale, and check a sample before making multiple copies.',
    related: context.related,
  };
}
