export type StylePreset = 'original' | 'pastel' | 'grayscale' | 'vintage' | 'bright' | 'outline';
export interface Transform { x: number; y: number; scaleX: number; scaleY: number; angle: number; }
interface LayerBase extends Transform { id: string; label: string; visible: boolean; locked: boolean; opacity: number; group?: string; }
export interface VectorLayer extends LayerBase { kind: 'vector'; markup: string; }
export interface TextLayer extends LayerBase { kind: 'text'; text: string; size: number; color: string; bold: boolean; align: 'start' | 'middle' | 'end'; }
export type Layer = VectorLayer | TextLayer;
export interface EditorDocument { version: 1; artId: string; width: number; height: number; background: string; layers: Layer[]; crop: null | { x: number; y: number; width: number; height: number }; print: { paper: 'letter' | 'a4'; orientation: 'portrait' | 'landscape'; margin: number; scale: 'fit' | 'fill' | 'actual' }; }
export const identity = (): Transform => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0 });
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const isColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);
export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
export const transformString = (layer: Transform): string => `translate(${layer.x} ${layer.y}) rotate(${layer.angle}) scale(${layer.scaleX} ${layer.scaleY})`;
export function changeLayers(doc: EditorDocument, ids: string[], update: (layer: Layer) => void): EditorDocument {
 const next = clone(doc); next.layers.filter(layer => ids.includes(layer.id) && !layer.locked && layer.visible).forEach(update); return next;
}
export class History<T> {
 private past: T[] = []; private future: T[] = []; public current: T;
 constructor(initial: T, private limit = 75) { this.current = clone(initial); }
 get canUndo() { return this.past.length > 0; } get canRedo() { return this.future.length > 0; }
 commit(next: T) { if (JSON.stringify(this.current) === JSON.stringify(next)) return false; this.past.push(clone(this.current)); if(this.past.length > this.limit) this.past.shift(); this.current = clone(next); this.future = []; return true; }
 undo() { const prev = this.past.pop(); if(prev !== undefined) { this.future.push(clone(this.current)); this.current = prev; } return this.current; }
 redo() { const next = this.future.pop(); if(next !== undefined) { this.past.push(clone(this.current)); this.current = next; } return this.current; }
}
export function validateDocument(value: unknown, artId: string): value is EditorDocument {
 if (!value || typeof value !== 'object') return false;
 const doc = value as EditorDocument;
 return doc.version === 1 && doc.artId === artId && Number.isFinite(doc.width) && doc.width > 0 && doc.width <= 10000 && Number.isFinite(doc.height) && doc.height > 0 && doc.height <= 10000 && (doc.background === 'transparent' || isColor(doc.background)) && Array.isArray(doc.layers) && doc.layers.length <= 500 && new Set(doc.layers.map(l => l?.id)).size === doc.layers.length && doc.layers.every(l => !!l && typeof l === 'object' && typeof l.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(l.id) && typeof l.label === 'string' && typeof l.visible === 'boolean' && typeof l.locked === 'boolean' && [l.x,l.y,l.scaleX,l.scaleY,l.angle,l.opacity].every(Number.isFinite) && l.opacity >= 0 && l.opacity <= 1 && Math.abs(l.x)<100000 && Math.abs(l.y)<100000 && l.scaleX>0 && l.scaleX<=100 && l.scaleY>0 && l.scaleY<=100 && (l.kind === 'vector' ? typeof l.markup === 'string' && l.markup.length < 1000000 : l.kind === 'text' && typeof l.text === 'string' && l.text.length <= 500 && Number.isFinite(l.size) && l.size > 0 && l.size <= 500 && isColor(l.color) && typeof l.bold === 'boolean' && ['start','middle','end'].includes(l.align))) && !!doc.print && ['letter','a4'].includes(doc.print.paper) && ['portrait','landscape'].includes(doc.print.orientation) && Number.isFinite(doc.print.margin) && doc.print.margin >= 0 && doc.print.margin <= 2 && ['fit','fill','actual'].includes(doc.print.scale) && (doc.crop === null || !!doc.crop && [doc.crop.x,doc.crop.y,doc.crop.width,doc.crop.height].every(Number.isFinite) && doc.crop.width>0 && doc.crop.height>0);
}
