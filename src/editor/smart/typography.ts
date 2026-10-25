import type { TextLayer } from '../model';
const NS = 'http://www.w3.org/2000/svg';
/** Center new text using its rendered shape, so rings and long titles do not start off-canvas. */
export function fitNewText(
  layer: TextLayer,
  area: { x: number; y: number; width: number; height: number },
) {
  const svg = document.createElementNS(NS, 'svg'),
    group = document.createElementNS(NS, 'g');
  svg.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none';
  group.append(...textNodes(layer));
  svg.append(group);
  document.body.append(svg);
  try {
    const b = group.getBBox(),
      padding = Math.min(24, area.width / 8, area.height / 8);
    const stroke = layer.typography?.strokeWidth || 0;
    const scale = Math.min(
      1,
      (area.width - padding * 2) / Math.max(1, b.width + stroke * 2),
      (area.height - padding * 2) / Math.max(1, b.height + stroke * 2),
    );
    if (scale < 0.01)
      throw new Error(
        'This text is too long for the canvas. Use fewer words or a smaller font size.',
      );
    layer.scaleX = layer.scaleY = scale;
    layer.x = area.x + area.width / 2 - (b.x + b.width / 2) * scale;
    layer.y = area.y + area.height / 2 - (b.y + b.height / 2) * scale;
  } finally {
    svg.remove();
  }
  return layer;
}
export function textNodes(layer: TextLayer): SVGElement[] {
  const t = layer.typography,
    nodes: SVGElement[] = [],
    family =
      t?.font === 'serif'
        ? 'Georgia, Times New Roman, serif'
        : t?.font === 'mono'
          ? 'Courier New, monospace'
          : 'UltraEditorText, Arial, sans-serif';
  const text = (value: string, x: number, y: number, angle = 0, anchor = layer.align) => {
    const el = document.createElementNS(NS, 'text');
    el.textContent = value;
    el.setAttribute('data-caption', value);
    el.setAttribute('font-family', family);
    el.setAttribute('font-size', String(layer.size));
    el.setAttribute('font-weight', layer.bold ? '700' : '400');
    el.setAttribute('font-style', t?.italic ? 'italic' : 'normal');
    el.setAttribute('text-anchor', anchor);
    el.setAttribute('fill', layer.color);
    el.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
    if (t?.strokeWidth) {
      el.setAttribute('stroke', t.stroke);
      el.setAttribute('stroke-width', String(t.strokeWidth));
      el.setAttribute('stroke-linejoin', 'round');
      el.setAttribute('paint-order', 'stroke fill');
    }
    if (t?.shadow) {
      const shadow = el.cloneNode(true) as SVGTextElement;
      shadow.setAttribute('fill', '#15233b');
      shadow.setAttribute('stroke', 'none');
      shadow.setAttribute('opacity', '.3');
      shadow.setAttribute(
        'transform',
        `translate(${x + layer.size * 0.06} ${y + layer.size * 0.08}) rotate(${angle})`,
      );
      nodes.push(shadow);
    }
    nodes.push(el);
    if (t?.decoration && t.decoration !== 'none') {
      const measure = document.createElement('canvas').getContext('2d')!;
      measure.font = `${t.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${layer.size}px ${family}`;
      const width = measure.measureText(value).width;
      const start = anchor === 'middle' ? -width / 2 : anchor === 'end' ? -width : 0;
      const line = document.createElementNS(NS, 'path');
      const dy = t.decoration === 'underline' ? layer.size * 0.13 : -layer.size * 0.3;
      line.setAttribute('d', `M${start} ${dy} H${start + width}`);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', layer.color);
      line.setAttribute('stroke-width', String(Math.max(1, layer.size * 0.045)));
      line.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
      nodes.push(line);
    }
  };
  if (!t || (t.layout === 'straight' && !t.spacing)) {
    for (const [i, line] of layer.text.split('\n').entries())
      text(line, 0, i * layer.size * (t?.lineHeight || 1.2));
    return nodes;
  }
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${t?.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${layer.size}px ${family}`;
  for (const [lineIndex, line] of layer.text.split('\n').entries()) {
    const characters = [...line],
      widths = characters.map((c) => ctx.measureText(c).width + t.spacing),
      total = widths.reduce((a, b) => a + b, 0) - t.spacing;
    let offset = layer.align === 'middle' ? -total / 2 : layer.align === 'end' ? -total : 0;
    for (let i = 0; i < characters.length; i++) {
      const center = offset + widths[i] / 2;
      if (t.layout === 'straight')
        text(characters[i], offset, lineIndex * layer.size * t.lineHeight, 0, 'start');
      else {
        const radius = t.radius + lineIndex * layer.size * t.lineHeight,
          angle =
            t.layout === 'circle'
              ? (i / Math.max(1, characters.length)) * Math.PI * 2 - Math.PI / 2
              : center / radius - Math.PI / 2;
        text(
          characters[i],
          Math.cos(angle) * radius,
          Math.sin(angle) * radius + radius,
          (angle * 180) / Math.PI + 90,
          'middle',
        );
      }
      offset += widths[i];
    }
  }
  return nodes;
}
