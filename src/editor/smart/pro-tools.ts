import { clone, isColor, validateDocument, type EditorDocument, type Layer } from '../model';
import { vectorLayer } from '../creation';
import { validateProjectMarkup } from '../svg';
import type { EditorHost } from './controller';
type Box = { x: number; y: number; width: number; height: number };
type Unit = { layers: Layer[]; box: Box };
const uid = () => `pro-${crypto.randomUUID()}`;
const center = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Bounds come from the same rendered SVG as the selection handles, including rotations. */
function bounds(host: EditorHost, ids: string[]): Box {
  const svg = host.canvas.querySelector('svg');
  const points: DOMPoint[] = [];
  if (!svg || host.root.dataset.processing === 'true')
    throw new Error('Wait for the canvas to finish drawing.');
  for (const id of ids) {
    const node = [...svg.querySelectorAll<SVGGElement>('[data-layer]')].find(
      (n) => n.dataset.layer === id,
    );
    const matrix = node?.getScreenCTM();
    const inverse = node?.ownerSVGElement?.getScreenCTM()?.inverse();
    if (!node || !matrix || !inverse) continue;
    const b = node.getBBox();
    if (!b.width && !b.height) continue;
    for (const [x, y] of [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ])
      points.push(new DOMPoint(x, y).matrixTransform(inverse.multiply(matrix)));
  }
  if (!points.length) throw new Error('Choose visible artwork with a measurable size.');
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    width: Math.max(...points.map((p) => p.x)) - x,
    height: Math.max(...points.map((p) => p.y)) - y,
  };
}
function selectedUnits(host: EditorHost): Unit[] {
  const doc = host.committed();
  const selected = doc.layers.filter(
    (l) => host.selected().includes(l.id) && l.visible && !l.locked,
  );
  if (!selected.length) throw new Error('Select visible, unlocked artwork first.');
  for (const l of selected)
    if (l.group && doc.layers.some((m) => m.group === l.group && !selected.includes(m)))
      throw new Error('Select and unlock every layer in the linked group first.');
  const groups = new Map<string, Layer[]>();
  for (const l of selected)
    groups.set(l.group || l.id, [...(groups.get(l.group || l.id) || []), l]);
  return [...groups.values()].map((layers) => ({
    layers,
    box: bounds(
      host,
      layers.map((l) => l.id),
    ),
  }));
}
function scaleInto(layers: Layer[], box: Box, target: Box) {
  const scale = Math.min(
    target.width / Math.max(1, box.width),
    target.height / Math.max(1, box.height),
  );
  if (
    layers.some(
      (l) =>
        Math.min(l.scaleX, l.scaleY) * scale < 0.01 || Math.max(l.scaleX, l.scaleY) * scale > 100,
    )
  )
    throw new Error(
      'This layout would make a layer too small or too large. Adjust the canvas or spacing.',
    );
  const x = target.x + (target.width - box.width * scale) / 2;
  const y = target.y + (target.height - box.height * scale) / 2;
  for (const l of layers) {
    l.x = x + (l.x - box.x) * scale;
    l.y = y + (l.y - box.y) * scale;
    l.scaleX *= scale;
    l.scaleY *= scale;
  }
}

export class ProTools {
  constructor(private host: EditorHost) {}
  private value(name: string) {
    return this.host.root.querySelector<HTMLInputElement>(`[data-pro-${name}]`)!.value;
  }
  private number(name: string, min: number, max: number, integer = false) {
    const n = Number(this.value(name));
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
      throw new Error(
        `Use ${integer ? 'a whole number' : 'a value'} from ${min} to ${max} for ${name.replaceAll('-', ' ')}.`,
      );
    return n;
  }
  private finish(d: EditorDocument, message: string) {
    if (d.layers.length > 500)
      throw new Error('This arrangement exceeds 500 layers. Reduce the copy count.');
    d.version = 2;
    delete d.selection;
    if (JSON.stringify(d).length > 16000000 || !validateDocument(d, d.artId))
      throw new Error(
        'This arrangement exceeds the project limits. Reduce the number or size of the copied items.',
      );
    validateProjectMarkup(d);
    this.host.commit(d, message + ' Undo restores the previous layout.');
  }
  action(action: string): boolean {
    if (!action.startsWith('pro-')) return false;
    if (action === 'pro-radial') this.radial();
    else if (action === 'pro-layout') this.layout();
    else if (action === 'pro-backdrop') this.backdrop();
    else if (action === 'pro-canvas') this.canvas();
    else if (action === 'pro-preflight') this.preflight();
    else return false;
    return true;
  }
  private radial() {
    const units = selectedUnits(this.host),
      source = units.flatMap((u) => u.layers);
    const box = bounds(
        this.host,
        source.map((l) => l.id),
      ),
      c = center(box);
    const count = this.number('copies', 2, 48, true),
      radius = this.number('radius', 20, 1800);
    const sweep = this.number('sweep', 15, 360),
      start = this.number('start', -360, 360);
    const mode = this.value('orbit'),
      rotate = this.value('rotate') === 'follow';
    const d = clone(this.host.committed());
    const replacing = this.value('source') === 'replace';
    if (d.layers.length + source.length * (count - Number(replacing)) > 500)
      throw new Error('Reduce the copy count to stay within 500 layers.');
    const copies: Layer[] = [];
    for (let i = 0; i < count; i++) {
      const a = ((start + (sweep === 360 ? i / count : i / (count - 1)) * sweep) * Math.PI) / 180;
      const r = mode === 'spiral' ? radius * (0.2 + (0.8 * i) / (count - 1)) : radius;
      const rotation = rotate ? a + Math.PI / 2 : 0,
        cosine = Math.cos(rotation),
        sine = Math.sin(rotation);
      const target = { x: d.width / 2 + Math.cos(a) * r, y: d.height / 2 + Math.sin(a) * r };
      const group = uid();
      for (const layer of source) {
        const l = clone(layer),
          dx = layer.x - c.x,
          dy = layer.y - c.y;
        l.id = uid();
        l.group = group;
        l.label = `${layer.label.slice(0, 70)} · ${i + 1}`;
        l.x = target.x + dx * cosine - dy * sine;
        l.y = target.y + dx * sine + dy * cosine;
        l.angle += (rotation * 180) / Math.PI;
        copies.push(l);
      }
    }
    // Fit the whole construction, including rotated bounds, inside the canvas.
    const corners: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = ((start + (sweep === 360 ? i / count : i / (count - 1)) * sweep) * Math.PI) / 180;
      const r = mode === 'spiral' ? radius * (0.2 + (0.8 * i) / (count - 1)) : radius;
      const rot = rotate ? a + Math.PI / 2 : 0;
      for (const [dx, dy] of [
        [-box.width / 2, -box.height / 2],
        [box.width / 2, -box.height / 2],
        [-box.width / 2, box.height / 2],
        [box.width / 2, box.height / 2],
      ])
        corners.push({
          x: d.width / 2 + Math.cos(a) * r + dx * Math.cos(rot) - dy * Math.sin(rot),
          y: d.height / 2 + Math.sin(a) * r + dx * Math.sin(rot) + dy * Math.cos(rot),
        });
    }
    const x = Math.min(...corners.map((p) => p.x)),
      y = Math.min(...corners.map((p) => p.y));
    scaleInto(
      copies,
      {
        x,
        y,
        width: Math.max(...corners.map((p) => p.x)) - x,
        height: Math.max(...corners.map((p) => p.y)) - y,
      },
      { x: 24, y: 24, width: d.width - 48, height: d.height - 48 },
    );
    if (replacing) d.layers = d.layers.filter((l) => !source.some((s) => s.id === l.id));
    d.layers.push(...copies);
    this.finish(
      d,
      `${count} editable ${mode === 'spiral' ? 'spiral' : 'circular'} copies created.`,
    );
    this.host.select(copies[0].id);
  }
  private layout() {
    const units = selectedUnits(this.host),
      d = clone(this.host.committed());
    const columns = this.number('columns', 1, 12, true),
      gap = this.number('gap', 0, 200),
      margin = this.number('margin', 0, 300);
    const rows = Math.ceil(units.length / columns),
      w = (d.width - margin * 2 - gap * (columns - 1)) / columns,
      h = (d.height - margin * 2 - gap * (rows - 1)) / rows;
    if (w < 8 || h < 8)
      throw new Error('The cells are too small. Reduce columns, margins or gaps.');
    units.forEach((unit, i) => {
      const layers = d.layers.filter((l) => unit.layers.some((s) => s.id === l.id));
      scaleInto(layers, unit.box, {
        x: margin + (i % columns) * (w + gap),
        y: margin + Math.floor(i / columns) * (h + gap),
        width: w,
        height: h,
      });
    });
    this.finish(
      d,
      `${units.length} selected items arranged in ${columns} columns with even spacing.`,
    );
  }
  private backdrop() {
    const d = clone(this.host.committed()),
      size = this.number('tile', 16, 240),
      density = this.number('motif-size', 1, 40);
    const foreground = this.value('ink'),
      background = this.value('paper'),
      kind = this.value('backdrop');
    if (!isColor(foreground) || !isColor(background))
      throw new Error('Choose valid background colors.');
    const pieces = [`<rect width="${d.width}" height="${d.height}" fill="${background}"/>`];
    const columns = Math.ceil(d.width / size),
      rows = Math.ceil(d.height / size);
    const tiled = ['checks', 'dots', 'diamonds', 'confetti', 'grid'].includes(kind);
    if (tiled && columns * rows > 1800)
      throw new Error(
        'Increase motif spacing for this canvas. Keep the background under 1,800 tiles.',
      );
    for (let row = 0; row < (tiled ? rows : 0); row++)
      for (let col = 0; col < columns; col++) {
        const x = col * size,
          y = row * size,
          w = Math.min(size, d.width - x),
          h = Math.min(size, d.height - y);
        if (kind === 'checks' && (row + col) % 2 === 0)
          pieces.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${foreground}"/>`);
        else if (kind === 'dots')
          pieces.push(
            `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(density, w / 3, h / 3)}" fill="${foreground}"/>`,
          );
        else if (kind === 'diamonds') {
          const cx = x + w / 2,
            cy = y + h / 2,
            r = Math.min(density, w / 2, h / 2);
          pieces.push(
            `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${foreground}"/>`,
          );
        } else if (kind === 'confetti') {
          const r = Math.min(density, w / 4, h / 4),
            cx = x + w / 2,
            cy = y + h / 2,
            a = (row * 37 + col * 53) % 180;
          pieces.push(
            `<rect x="${cx - r}" y="${cy - r / 3}" width="${r * 2}" height="${(r * 2) / 3}" rx="1" fill="${foreground}" transform="rotate(${a} ${cx} ${cy})"/>`,
          );
        } else if (kind === 'grid') {
          const stroke = Math.min(density, 5, w, h),
            inset = stroke / 2;
          pieces.push(
            `<path d="M${x + inset} ${y + inset}H${x + w - inset}V${y + h - inset}" fill="none" stroke="${foreground}" stroke-width="${stroke}"/>`,
          );
        }
      }
    if (kind === 'stripes')
      for (let x = 0; x < d.width; x += size)
        pieces.push(
          `<rect x="${x}" width="${Math.min(density, d.width - x)}" height="${d.height}" fill="${foreground}"/>`,
        );
    if (kind === 'frame' || kind === 'double-frame') {
      const inset = Math.min(size, d.width / 4, d.height / 4),
        stroke = Math.min(density, inset);
      pieces.push(
        `<rect x="${inset}" y="${inset}" width="${d.width - inset * 2}" height="${d.height - inset * 2}" rx="${Math.min(12, inset / 2)}" fill="none" stroke="${foreground}" stroke-width="${stroke}"/>`,
      );
      if (kind === 'double-frame')
        pieces.push(
          `<rect x="${inset + stroke * 2}" y="${inset + stroke * 2}" width="${Math.max(1, d.width - (inset + stroke * 2) * 2)}" height="${Math.max(1, d.height - (inset + stroke * 2) * 2)}" fill="none" stroke="${foreground}" stroke-width="${Math.max(1, stroke / 3)}"/>`,
        );
    }
    // One replaceable layer; repeated Apply never silently stacks identical backdrops.
    const old = d.layers.find((l) => l.id.startsWith('pro-backdrop-'));
    if (old?.locked) throw new Error('Unlock the existing Studio background before replacing it.');
    d.layers = d.layers.filter((l) => !l.id.startsWith('pro-backdrop-'));
    d.layers.unshift(
      vectorLayer(`pro-backdrop-${crypto.randomUUID()}`, 'Studio Background', pieces.join('')),
    );
    this.finish(d, 'Editable vector background added behind your artwork.');
  }
  private canvas() {
    const d = clone(this.host.committed()),
      mode = this.value('canvas-mode'),
      padding = this.number('padding', 0, 500);
    const layers = d.layers.filter((l) => l.visible && !l.id.startsWith('pro-backdrop-'));
    if (!layers.length) throw new Error('Add visible artwork before fitting the canvas.');
    if (d.layers.some((l) => l.locked))
      throw new Error('Unlock layers before changing their canvas placement.');
    const box = bounds(
      this.host,
      layers.map((l) => l.id),
    );
    if (mode === 'trim') {
      d.width = Math.max(64, Math.ceil(box.width + padding * 2));
      d.height = Math.max(64, Math.ceil(box.height + padding * 2));
      if (d.width > 4096 || d.height > 4096)
        throw new Error('Trimmed canvas exceeds 4,096 px. Reduce the padding or artwork size.');
      for (const l of d.layers) {
        l.x += padding - box.x;
        l.y += padding - box.y;
      }
    } else {
      const sizes: Record<string, [number, number]> = {
        square: [1080, 1080],
        portrait: [1080, 1350],
        story: [1080, 1920],
        landscape: [1920, 1080],
        a4: [793.7008, 1122.5197],
        letter: [816, 1056],
      };
      const size = sizes[this.value('canvas-size')];
      if (!size) throw new Error('Choose a canvas size.');
      [d.width, d.height] = size;
      if (padding * 2 >= Math.min(d.width, d.height) - 8)
        throw new Error('Reduce the padding for this canvas.');
      // Apply one shared transform to hidden layers too, keeping alternate versions aligned.
      scaleInto(d.layers, box, {
        x: padding,
        y: padding,
        width: d.width - padding * 2,
        height: d.height - padding * 2,
      });
      if (['a4', 'letter'].includes(this.value('canvas-size')))
        d.print = {
          paper: this.value('canvas-size') as 'a4' | 'letter',
          orientation: 'portrait',
          margin: 0,
          scale: 'actual',
        };
    }
    // A full-canvas backdrop has to be regenerated at the new size.
    d.layers = d.layers.filter((l) => !l.id.startsWith('pro-backdrop-'));
    d.crop = null;
    this.finish(
      d,
      'Canvas fitted to your artwork. Reapply a Studio background at the new size if needed.',
    );
    this.host.zoom(1);
  }
  private preflight() {
    const d = this.host.committed(),
      visible = d.layers.filter((l) => l.visible),
      rows: string[] = [];
    rows.push(
      `${d.width.toFixed(0)} × ${d.height.toFixed(0)} px · ${visible.length} visible layers · ${d.layers.filter((l) => !l.visible).length} hidden.`,
    );
    const edge = d.crop || { x: 0, y: 0, width: d.width, height: d.height };
    for (const l of visible) {
      const b = bounds(this.host, [l.id]);
      if (
        b.x < edge.x - 0.5 ||
        b.y < edge.y - 0.5 ||
        b.x + b.width > edge.x + edge.width + 0.5 ||
        b.y + b.height > edge.y + edge.height + 0.5
      )
        rows.push(
          `${l.label}: extends beyond the exported canvas. Use Canvas Fit or reposition it.`,
        );
      if (l.kind === 'raster' && Math.max(Math.abs(l.scaleX), Math.abs(l.scaleY)) > 1)
        rows.push(
          `${l.label}: enlarged above its source pixel size; inspect sharpness before printing.`,
        );
      if (l.kind === 'text')
        rows.push(
          `${l.label}: PDF uses standard print fonts. Review the PDF proof for text differences.`,
        );
    }
    if (!visible.length) rows.push('No visible artwork to export.');
    if (d.background === 'transparent')
      rows.push(
        'Transparent background: image export preserves transparency; paper proofs appear white.',
      );
    if (rows.length === 1) rows.push('All visible artwork fits inside the canvas.');
    const report = this.host.root.querySelector<HTMLElement>('[data-pro-report]')!;
    const ul = document.createElement('ul');
    for (const message of rows) {
      const li = document.createElement('li');
      li.textContent = message;
      ul.append(li);
    }
    report.replaceChildren(ul);
    this.host.status('Canvas review updated. Review it again after changing your artwork.');
  }
}
