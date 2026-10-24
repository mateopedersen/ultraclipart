import type { Region, RasterEffect, Typography } from './smart/types';
export type StylePreset = 'original' | 'pastel' | 'grayscale' | 'vintage' | 'bright' | 'outline';
export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
}
interface LayerBase extends Transform {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  group?: string;
  paletteOriginal?: string;
}
export interface VectorLayer extends LayerBase {
  kind: 'vector';
  markup: string;
}
export interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  size: number;
  color: string;
  bold: boolean;
  align: 'start' | 'middle' | 'end';
  typography?: Typography;
}
/** Private generation provenance stays in local project files, never in document markup. */
export interface AiImageMetadata {
  version: 1;
  prompt: string;
  model: string;
  style: string;
  createdAt: string;
  composedPrompt?: string;
  seed?: number;
  transferId?: string;
}
export function validAiMetadata(value: unknown): value is AiImageMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as AiImageMetadata;
  const text = (v: unknown, max: number) =>
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  return (
    Object.keys(m).every((k) =>
      [
        'version',
        'prompt',
        'model',
        'style',
        'createdAt',
        'composedPrompt',
        'seed',
        'transferId',
      ].includes(k),
    ) &&
    m.version === 1 &&
    text(m.prompt, 2048) &&
    text(m.model, 160) &&
    text(m.style, 80) &&
    typeof m.createdAt === 'string' &&
    m.createdAt.length <= 30 &&
    Number.isFinite(Date.parse(m.createdAt)) &&
    (m.composedPrompt === undefined || text(m.composedPrompt, 4096)) &&
    (m.seed === undefined ||
      (Number.isSafeInteger(m.seed) && m.seed >= 0 && m.seed <= 4294967295)) &&
    (m.transferId === undefined ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(m.transferId))
  );
}
export interface RasterLayer extends LayerBase {
  ai?: AiImageMetadata;
  kind: 'raster';
  assetId: string;
  sourceSha256: string;
  regions?: Region[];
  effects?: RasterEffect[];
  width: number;
  height: number;
}
export type Layer = VectorLayer | TextLayer | RasterLayer;
export interface EditorDocument {
  version: 1 | 2;
  selection?: { layerId: string; mask: import('./smart/types').MaskData };
  exportPreferences?: {
    width: number;
    quality: number;
    allowLargePdf: boolean;
    size?: 'original' | 'custom';
  };
  artId: string;
  width: number;
  height: number;
  background: string;
  layers: Layer[];
  crop: null | { x: number; y: number; width: number; height: number };
  print: {
    paper: 'letter' | 'a4';
    orientation: 'portrait' | 'landscape';
    margin: number;
    scale: 'fit' | 'fill' | 'actual' | 'native';
  };
}
export const identity = (): Transform => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 });
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const isColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);
export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
export const transformString = (layer: Transform): string =>
  `translate(${layer.x} ${layer.y}) rotate(${layer.angle}) scale(${layer.scaleX} ${layer.scaleY})`;
export function changeLayers(
  doc: EditorDocument,
  ids: string[],
  update: (layer: Layer) => void,
): EditorDocument {
  const next = clone(doc);
  next.layers
    .filter((layer) => ids.includes(layer.id) && !layer.locked && layer.visible)
    .forEach(update);
  return next;
}
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private sizes: number[] = [];
  private bytes = 0;
  public current: T;
  constructor(
    initial: T,
    private limit = 75,
  ) {
    this.current = clone(initial);
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  commit(next: T) {
    if (JSON.stringify(this.current) === JSON.stringify(next)) return false;
    const size = JSON.stringify(this.current).length * 2;
    this.past.push(clone(this.current));
    this.sizes.push(size);
    this.bytes += size;
    while (this.past.length > this.limit || (this.bytes > 32000000 && this.past.length > 1)) {
      this.past.shift();
      this.bytes -= this.sizes.shift()!;
    }
    this.current = clone(next);
    this.future = [];
    return true;
  }
  undo() {
    const prev = this.past.pop();
    this.bytes -= this.sizes.pop() || 0;
    if (prev !== undefined) {
      this.future.push(clone(this.current));
      this.current = prev;
    }
    return this.current;
  }
  redo() {
    const next = this.future.pop();
    if (next !== undefined) {
      const size = JSON.stringify(this.current).length * 2;
      this.past.push(clone(this.current));
      this.sizes.push(size);
      this.bytes += size;
      this.current = next;
    }
    return this.current;
  }
}
export function validateDocument(value: unknown, artId: string): value is EditorDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as EditorDocument;
  return (
    (doc.version === 1 || doc.version === 2) &&
    (!doc.exportPreferences ||
      (Number.isFinite(doc.exportPreferences.width) &&
        doc.exportPreferences.width >= 1 &&
        doc.exportPreferences.width <= 10000 &&
        Number.isFinite(doc.exportPreferences.quality) &&
        doc.exportPreferences.quality >= 0.8 &&
        doc.exportPreferences.quality <= 1 &&
        typeof doc.exportPreferences.allowLargePdf === 'boolean' &&
        (!doc.exportPreferences.size ||
          ['original', 'custom'].includes(doc.exportPreferences.size)))) &&
    doc.artId === artId &&
    Number.isFinite(doc.width) &&
    doc.width >= 1 &&
    doc.width <= 10000 &&
    Number.isFinite(doc.height) &&
    doc.height >= 1 &&
    doc.height <= 10000 &&
    (doc.background === 'transparent' || isColor(doc.background)) &&
    Array.isArray(doc.layers) &&
    doc.layers.length <= 500 &&
    new Set(doc.layers.map((l) => l?.id)).size === doc.layers.length &&
    (!doc.selection ||
      (validMask(doc.selection.mask) &&
        doc.layers.some(
          (l) =>
            l?.kind === 'raster' &&
            l.id === doc.selection!.layerId &&
            l.width === doc.selection!.mask.width &&
            l.height === doc.selection!.mask.height,
        ))) &&
    new Set(doc.layers.filter((l) => l?.kind === 'raster').map((l) => (l as RasterLayer).assetId))
      .size <= 12 &&
    [
      ...new Map(
        doc.layers
          .filter((l) => l?.kind === 'raster')
          .map((l) => [(l as RasterLayer).assetId, l as RasterLayer]),
      ).values(),
    ].reduce((n, l) => n + l.width * l.height, 0) <= 40000000 &&
    doc.layers.every(
      (l) =>
        !!l &&
        typeof l === 'object' &&
        typeof l.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(l.id) &&
        typeof l.label === 'string' &&
        l.label.length <= 500 &&
        (l.group === undefined || (typeof l.group === 'string' && l.group.length <= 100)) &&
        typeof l.visible === 'boolean' &&
        typeof l.locked === 'boolean' &&
        (l.paletteOriginal === undefined ||
          (typeof l.paletteOriginal === 'string' && l.paletteOriginal.length < 1000000)) &&
        [l.x, l.y, l.scaleX, l.scaleY, l.angle, l.opacity].every(Number.isFinite) &&
        l.opacity >= 0 &&
        l.opacity <= 1 &&
        Math.abs(l.x) < 100000 &&
        Math.abs(l.y) < 100000 &&
        Math.abs(l.angle) <= 100000 &&
        l.scaleX >= 0.01 &&
        l.scaleX <= 100 &&
        l.scaleY >= 0.01 &&
        l.scaleY <= 100 &&
        (l.kind === 'vector'
          ? typeof l.markup === 'string' && l.markup.length < 1000000
          : l.kind === 'raster'
            ? (doc.version === 2
                ? /^[a-z0-9-]{1,160}$/.test(l.assetId)
                : l.assetId === doc.artId) &&
              validRegions(l) &&
              (l.ai === undefined || validAiMetadata(l.ai)) &&
              /^[a-f0-9]{64}$/.test(l.sourceSha256) &&
              Number.isInteger(l.width) &&
              l.width > 0 &&
              l.width <= 4096 &&
              Number.isInteger(l.height) &&
              l.height > 0 &&
              l.height <= 4096
            : l.kind === 'text' &&
              typeof l.text === 'string' &&
              l.text.length <= 500 &&
              Number.isFinite(l.size) &&
              l.size > 0 &&
              l.size <= 500 &&
              isColor(l.color) &&
              validTypography(l.typography) &&
              typeof l.bold === 'boolean' &&
              ['start', 'middle', 'end'].includes(l.align)),
    ) &&
    !!doc.print &&
    ['letter', 'a4'].includes(doc.print.paper) &&
    ['portrait', 'landscape'].includes(doc.print.orientation) &&
    Number.isFinite(doc.print.margin) &&
    doc.print.margin >= 0 &&
    doc.print.margin <= 2 &&
    ['fit', 'fill', 'actual', 'native'].includes(doc.print.scale) &&
    (doc.crop === null ||
      (!!doc.crop &&
        [doc.crop.x, doc.crop.y, doc.crop.width, doc.crop.height].every(Number.isFinite) &&
        Math.abs(doc.crop.x) <= 10000 &&
        Math.abs(doc.crop.y) <= 10000 &&
        doc.crop.width >= 1 &&
        doc.crop.width <= 10000 &&
        doc.crop.height >= 1 &&
        doc.crop.height <= 10000))
  );
}

/** Version 1 remains readable. Version 2 adds hash-bound sources and compact region masks. */
export function migrateDocument(value: EditorDocument): EditorDocument {
  return { ...clone(value), version: 2 };
}
function validMask(mask: unknown): boolean {
  if (!mask || typeof mask !== 'object') return false;
  const m = mask as import('./smart/types').MaskData;
  if (
    m.encoding !== 'rle8' ||
    ![m.width, m.height].every((v) => Number.isInteger(v) && v > 0 && v <= 4096) ||
    typeof m.data !== 'string' ||
    m.data.length > 24000000 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(m.data)
  )
    return false;
  try {
    const bytes = atob(m.data);
    let i = 0,
      size = 0;
    while (i < bytes.length) {
      let n = 0,
        shift = 0,
        b;
      do {
        if (i >= bytes.length || shift > 21) return false;
        b = bytes.charCodeAt(i++);
        n += (b & 127) * 2 ** shift;
        shift += 7;
      } while (b & 128);
      if (n < 1 || i >= bytes.length) return false;
      i++;
      size += n;
      if (size > m.width * m.height) return false;
    }
    return size === m.width * m.height;
  } catch {
    return false;
  }
}
function validRegions(layer: RasterLayer): boolean {
  if (
    layer.regions &&
    (!Array.isArray(layer.regions) ||
      layer.regions.length > 100 ||
      new Set(layer.regions.map((r) => r?.id)).size !== layer.regions.length ||
      !layer.regions.every((r) => {
        if (
          !r ||
          typeof r.id !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
          typeof r.name !== 'string' ||
          r.name.length > 100 ||
          typeof r.visible !== 'boolean' ||
          typeof r.locked !== 'boolean' ||
          !validMask(r.mask) ||
          r.mask.width !== layer.width ||
          r.mask.height !== layer.height
        )
          return false;
        if (
          !validAdjustment(r.adjustment) ||
          (r.paletteAdjustment && !validAdjustment(r.paletteAdjustment))
        )
          return false;
        if (
          r.palette &&
          (!Array.isArray(r.palette.source) ||
            !Array.isArray(r.palette.target) ||
            !r.palette.source.length ||
            r.palette.source.length > 6 ||
            !r.palette.target.length ||
            r.palette.target.length > 6 ||
            ![...r.palette.source, ...r.palette.target].every(isColor))
        )
          return false;
        if (r.stage && !['before-effects', 'after-effects'].includes(r.stage)) return false;
        if (r.operation && !['color', 'erase', 'restore', 'clone', 'repair'].includes(r.operation))
          return false;
        if (
          r.offset &&
          ![r.offset.x, r.offset.y].every((v) => Number.isFinite(v) && Math.abs(v) <= 4096)
        )
          return false;
        const p = r.pattern;
        return (
          !p ||
          (['none', 'dots', 'stripes', 'plaid', 'diamonds', 'texture', 'gradient'].includes(
            p.kind,
          ) &&
            ['normal', 'multiply', 'screen'].includes(p.blend) &&
            isColor(p.color) &&
            isColor(p.secondary) &&
            Number.isFinite(p.scale) &&
            p.scale >= 2 &&
            p.scale <= 1000 &&
            Number.isFinite(p.angle) &&
            Math.abs(p.angle) <= 360 &&
            Number.isFinite(p.opacity) &&
            p.opacity >= 0 &&
            p.opacity <= 1)
        );
      }))
  )
    return false;
  return (
    !layer.effects ||
    (Array.isArray(layer.effects) &&
      layer.effects.length <= 24 &&
      layer.effects.every(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          /^[a-zA-Z0-9_-]{1,100}$/.test(e.id) &&
          typeof e.enabled === 'boolean' &&
          [
            'sticker',
            'coloring',
            'outline',
            'shadow',
            'inner-shadow',
            'glow',
            'blur',
            'sharpen',
            'balance',
            'emboss',
          ].includes(e.kind) &&
          [e.amount, e.detail].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) &&
          Number.isFinite(e.radius) &&
          e.radius >= 0 &&
          e.radius <= 64 &&
          Number.isFinite(e.smooth) &&
          e.smooth >= 0 &&
          e.smooth <= 12 &&
          [e.x, e.y].every((v) => Number.isFinite(v) && Math.abs(v) <= 128) &&
          isColor(e.color) &&
          typeof e.cut === 'boolean',
      ))
  );
}
function validTypography(t: Typography | undefined): boolean {
  return (
    !t ||
    (['straight', 'arc', 'circle'].includes(t.layout) &&
      ['sans', 'serif', 'mono'].includes(t.font) &&
      Number.isFinite(t.radius) &&
      t.radius >= 20 &&
      t.radius <= 4000 &&
      Number.isFinite(t.spacing) &&
      t.spacing >= -20 &&
      t.spacing <= 100 &&
      Number.isFinite(t.lineHeight) &&
      t.lineHeight >= 0.5 &&
      t.lineHeight <= 3 &&
      isColor(t.stroke) &&
      Number.isFinite(t.strokeWidth) &&
      t.strokeWidth >= 0 &&
      t.strokeWidth <= 20 &&
      typeof t.shadow === 'boolean' &&
      (t.italic === undefined || typeof t.italic === 'boolean') &&
      (t.decoration === undefined || ['none', 'underline', 'strike'].includes(t.decoration)))
  );
}

function validAdjustment(a: import('./smart/types').Adjustment): boolean {
  return !(
    !a ||
    !['replace', 'tint', 'adjust'].includes(a.mode) ||
    !isColor(a.color) ||
    ![a.intensity, a.opacity].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
    !Number.isFinite(a.hue) ||
    Math.abs(a.hue) > 180 ||
    ![a.saturation, a.brightness, a.contrast].every(
      (v) => Number.isFinite(v) && v >= -100 && v <= 100,
    ) ||
    typeof a.grayscale !== 'boolean'
  );
}
