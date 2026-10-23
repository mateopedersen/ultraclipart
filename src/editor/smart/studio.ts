import { effectBounds } from './padding';
import type { SmartController } from './controller';
import {
  clone,
  identity,
  isColor,
  type EditorDocument,
  type RasterLayer,
  type TextLayer,
} from '../model';
import {
  openRaster,
  rasterCatalog,
  rasterPixels,
  registerLocalImage,
  serializeProject,
  type RasterAsset,
} from '../raster';
import { download, renderWebp, recolor } from '../svg';
import { exportPdf, paperLayout } from '../pdf';
import { encodeMask, morphology, fillHoles } from './pixels';
import { processedPixels, withProcessor, prepareDocument } from './render';
import {
  defaultAdjustment,
  defaultEffect,
  defaultPattern,
  type RasterEffect,
  type Pattern,
  type Region,
  type Typography,
} from './types';
export class StudioTools {
  private catalogue: (RasterAsset & { title?: string })[] = [];
  private effectId = '';
  private batch = 0;
  constructor(private editor: SmartController) {
    editor.host.root.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.matches('[data-local-clipart]') || !input.files?.[0]) return;
      const file = input.files[0];
      input.value = '';
      void this.addLocal(file).catch((error) => editor.host.status(error.message, true));
    });
    editor.host.root.addEventListener('input', (event) => {
      if ((event.target as Element).matches('[data-composer-search]')) this.list();
    });
    editor.host.root.addEventListener('change', (event) => {
      if (
        (event.target as Element).matches(
          '[data-effect-kind],[data-pattern-kind],[data-type-layout]',
        )
      )
        this.controls();
    });
    editor.host.root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.dataset.effectSelect) {
        const e = editor.layer()?.effects?.find((e) => e.id === button.dataset.effectSelect);
        if (e) {
          this.effectId = e.id;
          editor.q<HTMLSelectElement>('data-studio-tool').value =
            e.kind === 'sticker' || e.kind === 'coloring' ? e.kind : 'effects';
          this.show();
          if (e.kind === 'sticker') {
            for (const [field, value] of [
              ['width', e.radius],
              ['color', e.color],
              ['smooth', e.smooth],
              ['shadow', e.amount * 100],
            ] as const)
              editor.q<HTMLInputElement>(`data-sticker-${field}`).value = String(value);
            editor.q<HTMLInputElement>('data-sticker-cut').checked = e.cut;
          } else if (e.kind === 'coloring') {
            editor.q<HTMLInputElement>('data-coloring-width').value = String(e.radius);
            editor.q<HTMLInputElement>('data-coloring-detail').value = String(e.detail);
            editor.q<HTMLInputElement>('data-coloring-smooth').value = String(e.smooth);
          } else {
            editor.q<HTMLSelectElement>('data-effect-kind').value = e.kind;
            for (const field of ['amount', 'radius', 'color', 'x', 'y'] as const)
              editor.q<HTMLInputElement>(`data-effect-${field}`).value = String(
                field === 'amount' ? e[field] * 100 : e[field],
              );
          }
          this.controls();
        }
      }
      if (button.dataset.effectToggle || button.dataset.effectDelete)
        editor.updateLayer((l) => {
          const id = button.dataset.effectToggle || button.dataset.effectDelete;
          if (button.dataset.effectDelete) l.effects = l.effects?.filter((e) => e.id !== id);
          else {
            const e = l.effects?.find((e) => e.id === id);
            if (e) e.enabled = !e.enabled;
          }
        }, 'Effect updated.');
      if (button.dataset.paletteColor)
        editor.q<HTMLInputElement>('data-palette-colors').value =
          button.dataset.paletteColor +
          ',' +
          editor
            .value('data-palette-colors')
            .split(',')
            .filter((c) => c !== button.dataset.paletteColor)
            .join(',');
    });
    try {
      const palette = localStorage.getItem('ultraclipart:palette');
      if (palette && this.colors(palette, 1).length)
        editor.q<HTMLInputElement>('data-palette-colors').value = palette;
    } catch {}
  }
  show() {
    const e = this.editor,
      name = e.value('data-studio-tool');
    for (const pane of e.host.root.querySelectorAll<HTMLElement>('[data-studio-pane]'))
      pane.hidden = pane.dataset.studioPane !== name;
    if (name === 'composer' && !this.catalogue.length)
      void rasterCatalog()
        .then((list) => {
          this.catalogue = list;
          this.list();
        })
        .catch((error) => e.host.status(error.message, true));
    this.controls();
    this.renderEffects();
  }
  private async addLocal(file: File) {
    const host = this.editor.host,
      snapshot = host.committed();
    if (file.size > 4000000) throw new Error('Choose a still PNG or WebP up to 4 MB.');
    host.status('Opening your clipart on this device…');
    const layer = await registerLocalImage(new Uint8Array(await file.arrayBuffer()));
    if (snapshot !== host.committed())
      throw new Error(
        'The composition changed while reading this image. Choose the file again to keep your latest work.',
      );
    const d = clone(snapshot),
      images = d.layers.filter((l): l is RasterLayer => l.kind === 'raster');
    if (
      images.length >= 12 ||
      images.reduce((n, l) => n + l.width * l.height, layer.width * layer.height) > 40000000
    )
      throw new Error('This composition reached its 12-image or 40-million-pixel limit.');
    layer.label = file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Your clipart';
    if (!d.layers.length) {
      d.width = layer.width;
      d.height = layer.height;
    } else {
      layer.scaleX = layer.scaleY = Math.min(d.width / layer.width, d.height / layer.height) * 0.65;
      layer.x = (d.width - layer.width * layer.scaleX) / 2;
      layer.y = (d.height - layer.height * layer.scaleY) / 2;
    }
    d.layers.push(layer);
    d.version = 2;
    if (JSON.stringify(serializeProject(d)).length > 16000000)
      throw new Error(
        'Embedded images would exceed the 16 MB project limit. Use a smaller file or a separate project.',
      );
    host.commit(
      d,
      'Your clipart is ready. Its original pixels stay on this device and are included in saved project files.',
    );
    host.select(layer.id);
  }
  private controls() {
    const e = this.editor,
      kind = e.value('data-effect-kind');
    const visible = (field: string, show: boolean) => {
      const label = e.q(field).closest('label');
      if (label) label.hidden = !show;
    };
    visible('data-effect-amount', !['outline', 'blur'].includes(kind));
    visible('data-effect-radius', !['balance', 'emboss'].includes(kind));
    visible(
      'data-effect-color',
      ['outline', 'shadow', 'inner-shadow', 'glow', 'balance'].includes(kind),
    );
    for (const axis of ['x', 'y'])
      visible(`data-effect-${axis}`, ['shadow', 'inner-shadow'].includes(kind));
    visible(
      'data-pattern-secondary',
      ['texture', 'gradient'].includes(e.value('data-pattern-kind')),
    );
    visible('data-type-radius', e.value('data-type-layout') !== 'straight');
    visible('data-type-spacing', e.value('data-type-layout') !== 'circle');
  }
  private list() {
    const e = this.editor,
      search = e.value('data-composer-search').trim().toLowerCase(),
      list = e.q<HTMLSelectElement>('data-composer-list');
    list.replaceChildren(
      ...this.catalogue
        .filter((a) => (a.title || a.id).toLowerCase().includes(search))
        .map((a) => {
          const option = document.createElement('option');
          option.value = a.id;
          option.textContent = a.title || a.id.replaceAll('-', ' ');
          return option;
        }),
    );
  }
  renderEffects() {
    const e = this.editor;
    e.q('data-effects-list').replaceChildren(
      ...(e.layer()?.effects || []).map((effect) => {
        const row = document.createElement('div');
        row.className = 'uc-region-row';
        const choose = document.createElement('button');
        choose.textContent = effect.kind.replaceAll('-', ' ');
        choose.dataset.effectSelect = effect.id;
        const toggle = document.createElement('button');
        toggle.textContent = effect.enabled ? 'Hide' : 'Show';
        toggle.dataset.effectToggle = effect.id;
        const remove = document.createElement('button');
        remove.textContent = 'Delete';
        remove.dataset.effectDelete = effect.id;
        row.append(choose, toggle, remove);
        return row;
      }),
    );
  }
  private effect(effect: RasterEffect) {
    const editor = this.editor;
    const source = editor.requireLayer(),
      doc = clone(editor.host.committed()),
      layer = doc.layers.find((l) => l.id === source.id) as RasterLayer;
    {
      layer.effects ??= [];
      const index = layer.effects.findIndex(
        (e) => e.id === this.effectId && e.kind === effect.kind,
      );
      if (index >= 0) {
        effect.id = layer.effects[index].id;
        layer.effects[index] = effect;
      } else {
        effect.id = `effect-${crypto.randomUUID()}`;
        layer.effects.push(effect);
      }
      this.effectId = effect.id;
    }
    // Preserve full borders and shadows even when source pixels reach an image edge.
    const b = effectBounds(layer),
      angle = (layer.angle * Math.PI) / 180;
    const corners = [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ].map(([x, y]) => ({
      x: layer.x + Math.cos(angle) * x * layer.scaleX - Math.sin(angle) * y * layer.scaleY,
      y: layer.y + Math.sin(angle) * x * layer.scaleX + Math.cos(angle) * y * layer.scaleY,
    }));
    if (!doc.crop) {
      const left = Math.ceil(Math.max(0, -Math.min(...corners.map((p) => p.x)))),
        top = Math.ceil(Math.max(0, -Math.min(...corners.map((p) => p.y)))),
        right = Math.ceil(Math.max(0, Math.max(...corners.map((p) => p.x)) - doc.width)),
        bottom = Math.ceil(Math.max(0, Math.max(...corners.map((p) => p.y)) - doc.height));
      doc.width += left + right;
      doc.height += top + bottom;
      for (const item of doc.layers) {
        item.x += left;
        item.y += top;
      }
    }
    editor.host.commit(
      doc,
      doc.crop
        ? 'Effect saved. Your crop remains active; expand it if the border reaches its edge.'
        : 'Effect saved with room for its full border and shadow. Select its name to edit it again.',
    );
  }
  private colors(raw: string, min = 3) {
    const colors = raw
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (colors.length < min || colors.length > 6 || !colors.every(isColor))
      throw new Error(`Enter ${min}–6 colors as six-digit hex values, separated by commas.`);
    return colors;
  }
  private async variant(
    doc: EditorDocument,
    color: string,
    scope: string,
  ): Promise<EditorDocument> {
    const next = clone(doc),
      editor = this.editor;
    if (scope === 'region') {
      const layer = next.layers.find((l) => l.id === editor.layer()?.id) as RasterLayer | undefined;
      if (!layer) throw new Error('Select an image region first.');
      const region = layer.regions?.find((r) => r.id === editor.regionId);
      if (region) {
        region.paletteAdjustment ??= clone(region.adjustment);
        delete region.palette;
        region.adjustment = { ...region.adjustment, color, mode: 'replace' };
        region.visible = true;
      } else {
        const selection = next.selection;
        if (!selection || selection.layerId !== layer.id)
          throw new Error('Select a region before generating variations.');
        layer.regions ??= [];
        layer.regions.push({
          id: 'palette-region',
          name: 'Palette variation',
          visible: true,
          locked: false,
          mask: selection.mask,
          adjustment: { ...defaultAdjustment(), color },
        });
      }
    } else
      for (const layer of next.layers) {
        if (!layer.visible || layer.locked) continue;
        if (layer.kind === 'raster') {
          const source = rasterPixels(layer),
            region: Region = {
              id: 'palette-composition',
              name: 'Palette variation',
              visible: true,
              locked: false,
              mask: encodeMask(
                Uint8Array.from({ length: layer.width * layer.height }, (_, i) =>
                  source.data[i * 4 + 3] ? 255 : 0,
                ),
                layer.width,
                layer.height,
              ),
              adjustment: { ...defaultAdjustment(), mode: 'tint', color },
            };
          layer.regions = (layer.regions || []).filter((r) => r.id !== 'palette-composition');
          layer.regions.push(region);
        } else {
          layer.paletteOriginal ??= layer.kind === 'text' ? layer.color : layer.markup;
          recolor(layer, color);
        }
      }
    next.version = 2;
    return next;
  }
  async action(action: string) {
    const e = this.editor,
      { host } = e;
    if (action === 'sticker') {
      const effect = defaultEffect('sticker');
      Object.assign(effect, {
        radius: e.number('data-sticker-width'),
        color: e.value('data-sticker-color'),
        smooth: e.number('data-sticker-smooth'),
        amount: e.number('data-sticker-shadow') / 100,
        cut: e.checked('data-sticker-cut'),
      });
      this.effect(effect);
    } else if (action === 'coloring') {
      const effect = defaultEffect('coloring');
      Object.assign(effect, {
        detail: e.number('data-coloring-detail'),
        radius: e.number('data-coloring-width'),
        smooth: e.number('data-coloring-smooth'),
      });
      this.effect(effect);
    } else if (action === 'correction') {
      host.panel('region');
      e.q<HTMLSelectElement>('data-smart-tool').value = 'erase';
      e.render();
    } else if (action === 'effect') {
      const kind = e.value('data-effect-kind') as RasterEffect['kind'];
      this.effect({
        ...defaultEffect(kind),
        amount: e.number('data-effect-amount') / 100,
        radius: e.number('data-effect-radius'),
        color: e.value('data-effect-color'),
        x: e.number('data-effect-x'),
        y: e.number('data-effect-y'),
      });
    } else if (action === 'cut-contour') {
      const layer = e.requireLayer(),
        image = await processedPixels({ ...layer, effects: [] }),
        sticker = layer.effects?.find((effect) => effect.kind === 'sticker' && effect.enabled);
      const pad = Math.ceil((sticker?.radius || e.number('data-sticker-width')) + 4),
        width = layer.width + pad * 2,
        height = layer.height + pad * 2;
      let mask: Uint8Array = new Uint8Array(width * height);
      for (let y = 0; y < layer.height; y++)
        for (let x = 0; x < layer.width; x++)
          mask[(y + pad) * width + x + pad] =
            image.data[(y * layer.width + x) * 4 + 3] > 127 ? 255 : 0;
      mask = fillHoles(
        morphology(mask, width, height, sticker?.radius || e.number('data-sticker-width'), true),
        width,
        height,
      );
      const { contourPaths } = await import('./contour'),
        paths = contourPaths(mask, width, height);
      download(
        new Blob(
          [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width / 600}in" height="${height / 600}in" viewBox="0 0 ${width} ${height}"><title>UltraClipart cut contour at 600 pixels per inch</title><g fill="none" stroke="#ff00ff" stroke-width="1">${paths.map((path) => `<path d="${path}"/>`).join('')}</g></svg>`,
          ],
          { type: 'image/svg+xml' },
        ),
        `${layer.assetId}-cut-contour.svg`,
      );
      host.status(
        'Cut contour downloaded at native 600 PPI scale. Confirm size in your cutting software.',
      );
    } else if (action === 'add-clipart') {
      if (!this.catalogue.length) this.catalogue = await rasterCatalog();
      const asset = this.catalogue.find((a) => a.id === e.value('data-composer-list'));
      if (!asset) throw new Error('Choose a catalogue illustration.');
      const snapshot = host.committed(),
        d = clone(snapshot),
        images = d.layers.filter((l): l is RasterLayer => l.kind === 'raster');
      if (
        images.length >= 12 ||
        images.reduce((sum, l) => sum + l.width * l.height, asset.width * asset.height) > 40_000_000
      )
        throw new Error(
          'This composition reached its 12-image or 40-million-pixel limit. Save a copy and simplify it before adding more.',
        );
      host.status('Opening verified catalogue artwork…');
      const opened = await openRaster(asset),
        layer = opened.layers[0] as RasterLayer;
      if (snapshot !== host.committed())
        throw new Error(
          'The composition changed while opening this clipart. Add it again to keep your latest edits.',
        );
      layer.id = `image-${crypto.randomUUID()}`;
      layer.label = asset.title || asset.id;
      layer.scaleX = layer.scaleY = Math.min(d.width / asset.width, d.height / asset.height) * 0.55;
      layer.x = (d.width - asset.width * layer.scaleX) / 2;
      layer.y = (d.height - asset.height * layer.scaleY) / 2;
      d.layers.push(layer);
      d.version = 2;
      host.commit(d, 'Clipart added as an independent image layer.');
      host.select(layer.id);
    } else if (action === 'pattern') {
      if (!e.region()) {
        e.inputs({ ...defaultAdjustment(), mode: 'adjust' });
        await e.apply();
      }
      const id = e.regionId;
      const pattern: Pattern = {
        ...defaultPattern(),
        kind: e.value('data-pattern-kind') as Pattern['kind'],
        color: e.value('data-pattern-color'),
        secondary: e.value('data-pattern-secondary'),
        scale: e.number('data-pattern-scale'),
        angle: e.number('data-pattern-angle'),
        opacity: e.number('data-pattern-opacity') / 100,
        blend: e.value('data-pattern-blend') as Pattern['blend'],
      };
      e.updateLayer((l) => {
        const region = l.regions!.find((r) => r.id === id)!;
        if (region.locked) throw new Error('Unlock the region first.');
        region.pattern = pattern;
      }, 'Pattern saved inside the region mask.');
    } else if (action === 'typography') {
      const d = clone(host.committed()),
        layer = d.layers.find((l) => host.selected().includes(l.id) && l.kind === 'text') as
          TextLayer | undefined;
      if (!layer || layer.locked) throw new Error('Select an unlocked text layer first.');
      layer.typography = {
        layout: e.value('data-type-layout') as Typography['layout'],
        font: e.value('data-type-font') as Typography['font'],
        radius: e.number('data-type-radius'),
        spacing: e.number('data-type-spacing'),
        lineHeight: e.number('data-type-line-height'),
        stroke: e.value('data-type-stroke'),
        strokeWidth: e.number('data-type-stroke-width'),
        shadow: e.checked('data-type-shadow'),
      };
      d.version = 2;
      host.commit(d, 'Typography updated. Caption text remains editable.');
    } else if (action === 'extract-palette') {
      const layer = e.requireLayer(),
        mask = host.committed().selection;
      const colors = await withProcessor(layer, (processor) =>
        processor.run<string[]>('palette', {
          mask: mask?.layerId === layer.id ? mask.mask : undefined,
        }),
      );
      e.q<HTMLInputElement>('data-palette-colors').value = colors.join(',');
      e.q('data-palette').replaceChildren(
        ...colors.map((color) => {
          const button = document.createElement('button');
          button.style.background = color;
          button.dataset.paletteColor = color;
          button.setAttribute('aria-label', `Use ${color}`);
          button.title = color;
          return button;
        }),
      );
    } else if (action === 'save-palette') {
      const colors = this.colors(e.value('data-palette-colors'), 1);
      localStorage.setItem('ultraclipart:palette', colors.join(','));
      host.status('Palette saved on this device.');
    } else if (action === 'apply-palette') {
      host.status('Mapping palette colors…');
      const colors = this.colors(e.value('data-palette-colors'), 1),
        scope = e.value('data-palette-scope');
      const snapshot = host.committed();
      const next = await this.variant(snapshot, colors[0], scope);
      let colorIndex = 0;
      for (const layer of next.layers) {
        if (!layer.visible || layer.locked) continue;
        if (layer.kind === 'raster') {
          const region =
            scope === 'region'
              ? layer.id === e.layer()?.id
                ? layer.regions?.find((r) => r.id === e.regionId || r.id === 'palette-region')
                : undefined
              : layer.regions?.find((r) => r.id === 'palette-composition');
          if (region) {
            const source = await withProcessor(layer, (p) =>
              p.run<string[]>('palette', { mask: region.mask }),
            );
            region.palette = { source, target: colors };
          }
        } else if (scope === 'composition') recolor(layer, colors[colorIndex++ % colors.length]);
      }
      if (snapshot !== host.committed())
        throw new Error(
          'The composition changed while mapping colors. Apply the palette again to keep your latest edits.',
        );
      host.commit(
        next,
        'Palette colors mapped to the selected artwork. Lightness detail and transparency are preserved.',
      );
    } else if (action === 'original-palette') {
      const d = clone(host.committed());
      for (const layer of d.layers) {
        if (layer.kind === 'raster') {
          layer.regions = layer.regions?.filter((r) => !r.id.startsWith('palette-'));
          for (const r of layer.regions || [])
            if (r.paletteAdjustment) {
              r.adjustment = r.paletteAdjustment;
              delete r.paletteAdjustment;
              delete r.palette;
            }
        } else if (layer.paletteOriginal) {
          if (layer.kind === 'vector') layer.markup = layer.paletteOriginal;
          else layer.color = layer.paletteOriginal;
          delete layer.paletteOriginal;
        }
      }
      host.commit(d, 'Palette variations removed. Other region edits are preserved.');
    } else if (action === 'template') this.template();
    else if (action === 'quality') {
      const layer = e.requireLayer(),
        image = await processedPixels(layer),
        layout = paperLayout(host.committed()),
        report = await withProcessor(layer, (p) =>
          p.run<import('./effects').Inspection>('inspect', {
            image,
            widthInches: (image.width * Math.max(layer.scaleX, layer.scaleY) * layout.scale) / 72,
          }),
        );
      const rows = [
        `${report.width} × ${report.height} source pixels; effective print resolution: ${report.effectivePpi} PPI.`,
        report.effectivePpi < 300
          ? 'Print resolution is below 300 PPI. Use a smaller printed size.'
          : report.effectivePpi < 600
            ? 'Suitable for many prints; below the 600 PPI native target.'
            : '600 PPI native print target met.',
        `${report.transparentPercent}% transparent; ${report.emptyMarginPercent}% outside the artwork bounding rectangle.`,
        `${report.partialPixels.toLocaleString()} antialiased pixels; ${report.isolatedPixels} isolated translucent pixels to inspect.`,
        report.isolatedPixels
          ? 'Possible edge specks: zoom in and check before exporting.'
          : 'No isolated translucent specks detected.',
        layer.regions?.length
          ? 'Review region boundaries with Overlay and Before / after for unintended color spill.'
          : 'No region recoloring is applied.',
      ];
      e.q('data-quality-report').replaceChildren(
        ...rows.map((message) => {
          const p = document.createElement('p');
          p.textContent = message;
          return p;
        }),
      );
    } else if (action === 'trace') {
      const layer = e.requireLayer(),
        image = await processedPixels(layer);
      host.status('Checking monochrome detail and tracing lines…');
      const result = await withProcessor(layer, (p) =>
        p.run<ReturnType<typeof import('./trace').traceLineArt>>('trace', {
          image,
          threshold: e.number('data-trace-threshold'),
        }),
      );
      e.q('data-trace-report').textContent =
        `${result.paths} closed contours; monochrome approximation error ${result.meanError}/255. Review curves at high zoom; fine antialiasing becomes vector edges.`;
      download(
        new Blob([result.svg], { type: 'image/svg+xml' }),
        `${layer.assetId}-line-trace.svg`,
      );
      host.status(
        'Monochrome vector trace downloaded. The original artwork and editable project are preserved.',
      );
    } else if (action === 'cancel-batch') {
      this.batch++;
      host.status('Batch export cancelled. The project is unchanged.');
    } else if (action === 'variants') {
      const colors = this.colors(e.value('data-variant-colors')),
        scope = e.value('data-variant-scope'),
        snapshot = clone(host.committed()),
        token = ++this.batch,
        files: { name: string; blob: Blob }[] = [];
      e.q('data-smart-action="cancel-batch"').hidden = false;
      try {
        for (const [i, color] of colors.entries()) {
          if (token !== this.batch) return;
          host.status(`Preparing variation ${i + 1} of ${colors.length}…`);
          const d = await this.variant(snapshot, color, scope);
          await prepareDocument(d);
          const webp = await renderWebp(d, d.crop?.width || d.width, 0.95),
            pdf = await exportPdf({
              ...d,
              exportPreferences: { width: d.width, quality: 0.95, allowLargePdf: false },
            });
          if (token !== this.batch) return;
          files.push(
            { name: `${d.artId}-variant-${i + 1}.webp`, blob: webp },
            { name: `${d.artId}-variant-${i + 1}.pdf`, blob: pdf },
          );
        }
        const { zipFiles } = await import('./zip');
        if (token === this.batch) {
          download(await zipFiles(files), `${snapshot.artId}-color-variations.zip`);
          host.status(
            `${colors.length} matched WebP / CMYK PDF pairs exported. Every PDF passed the 1,000,000-byte limit.`,
          );
        }
      } finally {
        e.q('data-smart-action="cancel-batch"').hidden = true;
        host.preview();
      }
    }
  }
  private template() {
    const e = this.editor,
      host = e.host,
      d = clone(host.committed()),
      selected = d.layers.filter((l) => host.selected().includes(l.id) && l.visible);
    if (!selected.length) throw new Error('Select the artwork layers to place in the template.');
    const type = e.value('data-template'),
      paper = e.value('data-template-paper') as 'letter' | 'a4',
      width = paper === 'a4' ? 793.7008 : 816,
      height = paper === 'a4' ? 1122.5197 : 1056,
      margin = Math.max(0.25, Math.min(1.5, e.number('data-template-margin'))) * 96;
    const [columns, rows] =
      type === 'stickers'
        ? [3, 4]
        : type === 'labels'
          ? [2, 4]
          : type === 'name-tags'
            ? [2, 3]
            : [1, 1];
    const oldWidth = d.width,
      oldHeight = d.height,
      copies = [] as EditorDocument['layers'];
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++) {
        const cellWidth = (width - margin * 2) / columns,
          cellHeight = (height - margin * 2) / rows,
          availableHeight = type === 'card' ? cellHeight / 2 : cellHeight,
          scale = Math.min((cellWidth - 24) / oldWidth, (availableHeight - 24) / oldHeight),
          x = margin + column * cellWidth + (cellWidth - oldWidth * scale) / 2,
          y =
            margin +
            row * cellHeight +
            (type === 'card' ? cellHeight / 2 : 0) +
            (availableHeight - oldHeight * scale) / 2,
          group = `template-${row}-${column}-${crypto.randomUUID()}`;
        for (const source of selected) {
          const l = clone(source);
          l.id = `layer-${crypto.randomUUID()}`;
          l.group = group;
          l.x = x + l.x * scale;
          l.y = y + l.y * scale;
          l.scaleX *= scale;
          l.scaleY *= scale;
          copies.push(l);
        }
        if (e.checked('data-template-guides') && columns * rows > 1)
          copies.push({
            kind: 'vector',
            id: `guide-${crypto.randomUUID()}`,
            label: 'Cut guide',
            markup: `<rect x="${margin + column * cellWidth}" y="${margin + row * cellHeight}" width="${cellWidth}" height="${cellHeight}" fill="none" stroke="#9aa8ba" stroke-width="0.4"/>`,
            visible: true,
            locked: false,
            opacity: 1,
            ...identity(),
          });
      }
    if (e.checked('data-template-guides') && type === 'card')
      copies.push({
        kind: 'vector',
        id: `fold-${crypto.randomUUID()}`,
        label: 'Fold guide',
        markup: `<line x1="${margin}" y1="${height / 2}" x2="${width - margin}" y2="${height / 2}" stroke="#9aa8ba" stroke-width="0.4"/>`,
        visible: true,
        locked: false,
        opacity: 1,
        ...identity(),
      });
    d.layers = copies;
    d.width = width;
    d.height = height;
    d.crop = null;
    d.background = '#ffffff';
    d.print = { paper, orientation: 'portrait', margin: 0, scale: 'actual' };
    delete d.selection;
    d.version = 2;
    host.commit(
      d,
      'Editable print template created with measured paper size and margins. Print the PDF at 100%.',
    );
  }
}
