/** Deterministic composition; never replaces or translates the visitor's description. */
export const styles = {
  realistic:
    'Realistic illustration with carefully observed anatomy, refined materials and lifelike texture',
  vector: 'Clean vector-look illustration with crisp contours and controlled flat shading',
  flat: 'Flat color illustration with clean silhouettes',
  kawaii: 'Sweet kawaii illustration with gentle rounded forms',
  watercolor: 'Detailed watercolor illustration with natural pigment and delicate edges',
  'hand-drawn': 'Hand-drawn illustration with confident expressive linework',
  'black-white': 'Black and white illustration with clear tonal separation',
  coloring: 'Printable coloring page, white interiors, clear black outlines, no gray shading',
  sticker: 'Polished sticker illustration with a clear continuous silhouette',
  classroom: 'Welcoming classroom illustration with clear, easy-to-recognize objects',
  retro: 'Vintage editorial illustration with restrained retro colors',
  minimal: 'Minimal icon illustration with simple recognizable geometry',
  pastel: 'Refined pastel illustration with soft harmonious colors',
  doodle: 'Playful hand-drawn doodle with clean intentional lines',
  'cut-paper': 'Layered cut-paper illustration with subtle paper texture',
} as const;
export type StyleId = keyof typeof styles;
export interface PromptOptions {
  prompt: string;
  style: StyleId;
  composition?: string;
  palette?: string;
  detail?: 'balanced' | 'detailed' | 'simple';
  outline?: 'none' | 'fine' | 'bold';
  margin?: 'standard' | 'generous';
  background?: 'white' | 'transparent' | 'color';
  backgroundColor?: string;
}
export function composePrompt(input: PromptOptions): string {
  const notes: string[] = [styles[input.style]];
  if (input.composition) notes.push(`Composition preference: ${input.composition}`);
  if (input.palette) notes.push(`Palette preference: ${input.palette}`);
  if (input.detail === 'detailed')
    notes.push('Finely resolved details, coherent lighting and thoughtful form');
  if (input.detail === 'simple') notes.push('Simplified forms and restrained detail');
  if (input.outline && input.outline !== 'none')
    notes.push(`${input.outline === 'bold' ? 'Bold clean' : 'Fine precise'} outlines`);
  notes.push(
    input.margin === 'generous'
      ? 'Generous clear space around the entire subject'
      : 'Keep the entire subject inside the frame',
  );
  notes.push(
    input.background === 'color'
      ? `Plain ${input.backgroundColor || '#ffffff'} background`
      : 'Plain white background suitable for later cutout',
  );
  return `${input.prompt.trim()}\nIllustration preferences (preserve the requested subjects, actions, counts and relationships): ${notes.join('. ')}. No watermark.`;
}
