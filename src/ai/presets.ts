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
  ['gouache', 'Gouache', 'Opaque paint · matte brush texture'],
  ['colored-pencil', 'Colored pencil', 'Visible pencil strokes · layered pigment'],
  ['woodcut', 'Woodcut', 'Carved lines · textured ink'],
  ['clay-3d', 'Clay 3D', 'Sculpted forms · soft material and shadows'],
  ['comic', 'Comic illustration', 'Confident ink · expressive shapes'],
] as const;
export { examples } from './ideas';

// These three existing homepage images have their own matching prompt transfers.
export const invitationExamples = [
  {
    label: 'A Rabbit With a Daisy',
    prompt:
      'A realistic baby rabbit holding a yellow daisy, detailed soft fur, warm gentle eyes, full body, centered on a clean white background, with space around the subject.',
    style: 'realistic',
    image: '/ai-examples/baby-rabbit-320.webp',
  },
  {
    label: 'A Gardening Robot',
    prompt:
      'A silver and orange imaginary robot holding a potted plant, carefully detailed metal surfaces, friendly rounded features, full body, clean white background.',
    style: 'realistic',
    image: '/ai-examples/garden-robot-320.webp',
  },
  {
    label: 'A Cup of Flowers',
    prompt:
      'Pink peonies and white daisies arranged in a pale green teacup, delicate realistic petals, soft natural light, isolated on a clean white background.',
    style: 'realistic',
    image: '/ai-examples/floral-teacup-320.webp',
  },
] as const;
