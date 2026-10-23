import {
  clamp,
  identity,
  isColor,
  transformString,
  type EditorDocument,
  type Layer,
  type StylePreset,
} from './model';
import { parsePath } from './pdf-math';
import { rasterPreview, requireRaster } from './raster';
export const NS = 'http://www.w3.org/2000/svg';
const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'title',
  'desc',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
]);
const attrs = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'id',
  'data-label',
  'data-role',
  'role',
  'aria-label',
  'aria-labelledby',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'opacity',
  'transform',
  'd',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'rx',
  'ry',
  'cx',
  'cy',
  'r',
  'points',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'clip-path',
  'clipPathUnits',
  'preserveAspectRatio',
]);
export function sanitizeSvg(source: string): SVGSVGElement {
  if (source.length > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('This SVG is too large or contains unsupported document declarations.');
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = parsed.documentElement;
  if (parsed.querySelector('parsererror') || root.localName !== 'svg')
    throw new Error('The SVG source could not be read.');
  const all = [root, ...root.querySelectorAll('*')];
  if (all.length > 10000) throw new Error('This illustration has too many shapes for the editor.');
  for (const el of all) {
    if (!tags.has(el.localName) || el.namespaceURI !== NS)
      throw new Error(`Unsupported or unsafe SVG element: ${el.localName}.`);
    let depth = 0;
    for (let parent = el.parentElement; parent; parent = parent.parentElement)
      if (++depth > 64)
        throw new Error(
          'This SVG has too many nested groups. Simplify its structure before importing.',
        );
    for (const attr of [...el.attributes]) {
      if (
        !attrs.has(attr.name) ||
        (/javascript:|data:|https?:|@import|expression\s*\(/i.test(attr.value) &&
          attr.name !== 'xmlns') ||
        (/url\s*\(/i.test(attr.value) && !/^url\(#[A-Za-z0-9_-]+\)$/.test(attr.value))
      )
        throw new Error(`Unsafe SVG attribute: ${attr.name}.`);
    }
  }
  return document.importNode(root, true) as unknown as SVGSVGElement;
}
export function fromSvg(source: string, artId: string): EditorDocument {
  const svg = sanitizeSvg(source);
  const box = (svg.getAttribute('viewBox') || '0 0 800 800').trim().split(/[ ,]+/).map(Number);
  if (
    box.length !== 4 ||
    !box.every(Number.isFinite) ||
    Math.abs(box[0]) > 10000 ||
    Math.abs(box[1]) > 10000 ||
    box[2] < 1 ||
    box[3] < 1 ||
    box[2] > 10000 ||
    box[3] > 10000
  )
    throw new Error('The SVG has invalid canvas dimensions.');
  const inherited = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'fill-rule',
    'fill-opacity',
    'stroke-opacity',
    'stroke-miterlimit',
    'transform',
  ]
    .map((a) =>
      svg.hasAttribute(a)
        ? `${a}="${(svg.getAttribute(a) || '').replaceAll('&', '&amp;').replaceAll('\"', '&quot;').replaceAll('<', '&lt;')}"`
        : '',
    )
    .join(' ');
  const children = [...svg.children].filter(
    (el) => !['title', 'desc', 'defs'].includes(el.localName),
  );
  if (svg.querySelector('defs'))
    throw new Error('This source uses definitions that need a dedicated editing adapter.');
  const layers: Layer[] = children.map((el, i) => ({
    id: `layer-${i}`,
    label: (
      el.getAttribute('data-label') ||
      el.getAttribute('aria-label') ||
      el.id ||
      `Shape ${i + 1}`
    ).slice(0, 80),
    kind: 'vector',
    markup: `<g transform="translate(${-box[0]} ${-box[1]})"><g ${inherited}>${new XMLSerializer().serializeToString(el)}</g></g>`,
    visible: true,
    locked: false,
    opacity: 1,
    ...identity(),
  }));
  return {
    version: 1,
    artId,
    width: box[2],
    height: box[3],
    background: 'transparent',
    layers,
    crop: null,
    print: { paper: 'letter', orientation: 'portrait', margin: 0.5, scale: 'fit' },
  };
}
/** Deliberately narrow import contract: everything accepted is editable and supported by the CMYK renderer. */
export function fromCreationSvg(source: string, artId: string): EditorDocument {
  const svg = sanitizeSvg(source);
  if (!svg.hasAttribute('viewBox')) {
    const width = Number(svg.getAttribute('width')),
      height = Number(svg.getAttribute('height'));
    if (!(width > 0 && height > 0))
      throw new Error('Your SVG needs a viewBox or numeric width and height.');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  const primitives = new Set([
    'svg',
    'g',
    'title',
    'desc',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
  ]);
  const numeric = new Set([
    'x',
    'y',
    'x1',
    'x2',
    'y1',
    'y2',
    'width',
    'height',
    'rx',
    'ry',
    'cx',
    'cy',
    'r',
    'stroke-width',
    'stroke-miterlimit',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
  ]);
  const matrices = new Map<Element, DOMMatrix>();
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    const parentMatrix = matrices.get(el.parentElement!) || new DOMMatrix();
    let matrix = parentMatrix;
    const transforms = (el as SVGGraphicsElement).transform?.baseVal;
    if (transforms)
      for (let i = 0; i < transforms.numberOfItems; i++)
        matrix = matrix.multiply(transforms.getItem(i).matrix);
    if (
      [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].some(
        (v) => !Number.isFinite(v) || Math.abs(v) > 1000000,
      )
    )
      throw new Error(
        'Combined SVG transforms are too large. Simplify the transformed geometry before importing.',
      );
    matrices.set(el, matrix);
    if (
      !primitives.has(el.localName) ||
      (el !== svg && el.localName === 'svg') ||
      el.hasAttribute('clip-path')
    )
      throw new Error(
        'This SVG uses an unsupported effect. Import basic shapes and paths with solid colors.',
      );
    if (
      (el.localName === 'g' || el === svg) &&
      el.hasAttribute('opacity') &&
      Number(el.getAttribute('opacity')) !== 1
    )
      throw new Error(
        'Group opacity is not supported on import. Apply opacity to individual shapes first.',
      );
    for (const attr of [...el.attributes]) {
      if (
        numeric.has(attr.name) &&
        (!/^[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?$/i.test(attr.value) ||
          !Number.isFinite(Number(attr.value)) ||
          Math.abs(Number(attr.value)) > 10000)
      )
        throw new Error(`Use finite artwork units for ${attr.name}.`);
      if (
        ['opacity', 'fill-opacity', 'stroke-opacity'].includes(attr.name) &&
        (Number(attr.value) < 0 || Number(attr.value) > 1)
      )
        throw new Error('Opacity must be between zero and one.');
      if (['fill', 'stroke'].includes(attr.name) && attr.value !== 'none' && !colorHex(attr.value))
        throw new Error(
          'Import supports hex or RGB solid colors. Convert named colors and paint effects first.',
        );
      if (
        ['width', 'height', 'rx', 'ry', 'r', 'stroke-width'].includes(attr.name) &&
        Number(attr.value) < 0
      )
        throw new Error('Shape dimensions cannot be negative.');
    }
    if (el.hasAttribute('transform')) {
      const transform = el.getAttribute('transform')!;
      const parts = [
        ...transform.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g),
      ];
      if (
        !parts.length ||
        transform.replace(/(matrix|translate|scale|rotate|skewX|skewY)\s*\([^)]*\)/g, '').trim()
      )
        throw new Error('The SVG contains an invalid transform.');
      for (const part of parts) {
        const values = part[2].trim().split(/[ ,]+/).map(Number);
        const counts: Record<string, number[]> = {
          matrix: [6],
          translate: [1, 2],
          scale: [1, 2],
          rotate: [1, 3],
          skewX: [1],
          skewY: [1],
        };
        if (
          !counts[part[1]].includes(values.length) ||
          values.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000)
        )
          throw new Error('The SVG contains an invalid transform.');
      }
    }
    if (el.localName === 'path') {
      const d = el.getAttribute('d') || '';
      if (/[^\s,0-9a-z.+-]/i.test(d)) throw new Error('The SVG contains an invalid path.');
      const ops = parsePath(d);
      if (
        !ops.length ||
        ops[0].op !== 'm' ||
        ops.some((o) => o.c.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000))
      )
        throw new Error('The SVG contains an invalid or oversized path.');
    }
    if (['polyline', 'polygon'].includes(el.localName)) {
      const points = (el.getAttribute('points') || '').trim().split(/[ ,]+/).map(Number);
      if (
        points.length < 4 ||
        points.length % 2 ||
        points.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000)
      )
        throw new Error('The SVG contains an invalid polygon.');
    }
  }
  const doc = fromSvg(new XMLSerializer().serializeToString(svg), artId);
  if (doc.width < 64 || doc.height < 64 || doc.width > 4096 || doc.height > 4096)
    throw new Error('Imported canvas dimensions must be between 64 and 4,096.');
  if (!doc.layers.length || doc.layers.length > 500)
    throw new Error('Import an SVG with 1 to 500 top-level layers.');
  if (!svg.querySelector('path,rect,circle,ellipse,line,polyline,polygon'))
    throw new Error('This SVG contains no supported shapes.');
  return doc;
}
export function validateProjectMarkup(doc: EditorDocument): void {
  let nodes = 0;
  for (const layer of doc.layers) {
    if (layer.kind === 'raster') {
      requireRaster(layer);
      continue;
    }
    if (layer.kind !== 'vector') continue;
    const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
    nodes += svg.querySelectorAll('*').length;
    // Reuse the same finite geometry and supported-paint contract for saved projects.
    fromCreationSvg(`<svg xmlns="${NS}" viewBox="0 0 800 800">${layer.markup}</svg>`, doc.artId);
    if (nodes > 10000)
      throw new Error(
        'This project has more than 10,000 vector elements. Simplify its layers before opening it.',
      );
  }
}
export function nodeForLayer(layer: Layer): SVGGElement {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('data-layer', layer.id);
  g.setAttribute('transform', transformString(layer));
  if (layer.kind === 'vector') g.innerHTML = layer.markup;
  else if (layer.kind === 'raster') {
    const image = document.createElementNS(NS, 'image');
    image.setAttribute('href', rasterPreview(layer));
    image.setAttribute('width', String(layer.width));
    image.setAttribute('height', String(layer.height));
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttribute('opacity', String(layer.opacity));
    g.append(image);
  } else {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('data-caption', layer.text);
    for (const [index, line] of layer.text.split('\n').entries()) {
      const span = document.createElementNS(NS, 'tspan');
      span.textContent = line;
      span.setAttribute('x', '0');
      span.setAttribute('dy', index === 0 ? '0' : '1.2em');
      text.append(span);
    }
    text.setAttribute('font-family', 'UltraEditorText, Arial, sans-serif');
    text.setAttribute('font-size', String(layer.size));
    text.setAttribute('font-weight', layer.bold ? '700' : '400');
    text.setAttribute('text-anchor', layer.align);
    text.setAttribute('fill', layer.color);
    g.append(text);
  }
  for (const shape of g.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text'))
    shape.setAttribute(
      'opacity',
      String(Number(shape.getAttribute('opacity') || 1) * layer.opacity),
    );
  return g;
}
export function documentSvg(doc: EditorDocument): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('xmlns', NS);
  const b = doc.crop || { x: 0, y: 0, width: doc.width, height: doc.height };
  svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
  svg.setAttribute('width', String(b.width));
  svg.setAttribute('height', String(b.height));
  if (doc.background !== 'transparent') {
    const rect = document.createElementNS(NS, 'rect');
    for (const key of ['x', 'y', 'width', 'height'] as const)
      rect.setAttribute(key, String(b[key]));
    rect.setAttribute('fill', doc.background);
    svg.append(rect);
  }
  doc.layers.filter((l) => l.visible).forEach((l) => svg.append(nodeForLayer(l)));
  return svg;
}
export function colorHex(color: string): string | null {
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(color)) return '#' + [...color.slice(1)].map((c) => c + c).join('');
  const v = color.match(/^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/);
  if (v)
    return (
      '#' +
      v
        .slice(1)
        .map((n) => clamp(Number(n), 0, 255).toString(16).padStart(2, '0'))
        .join('')
    );
  return (
    (
      {
        black: '#000000',
        white: '#ffffff',
        red: '#ff0000',
        transparent: null,
        none: null,
      } as Record<string, string | null>
    )[color] || null
  );
}
export function layerColors(layer: Layer): string[] {
  if (layer.kind === 'raster') return [];
  if (layer.kind === 'text') return [layer.color];
  const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
  return [
    ...new Set(
      [...svg.querySelectorAll('[fill],[stroke]')]
        .flatMap((el) => [el.getAttribute('fill'), el.getAttribute('stroke')])
        .map((v) => (v ? colorHex(v) : null))
        .filter((v): v is string => !!v),
    ),
  ];
}
export function recolor(layer: Layer, color: string, matching?: string, strokeOnly = false): void {
  if (layer.kind === 'raster') return;
  if (!isColor(color)) throw new Error('Enter a six-digit hex color, such as #2865D2.');
  if (layer.kind === 'text') {
    layer.color = color;
    return;
  }
  const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
  const selectors = strokeOnly ? ['stroke'] : ['fill', 'stroke'];
  for (const el of svg.querySelectorAll('*'))
    for (const attr of selectors) {
      const old = el.getAttribute(attr);
      if (old && old !== 'none' && (!matching || colorHex(old) === matching))
        el.setAttribute(attr, color);
    }
  layer.markup = svg.innerHTML;
}
export function strokeWidth(layer: Layer, width: number): void {
  if (layer.kind !== 'vector') return;
  const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
  for (const el of svg.querySelectorAll('[stroke]'))
    if (el.getAttribute('stroke') !== 'none') el.setAttribute('stroke-width', String(width));
  layer.markup = svg.innerHTML;
}
export function preset(layer: Layer, mode: StylePreset, contrast = 1): void {
  if (layer.kind === 'raster') return;
  if (mode === 'original') return;
  const map = (hex: string) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const gray = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    const next =
      mode === 'grayscale'
        ? rgb.map(() => 128 + (gray - 128) * contrast)
        : mode === 'pastel'
          ? rgb.map((v) => v * 0.65 + 255 * 0.35)
          : mode === 'vintage'
            ? [rgb[0] * 0.75 + 45, rgb[1] * 0.7 + 40, rgb[2] * 0.58 + 35]
            : rgb.map((v) => 128 + (v - 128) * 1.25);
    return (
      '#' +
      next
        .map((v) =>
          Math.round(clamp(v, 0, 255))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
  if (layer.kind === 'text') {
    layer.color = mode === 'outline' ? '#000000' : map(layer.color);
    return;
  }
  const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
  for (const el of svg.querySelectorAll('*')) {
    if (mode === 'outline') {
      if (el.hasAttribute('fill') && el.getAttribute('fill') !== 'none')
        el.setAttribute('fill', '#ffffff');
      if (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none')
        el.setAttribute('stroke', '#000000');
      if (
        ['path', 'rect', 'circle', 'ellipse', 'polygon'].includes(el.localName) &&
        !el.closest('[stroke]')
      ) {
        el.setAttribute('stroke', '#000000');
        el.setAttribute('stroke-width', '2');
      }
    } else
      for (const attr of ['fill', 'stroke']) {
        const old = el.getAttribute(attr);
        const hex = old ? colorHex(old) : null;
        if (hex) el.setAttribute(attr, map(hex));
      }
  }
  layer.markup = svg.innerHTML;
}
export async function renderWebp(
  doc: EditorDocument,
  size: number,
  quality: number,
): Promise<Blob> {
  const svg = documentSvg(doc);
  const box = doc.crop || doc;
  const width = Math.round(size),
    height = Math.round((size * box.height) / box.width);
  if (width * height > 16777216)
    throw new Error('This canvas is too large. Choose a smaller export size.');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  await document.fonts.ready;
  const serialized = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not create an image canvas.');
    context.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    if (blob?.type === 'image/webp') return blob;
    try {
      const { encodeWebp } = await import('./webp-fallback');
      return await encodeWebp(context.getImageData(0, 0, width, height), quality);
    } catch {
      throw new Error(
        'The local WebP encoder could not be loaded. Reconnect and try again. Your edits are saved, and PDF export is also available.',
      );
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
