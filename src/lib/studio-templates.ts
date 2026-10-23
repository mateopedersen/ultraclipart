/** Studio starting points are separate from the artwork catalog and its counts. */
export const studioTemplates = [
  {
    id: 'sunny-badge',
    title: 'Sunny badge',
    description: 'A little reward, a lot of sunshine.',
    tone: 'peach',
    layers: 20,
  },
  {
    id: 'botanical-sprig',
    title: 'Botanical sprig',
    description: 'Leaves, berries, and room to grow.',
    tone: 'sage',
    layers: 12,
  },
  {
    id: 'school-label',
    title: 'Learning label',
    description: 'Give a notebook a personal touch.',
    tone: 'blue',
    layers: 12,
  },
  {
    id: 'party-spark',
    title: 'Party spark',
    description: 'Build a small celebration.',
    tone: 'lavender',
    layers: 14,
  },
  {
    id: 'rainbow-arch',
    title: 'Rainbow arch',
    description: 'A bright idea for a cloudy day.',
    tone: 'rose',
    layers: 10,
  },
  {
    id: 'little-postcard',
    title: 'Little postcard',
    description: 'Make a note worth keeping.',
    tone: 'cream',
    layers: 11,
  },
].map((template) => ({ ...template, src: `/studio/${template.id}.svg`, width: 800, height: 600 }));
