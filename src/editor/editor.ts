import {
  History,
  changeLayers,
  clamp,
  clone,
  identity,
  isColor,
  validateDocument,
  type EditorDocument,
  type Layer,
  type StylePreset,
} from './model';
import {
  NS,
  documentSvg,
  download,
  fromSvg,
  fromCreationSvg,
  layerColors,
  preset,
  recolor,
  renderWebp,
  sanitizeSvg,
  strokeWidth,
  validateProjectMarkup,
} from './svg';
import { paperLayout, exportPdf } from './pdf';
import {
  blankDocument,
  shapeMarkup,
  shapeNames,
  vectorLayer,
  freehandPath,
  paintAttributes,
  type DrawPoint,
  type ShapeKind,
  type ShapeStyle,
} from './creation';

type Bounds = { x: number; y: number; width: number; height: number };
function init(root: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const qa = <T extends HTMLElement = HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const stage = q('.uc-stage'),
    canvas = q('.uc-canvas'),
    dialog = q<HTMLDialogElement>('[data-export-dialog]');
  const creator = root.dataset.creator === 'true';
  const id = root.dataset.artId!,
    storageKey = `ultraclipart:editor:v1:${id}`;
  let original: EditorDocument,
    history: History<EditorDocument>,
    selected: string[] = [],
    zoom = 1,
    matchedColor: string | undefined,
    live: EditorDocument | undefined;
  let panMode = false,
    panDrag: { x: number; y: number; left: number; top: number } | undefined;
  let printPreview = false,
    busy = false,
    exportGeneration = 0,
    exportFocus: HTMLElement | null = null;
  let drag:
    | { start: DOMPoint; before: EditorDocument; bounds: Bounds; action: string; pointer: number }
    | undefined;
  let drawing = false;
  let stroke:
    | {
        points: DrawPoint[];
        before: EditorDocument;
        pointer: number;
        id: string;
        style: ShapeStyle;
      }
    | undefined;
  let templateRequest: AbortController | undefined;
  const status = (message: string, error = false) => {
    q('[data-status]').textContent = message;
    q('[data-status]').dataset.error = String(error);
  };
  const doc = () => live || history.current;
  const currentLayer = () => doc().layers.find((l) => selected.includes(l.id));
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history.current));
    } catch {
      status(
        'Your changes work normally, but browser storage is unavailable. Save a project file to keep your edits.',
      );
    }
  }
  function cancelSource() {
    if (templateRequest) {
      templateRequest.abort();
      templateRequest = undefined;
      status('Starter loading cancelled. Your current work is preserved.');
    }
  }
  function commit(next: EditorDocument, message?: string) {
    cancelSource();
    live = undefined;
    if (next.layers.length > 500 || JSON.stringify(next).length > 2000000) {
      status(
        'This project reached the 500-layer or 2 MB editing limit. Save a copy, then simplify some layers to continue.',
        true,
      );
      render();
      return;
    }
    if (!validateDocument(next, id)) {
      status(
        'This change exceeds the supported editing limits. Your previous work is preserved.',
        true,
      );
      render();
      return;
    }
    try {
      validateProjectMarkup(next);
    } catch (error) {
      status(
        error instanceof Error ? error.message : 'This project cannot be edited safely.',
        true,
      );
      render();
      return;
    }
    if (history.commit(next)) {
      persist();
      if (message) status(message);
    }
    render();
  }
  function modify(fn: (next: EditorDocument) => void, message?: string) {
    const next = clone(history.current);
    fn(next);
    commit(next, message);
  }
  function selectedChange(fn: (layer: Layer) => void, message?: string) {
    commit(changeLayers(history.current, selected, fn), message);
  }
  function bounds(): Bounds | null {
    const svg = canvas.querySelector('svg');
    if (!svg) return null;
    const inv = svg.getCTM()?.inverse();
    if (!inv) return null;
    const points: DOMPoint[] = [];
    for (const sid of selected) {
      const node = svg.querySelector<SVGGElement>(`[data-layer="${sid}"]`);
      if (!node) continue;
      let b: DOMRect;
      try {
        b = node.getBBox();
      } catch {
        continue;
      }
      const matrix = node.getCTM();
      if (!matrix) continue;
      const m = inv.multiply(matrix);
      for (const [x, y] of [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x + b.width, b.y + b.height],
        [b.x, b.y + b.height],
      ])
        points.push(new DOMPoint(x, y).matrixTransform(m));
    }
    if (!points.length) return null;
    const x = Math.min(...points.map((p) => p.x)),
      y = Math.min(...points.map((p) => p.y));
    return {
      x,
      y,
      width: Math.max(...points.map((p) => p.x)) - x,
      height: Math.max(...points.map((p) => p.y)) - y,
    };
  }
  function paperSvg(state: EditorDocument): SVGSVGElement {
    const content = documentSvg(state),
      p = paperLayout(state),
      svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${p.pageWidth} ${p.pageHeight}`);
    svg.setAttribute('width', String(p.pageWidth));
    svg.setAttribute('height', String(p.pageHeight));
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#fff');
    svg.append(bg);
    content.setAttribute('x', String(p.x));
    content.setAttribute('y', String(p.y));
    content.setAttribute('width', String(p.width));
    content.setAttribute('height', String(p.height));
    const viewport = document.createElementNS(NS, 'svg');
    viewport.setAttribute('x', String(p.margin));
    viewport.setAttribute('y', String(p.margin));
    viewport.setAttribute('width', String(p.pageWidth - 2 * p.margin));
    viewport.setAttribute('height', String(p.pageHeight - 2 * p.margin));
    viewport.setAttribute(
      'viewBox',
      `${p.margin} ${p.margin} ${p.pageWidth - 2 * p.margin} ${p.pageHeight - 2 * p.margin}`,
    );
    viewport.style.overflow = 'hidden';
    viewport.append(content);
    svg.append(viewport);
    const margin = document.createElementNS(NS, 'rect');
    margin.setAttribute('x', String(p.margin));
    margin.setAttribute('y', String(p.margin));
    margin.setAttribute('width', String(p.pageWidth - p.margin * 2));
    margin.setAttribute('height', String(p.pageHeight - p.margin * 2));
    margin.setAttribute('class', 'uc-paper-margin');
    svg.append(margin);
    return svg;
  }
  function renderCanvas() {
    const d = doc(),
      svg = printPreview ? paperSvg(d) : documentSvg(d);
    svg.setAttribute('aria-label', 'Editable layered artwork');
    svg.setAttribute('data-artwork-canvas', '');
    canvas.replaceChildren(svg);
    const b = d.crop || d,
      p = paperLayout(d);
    canvas.style.aspectRatio = printPreview
      ? `${p.pageWidth}/${p.pageHeight}`
      : `${b.width}/${b.height}`;
    const ratio = printPreview ? p.pageWidth / p.pageHeight : b.width / b.height;
    canvas.style.width = `${Math.min(stage.clientWidth, stage.clientHeight * ratio) * zoom}px`;
    stage.classList.toggle('uc-paper-mode', printPreview);
    for (const node of svg.querySelectorAll<SVGGElement>('[data-layer]')) {
      const l = d.layers.find((l) => l.id === node.dataset.layer);
      node.setAttribute('data-locked', String(l?.locked || false));
    }
    root
      .querySelector<HTMLElement>('[data-empty-canvas]')
      ?.toggleAttribute('hidden', d.layers.some((l) => l.visible) || printPreview || drawing);
    if (printPreview) return;
    const selectedBounds = bounds();
    if (!selectedBounds) return;
    // Editing handles can extend beyond the artwork or crop. Keep them on a
    // separate overlay so the clipped artwork never makes a handle unreachable.
    const overlay = document.createElement('div');
    overlay.className = 'uc-selection-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    canvas.append(overlay);
    const { x, y, width, height } = selectedBounds;
    const viewport = d.crop ?? { x: 0, y: 0, width: d.width, height: d.height };
    const position = (element: HTMLElement, px: number, py: number) => {
      element.style.left = `${((px - viewport.x) / viewport.width) * 100}%`;
      element.style.top = `${((py - viewport.y) / viewport.height) * 100}%`;
    };
    const frame = document.createElement('div');
    position(frame, x, y);
    frame.style.width = `${(width / viewport.width) * 100}%`;
    frame.style.height = `${(height / viewport.height) * 100}%`;
    frame.className = 'uc-selection-box';
    overlay.append(frame);
    const positions = [
      ['nw', x, y],
      ['n', x + width / 2, y],
      ['ne', x + width, y],
      ['e', x + width, y + height / 2],
      ['se', x + width, y + height],
      ['s', x + width / 2, y + height],
      ['sw', x, y + height],
      ['w', x, y + height / 2],
    ] as const;
    positions.forEach(([name, hx, hy]) => {
      const handle = document.createElement('div');
      position(handle, hx, hy);
      handle.className = 'uc-handle';
      handle.setAttribute('data-handle', name);
      overlay.append(handle);
    });
    const rotate = document.createElement('div');
    position(rotate, x + width / 2, y);
    rotate.className = 'uc-handle uc-rotate-handle';
    rotate.setAttribute('data-handle', 'rotate');
    overlay.append(rotate);
  }
  function render() {
    if (!history) return;
    selected = selected.filter((id) => doc().layers.some((l) => l.id === id));
    renderCanvas();
    q<HTMLOutputElement>('[data-zoom]').value = `${Math.round(zoom * 100)}%`;
    q<HTMLButtonElement>('[data-action=undo]').disabled = !history.canUndo;
    q<HTMLButtonElement>('[data-action=redo]').disabled = !history.canRedo;
    if (creator) {
      q<HTMLInputElement>('[data-canvas-width]').value = String(doc().width);
      q<HTMLInputElement>('[data-canvas-height]').value = String(doc().height);
      q<HTMLButtonElement>('[data-action=paint-selection]').disabled = !selected.some((id) =>
        doc().layers.some((l) => l.id === id && !l.locked && l.visible && l.kind === 'vector'),
      );
    }
    const l = currentLayer();
    q('[data-selection]').textContent =
      selected.length > 1
        ? `${selected.length} linked or selected layers`
        : l
          ? `${l.label}${l.locked ? ' · locked' : ''}`
          : 'Select a layer to begin';
    for (const input of qa<HTMLInputElement>('[data-prop]')) {
      input.disabled = !l || l.locked || !l.visible;
      const key = input.dataset.prop as keyof Layer;
      const value = l?.[key];
      input.value =
        typeof value === 'number'
          ? String(
              Math.round(
                value * (key === 'scaleX' || key === 'scaleY' || key === 'opacity' ? 100 : 1) * 100,
              ) / 100,
            )
          : '';
    }
    q('[data-opacity-output]').textContent = `${Math.round((l?.opacity ?? 1) * 100)}%`;
    const picker = q<HTMLSelectElement>('[data-layer-picker]');
    picker.replaceChildren(
      ...doc().layers.map((layer) => {
        const o = document.createElement('option');
        o.value = layer.id;
        o.textContent = layer.label;
        o.selected = selected.includes(layer.id);
        return o;
      }),
    );
    const colors = l ? layerColors(l) : [];
    if (!matchedColor || !colors.includes(matchedColor)) matchedColor = colors[0];
    q('[data-colors]').replaceChildren(
      ...colors.map((color) => {
        const b = document.createElement('button');
        b.style.background = color;
        b.dataset.swatch = color;
        b.title = `Select ${color}`;
        b.setAttribute('aria-label', `Select color ${color}`);
        b.setAttribute('aria-pressed', String(color === matchedColor));
        return b;
      }),
    );
    if (matchedColor) {
      q<HTMLInputElement>('[data-color]').value = matchedColor;
      q<HTMLInputElement>('[data-hex]').value = matchedColor;
    }
    q<HTMLInputElement>('[data-layer-name]').value = l?.label || '';
    q<HTMLInputElement>('[data-layer-name]').disabled = !l || l.locked;
    q('[data-layers]').replaceChildren(
      ...[...doc().layers].reverse().map((layer) => {
        const row = document.createElement('div');
        row.className = 'uc-layer';
        const select = document.createElement('button');
        select.textContent = layer.label;
        select.dataset.select = layer.id;
        select.setAttribute('aria-pressed', String(selected.includes(layer.id)));
        const visible = document.createElement('button');
        visible.dataset.visibility = layer.id;
        visible.textContent = layer.visible ? '◉' : '○';
        visible.setAttribute('aria-label', `${layer.visible ? 'Hide' : 'Show'} ${layer.label}`);
        const lock = document.createElement('button');
        lock.dataset.lock = layer.id;
        lock.textContent = layer.locked ? '▣' : '□';
        lock.setAttribute('aria-label', `${layer.locked ? 'Unlock' : 'Lock'} ${layer.label}`);
        row.append(select, visible, lock);
        return row;
      }),
    );
    for (const el of qa<HTMLInputElement | HTMLSelectElement>('[data-print]'))
      el.value = String(doc().print[el.dataset.print as keyof EditorDocument['print']]);
    for (const input of qa<HTMLInputElement>('[data-crop]')) {
      const b = doc().crop || { x: 0, y: 0, width: doc().width, height: doc().height };
      input.value = String(b[input.dataset.crop as keyof Bounds]);
    }
    if (l?.kind === 'text') {
      q<HTMLTextAreaElement>('[data-text]').value = l.text;
      q<HTMLInputElement>('[data-text-size]').value = String(l.size);
      q<HTMLInputElement>('[data-text-color]').value = l.color;
      q<HTMLInputElement>('[data-text-bold]').checked = l.bold;
      q<HTMLSelectElement>('[data-text-align]').value = l.align;
    }
  }
  function select(id: string, add = false) {
    const layer = doc().layers.find((l) => l.id === id);
    if (!layer) return;
    const ids = layer.group
      ? doc()
          .layers.filter((l) => l.group === layer.group)
          .map((l) => l.id)
      : [id];
    selected = add
      ? selected.includes(id)
        ? selected.filter((x) => !ids.includes(x))
        : [...new Set([...selected, ...ids])]
      : ids;
    matchedColor = undefined;
    render();
  }
  function panel(name: string) {
    if (drawing && name !== 'create') setDrawing(false);
    qa('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== name));
    qa<HTMLButtonElement>('[data-panel]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.panel === name)),
    );
    q('[data-panel-title]').textContent = (
      {
        create: 'Make something yours',
        canvas: 'Your canvas',
        transform: 'Edit clipart',
        color: 'Recolor elements',
        background: 'Background',
        print: 'Black & white / print',
        crop: 'Crop artwork',
        layers: 'Artwork layers',
        text: 'Add a caption',
      } as Record<string, string>
    )[name];
  }
  function cancelInteraction() {
    const pointer = stroke?.pointer ?? drag?.pointer;
    if (pointer !== undefined && stage.hasPointerCapture(pointer))
      stage.releasePointerCapture(pointer);
    stroke = undefined;
    drag = undefined;
    panDrag = undefined;
    live = undefined;
  }
  function setDrawing(enabled: boolean) {
    cancelInteraction();
    drawing = enabled;
    if (enabled) {
      panMode = false;
      printPreview = false;
      q<HTMLInputElement>('[data-print-preview]').checked = false;
      q('[data-action=pan]').setAttribute('aria-pressed', 'false');
      stage.style.cursor = '';
      selected = [];
    }
    root.dataset.drawing = String(enabled);
    q('[data-action=draw]').setAttribute('aria-pressed', String(enabled));
    q('[data-action=draw]').textContent = enabled ? 'Finish drawing' : 'Start drawing';
    q('[data-action=cancel-draw]').hidden = !enabled;
    q('[data-draw-hint]').hidden = !enabled;
    render();
  }
  function creationStyle(): ShapeStyle {
    return {
      fill: q<HTMLInputElement>('[data-create-no-fill]').checked
        ? 'none'
        : q<HTMLInputElement>('[data-create-fill]').value,
      stroke: q<HTMLInputElement>('[data-create-no-stroke]').checked
        ? 'none'
        : q<HTMLInputElement>('[data-create-stroke]').value,
      strokeWidth: Number(q<HTMLInputElement>('[data-create-width]').value),
    };
  }
  function addShape(kind: ShapeKind) {
    if (!creator) return;
    setDrawing(false);
    const width = Number(q<HTMLInputElement>('[data-shape-width]').value),
      height = Number(q<HTMLInputElement>('[data-shape-height]').value);
    const markup = shapeMarkup(kind, {
      ...creationStyle(),
      width,
      height,
      sides: Number(q<HTMLInputElement>('[data-shape-sides]').value),
      rounding: Number(q<HTMLInputElement>('[data-shape-rounding]').value),
    });
    const layer = vectorLayer(
      `shape-${crypto.randomUUID()}`,
      shapeNames[kind],
      markup,
      (doc().width - width) / 2,
      (doc().height - height) / 2,
    );
    selected = [layer.id];
    modify(
      (d) => d.layers.push(layer),
      `${shapeNames[kind]} added as an editable layer. Use Select to move, resize or rotate it.`,
    );
  }
  function replaceCanvas(next: EditorDocument, message: string) {
    cancelInteraction();
    if (creator) setDrawing(false);
    printPreview = false;
    q<HTMLInputElement>('[data-print-preview]').checked = false;
    zoom = 1;
    selected = [];
    commit(next, message);
  }
  function strokePreview() {
    if (!stroke || stroke.points.length < 2) return;
    const markup = `<path ${paintAttributes(stroke.style)} d="${freehandPath(stroke.points)}"/>`;
    live = clone(stroke.before);
    live.layers.push(vectorLayer(stroke.id, 'Freehand stroke', markup));
    renderCanvas();
  }
  if (creator)
    document.addEventListener('click', async (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        '[data-creator-template]',
      );
      if (!button || !history) return;
      templateRequest?.abort();
      if (button.dataset.creatorTemplate === 'blank') {
        replaceCanvas(
          blankDocument(id),
          'A fresh blank canvas is ready. Undo restores your previous work.',
        );
      } else {
        const source = button.dataset.templateSource || '';
        if (!/^\/studio\/[a-z0-9-]+\.svg$/.test(source)) {
          status('This starter source is not supported.', true);
          return;
        }
        const request = new AbortController();
        templateRequest = request;
        button.setAttribute('aria-busy', 'true');
        status('Opening your editable starter…');
        try {
          const response = await fetch(source, { signal: request.signal });
          if (!response.ok) throw new Error('The starter could not be loaded. Please try again.');
          if (Number(response.headers.get('content-length')) > 1000000)
            throw new Error('This starter is too large.');
          const text = await response.text();
          if (request.signal.aborted) return;
          const next = fromCreationSvg(text, id);
          if (templateRequest === request) templateRequest = undefined;
          replaceCanvas(
            next,
            `${next.layers.length} editable starter layers loaded. Undo restores your previous work.`,
          );
        } catch (error) {
          if (!request.signal.aborted)
            status(
              error instanceof Error ? error.message : 'The starter could not be opened.',
              true,
            );
        } finally {
          button.removeAttribute('aria-busy');
          if (templateRequest === request) templateRequest = undefined;
        }
        if (request.signal.aborted) return;
      }
      root.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      stage.focus({ preventScroll: true });
    });
  function applyPreset(mode: StylePreset) {
    modify(
      (d) =>
        d.layers
          .filter((l) => !l.locked && l.visible)
          .forEach((l) => {
            const base = original.layers.find((a) => a.id === l.id);
            if (mode === 'original') {
              if (base?.kind === 'vector' && l.kind === 'vector') l.markup = base.markup;
            } else preset(l, mode);
          }),
      mode === 'original'
        ? 'Original colors restored. Your positions and background are unchanged.'
        : `${mode[0].toUpperCase() + mode.slice(1)} style applied to all visible, unlocked layers.`,
    );
  }
  function center() {
    const b = bounds();
    if (!b) return;
    const d = doc(),
      c = d.crop || { x: 0, y: 0, width: d.width, height: d.height };
    selectedChange((l) => {
      l.x += c.x + c.width / 2 - b.x - b.width / 2;
      l.y += c.y + c.height / 2 - b.y - b.height / 2;
    });
  }
  function exportOpen() {
    cancelSource();
    exportGeneration++;
    exportFocus = q<HTMLElement>('[data-action=export]');
    q('[data-export-preview]').replaceChildren(documentSvg(history.current));
    q('[data-export-status]').textContent = '';
    dialog.showModal();
  }
  async function saveExport() {
    if (busy) return;
    busy = true;
    const generation = exportGeneration;
    const button = q<HTMLButtonElement>('[data-action=download]');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    q('[data-export-status]').textContent = 'Preparing your edited artwork…';
    try {
      const format = q<HTMLInputElement>('[data-format]:checked').value;
      const name =
        q<HTMLInputElement>('[data-filename]')
          .value.replace(/[^a-zA-Z0-9-_]+/g, '-')
          .slice(0, 100) || id;
      let blob: Blob;
      if (format === 'pdf') blob = await exportPdf(history.current);
      else {
        const requested = q<HTMLSelectElement>('[data-size]').value;
        blob = await renderWebp(
          history.current,
          requested === 'original'
            ? history.current.crop?.width || history.current.width
            : Number(requested),
          Number(q<HTMLInputElement>('[data-quality]').value) / 100,
        );
      }
      if (!dialog.open || generation !== exportGeneration) return;
      download(blob, `${name}-edited.${format}`);
      q('[data-export-status]').textContent =
        `Your edited ${format.toUpperCase()} is ready (${blob.size.toLocaleString()} bytes).`;
    } catch (error) {
      if (generation !== exportGeneration || !dialog.open) return;
      q('[data-export-status]').textContent =
        error instanceof Error ? error.message : 'Export failed. Please try again.';
    } finally {
      if (generation === exportGeneration) {
        busy = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }
  new ResizeObserver(() => {
    if (history) renderCanvas();
  }).observe(stage);
  const actions: Record<string, () => void | Promise<void>> = {
    pan: () => {
      if (creator && drawing) setDrawing(false);
      panMode = !panMode;
      q('[data-action=pan]').setAttribute('aria-pressed', String(panMode));
      stage.style.cursor = panMode ? 'grab' : '';
      status(
        panMode
          ? 'Pan is on. Drag to move around the zoomed canvas; arrow keys scroll the view.'
          : 'Selection mode restored.',
      );
    },
    undo: () => {
      cancelSource();
      cancelInteraction();
      history.undo();
      persist();
      render();
    },
    redo: () => {
      cancelSource();
      cancelInteraction();
      history.redo();
      persist();
      render();
    },
    reset: () => {
      replaceCanvas(
        clone(original),
        creator
          ? 'Blank canvas restored. Undo is available.'
          : 'Original artwork restored. Undo is available.',
      );
    },
    'zoom-in': () => {
      zoom = clamp(zoom + 0.25, 0.25, 4);
      render();
    },
    'zoom-out': () => {
      zoom = clamp(zoom - 0.25, 0.25, 4);
      render();
    },
    fit: () => {
      zoom = 1;
      render();
    },
    center,
    'select-all': () => {
      selected = doc()
        .layers.filter((l) => !l.locked && l.visible)
        .map((l) => l.id);
      render();
    },
    duplicate: () => {
      const ids: string[] = [];
      modify((d) => {
        const copies = d.layers
          .filter((l) => selected.includes(l.id) && !l.locked && l.visible)
          .map((l) => {
            const c = clone(l);
            c.id = `layer-${crypto.randomUUID()}`;
            c.label += ' copy';
            c.x += 20;
            c.y += 20;
            delete c.group;
            ids.push(c.id);
            return c;
          });
        d.layers.push(...copies);
      });
      selected = ids;
      render();
    },
    delete: () => {
      modify((d) => {
        d.layers = d.layers.filter((l) => !selected.includes(l.id) || l.locked || !l.visible);
      });
    },
    'layer-up': () => {
      modify((d) => {
        for (let i = d.layers.length - 2; i >= 0; i--) {
          if (
            selected.includes(d.layers[i].id) &&
            !selected.includes(d.layers[i + 1].id) &&
            !d.layers[i].locked &&
            d.layers[i].visible
          )
            [d.layers[i], d.layers[i + 1]] = [d.layers[i + 1], d.layers[i]];
        }
      });
    },
    'layer-down': () => {
      modify((d) => {
        for (let i = 1; i < d.layers.length; i++) {
          if (
            selected.includes(d.layers[i].id) &&
            !selected.includes(d.layers[i - 1].id) &&
            !d.layers[i].locked &&
            d.layers[i].visible
          )
            [d.layers[i], d.layers[i - 1]] = [d.layers[i - 1], d.layers[i]];
        }
      });
    },
    group: () => {
      if (selected.length < 2) {
        status('Select two or more layers to link them.');
        return;
      }
      const group = crypto.randomUUID();
      selectedChange((l) => {
        l.group = group;
      }, 'Selected layers now move together.');
    },
    ungroup: () =>
      selectedChange((l) => {
        delete l.group;
      }),
    'apply-color': () => {
      const value = q<HTMLInputElement>('[data-hex]').value;
      if (!isColor(value)) {
        status('Enter a six-digit hex color, such as #2865D2.', true);
        return;
      }
      selectedChange(
        (l) =>
          recolor(
            l,
            value,
            q<HTMLInputElement>('[data-matching]').checked ? matchedColor : undefined,
          ),
        'Layer color updated.',
      );
    },
    'remove-bg': () =>
      modify((d) => {
        d.background = 'transparent';
      }, 'Canvas background removed. Colored shapes remain editable in Layers.'),
    contrast: () =>
      modify((d) =>
        d.layers
          .filter((l) => !l.locked && l.visible)
          .forEach((l) =>
            preset(l, 'grayscale', Number(q<HTMLInputElement>('[data-contrast]').value) / 100),
          ),
      ),
    crop: () => {
      const b = Object.fromEntries(
        qa<HTMLInputElement>('[data-crop]').map((i) => [i.dataset.crop, Number(i.value)]),
      ) as Bounds;
      if (
        !Object.values(b).every(Number.isFinite) ||
        b.width < 1 ||
        b.height < 1 ||
        Math.abs(b.x) > 10000 ||
        Math.abs(b.y) > 10000 ||
        b.width > 10000 ||
        b.height > 10000
      ) {
        status('Enter valid crop dimensions between 1 and 10,000.', true);
        return;
      }
      modify((d) => {
        d.crop = b;
      }, 'Crop applied. Reset crop restores the complete canvas.');
    },
    uncrop: () =>
      modify((d) => {
        d.crop = null;
      }),
    text: () => {
      const text = q<HTMLTextAreaElement>('[data-text]').value.trim();
      if (!text) {
        status('Type a caption first.');
        return;
      }
      const current = currentLayer();
      const textProps = {
        text: text.slice(0, 500),
        size: clamp(Number(q<HTMLInputElement>('[data-text-size]').value), 8, 300),
        color: q<HTMLInputElement>('[data-text-color]').value,
        bold: q<HTMLInputElement>('[data-text-bold]').checked,
        align: q<HTMLSelectElement>('[data-text-align]').value as 'start' | 'middle' | 'end',
      };
      if (current?.kind === 'text')
        selectedChange((l) => {
          if (l.kind === 'text') Object.assign(l, textProps);
        });
      else {
        const newId = `text-${crypto.randomUUID()}`;
        modify((d) => {
          d.layers.push({
            kind: 'text',
            id: newId,
            label: 'Caption',
            visible: true,
            locked: false,
            opacity: 1,
            ...identity(),
            x: (d.crop?.x || 0) + 24,
            y: (d.crop?.y || 0) + (d.crop?.height || d.height) - 24,
            ...textProps,
          });
        });
        selected = [newId];
        render();
      }
    },
    blank: () => {
      if (!creator) return;
      templateRequest?.abort();
      replaceCanvas(
        blankDocument(id),
        'A fresh blank canvas is ready. Undo restores your previous work.',
      );
    },
    'resize-canvas': () => {
      const next = blankDocument(
        id,
        Number(q<HTMLInputElement>('[data-canvas-width]').value),
        Number(q<HTMLInputElement>('[data-canvas-height]').value),
      );
      cancelInteraction();
      modify((d) => {
        d.width = next.width;
        d.height = next.height;
        d.crop = null;
      }, 'Canvas resized. Shape sizes are preserved. Undo is available.');
    },
    'import-svg': () => q<HTMLInputElement>('[data-import-svg]').click(),
    draw: () => {
      if (!drawing) paintAttributes({ ...creationStyle(), fill: 'none' });
      setDrawing(!drawing);
      if (drawing) {
        stage.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
        stage.focus({ preventScroll: true });
      }
      status(
        drawing
          ? 'Draw on the canvas with a mouse, pen or touch. Escape cancels the current stroke.'
          : 'Drawing finished. Each stroke is an editable vector layer.',
      );
    },
    'cancel-draw': () => {
      setDrawing(false);
      status('The unfinished stroke was cancelled. Completed layers are unchanged.');
    },
    'paint-selection': () => {
      const style = creationStyle();
      paintAttributes(style);
      selectedChange((l) => {
        if (l.kind !== 'vector') return;
        const svg = sanitizeSvg(`<svg xmlns="${NS}">${l.markup}</svg>`);
        for (const shape of svg.querySelectorAll(
          'path,rect,circle,ellipse,line,polyline,polygon',
        )) {
          shape.setAttribute(
            'fill',
            ['line', 'polyline'].includes(shape.localName) ? 'none' : style.fill,
          );
          shape.setAttribute('stroke', style.stroke);
          shape.setAttribute('stroke-width', String(style.strokeWidth));
          shape.setAttribute('stroke-linecap', 'round');
          shape.setAttribute('stroke-linejoin', 'round');
        }
        l.markup = svg.innerHTML;
      }, 'Fill and stroke applied to the selected vector layers.');
    },
    save: () => {
      download(
        new Blob([JSON.stringify(history.current, null, 2)], { type: 'application/json' }),
        `${id}-project.json`,
      );
      status('Editable project saved. Open it from the Layers panel to continue.');
    },
    load: () => q<HTMLInputElement>('[data-load]').click(),
    export: exportOpen,
    'close-export': () => dialog.close(),
    download: saveExport,
  };
  root.addEventListener('click', (event) => {
    if (!history) return;
    const target = (event.target as Element).closest<HTMLElement>('button');
    if (!target) return;
    try {
      if (target.dataset.shape) addShape(target.dataset.shape as ShapeKind);
      else if (target.dataset.action) void actions[target.dataset.action]?.();
      else if (target.dataset.panel) panel(target.dataset.panel);
      else if (target.dataset.select) select(target.dataset.select, (event as MouseEvent).shiftKey);
      else if (target.dataset.visibility)
        modify((d) => {
          const l = d.layers.find((l) => l.id === target.dataset.visibility);
          if (l && !l.locked) l.visible = !l.visible;
        });
      else if (target.dataset.lock)
        modify((d) => {
          const l = d.layers.find((l) => l.id === target.dataset.lock);
          if (l) l.locked = !l.locked;
        });
      else if (target.dataset.swatch) {
        matchedColor = target.dataset.swatch;
        render();
      } else if (target.dataset.preset) applyPreset(target.dataset.preset as StylePreset);
      else if (target.dataset.bg)
        modify((d) => {
          d.background = target.dataset.bg!;
        });
    } catch (error) {
      status(error instanceof Error ? error.message : 'This change could not be applied.', true);
    }
  });
  root.addEventListener('change', async (event) => {
    if (!history) return;
    const target = event.target as HTMLInputElement;
    try {
      if (target.dataset.prop) {
        const key = target.dataset.prop as 'x' | 'y' | 'scaleX' | 'scaleY' | 'angle' | 'opacity';
        const raw = Number(target.value);
        if (!Number.isFinite(raw)) return;
        const anchor = currentLayer(),
          b = bounds();
        if (!anchor) return;
        const prior = anchor[key];
        selectedChange((l) => {
          if (key === 'opacity') l.opacity = clamp(raw / 100, 0, 1);
          else if (key === 'scaleX' || key === 'scaleY') {
            const factor = clamp(raw / 100, 0.01, 100) / prior;
            const uniform = q<HTMLInputElement>('[data-lock-ratio]').checked;
            if (key === 'scaleX' || uniform) {
              l.scaleX = clamp(l.scaleX * factor, 0.01, 100);
              if (b) l.x = b.x + (l.x - b.x) * factor;
            }
            if (key === 'scaleY' || uniform) {
              l.scaleY = clamp(l.scaleY * factor, 0.01, 100);
              if (b) l.y = b.y + (l.y - b.y) * factor;
            }
          } else if (key === 'angle' && b) {
            const change = clamp(raw, -360, 360) - prior,
              r = (change * Math.PI) / 180,
              cx = b.x + b.width / 2,
              cy = b.y + b.height / 2,
              x = l.x - cx,
              y = l.y - cy;
            l.x = cx + x * Math.cos(r) - y * Math.sin(r);
            l.y = cy + x * Math.sin(r) + y * Math.cos(r);
            l.angle += change;
          } else l[key] += clamp(raw, -10000, 10000) - prior;
        });
      } else if (target.matches('[data-color]'))
        q<HTMLInputElement>('[data-hex]').value = target.value;
      else if (target.matches('[data-hex]') && isColor(target.value))
        q<HTMLInputElement>('[data-color]').value = target.value;
      else if (target.matches('[data-layer-picker]')) select(target.value);
      else if (target.matches('[data-stroke]'))
        selectedChange((l) => strokeWidth(l, clamp(Number(target.value), 0, 40)));
      else if (target.matches('[data-outline-width]'))
        modify((d) =>
          d.layers
            .filter((l) => !l.locked && l.visible)
            .forEach((l) => strokeWidth(l, clamp(Number(target.value), 0.5, 40))),
        );
      else if (target.matches('[data-bg-color]'))
        modify((d) => {
          d.background = target.value;
        });
      else if (target.matches('[data-layer-name]'))
        selectedChange((l) => {
          l.label = target.value.trim().slice(0, 80) || 'Unnamed layer';
        });
      else if (target.dataset.print)
        modify((d) => {
          if (target.dataset.print === 'margin') d.print.margin = clamp(Number(target.value), 0, 2);
          else Object.assign(d.print, { [target.dataset.print!]: target.value });
        });
      else if (target.matches('[data-print-preview]')) {
        printPreview = target.checked;
        render();
        status(
          printPreview
            ? 'Print preview — use the property panels to edit, or turn off paper preview to drag layers.'
            : 'Artwork view restored.',
        );
      } else if (target.matches('[data-format]')) {
        const pdf = target.value === 'pdf';
        q('[data-webp-options]').hidden = pdf;
        q('[data-pdf-options]').hidden = !pdf;
        q('[data-action=download]').textContent = `↓ Download ${pdf ? 'CMYK PDF' : 'WEBP'}`;
      } else if (target.matches('[data-import-svg]')) {
        const file = target.files?.[0];
        target.value = '';
        if (!file) return;
        if (file.size > 1000000) throw new Error('SVG imports must be at most 1,000,000 bytes.');
        templateRequest?.abort();
        const request = new AbortController();
        templateRequest = request;
        const text = await file.text();
        if (request.signal.aborted) return;
        const next = fromCreationSvg(text, id);
        templateRequest = undefined;
        replaceCanvas(
          next,
          `${next.layers.length} editable SVG layers imported. Undo restores your previous work.`,
        );
      } else if (target.matches('[data-load]')) {
        const file = target.files?.[0];
        target.value = '';
        if (!file) return;
        if (file.size > 2000000) throw new Error('This project file is too large.');
        templateRequest?.abort();
        const request = new AbortController();
        templateRequest = request;
        const text = await file.text();
        if (request.signal.aborted) return;
        const value: unknown = JSON.parse(text);
        target.value = '';
        if (creator && value && typeof value === 'object' && 'artId' in value) value.artId = id;
        if (!validateDocument(value, id))
          throw new Error('This file is not a valid project for this artwork.');
        validateProjectMarkup(value);
        templateRequest = undefined;
        replaceCanvas(value, 'Saved project opened.');
        target.value = '';
      }
    } catch (error) {
      status(error instanceof Error ? error.message : 'The change could not be applied.', true);
    }
  });
  const point = (event: PointerEvent) => {
    const svg = canvas.querySelector('svg')!;
    const m = svg.getScreenCTM();
    return m
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse())
      : new DOMPoint();
  };
  stage.addEventListener('pointerdown', (event) => {
    if (!history || event.button !== 0) return;
    if (drawing && creator) {
      if (stroke) return;
      try {
        if (doc().layers.length >= 500)
          throw new Error('The 500-layer limit has been reached. Remove a layer before drawing.');
        const p = point(event);
        if (p.x < 0 || p.y < 0 || p.x > doc().width || p.y > doc().height) return;
        const style = { ...creationStyle(), fill: 'none' };
        paintAttributes(style);
        stroke = {
          points: [{ x: p.x, y: p.y }],
          before: clone(history.current),
          pointer: event.pointerId,
          id: `stroke-${crypto.randomUUID()}`,
          style,
        };
        stage.setPointerCapture(event.pointerId);
        stage.focus({ preventScroll: true });
        event.preventDefault();
      } catch (error) {
        status(error instanceof Error ? error.message : 'The stroke could not be started.', true);
      }
      return;
    }
    if (panMode) {
      panDrag = {
        x: event.clientX,
        y: event.clientY,
        left: stage.scrollLeft,
        top: stage.scrollTop,
      };
      stage.setPointerCapture(event.pointerId);
      stage.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    if (printPreview) return;
    const target = event.target as Element;
    const handle = target.getAttribute('data-handle'),
      layer = target.closest<SVGGElement>('[data-layer]');
    if (!handle) {
      if (!layer) {
        selected = [];
        render();
        return;
      }
      const sid = layer.dataset.layer!;
      if (!selected.includes(sid) || event.shiftKey) select(sid, event.shiftKey);
      if (event.shiftKey) return;
    }
    if (!selected.some((s) => doc().layers.some((l) => l.id === s && !l.locked && l.visible)))
      return;
    const b = bounds();
    if (!b) return;
    drag = {
      start: point(event),
      before: clone(history.current),
      bounds: b,
      action: handle || 'move',
      pointer: event.pointerId,
    };
    stage.setPointerCapture(event.pointerId);
    stage.focus({ preventScroll: true });
    event.preventDefault();
  });
  stage.addEventListener('pointermove', (event) => {
    if (stroke && event.pointerId === stroke.pointer) {
      const samples =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      for (const sample of samples.length ? samples : [event]) {
        const p = point(sample),
          last = stroke.points[stroke.points.length - 1];
        const next = { x: clamp(p.x, 0, doc().width), y: clamp(p.y, 0, doc().height) };
        if (Math.hypot(next.x - last.x, next.y - last.y) >= 1.5 && stroke.points.length < 2000)
          stroke.points.push(next);
      }
      strokePreview();
      return;
    }
    if (panDrag) {
      stage.scrollLeft = panDrag.left - event.clientX + panDrag.x;
      stage.scrollTop = panDrag.top - event.clientY + panDrag.y;
      return;
    }
    if (!drag) return;
    const p = point(event),
      dx = p.x - drag.start.x,
      dy = p.y - drag.start.y;
    live = changeLayers(drag.before, selected, (l) => {
      const b = drag!.bounds,
        a = drag!.action;
      if (a === 'move') {
        const snap = q<HTMLInputElement>('[data-snap]').checked;
        l.x += snap ? Math.round(dx / 5) * 5 : dx;
        l.y += snap ? Math.round(dy / 5) * 5 : dy;
      } else if (a === 'rotate') {
        const cx = b.x + b.width / 2,
          cy = b.y + b.height / 2;
        let angle =
          ((Math.atan2(p.y - cy, p.x - cx) - Math.atan2(drag!.start.y - cy, drag!.start.x - cx)) *
            180) /
          Math.PI;
        if (event.shiftKey) angle = Math.round(angle / 15) * 15;
        const r = (angle * Math.PI) / 180,
          x = l.x - cx,
          y = l.y - cy;
        l.x = cx + x * Math.cos(r) - y * Math.sin(r);
        l.y = cy + x * Math.sin(r) + y * Math.cos(r);
        l.angle += angle;
      } else {
        const west = a.includes('w'),
          north = a.includes('n'),
          horizontal = a.includes('e') || west,
          vertical = a.includes('s') || north;
        let sx = horizontal ? clamp(1 + (west ? -dx : dx) / Math.max(1, b.width), 0.02, 20) : 1,
          sy = vertical ? clamp(1 + (north ? -dy : dy) / Math.max(1, b.height), 0.02, 20) : 1;
        if (q<HTMLInputElement>('[data-lock-ratio]').checked) {
          const s = horizontal ? sx : sy;
          sx = s;
          sy = s;
        }
        const ax = west ? b.x + b.width : b.x,
          ay = north ? b.y + b.height : b.y;
        l.x = ax + (l.x - ax) * sx;
        l.y = ay + (l.y - ay) * sy;
        l.scaleX = clamp(l.scaleX * sx, 0.01, 100);
        l.scaleY = clamp(l.scaleY * sy, 0.01, 100);
      }
    });
    renderCanvas();
  });
  const endDrag = () => {
    if (stroke) {
      const completed = stroke;
      strokePreview();
      stroke = undefined;
      if (stage.hasPointerCapture(completed.pointer))
        stage.releasePointerCapture(completed.pointer);
      if (live) {
        selected = [completed.id];
        commit(
          live,
          'Freehand stroke added. Keep drawing, or choose Finish drawing to edit layers.',
        );
      } else {
        render();
        status('Drag to draw a stroke; a single tap does not create a layer.');
      }
      return;
    }
    panDrag = undefined;
    if (!drag) return;
    drag = undefined;
    if (live) commit(live);
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', () => {
    cancelInteraction();
    render();
    if (drawing) status('The unfinished stroke was cancelled.');
  });
  stage.addEventListener(
    'wheel',
    (event) => {
      if (!history || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const before = zoom,
        rect = stage.getBoundingClientRect(),
        x = event.clientX - rect.left + stage.scrollLeft,
        y = event.clientY - rect.top + stage.scrollTop;
      zoom = clamp(zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.25, 4);
      render();
      stage.scrollLeft = (x * zoom) / before - (event.clientX - rect.left);
      stage.scrollTop = (y * zoom) / before - (event.clientY - rect.top);
    },
    { passive: false },
  );
  root.addEventListener('keydown', (event) => {
    if (!history || dialog.open) return;
    const target = event.target as Element;
    if (event.key === 'Escape' && (drawing || drag || stroke)) {
      event.preventDefault();
      if (creator) setDrawing(false);
      else {
        cancelInteraction();
        render();
      }
      status('The unfinished gesture was cancelled.');
      return;
    }
    if (target.matches('input,textarea,select')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      void actions[event.shiftKey ? 'redo' : 'undo']();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      void actions['select-all']();
    } else if (event.key === 'Escape') {
      selected = [];
      render();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      void actions.delete();
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (panMode) {
        stage.scrollBy({
          left: event.key === 'ArrowLeft' ? -40 : event.key === 'ArrowRight' ? 40 : 0,
          top: event.key === 'ArrowUp' ? -40 : event.key === 'ArrowDown' ? 40 : 0,
        });
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      selectedChange((l) => {
        if (event.key === 'ArrowLeft') l.x -= step;
        if (event.key === 'ArrowRight') l.x += step;
        if (event.key === 'ArrowUp') l.y -= step;
        if (event.key === 'ArrowDown') l.y += step;
      });
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const fields = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex=\"0\"]',
      ),
    ].filter((el) => el.getClientRects().length > 0 && !el.closest('[hidden]'));
    if (!fields.length) return;
    event.preventDefault();
    const index = fields.indexOf(document.activeElement as HTMLElement);
    fields[(index + (event.shiftKey ? -1 : 1) + fields.length) % fields.length].focus();
  });
  dialog.addEventListener('close', () => {
    exportGeneration++;
    busy = false;
    q<HTMLButtonElement>('[data-action=download]').disabled = false;
    q('[data-action=download]').removeAttribute('aria-busy');
    exportFocus?.focus();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
  void (async () => {
    try {
      if (creator) original = blankDocument(id);
      else {
        // A prior cross-origin <img> can leave a no-CORS cache entry for this SVG.
        // Revalidate over the network so editable bytes receive the CORS headers.
        const response = await fetch(root.dataset.source!, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'reload',
        });
        if (!response.ok)
          throw new Error('The editable source could not be loaded. Refresh the page to retry.');
        original = fromSvg(await response.text(), id);
      }
      history = new History(original);
      let recovered = false;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (validateDocument(saved, id)) {
            validateProjectMarkup(saved);
            history = new History(saved);
            recovered = true;
          }
        }
      } catch {
        /* A corrupt saved project must never prevent opening the original. */
      }
      selected = doc()
        .layers.filter((l) => l.visible && !l.locked)
        .map((l) => l.id);
      render();
      if (creator) panel('create');
      root.removeAttribute('aria-busy');
      qa('[inert]').forEach((el) => el.removeAttribute('inert'));
      status(
        recovered
          ? 'Your last local editing session was restored. Changes stay on this device.'
          : creator
            ? 'Your blank canvas is ready. Add a shape, draw, or choose a starter. Changes are saved on this device.'
            : `${original.layers.length} editable layers loaded. Changes are saved locally on this device.`,
      );
    } catch (error) {
      status(error instanceof Error ? error.message : 'The artwork could not be opened.', true);
      qa<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
    }
  })();
}
export function initializeEditors() {
  document.querySelectorAll<HTMLElement>('.uc-editor').forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    init(root);
  });
}
