/** Shared visible paint colors and the descriptions sent with the visitor's idea. */
export const builderColors = [
  ['#17375d', 'Navy'],
  ['#1769d5', 'Royal blue'],
  ['#58a6d6', 'Sky blue'],
  ['#1c9ca7', 'Teal'],
  ['#164e44', 'Forest green'],
  ['#5b8b44', 'Leaf green'],
  ['#a8bfa0', 'Sage'],
  ['#b8e2d1', 'Mint'],
  ['#e5532f', 'Rust orange'],
  ['#ef7b69', 'Coral'],
  ['#f49a28', 'Amber'],
  ['#e6b63e', 'Gold'],
  ['#f4d55c', 'Lemon'],
  ['#ffe7c9', 'Warm cream'],
  ['#f4bb9e', 'Peach'],
  ['#fff8e7', 'Ivory'],
  ['#d94f78', 'Rose'],
  ['#eea7c3', 'Pink'],
  ['#f6d2dc', 'Blush'],
  ['#6c3a72', 'Plum'],
  ['#8359b5', 'Violet'],
  ['#c7b5e8', 'Lavender'],
  ['#805a44', 'Brown'],
  ['#573e36', 'Cocoa'],
  ['#cbb791', 'Sand'],
  ['#899353', 'Olive'],
  ['#617488', 'Slate'],
  ['#d9edf7', 'Ice blue'],
  ['#ffffff', 'White'],
  ['#262f3a', 'Charcoal'],
  ['#758391', 'Graphite'],
  ['#c8d0d9', 'Silver'],
] as const;

export function normalizeBuilderColor(value: string): string | undefined {
  const hex = value.trim().replace(/^#/, '');
  if (!/^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(hex)) return;
  return (
    '#' + (hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex).toLowerCase()
  );
}

export function builderColorDescription(hex: string): string {
  const name = builderColors.find(([value]) => value === hex)?.[1];
  return name ? `${name.toLowerCase()} (${hex.toUpperCase()})` : hex.toUpperCase();
}
