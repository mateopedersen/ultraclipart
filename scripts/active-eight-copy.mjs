export const activeContexts = {
  money: {
    cluster: 'Business & money',
    label: 'Money',
    lead: 'Coins, savings and little money lessons.',
    intro:
      'Explore banknotes, coins, piggy banks, wallets, savings jars and cheerful money characters. Build classroom money vocabulary cards, a savings tracker or a personal budgeting notebook with a clear, recognizable illustration.',
    use: 'classroom money vocabulary cards, savings trackers and personal budgeting notebooks',
    related: ['school', 'book'],
    chips: ['money coins', 'money piggy bank', 'money wallet'],
  },
  music: {
    cluster: 'Arts & entertainment',
    label: 'Music',
    lead: 'A little rhythm for your next project.',
    intro:
      'Find guitars, keyboards, strings, brass and percussion alongside musical notes, headphones and recording equipment. Choose a familiar instrument for a classroom display, music-practice journal or personal concert invitation.',
    use: 'instrument vocabulary cards, music-practice journals and personal concert invitations',
    related: ['movie', 'school', 'boy', 'girl'],
    chips: ['music guitar', 'music piano', 'music note'],
  },
  beach: {
    cluster: 'Nature & elements',
    label: 'Beach',
    lead: 'Seaside details, ready for sunny ideas.',
    intro:
      'Explore seashells, waves, sandcastles, palms, umbrellas and beach-day essentials. Create a personal travel scrapbook, summer invitation or classroom seaside activity with a compact shell accent or a larger coastal scene.',
    use: 'personal travel scrapbooks, summer invitations and classroom seaside activities',
    related: ['watermelon', 'coconut', 'pineapple'],
    chips: ['beach seashell', 'beach sandcastle', 'beach umbrella'],
  },
  boy: {
    cluster: 'People & activities',
    label: 'Boy',
    lead: 'Everyday adventures, plenty of personality.',
    intro:
      'Choose boys reading, making art, playing sports, exploring nature and enjoying imaginative activities. The collection also includes a boy using a wheelchair. Use these characters for classroom stories, activity schedules and personal scrapbook pages.',
    use: 'classroom story cards, activity schedules and personal scrapbook pages',
    related: ['girl', 'school', 'book', 'basketball'],
    chips: ['boy reading', 'boy soccer', 'boy painting'],
  },
  girl: {
    cluster: 'People & activities',
    label: 'Girl',
    lead: 'Curiosity, creativity and everyday moments.',
    intro:
      'Explore girls reading, building, making art, playing instruments, enjoying sports and discovering the outdoors. The collection includes a girl using a wheelchair. Add a character to classroom stories, activity cards or a personal memory book.',
    use: 'classroom story cards, creative activity sheets and personal memory books',
    related: ['boy', 'school', 'book', 'basketball'],
    chips: ['girl reading', 'girl soccer', 'girl painting'],
  },
  pizza: {
    cluster: 'Food & drink',
    label: 'Pizza',
    lead: 'Slices of color for food-themed projects.',
    intro:
      'Choose whole pizzas, individual slices, toppings, takeaway boxes, baking tools and playful pizza characters. Make classroom food vocabulary cards, a personal recipe notebook or a pizza-party invitation with the design that fits your layout.',
    use: 'classroom food vocabulary cards, personal recipe notebooks and pizza-party invitations',
    related: ['cookie', 'beach', 'school'],
    chips: ['pizza slice', 'pizza pepperoni', 'pizza character'],
  },
  cookie: {
    cluster: 'Food & drink',
    label: 'Cookie',
    lead: 'Small treats for sweet creative moments.',
    intro:
      'Find chocolate chip cookies, shortbread, biscotti, jam-filled biscuits, decorated sugar cookies and cheerful cookie characters. There are everyday baking designs as well as holiday shapes for personal recipe cards, gift notes and classroom activities.',
    use: 'personal recipe cards, baking gift notes and classroom food activities',
    related: ['pizza', 'cranberry', 'apple'],
    chips: ['chocolate chip cookie', 'cookie gingerbread', 'cookie character'],
  },
  movie: {
    cluster: 'Arts & entertainment',
    label: 'Movie',
    lead: 'Bring a little cinema to your page.',
    intro:
      'Explore film cameras, clapperboards, projectors, tickets, cinema seats and movie-night snacks. Mix filmmaking equipment with a popcorn accent for a classroom film project, personal cinema journal or movie-night invitation.',
    use: 'classroom filmmaking projects, personal cinema journals and movie-night invitations',
    related: ['music', 'pizza', 'robot'],
    chips: ['movie camera', 'movie clapperboard', 'movie popcorn'],
  },
};

const techniqueNames = {
  enamel: 'Enamel-style Illustration',
  manga: 'Manga',
  'line-art': 'Line Art',
  'realistic-3d-illustration': 'Realistic 3D',
  'smooth-digital-illustration': 'Digital Illustration',
  'detailed-metallic-illustration': 'Metallic Illustration',
  'textured-colored-drawing': 'Textured Drawing',
  'textured-metallic-render': 'Metallic Illustration',
  'cartoon-illustration': 'Cartoon',
  'colored-engraving': 'Color Engraving',
  'tinted-engraving': 'Tinted Engraving',
  'colored-linocut': 'Color Linocut',
  'color-linocut': 'Color Linocut',
  'ornamental-ink': 'Ornamental Ink',
  'engraved-illustration': 'Engraving',
  'engraved-drawing': 'Engraving',
  'engraved-ink': 'Engraving',
  'minimal-color-line': 'Minimal Line Illustration',
  'fine-line-color': 'Fine Line Illustration',
  'minimal-outline': 'Outline',
  'coloring-outline': 'Coloring Design',
  'coloring-page': 'Coloring Design',
  'layered-paper-cut': 'Paper-cut Illustration',
  'faceted-paper-craft': 'Paper-craft Illustration',
  'painted-illustration': 'Painted Illustration',
  'printed-illustration': 'Printed Illustration',
  'realistic-illustration': 'Realistic Illustration',
  'textured-illustration': 'Textured Illustration',
  'detailed-illustration': 'Detailed Illustration',
  'clean-illustration': 'Clean Illustration',
  'glossy-illustration': 'Glossy Illustration',
  'digital-illustration': 'Digital Illustration',
  'vintage-storybook': 'Storybook',
  'storybook-digital': 'Storybook',
  'vintage-poster': 'Vintage Poster',
  'traditional-tattoo': 'Traditional Tattoo',
  'glazed-ceramic': 'Ceramic-style Illustration',
  'painted-porcelain': 'Porcelain-style Illustration',
  'painted-wood': 'Painted Wood-style Illustration',
  'colored-glass': 'Glass-style Illustration',
  'stained-glass': 'Stained Glass-style Illustration',
  'felt-applique': 'Felt-style Illustration',
  'needle-felt': 'Needle-felt-style Illustration',
  'fabric-collage': 'Fabric Collage-style Illustration',
  'wood-marquetry': 'Wood Marquetry-style Illustration',
  'paper-quilling': 'Paper Quilling-style Illustration',
  'paper-collage': 'Paper Collage',
  'layered-paper': 'Layered Paper-style Illustration',
  'paper-cut': 'Paper-cut Illustration',
  'clay-sculpture': 'Clay-style Illustration',
  'clay-render': 'Clay-style Illustration',
  'soft-3d': 'Soft 3D',
  '3d-illustration': '3D Illustration',
  'bold-geometric': 'Geometric Illustration',
  'soft-pastel': 'Soft Pastel',
  'chalk-pastel': 'Chalk Pastel',
  'pastel-chalk': 'Pastel Chalk',
  'oil-pastel': 'Oil Pastel',
  'colored-pencil': 'Colored Pencil',
  'colored-charcoal': 'Colored Charcoal',
  'ink-and-wash': 'Ink and Wash',
  'ink-wash': 'Ink Wash',
  'ink-outline': 'Ink Outline',
  'ink-drawing': 'Ink Drawing',
  'comic-ink': 'Comic Ink',
  'brush-ink': 'Brush Ink',
  'bold-ink': 'Bold Ink',
  'brush-pen': 'Brush Pen',
  'retro-comic': 'Retro Comic',
  'comic-book': 'Comic Book',
  'cute-cartoon': 'Cute Cartoon',
  'digital-cartoon': 'Digital Cartoon',
  'flat-illustration': 'Flat Illustration',
  'flat-graphic': 'Flat Graphic',
  'smooth-graphic': 'Smooth Graphic',
  'color-stamp': 'Color Stamp',
  'color-etching': 'Color Etching',
  'color-stipple': 'Color Stipple',
  'palette-knife': 'Palette Knife-style Illustration',
  'oil-painting': 'Oil-style Illustration',
  'enamel-pin': 'Enamel Pin-style Illustration',
  'glossy-render': 'Glossy Illustration',
  'glossy-gel': 'Glossy Gel-style Illustration',
  'mid-century': 'Mid-century Illustration',
  'retro-halftone': 'Retro Halftone',
  'pixel-art': 'Pixel Art',
  'low-poly': 'Low-poly Illustration',
  watercolor: 'Watercolor',
  gouache: 'Gouache',
  crayon: 'Crayon',
  acrylic: 'Acrylic-style Illustration',
  airbrush: 'Airbrush',
  embroidery: 'Embroidery-style Illustration',
  mosaic: 'Mosaic-style Illustration',
  knitted: 'Knitted-style Illustration',
  origami: 'Origami-style Illustration',
  woodblock: 'Woodblock',
  screenprint: 'Screenprint-style Illustration',
  risograph: 'Risograph-style Illustration',
  pointillist: 'Pointillist Illustration',
  lithograph: 'Lithograph-style Illustration',
  charcoal: 'Charcoal',
  crosshatch: 'Crosshatch',
  stipple: 'Stipple',
  coloring: 'Coloring Design',
  engraving: 'Engraving',
  linocut: 'Linocut',
  woodcut: 'Woodcut',
  graphite: 'Graphite',
  silhouette: 'Silhouette',
  ornamental: 'Ornamental Illustration',
  cutout: 'Cutout Illustration',
  scratchboard: 'Scratchboard',
  drybrush: 'Drybrush',
  applique: 'Applique-style Illustration',
  impasto: 'Impasto-style Illustration',
  'cel-shaded': 'Cel-shaded Cartoon',
  'folk-art': 'Folk Art',
  comic: 'Comic',
  cartoon: 'Cartoon',
  illustration: 'Illustration',
  drawing: 'Drawing',
};
const techniques = Object.entries(techniqueNames).sort((a, b) => b[0].length - a[0].length);
const titleCase = (s) =>
  s
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(And|With|Of|In|On|At|The|For)\b/g, (s) => s.toLowerCase())
    .replace(/\b3d\b/gi, '3D');

export function activeMetadata(topic, id) {
  const context = activeContexts[topic];
  if (!context || !id.startsWith(topic + '-') || !id.endsWith('-clipart'))
    throw Error('Wrong artwork identity');
  const monochrome = id.includes('-black-and-white-');
  let body = id.slice(topic.length + 1, -8).replace(/-black-and-white/g, '');
  const technique = techniques.find(([suffix]) => body.endsWith('-' + suffix));
  if (technique) body = body.slice(0, -technique[0].length - 1);
  const medium = technique?.[1] ?? (monochrome ? 'Illustration' : 'Color Illustration');
  let subject = titleCase(body);
  if (topic === 'boy' || topic === 'girl') subject = context.label + ' ' + subject;
  else if (
    (topic === 'pizza' || topic === 'cookie') &&
    !new RegExp(`\\b${topic}(s)?\\b`, 'i').test(subject)
  )
    subject = context.label + ' ' + subject;
  const outline = /coloring|minimal-outline|ink-outline|line-art/.test(id);
  const style = outline
    ? 'Outline'
    : monochrome
      ? 'Black & White'
      : /watercolor/.test(id)
        ? 'Watercolor'
        : 'Color';
  const title = `${subject} Clipart (${medium}${monochrome ? ', Black & White' : ''})`;
  const alt = `${subject}, ${medium.toLowerCase()}${monochrome ? ' in black and white' : ''}, on a transparent background.`;
  const description = `${subject} in ${medium.toLowerCase()}${monochrome ? ', shown in black and white' : ''}. Use this ${context.label.toLowerCase()} design for ${context.use}. Download a transparent WebP image or matching printable CMYK PDF.`;
  if (title.length > 165 || alt.length > 420 || description.length > 500)
    throw Error('Metadata too long: ' + id);
  return { title, alt, description, style };
}

export function activeCollectionCopy(topic, items) {
  const c = activeContexts[topic];
  const feature = [];
  for (const pattern of [
    /watercolor/,
    /cute-cartoon|cartoon-illustration/,
    /colored-pencil/,
    /realistic|detailed/,
    /coloring/,
    /stained-glass/,
  ]) {
    const item = items.find((i) => pattern.test(i.id));
    if (item && !feature.includes(item.id)) feature.push(item.id);
  }
  for (const item of items) {
    if (feature.length >= 6) break;
    if (!feature.includes(item.id)) feature.push(item.id);
  }
  return {
    description: `Explore ${items.length} ${topic} clipart designs with transparent WebP images and matching printable CMYK PDFs for personal and classroom projects.`,
    lead: c.lead,
    intro: c.intro,
    featured: feature,
    chips: c.chips.map((query) => ({
      label: titleCase(query.replace(new RegExp(`^${topic}\\s+`, 'i'), '')),
      query,
    })),
    heading: `Choose a ${topic} design for your next project`,
    paragraphs: [
      `Choose a design that suits your layout and its purpose. ${c.intro.split('. ')[0]}. Use the small preview to compare subjects, then open the artwork page to check the original dimensions and download sizes.`,
      `Color illustrations add a focal point to ${c.use}. Black-and-white designs offer a quieter alternative; the open outline designs also suit coloring activities. Leave a clear space beside the illustration for names, captions or instructions.`,
      'Open a design in Clipart Studio to move, resize, rotate or crop its image layer and add separate text and shapes. The illustration is an image layer; its internal details are not separate vector objects. Save the project to return to your arrangement later.',
    ],
    print:
      'Each design includes two separate downloads: a transparent WebP image and a matching single-page CMYK PDF. The supplied PDFs place their original 1,254 × 1,254 pixel illustrations at 300 pixels per inch (4.18 × 4.18 inches). Print at actual size to preserve that scale; enlarging reduces effective resolution. Check a sample print before making multiple copies.',
    related: c.related,
  };
}
