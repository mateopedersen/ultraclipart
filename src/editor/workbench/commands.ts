import { clone, type EditorDocument, type Layer, type TextLayer } from '../model';
import { layerColors, NS, sanitizeSvg } from '../svg';
import type { WorkbenchCommandId } from './catalog';
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface CommandContext {
  selected: string[];
  bounds: (ids: string[]) => Box | null;
  value?: string;
  second?: string;
  margin?: number;
}
const merge = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
};
const number = (value: string | undefined, min: number, max: number, fallback: number) => {
  const n = value?.trim() ? Number(value) : fallback;
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error(`Enter a number from ${min} to ${max}.`);
  return n;
};
const outside = (box: Box, area: Box, complete = false) =>
  complete
    ? box.x + box.width <= area.x ||
      box.y + box.height <= area.y ||
      box.x >= area.x + area.width ||
      box.y >= area.y + area.height
    : box.x < area.x ||
      box.y < area.y ||
      box.x + box.width > area.x + area.width ||
      box.y + box.height > area.y + area.height;
export function documentCommand(
  id: WorkbenchCommandId,
  source: EditorDocument,
  c: CommandContext,
): { document?: EditorDocument; selection?: string[] } {
  const d = clone(source),
    area = d.crop || { x: 0, y: 0, width: d.width, height: d.height };
  const chosen = d.layers.filter((l) => c.selected.includes(l.id));
  const editable = chosen.filter((l) => l.visible && !l.locked);
  const first = chosen[0];
  const select = (predicate: (l: Layer) => boolean) => ({
    selection: d.layers.filter(predicate).map((l) => l.id),
  });
  if (id === 'select-none') return { selection: [] };
  if (id === 'select-invert')
    return select((l) => l.visible && !l.locked && !c.selected.includes(l.id));
  if (id === 'select-text' || id === 'select-vector' || id === 'select-raster')
    return select((l) => l.visible && !l.locked && l.kind === id.slice(7));
  if (id === 'select-locked') return select((l) => l.locked);
  if (id === 'select-hidden') return select((l) => !l.visible);
  if (id === 'select-unlocked') return select((l) => !l.locked);
  if (id === 'select-name') {
    const query = (c.value || '').trim().toLowerCase();
    if (!query) throw Error('Enter a layer name to search.');
    return select((l) => l.label.toLowerCase().includes(query));
  }
  if (id === 'select-outside')
    return select((l) => {
      const b = c.bounds([l.id]);
      return !!b && outside(b, area);
    });
  if (id === 'select-opacity') {
    if (!first) throw Error('Select a reference object first.');
    return select((l) => l.visible && !l.locked && Math.abs(l.opacity - first.opacity) < 0.001);
  }
  if (id === 'select-color') {
    if (!first) throw Error('Select a text or vector reference first.');
    const colors = layerColors(first);
    if (!colors.length) throw Error('This object has no editable text or vector color.');
    return select(
      (l) => l.visible && !l.locked && layerColors(l).some((color) => colors.includes(color)),
    );
  }
  if (id === 'rename-project') {
    const title = (c.value || '').trim().slice(0, 120);
    if (!title) throw Error('Enter a project name.');
    d.title = title;
    return { document: d };
  }
  if (id === 'unlock-all') {
    d.layers.forEach((l) => (l.locked = false));
    return { document: d };
  }
  if (id === 'show-all') {
    d.layers.forEach((l) => {
      if (!l.locked) l.visible = true;
    });
    return { document: d };
  }
  if (id === 'delete-hidden') {
    d.layers = d.layers.filter((l) => l.visible || l.locked);
    return { document: d };
  }
  if (id === 'delete-empty-text') {
    d.layers = d.layers.filter((l) => l.locked || l.kind !== 'text' || l.text.trim());
    return { document: d };
  }
  if (id === 'delete-outside') {
    d.layers = d.layers.filter((l) => {
      const b = c.bounds([l.id]);
      return l.locked || !b || !outside(b, area, true);
    });
    return { document: d };
  }
  if (!chosen.length) throw Error('Select one or more objects on the canvas first.');
  if (id === 'lock-selection') {
    chosen.forEach((l) => (l.locked = true));
    return { document: d };
  }
  if (id === 'hide-selection') {
    chosen.forEach((l) => {
      if (!l.locked) l.visible = false;
    });
    return { document: d };
  }
  if (id === 'solo-selection') {
    d.layers.forEach((l) => {
      if (!l.locked) l.visible = c.selected.includes(l.id);
    });
    return { document: d };
  }
  if (!editable.length) throw Error('Choose visible, unlocked objects first.');
  if (id === 'prefix-names') {
    const prefix = (c.value || '').trim();
    if (!prefix) throw Error('Enter a short name prefix.');
    editable.forEach((l) => (l.label = `${prefix} ${l.label}`.slice(0, 80)));
    return { document: d };
  }
  if (id === 'number-names') {
    editable.forEach(
      (l, i) => (l.label = `${i + 1}. ${l.label.replace(/^\d+\.\s*/, '')}`.slice(0, 80)),
    );
    return { document: d };
  }
  if (id === 'label-from-text') {
    editable
      .filter((l): l is TextLayer => l.kind === 'text')
      .forEach((l) => (l.label = l.text.trim().slice(0, 80) || 'Empty text'));
    return { document: d };
  }
  if (id.startsWith('text-')) {
    const layers = editable.filter((l): l is TextLayer => l.kind === 'text');
    if (!layers.length) throw Error('Select an unlocked text object first.');
    layers.forEach((l, i) => {
      let t = l.text;
      if (id === 'text-upper') t = t.toLocaleUpperCase();
      else if (id === 'text-lower') t = t.toLocaleLowerCase();
      else if (id === 'text-title')
        t = t.toLocaleLowerCase().replace(/\b\p{L}/gu, (x) => x.toLocaleUpperCase());
      else if (id === 'text-sentence')
        t = t
          .toLocaleLowerCase()
          .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase());
      else if (id === 'text-trim')
        t = t
          .split('\n')
          .map((line) => line.trim().replace(/[\t ]+/g, ' '))
          .join('\n')
          .trim();
      else if (id === 'text-join') t = t.replace(/\s*\n\s*/g, ' ');
      else if (id === 'text-bullets')
        t = t
          .split('\n')
          .map((line) => (line.trim() ? `• ${line.replace(/^[•*]\s*/, '')}` : ''))
          .join('\n');
      else if (id === 'text-numbers')
        t = t
          .split('\n')
          .map((line, n) => `${n + 1}. ${line.replace(/^\d+\.\s*/, '')}`)
          .join('\n');
      else if (id === 'text-sequence') t = `${i + 1}. ${t.replace(/^\d+\.\s*/, '')}`;
      else if (id === 'text-replace') {
        if (!c.value) throw Error('Enter the phrase to replace.');
        t = t.split(c.value).join(c.second || '');
      } else if (id === 'text-sort-lines')
        t = t
          .split('\n')
          .sort((a, b) => a.localeCompare(b))
          .join('\n');
      else if (id === 'text-reverse-lines') t = t.split('\n').reverse().join('\n');
      else throw Error('This text command is not available.');
      if (t.length > 500) throw Error('This change would exceed 500 characters in a text object.');
      l.text = t;
    });
    return { document: d };
  }
  if (id === 'full-opacity') {
    editable.forEach((l) => (l.opacity = 1));
    return { document: d };
  }
  if (
    [
      'swap-paints',
      'remove-fill',
      'remove-stroke',
      'round-joins',
      'square-joins',
      'dashed-strokes',
      'solid-strokes',
    ].includes(id)
  ) {
    const vectors = editable.filter((l) => l.kind === 'vector');
    if (!vectors.length) throw Error('Select an unlocked vector object first.');
    for (const l of vectors) {
      if (l.kind !== 'vector') continue;
      const svg = sanitizeSvg(`<svg xmlns="${NS}">${l.markup}</svg>`);
      for (const el of svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')) {
        if (id === 'swap-paints') {
          const fill = el.getAttribute('fill') || '#000000',
            stroke = el.getAttribute('stroke') || 'none';
          el.setAttribute('fill', stroke);
          el.setAttribute('stroke', fill);
          if (fill !== 'none' && Number(el.getAttribute('stroke-width') || 0) === 0)
            el.setAttribute('stroke-width', '2');
        }
        if (id === 'remove-fill') {
          if ((el.getAttribute('stroke') || 'none') === 'none') {
            el.setAttribute('stroke', el.getAttribute('fill') || '#000000');
            el.setAttribute('stroke-width', '2');
          }
          el.setAttribute('fill', 'none');
        }
        if (id === 'remove-stroke') {
          if ((el.getAttribute('fill') || 'black') === 'none')
            el.setAttribute('fill', el.getAttribute('stroke') || '#000000');
          el.setAttribute('stroke', 'none');
        }
        if (id === 'round-joins') {
          el.setAttribute('stroke-linecap', 'round');
          el.setAttribute('stroke-linejoin', 'round');
        }
        if (id === 'square-joins') {
          el.setAttribute('stroke-linecap', 'square');
          el.setAttribute('stroke-linejoin', 'miter');
        }
        if (id === 'dashed-strokes') {
          if ((el.getAttribute('stroke') || 'none') === 'none') {
            el.setAttribute('stroke', el.getAttribute('fill') || '#000000');
            el.setAttribute('stroke-width', '2');
          }
          el.setAttribute('stroke-dasharray', '8 5');
        }
        if (id === 'solid-strokes') {
          el.removeAttribute('stroke-dasharray');
          el.removeAttribute('stroke-dashoffset');
        }
      }
      l.markup = svg.innerHTML;
    }
    return { document: d };
  }
  const grouped = new Map<string, Layer[]>();
  for (const l of editable) {
    if (l.group && d.layers.some((m) => m.group === l.group && !editable.includes(m)))
      throw Error('Select every visible, unlocked layer in a linked group first.');
    grouped.set(l.group || l.id, [...(grouped.get(l.group || l.id) || []), l]);
  }
  const units = [...grouped.values()]
    .map((layers) => ({ layers, box: c.bounds(layers.map((l) => l.id)) }))
    .filter((u): u is { layers: Layer[]; box: Box } => !!u.box);
  if (!units.length) throw Error('The selected objects have no measurable bounds.');
  const box = merge(units.map((u) => u.box)),
    reference = units[0].box;
  const move = (u: (typeof units)[number], x: number, y: number) =>
    u.layers.forEach((l) => {
      l.x += x - u.box.x;
      l.y += y - u.box.y;
    });
  if (id === 'swap-positions') {
    if (units.length !== 2)
      throw Error('Select exactly two independent objects or complete groups.');
    move(units[0], units[1].box.x, units[1].box.y);
    move(units[1], reference.x, reference.y);
  } else if (['match-width', 'match-height', 'match-size'].includes(id))
    for (const u of units.slice(1)) {
      const sx = id === 'match-height' ? 1 : reference.width / Math.max(1, u.box.width),
        sy = id === 'match-width' ? 1 : reference.height / Math.max(1, u.box.height);
      u.layers.forEach((l) => {
        l.x = u.box.x + (l.x - u.box.x) * sx;
        l.y = u.box.y + (l.y - u.box.y) * sy;
        l.scaleX *= sx;
        l.scaleY *= sy;
      });
    }
  else if (id === 'match-rotation') editable.forEach((l) => (l.angle = editable[0].angle));
  else if (id === 'match-opacity') editable.forEach((l) => (l.opacity = editable[0].opacity));
  else if (id === 'stack-horizontal' || id === 'stack-vertical') {
    const gap = number(c.value, 0, 1000, 24);
    let x = box.x,
      y = box.y;
    for (const u of units) {
      move(u, x, y);
      if (id === 'stack-horizontal') x += u.box.width + gap;
      else y += u.box.height + gap;
    }
  } else if (id === 'reading-order' || id === 'reverse-order') {
    const ids = new Set(editable.map((l) => l.id));
    const ordered =
      id === 'reverse-order'
        ? [...editable].reverse()
        : [...units]
            .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
            .flatMap((u) => u.layers);
    let i = 0;
    d.layers = d.layers.map((l) => (ids.has(l.id) ? ordered[i++] : l));
  } else if (id === 'pack-rows' || id === 'pack-columns') {
    const gap = number(c.value, 0, 1000, 16);
    let x = area.x + gap,
      y = area.y + gap,
      line = 0;
    for (const u of units) {
      if (u.box.width > area.width - gap * 2 || u.box.height > area.height - gap * 2)
        throw Error('An object is larger than the available canvas. Reduce its size first.');
      if (id === 'pack-rows') {
        if (x + u.box.width > area.x + area.width - gap) {
          x = area.x + gap;
          y += line + gap;
          line = 0;
        }
        if (y + u.box.height > area.y + area.height - gap)
          throw Error('These objects do not fit on this canvas with that gap.');
        move(u, x, y);
        x += u.box.width + gap;
        line = Math.max(line, u.box.height);
      } else {
        if (y + u.box.height > area.y + area.height - gap) {
          y = area.y + gap;
          x += line + gap;
          line = 0;
        }
        if (x + u.box.width > area.x + area.width - gap)
          throw Error('These objects do not fit on this canvas with that gap.');
        move(u, x, y);
        y += u.box.height + gap;
        line = Math.max(line, u.box.width);
      }
    }
  } else if (id === 'fit-safe') {
    const margin = number(String(c.margin ?? 24), 0, Math.min(area.width, area.height) / 2 - 1, 24),
      scale = Math.min(
        (area.width - margin * 2) / Math.max(1, box.width),
        (area.height - margin * 2) / Math.max(1, box.height),
      );
    const x = area.x + (area.width - box.width * scale) / 2,
      y = area.y + (area.height - box.height * scale) / 2;
    editable.forEach((l) => {
      l.x = x + (l.x - box.x) * scale;
      l.y = y + (l.y - box.y) * scale;
      l.scaleX *= scale;
      l.scaleY *= scale;
    });
  } else if (id === 'mirror-layout-x' || id === 'mirror-layout-y')
    for (const u of units)
      move(
        u,
        id === 'mirror-layout-x' ? box.x + box.width - (u.box.x - box.x) - u.box.width : u.box.x,
        id === 'mirror-layout-y' ? box.y + box.height - (u.box.y - box.y) - u.box.height : u.box.y,
      );
  else throw Error('This command is not a document transformation.');
  for (const l of d.layers)
    if (l.scaleX < 0.01 || l.scaleY < 0.01 || l.scaleX > 100 || l.scaleY > 100)
      throw Error('This change would exceed the supported object scale.');
  return { document: d };
}
