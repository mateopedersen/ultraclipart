export const styles = [
  ['realistic', 'Natural illustration', 'Soft light · realistic detail'],
  ['vector', 'Clean vector look', 'Crisp shapes · clear edges'],
  ['flat', 'Flat color', 'Bold color · simple forms'],
  ['kawaii', 'Kawaii', 'Small characters · big personality'],
  ['watercolor', 'Watercolor', 'Soft pigment · delicate texture'],
  ['hand-drawn', 'Hand drawn', 'Expressive lines · organic detail'],
  ['black-white', 'Black & white', 'Strong contrast · monochrome'],
  ['coloring', 'Coloring page', 'Open spaces · black outlines'],
  ['sticker', 'Sticker', 'Defined silhouette · clean border'],
  ['classroom', 'Classroom illustration', 'Friendly subjects · clear shapes'],
  ['retro', 'Retro', 'Vintage color · printed texture'],
  ['minimal', 'Minimal icon', 'Essential details · simple form'],
  ['pastel', 'Pastel', 'Gentle color · soft detail'],
  ['doodle', 'Doodle', 'Playful lines · spontaneous shapes'],
  ['cut-paper', 'Cut paper', 'Layered paper · subtle depth'],
] as const;
export const examples = [
  {
    label: 'A little wildflower',
    prompt:
      'A realistic baby rabbit holding a yellow daisy, detailed soft fur, warm gentle eyes, full body, centered on a clean white background, with space around the subject.',
    style: 'realistic',
    image: '/ai-examples/baby-rabbit-320.webp',
    alt: 'A detailed baby rabbit with a yellow daisy',
  },
  {
    label: 'A friendly invention',
    prompt:
      'A silver and orange robot holding a potted plant, carefully detailed metal surfaces, friendly rounded features, full body, clean white background.',
    style: 'realistic',
    image: '/ai-examples/garden-robot-320.webp',
    alt: 'A silver and orange robot holding a potted plant',
  },
  {
    label: 'A cup of flowers',
    prompt:
      'Pink peonies and white daisies arranged in a pale green teacup, delicate realistic petals, soft natural light, isolated on a clean white background.',
    style: 'realistic',
    image: '/ai-examples/floral-teacup-320.webp',
    alt: 'Pink peonies and white daisies in a pale green teacup',
  },
  {
    label: 'A classroom classic',
    prompt:
      'A red school bus seen from the side, carefully drawn wheels and windows, thick clean outline, centered with generous white space.',
    style: 'vector',
  },
] as const;
