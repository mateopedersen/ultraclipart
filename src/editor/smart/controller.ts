import { clone, transformString, type EditorDocument, type RasterLayer } from '../model';
import { NS } from '../svg';
import { rasterPixels } from '../raster';
import { encodeMask, decodeMask, combineMasks, brushMask, polygonMask } from './pixels';
import { defaultAdjustment, type Region, type Point, type Adjustment } from './types';
import { withProcessor } from './render';
import { StudioTools } from './studio';
export interface EditorHost {
  root: HTMLElement;
  stage: HTMLElement;
  canvas: HTMLElement;
  doc: () => EditorDocument;
  committed: () => EditorDocument;
  selected: () => string[];
  commit: (doc: EditorDocument, message?: string) => void;
  preview: (doc?: EditorDocument) => void;
  select: (id: string) => void;
  panel: (name: string) => void;
  render: () => void;
  status: (message: string, error?: boolean) => void;
  zoom: (amount: number) => void;
}
type Tool =
  'smart' | 'wand' | 'lasso' | 'polygon' | 'brush' | 'erase' | 'restore' | 'clone' | 'repair';
export class SmartController {
  private target = '';
  public regionId = '';
  private active = false;
  private comparing = false;
  private generation = 0;
  private overlayKey = '';
  private overlayUrl = '';
  private shownRegion = '';
  private mask?: Uint8Array;
  private gesture?: {
    pointer: number;
    points: Point[];
    mask: Uint8Array;
    last: Point;
    offset: Point;
    pressure: number;
  };
  private polygon: Point[] = [];
  private touches = new Map<number, Point>();
  private pinchDistance = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private studio: StudioTools;
  private operations = 0;
  constructor(public host: EditorHost) {
    const { root, stage } = host;
    root.dataset.workMode = 'quick';
    this.studio = new StudioTools(this);
    root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.dataset.workMode) {
        root.dataset.workMode = button.dataset.workMode;
        root
          .querySelectorAll<HTMLButtonElement>('[data-work-mode]')
          .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        host.panel(button.dataset.workMode === 'print' ? 'studio' : 'region');
        return;
      }
      if (button.dataset.smartAction) {
        this.operations++;
        root.dataset.operationBusy = 'true';
        void this.action(button.dataset.smartAction)
          .catch((error) => host.status(error.message, true))
          .finally(() => {
            root.dataset.operationBusy = String(--this.operations > 0);
          });
      }
      if (button.dataset.regionSelect) this.openRegion(button.dataset.regionSelect);
      if (button.dataset.regionCommand)
        this.regionCommand(button.dataset.regionCommand, button.dataset.regionId!);
    });
    root.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.matches('[data-smart-source]')) {
        this.cancel();
        this.target = target.value;
        this.regionId = '';
        host.select(target.value);
        this.render();
      } else if (target.matches('[data-smart-tool]')) {
        this.cancel();
        this.active = true;
        root.dataset.smartActive = 'true';
        this.toolControls();
      } else if (target.matches('[data-mask-overlay]')) this.drawOverlay();
      else if (
        target.matches(
          '[data-region-color],[data-region-mode],[data-adjust],[data-region-grayscale]',
        )
      ) {
        clearTimeout(this.timer);
        void this.apply().catch((e) => host.status(e.message, true));
      } else if (
        target.matches('[data-tolerance],[data-contiguous],[data-distance],[data-connectivity]')
      )
        this.q('data-tolerance-value').textContent = this.value('data-tolerance');
      else if (target.matches('[data-studio-tool]')) this.studio.show();
    });
    root.addEventListener('input', (event) => {
      if ((event.target as Element).matches('[data-region-color],[data-adjust]')) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          try {
            this.previewAdjustment();
          } catch {}
        }, 90);
      }
    });
    stage.addEventListener('pointerdown', (e) => this.down(e), true);
    stage.addEventListener('pointermove', (e) => this.move(e), true);
    stage.addEventListener('pointerup', (e) => this.up(e), true);
    stage.addEventListener(
      'pointercancel',
      (e) => {
        if (this.active) {
          this.cancel();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    root.addEventListener(
      'keydown',
      (e) => {
        if (!this.active || !stage.contains(e.target as Node)) return;
        if (e.key === 'Escape') {
          this.cancel();
          e.preventDefault();
          e.stopImmediatePropagation();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          void (
            this.tool() === 'polygon'
              ? this.action('finish-polygon')
              : this.selectPoint({ x: this.number('data-point-x'), y: this.number('data-point-y') })
          ).catch((error) => host.status(error.message, true));
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          const layer = this.layer();
          if (!layer) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          const step = e.shiftKey ? 10 : 1;
          const x =
              this.number('data-point-x') +
              (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
            y =
              this.number('data-point-y') +
              (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
          this.q<HTMLInputElement>('data-point-x').value = String(
            Math.max(0, Math.min(layer.width - 1, x)),
          );
          this.q<HTMLInputElement>('data-point-y').value = String(
            Math.max(0, Math.min(layer.height - 1, y)),
          );
          this.drawOverlay();
        } else if (e.key === '+' || e.key === '-') {
          e.preventDefault();
          e.stopImmediatePropagation();
          host.zoom(e.key === '+' ? 1.25 : 0.8);
        }
      },
      true,
    );
  }
  q<T extends HTMLElement = HTMLElement>(attribute: string) {
    return this.host.root.querySelector<T>(`[${attribute}]`)!;
  }
  value(attribute: string) {
    return this.q<HTMLInputElement>(attribute).value;
  }
  number(attribute: string) {
    return Number(this.value(attribute));
  }
  checked(attribute: string) {
    return this.q<HTMLInputElement>(attribute).checked;
  }
  layer(): RasterLayer | undefined {
    const d = this.host.committed(),
      selected = d.layers.find(
        (l) => this.host.selected().includes(l.id) && l.kind === 'raster',
      ) as RasterLayer | undefined;
    return (
      selected ||
      (d.layers.find((l) => l.id === this.target && l.kind === 'raster') as
        RasterLayer | undefined) ||
      (d.layers.find((l) => l.kind === 'raster') as RasterLayer | undefined)
    );
  }
  requireLayer() {
    const layer = this.layer();
    if (!layer)
      throw new Error(
        'Select an image layer first. Add catalogue clipart with Composer if needed.',
      );
    if (layer.locked) throw new Error('Unlock this image layer before editing its pixels.');
    if (!layer.visible) throw new Error('Show this image layer before editing.');
    return layer;
  }
  region() {
    return this.layer()?.regions?.find((r) => r.id === this.regionId);
  }
  selection() {
    const l = this.layer(),
      s = this.host.committed().selection;
    return l && s?.layerId === l.id
      ? decodeMask(s.mask)
      : l
        ? new Uint8Array(l.width * l.height)
        : new Uint8Array();
  }
  tool() {
    return this.value('data-smart-tool') as Tool;
  }
  onPanel(name: string) {
    this.active = name === 'region';
    this.host.root.dataset.smartActive = String(this.active);
    if (!this.active) {
      this.cancel();
    }
    this.render();
    if (name === 'studio') this.studio.show();
  }
  cancel() {
    clearTimeout(this.timer);
    this.generation++;
    this.gesture = undefined;
    this.mask = undefined;
    this.polygon = [];
    this.touches.clear();
    this.pinchDistance = 0;
    this.comparing = false;
    this.q('data-smart-action="compare"')?.setAttribute('aria-pressed', 'false');
    this.host.preview();
    this.drawOverlay();
  }
  private toolControls() {
    const t = this.tool(),
      brush = ['brush', 'erase', 'restore', 'clone', 'repair'].includes(t);
    this.q('data-wand-controls').hidden = t !== 'smart' && t !== 'wand';
    this.q('data-brush-controls').hidden = !brush;
    this.q('data-clone-controls').hidden = t !== 'clone' && t !== 'repair';
    this.q('data-smart-action="finish-polygon"').hidden = t !== 'polygon';
    this.q('data-smart-help').textContent =
      t === 'polygon'
        ? 'Click around the region, then Finish polygon or press Enter.'
        : t === 'lasso'
          ? 'Draw around the desired region. Release to close the selection.'
          : brush
            ? 'Paint on the image. The original is preserved; Undo reverses each stroke.'
            : 'Click a connected color region. Smart Select uses local color and edges; similar neighboring parts may need manual refinement.';
  }
  render() {
    for (const button of this.host.root.querySelectorAll<HTMLButtonElement>(
      'button[data-work-mode]',
    ))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.workMode === this.host.root.dataset.workMode),
      );
    const layer = this.layer();
    if (layer) this.target = layer.id;
    const picker = this.q<HTMLSelectElement>('data-smart-source');
    picker.replaceChildren(
      ...this.host
        .committed()
        .layers.filter((l): l is RasterLayer => l.kind === 'raster')
        .map((l) => {
          const o = document.createElement('option');
          o.value = l.id;
          o.textContent = l.label;
          o.selected = l.id === layer?.id;
          return o;
        }),
    );
    const region = this.region();
    if (this.regionId && !region) this.regionId = '';
    if (region && this.shownRegion !== region.id) {
      this.shownRegion = region.id;
      this.inputs(region.adjustment);
      this.q<HTMLInputElement>('data-region-name').value = region.name;
    }
    this.q('data-regions').replaceChildren(
      ...[...(layer?.regions || [])].reverse().map((r) => {
        const row = document.createElement('div');
        row.className = 'uc-region-row';
        const open = document.createElement('button');
        open.dataset.regionSelect = r.id;
        open.textContent = r.name;
        open.setAttribute('aria-pressed', String(r.id === this.regionId));
        row.append(open);
        for (const [action, label] of [
          ['visibility', r.visible ? 'Hide' : 'Show'],
          ['lock', r.locked ? 'Unlock' : 'Lock'],
          ['duplicate', 'Copy'],
          ['up', '↑'],
          ['down', '↓'],
          ['delete', 'Delete'],
        ]) {
          const b = document.createElement('button');
          b.dataset.regionCommand = action;
          b.dataset.regionId = r.id;
          b.textContent = label;
          b.setAttribute('aria-label', `${label} ${r.name}`);
          row.append(b);
        }
        return row;
      }),
    );
    this.toolControls();
    this.drawOverlay();
    this.studio.renderEffects();
  }
  inputs(a: Adjustment) {
    this.q<HTMLInputElement>('data-region-color').value = a.color;
    this.q<HTMLSelectElement>('data-region-mode').value = a.mode;
    for (const input of this.host.root.querySelectorAll<HTMLInputElement>('[data-adjust]')) {
      const key = input.dataset.adjust as keyof Adjustment;
      input.value = String(Number(a[key]) * (key === 'opacity' || key === 'intensity' ? 100 : 1));
    }
    this.q<HTMLInputElement>('data-region-grayscale').checked = a.grayscale;
  }
  adjustment(): Adjustment {
    const a = defaultAdjustment();
    a.color = this.value('data-region-color');
    a.mode = this.value('data-region-mode') as Adjustment['mode'];
    a.grayscale = this.checked('data-region-grayscale');
    for (const input of this.host.root.querySelectorAll<HTMLInputElement>('[data-adjust]'))
      Object.assign(a, {
        [input.dataset.adjust!]:
          Number(input.value) /
          (input.dataset.adjust === 'opacity' || input.dataset.adjust === 'intensity' ? 100 : 1),
      });
    return a;
  }
  private adjustedDocument(): EditorDocument {
    const layer = this.requireLayer(),
      current = this.region();
    if (current?.locked) throw new Error('Unlock the region before changing it.');
    const mask = this.selection();
    if (!mask.some((v) => v > 0)) throw new Error('Select a region first.');
    const d = clone(this.host.committed()),
      target = d.layers.find((l) => l.id === layer.id) as RasterLayer;
    target.regions ??= [];
    const region: Region = current
      ? clone(current)
      : {
          id: `region-${crypto.randomUUID()}`,
          name: 'Selected region',
          visible: true,
          locked: false,
          mask: encodeMask(mask, layer.width, layer.height),
          adjustment: defaultAdjustment(),
        };
    region.mask = encodeMask(mask, layer.width, layer.height);
    region.adjustment = this.adjustment();
    region.name = this.value('data-region-name').trim().slice(0, 100) || 'Selected region';
    const index = target.regions.findIndex((r) => r.id === region.id);
    if (index >= 0) target.regions[index] = region;
    else target.regions.push(region);
    d.version = 2;
    return d;
  }
  private previewAdjustment() {
    this.comparing = false;
    this.host.preview(this.adjustedDocument());
  }
  async apply() {
    const d = this.adjustedDocument(),
      l = d.layers.find((l) => l.id === this.layer()!.id) as RasterLayer;
    this.regionId = this.regionId || l.regions!.at(-1)!.id;
    this.host.commit(d, 'Region saved. Its mask and color remain editable.');
  }
  updateLayer(fn: (layer: RasterLayer) => void, message: string) {
    const source = this.requireLayer(),
      d = clone(this.host.committed()),
      target = d.layers.find((l) => l.id === source.id) as RasterLayer;
    fn(target);
    d.version = 2;
    this.host.commit(d, message);
  }
  setSelection(mask: Uint8Array, message = 'Selection ready. Choose a color, or refine the mask.') {
    const layer = this.requireLayer(),
      d = clone(this.host.committed());
    d.version = 2;
    d.selection = { layerId: layer.id, mask: encodeMask(mask, layer.width, layer.height) };
    this.mask = undefined;
    this.host.commit(d, message);
  }
  async selectPoint(point: Point) {
    const layer = this.requireLayer(),
      generation = ++this.generation,
      snapshot = this.host.committed(),
      start = performance.now();
    this.host.status('Finding a region…');
    const mask = await withProcessor(layer, (processor) =>
      processor.run<Uint8Array>('select', {
        point,
        options: {
          tolerance: this.number('data-tolerance'),
          contiguous: this.tool() === 'smart' || this.checked('data-contiguous'),
          perceptual: this.tool() === 'smart' || this.value('data-distance') === 'perceptual',
          connectivity: Number(this.value('data-connectivity')),
          smart: this.tool() === 'smart',
        },
      }),
    );
    if (generation !== this.generation || snapshot !== this.host.committed()) return;
    this.host.root.dataset.selectionMs = String(Math.round(performance.now() - start));
    if (this.value('data-mask-mode') === 'replace') {
      this.regionId = '';
      this.shownRegion = '';
    }
    this.setSelection(
      combineMasks(
        this.selection(),
        mask,
        this.value('data-mask-mode') as 'replace' | 'add' | 'subtract',
      ),
      mask.some((v) => v)
        ? `Selection ready (${Math.round(performance.now() - start)} ms). Review the overlay, then choose a color.`
        : 'No visible region at this point. Try the lasso or brush.',
    );
  }
  private point(e: PointerEvent): Point | undefined {
    const layer = this.layer();
    if (!layer) return;
    const g = this.host.canvas.querySelector<SVGGElement>(`[data-layer="${layer.id}"]`),
      matrix = g?.getScreenCTM();
    if (!matrix) return;
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  }
  private down(e: PointerEvent) {
    if (!this.active || e.button !== 0) return;
    const p = this.point(e);
    if (!p) return;
    const layer = this.layer()!;
    if (p.x < 0 || p.y < 0 || p.x >= layer.width || p.y >= layer.height) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.host.stage.focus({ preventScroll: true });
    this.host.stage.setPointerCapture(e.pointerId);
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      this.generation++;
      this.gesture = undefined;
      this.mask = undefined;
      const a = [...this.touches.values()];
      this.pinchDistance = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      return;
    }
    this.q<HTMLInputElement>('data-point-x').value = String(Math.round(p.x));
    this.q<HTMLInputElement>('data-point-y').value = String(Math.round(p.y));
    try {
      this.requireLayer();
      const t = this.tool();
      if ((t === 'clone' || t === 'repair') && e.altKey) {
        this.q<HTMLInputElement>('data-sample-x').value = String(Math.round(p.x));
        this.q<HTMLInputElement>('data-sample-y').value = String(Math.round(p.y));
        this.host.status('Clone source set. Paint the destination.');
        return;
      }
      if (t === 'smart' || t === 'wand') {
        void this.selectPoint(p).catch((error) => this.host.status(error.message, true));
        return;
      }
      if (t === 'polygon') {
        if (this.polygon.length < 2000) this.polygon.push(p);
        this.drawOverlay();
        return;
      }
      const mask =
        t === 'brush' && this.value('data-mask-mode') !== 'replace'
          ? this.selection()
          : new Uint8Array(layer.width * layer.height);
      this.gesture = {
        pointer: e.pointerId,
        points: [p],
        last: p,
        mask,
        offset: { x: this.number('data-sample-x') - p.x, y: this.number('data-sample-y') - p.y },
        pressure: e.pointerType === 'pen' ? e.pressure : 1,
      };
      if (t !== 'lasso') {
        brushMask(
          mask,
          layer.width,
          layer.height,
          p,
          p,
          this.number('data-brush-size') / 2,
          this.number('data-brush-hardness') / 100,
          t === 'brush' && this.value('data-mask-mode') === 'subtract',
        );
        this.mask = mask;
        this.drawOverlay();
      }
    } catch (error) {
      this.host.status((error as Error).message, true);
    }
  }
  private move(e: PointerEvent) {
    if (!this.active) return;
    if (this.touches.has(e.pointerId))
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const a = [...this.touches.values()],
        distance = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      if (this.pinchDistance && distance > 0) this.host.zoom(distance / this.pinchDistance);
      this.pinchDistance = distance;
      return;
    }
    const gesture = this.gesture;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const p = this.point(e),
      layer = this.layer();
    if (!p || !layer) return;
    if (this.tool() === 'lasso') {
      if (
        gesture.points.length < 2000 &&
        Math.hypot(p.x - gesture.last.x, p.y - gesture.last.y) > 1
      )
        gesture.points.push(p);
    } else {
      const pressure = e.pointerType === 'pen' ? Math.max(0.15, e.pressure) : 1;
      brushMask(
        gesture.mask,
        layer.width,
        layer.height,
        gesture.last,
        p,
        (this.number('data-brush-size') / 2) * pressure,
        this.number('data-brush-hardness') / 100,
        this.tool() === 'brush' && this.value('data-mask-mode') === 'subtract',
      );
      this.mask = gesture.mask;
    }
    gesture.last = p;
    this.drawOverlay();
  }
  private up(e: PointerEvent) {
    if (!this.active) return;
    e.stopImmediatePropagation();
    this.touches.delete(e.pointerId);
    if (this.host.stage.hasPointerCapture(e.pointerId))
      this.host.stage.releasePointerCapture(e.pointerId);
    const gesture = this.gesture,
      layer = this.layer();
    if (!gesture || gesture.pointer !== e.pointerId || !layer) return;
    this.gesture = undefined;
    try {
      const t = this.tool();
      if (t === 'lasso') {
        if (this.value('data-mask-mode') === 'replace') this.regionId = '';
        this.setSelection(
          combineMasks(
            this.selection(),
            polygonMask(gesture.points, layer.width, layer.height),
            this.value('data-mask-mode') as 'replace' | 'add' | 'subtract',
          ),
        );
      } else if (t === 'brush') {
        if (this.value('data-mask-mode') === 'replace') this.regionId = '';
        this.setSelection(gesture.mask);
      } else {
        const region: Region = {
          id: `region-${crypto.randomUUID()}`,
          name: (
            {
              erase: 'Erase',
              restore: 'Restore source',
              clone: 'Clone stamp',
              repair: 'Local repair',
            } as Record<string, string>
          )[t],
          visible: true,
          locked: false,
          mask: encodeMask(gesture.mask, layer.width, layer.height),
          adjustment: { ...defaultAdjustment(), mode: 'adjust' },
          operation: t as Region['operation'],
          stage: layer.effects?.some((e) => e.enabled && e.kind === 'coloring')
            ? 'after-effects'
            : 'before-effects',
          offset: gesture.offset,
        };
        this.updateLayer((l) => {
          l.regions ??= [];
          l.regions.push(region);
        }, 'Brush stroke saved. Undo restores the previous image.');
      }
    } catch (error) {
      this.host.status((error as Error).message, true);
    }
    this.mask = undefined;
    this.drawOverlay();
  }
  drawOverlay() {
    const svg = this.host.canvas.querySelector('svg');
    if (!svg) return;
    svg.querySelector('.uc-mask-overlay')?.remove();
    if (!this.active || this.comparing || !this.checked('data-mask-overlay')) return;
    const layer = this.layer();
    if (!layer) return;
    const group = document.createElementNS(NS, 'g');
    group.classList.add('uc-mask-overlay');
    group.setAttribute('transform', transformString(layer));
    group.setAttribute('aria-hidden', 'true');
    group.setAttribute('pointer-events', 'none');
    const saved = this.host.committed().selection,
      mask = this.mask || (saved?.layerId === layer.id ? decodeMask(saved.mask) : undefined),
      key = this.mask ? '' : saved?.mask.data || '';
    if (mask) {
      if (!key || key !== this.overlayKey) {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(1, 768 / Math.max(layer.width, layer.height));
        canvas.width = Math.max(1, Math.round(layer.width * ratio));
        canvas.height = Math.max(1, Math.round(layer.height * ratio));
        const ctx = canvas.getContext('2d')!,
          data = ctx.createImageData(canvas.width, canvas.height);
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            const i = y * canvas.width + x,
              sx = Math.min(layer.width - 1, Math.floor(x / ratio)),
              sy = Math.min(layer.height - 1, Math.floor(y / ratio)),
              p = sy * layer.width + sx,
              edge =
                mask[p] > 128 &&
                (!mask[p - 1] || !mask[p + 1] || !mask[p - layer.width] || !mask[p + layer.width]);
            data.data[i * 4] = 30;
            data.data[i * 4 + 1] = 130;
            data.data[i * 4 + 2] = 255;
            data.data[i * 4 + 3] = edge ? 220 : Math.round(mask[p] * 0.38);
          }
        ctx.putImageData(data, 0, 0);
        this.overlayUrl = canvas.toDataURL();
        this.overlayKey = key;
      }
      const image = document.createElementNS(NS, 'image');
      image.setAttribute('href', this.overlayUrl);
      image.setAttribute('width', String(layer.width));
      image.setAttribute('height', String(layer.height));
      group.append(image);
    }
    const points = this.polygon.length ? this.polygon : this.gesture?.points;
    if (points && points.length > 1) {
      const path = document.createElementNS(NS, 'polyline');
      path.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
      path.setAttribute('fill', '#2670ed22');
      path.setAttribute('stroke', '#2670ed');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      group.append(path);
    }
    svg.append(group);
  }
  private openRegion(id: string) {
    const region = this.layer()?.regions?.find((r) => r.id === id);
    if (!region) return;
    this.regionId = id;
    this.shownRegion = '';
    this.setSelection(
      decodeMask(region.mask),
      'Saved region opened. Change the mask or adjustment, then Save region.',
    );
    this.host.panel('region');
  }
  private regionCommand(action: string, id: string) {
    this.updateLayer((l) => {
      const regions = l.regions!,
        index = regions.findIndex((r) => r.id === id),
        r = regions[index];
      if (action === 'lock') r.locked = !r.locked;
      else if (!r.locked) {
        if (action === 'visibility') r.visible = !r.visible;
        else if (action === 'delete') regions.splice(index, 1);
        else if (action === 'duplicate')
          regions.splice(index + 1, 0, {
            ...clone(r),
            id: `region-${crypto.randomUUID()}`,
            name: r.name + ' copy',
          });
        else {
          const other = index + (action === 'up' ? 1 : -1);
          if (other >= 0 && other < regions.length)
            [regions[index], regions[other]] = [regions[other], regions[index]];
        }
      }
    }, 'Region updated.');
  }
  async action(action: string) {
    if (action === 'collapse-properties') {
      this.host.root.dataset.propertiesCollapsed = String(
        this.host.root.dataset.propertiesCollapsed !== 'true',
      );
      return;
    }
    if (action === 'clear' || action === 'new-region') {
      this.cancel();
      this.regionId = '';
      this.shownRegion = '';
      this.inputs(defaultAdjustment());
      this.q<HTMLInputElement>('data-region-name').value = 'Selected region';
      const d = clone(this.host.committed());
      delete d.selection;
      this.host.commit(d, 'Choose another region.');
      return;
    }
    if (action === 'apply') {
      await this.apply();
      return;
    }
    if (action === 'compare') {
      this.comparing = !this.comparing;
      this.q('data-smart-action="compare"').setAttribute('aria-pressed', String(this.comparing));
      const d = clone(this.host.committed());
      if (this.comparing)
        for (const l of d.layers)
          if (l.kind === 'raster') {
            l.regions = [];
            l.effects = [];
          }
      this.host.preview(this.comparing ? d : undefined);
      return;
    }
    if (action === 'reset-region') {
      this.inputs({ ...defaultAdjustment(), mode: 'adjust' });
      if (this.region()) await this.apply();
      return;
    }
    if (action === 'select-point') {
      await this.selectPoint({ x: this.number('data-point-x'), y: this.number('data-point-y') });
      return;
    }
    if (action === 'all') {
      const l = this.requireLayer(),
        image = rasterPixels(l);
      this.regionId = '';
      this.setSelection(
        Uint8Array.from({ length: l.width * l.height }, (_, i) =>
          image.data[i * 4 + 3] ? 255 : 0,
        ),
      );
      return;
    }
    if (action === 'finish-polygon') {
      const l = this.requireLayer();
      if (this.polygon.length < 3) throw new Error('Choose at least three polygon points.');
      if (this.value('data-mask-mode') === 'replace') this.regionId = '';
      this.setSelection(
        combineMasks(
          this.selection(),
          polygonMask(this.polygon, l.width, l.height),
          this.value('data-mask-mode') as 'replace' | 'add' | 'subtract',
        ),
      );
      this.polygon = [];
      this.drawOverlay();
      return;
    }
    if (action === 'refine') {
      const l = this.requireLayer(),
        generation = ++this.generation;
      this.host.status('Refining mask…');
      const mask = await withProcessor(l, (p) =>
        p.run<Uint8Array>('refine', {
          mask: this.selection(),
          kind: this.value('data-refine-kind'),
          radius: this.number('data-refine-radius'),
        }),
      );
      if (generation === this.generation)
        this.setSelection(mask, 'Mask refined. Review the edge before saving.');
      return;
    }
    await this.studio.action(action);
  }
}
