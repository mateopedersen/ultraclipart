import { workbenchCommands, searchWorkbench, type WorkbenchCommandId } from './catalog';
import { documentCommand, type Box } from './commands';
import { clone, validateDocument, type EditorDocument, type Layer, type TextLayer } from '../model';
import { NS, download, layerColors, renderBitmap, sanitizeSvg } from '../svg';
import { serializeProject, prepareProjectSources, withoutEmbeddedSources } from '../raster';
import { saveLocal, loadLocal, deleteLocal } from '../smart/storage';
import type { EditorHost } from '../smart/controller';
import { portableSvg } from '../export-document';
export interface WorkbenchHost extends EditorHost {
  setSelection: (ids: string[]) => void;
  bounds: (ids: string[]) => Box | null;
  action: (name: string) => void | Promise<void>;
  pan: () => boolean;
}
const PREFS = 'ultraclipart:studio:workbench:v1';
const commandIds = new Set<string>(workbenchCommands.map((c) => c[0]));
const defaults = {
  grid: false,
  gridSize: 24,
  rulers: false,
  center: false,
  safe: false,
  safeSize: 24,
  snap: false,
  snapCenter: false,
  cursor: false,
  measure: true,
  context: true,
  space: true,
  dockWidth: 300,
  recent: [] as string[],
  favorites: [] as string[],
};
type Preferences = typeof defaults;
function readPrefs(): Preferences {
  try {
    const d = JSON.parse(localStorage.getItem(PREFS) || '{}'),
      p = { ...defaults };
    for (const key of [
      'grid',
      'rulers',
      'center',
      'safe',
      'snap',
      'snapCenter',
      'cursor',
      'measure',
      'context',
      'space',
    ] as const)
      if (typeof d[key] === 'boolean') p[key] = d[key];
    for (const [key, min, max] of [
      ['gridSize', 8, 200],
      ['safeSize', 0, 500],
      ['dockWidth', 250, 440],
    ] as const)
      if (Number.isFinite(d[key]) && d[key] >= min && d[key] <= max) p[key] = d[key];
    for (const key of ['recent', 'favorites'] as const)
      if (Array.isArray(d[key]))
        p[key] = [
          ...new Set<string>(
            d[key].filter((id: unknown) => typeof id === 'string' && commandIds.has(id)),
          ),
        ].slice(0, key === 'recent' ? 12 : 100);
    return p;
  } catch {
    return { ...defaults };
  }
}
function filename(doc: EditorDocument) {
  return (
    (doc.title || doc.artId)
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 90) || 'my-clipart'
  );
}
export class Workbench {
  private p = readPrefs();
  private clipboard: Layer[] = [];
  private style: Layer | undefined;
  private solo: Record<string, boolean> | undefined;
  private parameter: WorkbenchCommandId | undefined;
  private filter: 'all' | 'recent' | 'favorite' = 'all';
  private limit = 6;
  private toolPage = 1;
  private spaceHeld = false;
  private priorPan = false;
  private cursorFrame = 0;
  private checkpointKey: string;
  private busy = false;
  private initialTitle: string;
  private resizeFrame = 0;
  constructor(private host: WorkbenchHost) {
    const root = host.root;
    this.initialTitle = root.querySelector('.uc-command h2')?.textContent || 'My Clipart Project';
    if (
      root.dataset.creator === 'true' &&
      new URLSearchParams(location.search).get('view') !== 'page'
    )
      root.dataset.wbFocus = 'true';
    window.addEventListener('resize', () => this.scheduleResize());
    window.visualViewport?.addEventListener('resize', () => this.scheduleResize());
    this.checkpointKey = `ultraclipart:studio:checkpoints:${host.committed().artId}`;
    root.addEventListener('click', (e) => {
      const button = (e.target as Element)?.closest<HTMLButtonElement>('button');
      if (!button) return;
      if (button.closest('.wb-file-menu') && (button.dataset.action || button.dataset.wbRun))
        button.closest<HTMLDetailsElement>('.wb-file-menu')!.open = false;
      if (button.hasAttribute('data-wb-close'))
        button.closest<HTMLDialogElement>('dialog')?.close();
      if (button.dataset.wbRun) void this.run(button.dataset.wbRun as WorkbenchCommandId);
      if (button.dataset.wbGroup) {
        this.filter = 'all';
        this.openPalette();
        this.q<HTMLSelectElement>('[data-wb-category]').value = button.dataset.wbGroup;
        this.renderPalette();
      }
      if (button.dataset.wbList) {
        this.filter = button.dataset.wbList as typeof this.filter;
        this.limit = 6;
        this.toolPage = 1;
        this.renderPalette();
      }
      if (button.dataset.wbStar) {
        const id = button.dataset.wbStar;
        this.p.favorites = this.p.favorites.includes(id)
          ? this.p.favorites.filter((v) => v !== id)
          : [...this.p.favorites, id];
        this.savePrefs();
        this.renderPalette();
      }
      if (button.hasAttribute('data-wb-previous')) {
        this.toolPage = Math.max(1, this.toolPage - 1);
        this.renderPalette();
      }
      if (button.hasAttribute('data-wb-more')) {
        this.toolPage++;
        this.renderPalette();
      }
    });
    this.q<HTMLInputElement>('[data-wb-search]').addEventListener('input', () => {
      this.limit = 6;
      this.toolPage = 1;
      this.renderPalette();
    });
    this.q<HTMLSelectElement>('[data-wb-category]').addEventListener('change', () => {
      this.limit = 6;
      this.toolPage = 1;
      this.renderPalette();
    });
    this.q<HTMLFormElement>('[data-wb-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.applyParameter();
    });
    document.addEventListener('keydown', (e) => this.key(e), true);
    root.addEventListener(
      'keyup',
      (e) => {
        if (e.code === 'Space' && this.spaceHeld) {
          this.spaceHeld = false;
          if (this.host.pan() !== this.priorPan) void this.host.action('pan');
        }
      },
      true,
    );
    window.addEventListener('blur', () => {
      if (this.spaceHeld) {
        this.spaceHeld = false;
        if (this.host.pan() !== this.priorPan) void this.host.action('pan');
      }
    });
    host.stage.addEventListener(
      'pointermove',
      (e) => {
        if (!this.p.cursor || this.cursorFrame) return;
        this.cursorFrame = requestAnimationFrame(() => {
          this.cursorFrame = 0;
          const svg = host.canvas.querySelector('svg'),
            m = svg?.getScreenCTM();
          if (m) {
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
            this.q('[data-wb-cursor]').textContent = `X ${Math.round(p.x)} · Y ${Math.round(p.y)}`;
          }
        });
      },
      { passive: true },
    );
    this.savePrefs(false);
    this.render();
  }
  private q<T extends HTMLElement = HTMLElement>(s: string) {
    return this.host.root.querySelector<T>(s)!;
  }
  private scheduleResize() {
    if (this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      const root = this.host.root;
      if (root.dataset.wbFocus !== 'true') {
        root.style.removeProperty('--wb-layout-height');
        root.style.removeProperty('--wb-work-height');
        return;
      }
      const workspace = root.querySelector<HTMLElement>('.uc-workspace')!;
      const bottom =
        (window.visualViewport?.height || innerHeight) + (window.visualViewport?.offsetTop || 0);
      const height = Math.max(100, bottom - workspace.getBoundingClientRect().top - 12);
      const used = ['.wb-context', '.uc-stage-toolbar', '.wb-statusbar'].reduce(
        (sum, selector) =>
          sum + (root.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height || 0),
        24,
      );
      root.style.setProperty('--wb-layout-height', `${Math.round(height)}px`);
      root.style.setProperty('--wb-work-height', `${Math.round(Math.max(80, height - used))}px`);
    });
  }
  private savePrefs(write = true) {
    if (write)
      try {
        localStorage.setItem(PREFS, JSON.stringify(this.p));
      } catch {}
    this.host.root.style.setProperty('--wb-panel-width', `${this.p.dockWidth}px`);
    this.render();
  }
  private async key(e: KeyboardEvent) {
    if (!this.host.root.isConnected) return;
    const target = e.target as Element,
      editing = target.matches('input,textarea,select,[contenteditable=true]');
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 'k' &&
      (!editing || this.host.root.contains(target))
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.filter = 'all';
      this.q<HTMLSelectElement>('[data-wb-category]').value = 'all';
      this.openPalette();
      return;
    }
    if (!this.host.root.contains(target) || editing || this.host.root.querySelector('dialog[open]'))
      return;
    if (e.code === 'Space' && this.p.space && this.host.stage.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
      if (!this.spaceHeld) {
        this.spaceHeld = true;
        this.priorPan = this.host.pan();
        if (!this.priorPan) void this.host.action('pan');
      }
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      this.host.stage.contains(target) &&
      ['c', 'x', 'v'].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      e.stopPropagation();
      await this.run(
        e.key.toLowerCase() === 'c'
          ? 'copy-selection'
          : e.key.toLowerCase() === 'x'
            ? 'cut-selection'
            : e.shiftKey
              ? 'paste-in-place'
              : 'paste-selection',
      );
    }
  }
  private openPalette() {
    this.limit = 6;
    this.toolPage = 1;
    this.q<HTMLInputElement>('[data-wb-search]').value = '';
    const dialog = this.q<HTMLDialogElement>('[data-wb-palette]');
    if (!dialog.open) dialog.showModal();
    this.renderPalette();
    this.q('[data-wb-search]').focus();
  }
  private unavailable(id: WorkbenchCommandId): string {
    const doc = this.host.committed(),
      selected = doc.layers.filter((layer) => this.host.selected().includes(layer.id)),
      editable = selected.filter((layer) => layer.visible && !layer.locked);
    if (id === 'paste-selection' || id === 'paste-in-place')
      return this.clipboard.length ? '' : 'Copy or cut objects first.';
    if (id === 'paste-style' && !this.style) return 'Copy an appearance first.';
    if ((id === 'restore-checkpoint' || id === 'delete-checkpoint') && !this.checkpoints().length)
      return 'Save a checkpoint first.';
    if (id === 'end-solo' && !this.solo) return 'Use Solo Selection first.';
    if (id.startsWith('text-') || id === 'label-from-text')
      return editable.some((layer) => layer.kind === 'text')
        ? ''
        : 'Select an unlocked text object.';
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
    )
      return editable.some((layer) => layer.kind === 'vector')
        ? ''
        : 'Select an unlocked vector object.';
    if (
      ['select-color', 'select-opacity', 'copy-style', 'selection-tool'].includes(id) &&
      !selected.length
    )
      return 'Select a reference object first.';
    if (
      [
        'match-width',
        'match-height',
        'match-size',
        'match-rotation',
        'match-opacity',
        'stack-horizontal',
        'stack-vertical',
        'reading-order',
        'reverse-order',
      ].includes(id) &&
      editable.length < 2
    )
      return 'Select at least two unlocked objects.';
    if (id === 'swap-positions' && editable.length !== 2)
      return 'Select exactly two unlocked objects.';
    if (
      [
        'pack-rows',
        'pack-columns',
        'fit-safe',
        'mirror-layout-x',
        'mirror-layout-y',
        'lock-selection',
        'hide-selection',
        'solo-selection',
        'prefix-names',
        'number-names',
        'full-opacity',
        'copy-selection',
        'cut-selection',
        'paste-style',
        'export-selected-svg',
        'export-selected-png',
      ].includes(id) &&
      !editable.length
    )
      return 'Select visible, unlocked objects first.';
    return '';
  }
  private renderPalette() {
    const items = searchWorkbench(
      this.q<HTMLInputElement>('[data-wb-search]').value,
      this.q<HTMLSelectElement>('[data-wb-category]').value,
    ).filter(
      (c) =>
        this.filter === 'all' ||
        (this.filter === 'recent' ? this.p.recent : this.p.favorites).includes(c[0]),
    );
    if (this.filter === 'recent')
      items.sort((a, b) => this.p.recent.indexOf(a[0]) - this.p.recent.indexOf(b[0]));
    const list = this.q('[data-wb-results]');
    list.replaceChildren();
    const pages = Math.max(1, Math.ceil(items.length / this.limit));
    this.toolPage = Math.min(this.toolPage, pages);
    for (const c of items.slice((this.toolPage - 1) * this.limit, this.toolPage * this.limit)) {
      const row = document.createElement('div');
      row.className = 'wb-command-row';
      const run = document.createElement('button');
      run.type = 'button';
      run.dataset.wbRun = c[0];
      const strong = document.createElement('strong');
      strong.textContent = c[1];
      const small = document.createElement('small');
      const unavailable = this.unavailable(c[0]);
      small.textContent = unavailable || c[3];
      run.disabled = !!unavailable;
      run.append(strong, small);
      const star = document.createElement('button');
      star.type = 'button';
      star.dataset.wbStar = c[0];
      star.textContent = this.p.favorites.includes(c[0]) ? '★' : '☆';
      star.setAttribute(
        'aria-label',
        `${this.p.favorites.includes(c[0]) ? 'Unpin' : 'Pin'} ${c[1]}`,
      );
      star.setAttribute('aria-pressed', String(this.p.favorites.includes(c[0])));
      row.append(run, star);
      list.append(row);
    }
    this.q('[data-wb-result-count]').textContent =
      `${items.length} tools${this.filter === 'recent' ? ' recently used' : this.filter === 'favorite' ? ' pinned' : ''}`;
    this.q<HTMLButtonElement>('[data-wb-more]').disabled = this.toolPage >= pages;
    this.q<HTMLButtonElement>('[data-wb-previous]').disabled = this.toolPage <= 1;
    this.q('[data-wb-page]').textContent = `Page ${this.toolPage} of ${pages}`;
    this.host.root
      .querySelectorAll<HTMLElement>('[data-wb-list]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.wbList === this.filter)),
      );
  }
  private ask(id: WorkbenchCommandId) {
    this.parameter = id;
    const command = workbenchCommands.find((c) => c[0] === id)!;
    this.q('#wb-parameter-title').textContent = command[1];
    this.q('[data-wb-description]').textContent = command[3];
    const labels: Partial<Record<WorkbenchCommandId, string>> = {
      'dock-width': 'Panel Width (250–440 px)',
      'grid-size': 'Grid Spacing (8–200 px)',
      'safe-size': 'Safe Inset (0–500 px)',
      'select-name': 'Layer Name Contains',
      'stack-horizontal': 'Gap (0–1,000 px)',
      'stack-vertical': 'Gap (0–1,000 px)',
      'pack-rows': 'Gap (0–1,000 px)',
      'pack-columns': 'Gap (0–1,000 px)',
      'prefix-names': 'Name Prefix',
      'text-replace': 'Find This Phrase',
      'save-checkpoint': 'Checkpoint Name',
      'rename-project': 'Project Name',
    };
    const select = ['restore-checkpoint', 'delete-checkpoint'].includes(id),
      confirmation = ['delete-hidden', 'delete-empty-text', 'delete-outside'].includes(id);
    this.q('[data-wb-value-label]').hidden = select || confirmation;
    this.q('[data-wb-checkpoint-label]').hidden = !select;
    this.q('[data-wb-second-label]').hidden = id !== 'text-replace';
    this.q('[data-wb-value-caption]').textContent = labels[id] || 'Value';
    const input = this.q<HTMLInputElement>('[data-wb-value]');
    input.value =
      id === 'grid-size'
        ? String(this.p.gridSize)
        : id === 'safe-size'
          ? String(this.p.safeSize)
          : id === 'dock-width'
            ? String(this.p.dockWidth)
            : id === 'rename-project'
              ? this.host.committed().title || this.host.committed().artId
              : ['stack-horizontal', 'stack-vertical', 'pack-rows', 'pack-columns'].includes(id)
                ? '24'
                : '';
    input.type = [
      'grid-size',
      'safe-size',
      'dock-width',
      'stack-horizontal',
      'stack-vertical',
      'pack-rows',
      'pack-columns',
    ].includes(id)
      ? 'number'
      : 'text';
    input.required = !select && !confirmation;
    this.q<HTMLInputElement>('[data-wb-second]').value = '';
    const picker = this.q<HTMLSelectElement>('[data-wb-checkpoint]');
    picker.replaceChildren();
    for (const saved of this.checkpoints())
      picker.add(new Option(`${saved.name} · ${new Date(saved.at).toLocaleString()}`, saved.id));
    this.q('[data-wb-form-error]').hidden = true;
    const dialog = this.q<HTMLDialogElement>('[data-wb-parameter-dialog]');
    dialog.showModal();
    (select ? picker : input).focus();
  }
  private async applyParameter() {
    if (!this.parameter) return;
    try {
      await this.execute(
        this.parameter,
        this.q<HTMLInputElement>('[data-wb-value]').value,
        this.q<HTMLInputElement>('[data-wb-second]').value,
      );
      this.q<HTMLDialogElement>('[data-wb-parameter-dialog]').close();
    } catch (error) {
      this.q('[data-wb-form-error]').textContent =
        error instanceof Error ? error.message : 'This tool could not be applied.';
      this.q('[data-wb-form-error]').hidden = false;
    }
  }
  async run(id: WorkbenchCommandId) {
    if (!commandIds.has(id) || this.busy) return;
    const reason = this.unavailable(id);
    if (reason) {
      this.host.status(reason);
      return;
    }
    this.q<HTMLDialogElement>('[data-wb-palette]').close();
    if (
      [
        'dock-width',
        'grid-size',
        'safe-size',
        'select-name',
        'stack-horizontal',
        'stack-vertical',
        'pack-rows',
        'pack-columns',
        'prefix-names',
        'text-replace',
        'save-checkpoint',
        'restore-checkpoint',
        'delete-checkpoint',
        'rename-project',
        'delete-hidden',
        'delete-empty-text',
        'delete-outside',
      ].includes(id)
    ) {
      this.ask(id);
      return;
    }
    try {
      await this.execute(id);
    } catch (error) {
      this.host.status(
        error instanceof Error ? error.message : 'This tool could not be applied.',
        true,
      );
    }
  }
  private checkpoints(): { id: string; name: string; at: string }[] {
    try {
      const data = JSON.parse(localStorage.getItem(this.checkpointKey) || '[]');
      return Array.isArray(data)
        ? data
            .filter(
              (v) =>
                v &&
                /^[a-f0-9-]{36}$/.test(v.id) &&
                typeof v.name === 'string' &&
                typeof v.at === 'string',
            )
            .slice(0, 10)
        : [];
    } catch {
      return [];
    }
  }
  private output(title: string, text: string, copy = false) {
    this.q('#wb-output-title').textContent = title;
    this.q('[data-wb-output]').textContent = copy ? 'Copy the text below.' : text;
    const input = this.q<HTMLTextAreaElement>('[data-wb-copy]');
    input.hidden = !copy;
    input.value = copy ? text : '';
    this.q<HTMLDialogElement>('[data-wb-output-dialog]').showModal();
    if (copy) input.select();
  }
  private async copyText(value: string, title: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.host.status(`${title} copied.`);
    } catch {
      this.output(title, value, true);
    }
  }
  private file(doc: EditorDocument, selection = false) {
    const d = clone(doc);
    delete d.selection;
    if (selection) {
      d.layers = d.layers.filter((l) => this.host.selected().includes(l.id) && l.visible);
      if (!d.layers.length) throw Error('Select visible objects to export.');
      const b = this.host.bounds(d.layers.map((l) => l.id));
      if (!b || !b.width || !b.height) throw Error('The selection has no visible size.');
      d.crop = b;
      d.background = 'transparent';
    }
    return d;
  }
  private async portableSvg(doc: EditorDocument) {
    return portableSvg(doc);
  }
  private async execute(id: WorkbenchCommandId, value = '', second = '') {
    const definition = workbenchCommands.find((c) => c[0] === id)!;
    this.p.recent = [id, ...this.p.recent.filter((v) => v !== id)].slice(0, 12);
    this.savePrefs();
    const toggles: Partial<Record<WorkbenchCommandId, keyof Preferences>> = {
      'show-grid': 'grid',
      'show-rulers': 'rulers',
      'center-guides': 'center',
      'safe-guides': 'safe',
      'snap-grid': 'snap',
      'snap-center': 'snapCenter',
      'cursor-coordinates': 'cursor',
      'selection-size': 'measure',
      'context-toolbar': 'context',
      'space-pan': 'space',
    };
    if (toggles[id]) {
      const key = toggles[id]!;
      Object.assign(this.p, { [key]: !this.p[key] });
      this.savePrefs();
      this.host.status(`${definition[1]} ${this.p[key] ? 'on' : 'off'}.`);
      return;
    }
    if (['dock-width', 'grid-size', 'safe-size'].includes(id)) {
      const n = Number(value),
        key = id === 'dock-width' ? 'dockWidth' : id === 'grid-size' ? 'gridSize' : 'safeSize';
      const [min, max] =
        id === 'dock-width' ? [250, 440] : id === 'grid-size' ? [8, 200] : [0, 500];
      if (!Number.isFinite(n) || n < min || n > max)
        throw Error(`Enter a value from ${min} to ${max}.`);
      this.p[key] = n;
      this.savePrefs();
      return;
    }
    if (id === 'command-search' || id === 'command-recents' || id === 'command-favorites') {
      this.filter =
        id === 'command-recents' ? 'recent' : id === 'command-favorites' ? 'favorite' : 'all';
      this.openPalette();
      return;
    }
    if (id === 'focus-mode') {
      this.host.root.dataset.wbFocus = String(this.host.root.dataset.wbFocus !== 'true');
      this.host.root.scrollIntoView({ block: 'start' });
      this.host.render();
      return;
    }
    if (id === 'fullscreen') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (this.host.root.requestFullscreen) await this.host.root.requestFullscreen();
        else throw Error('Unavailable');
      } catch {
        this.host.root.dataset.wbFocus = 'true';
        this.host.status(
          'This browser uses the full-window workspace instead of native full screen.',
        );
      }
      this.host.render();
      return;
    }
    if (id === 'toggle-dock') {
      this.host.root.dataset.propertiesCollapsed = String(
        this.host.root.dataset.propertiesCollapsed !== 'true',
      );
      this.host.root.dispatchEvent(new CustomEvent('uc:inspector-collapse'));
      return;
    }
    if (id === 'selection-tool') {
      const layer = this.host.committed().layers.find((l) => this.host.selected().includes(l.id));
      if (!layer) throw Error('Choose an object first.');
      this.host.panel(
        layer.kind === 'text' ? 'text' : layer.kind === 'raster' ? 'region' : 'transform',
      );
      return;
    }
    if (id === 'shortcut-guide') {
      this.output(
        'Studio Shortcuts',
        'Ctrl / Command K — Find a tool\nCtrl / Command C — Copy selected objects\nCtrl / Command X — Cut selected objects\nCtrl / Command V — Paste objects\nCtrl / Command Shift V — Paste in place\nHold Space on canvas — Pan\nCtrl / Command Z — Undo\nCtrl / Command Shift Z — Redo\nArrow keys — Move selection\nShift + Arrow — Move ten pixels\nEscape — Cancel drawing or clear selection\nDelete — Remove selected unlocked objects',
      );
      return;
    }
    const doc = this.host.committed(),
      selected = this.host.selected();
    if (id === 'solo-selection') {
      this.solo = Object.fromEntries(doc.layers.map((l) => [l.id, l.visible]));
    }
    if (id === 'end-solo') {
      if (!this.solo) throw Error('Use Solo Selection first.');
      const next = clone(doc);
      for (const l of next.layers) if (l.id in this.solo) l.visible = this.solo[l.id];
      this.solo = undefined;
      this.host.commit(next, 'Visibility before Solo Selection restored.');
      return;
    }
    if (id === 'copy-selection' || id === 'cut-selection') {
      const layers = doc.layers.filter((l) => selected.includes(l.id) && l.visible && !l.locked);
      if (!layers.length) throw Error('Select visible, unlocked objects first.');
      this.clipboard = clone(layers);
      if (id === 'cut-selection') {
        const next = clone(doc);
        next.layers = next.layers.filter((l) => !layers.some((c) => c.id === l.id));
        this.host.commit(next, 'Objects cut. Paste them to reuse; Undo restores them.');
      } else this.host.status(`${layers.length} editable objects copied in Studio.`);
      this.render();
      return;
    }
    if (id === 'paste-selection' || id === 'paste-in-place') {
      if (!this.clipboard.length) throw Error('Copy or cut some objects in Studio first.');
      const groups = new Map<string, string>(),
        copies = clone(this.clipboard);
      for (const l of copies) {
        l.id = `paste-${crypto.randomUUID()}`;
        l.label = l.label.slice(0, 75);
        l.locked = false;
        if (id === 'paste-selection') {
          l.x += 24;
          l.y += 24;
        }
        if (l.group) {
          if (!groups.has(l.group)) groups.set(l.group, `group-${crypto.randomUUID()}`);
          l.group = groups.get(l.group)!;
        }
      }
      const next = clone(doc);
      next.layers.push(...copies);
      this.host.commit(next, 'Copied objects pasted.');
      this.host.setSelection(copies.map((l) => l.id));
      return;
    }
    if (id === 'copy-style') {
      const l = doc.layers.find((l) => selected.includes(l.id) && l.kind !== 'raster');
      if (!l) throw Error('Select text or a vector to copy its appearance.');
      this.style = clone(l);
      this.host.status('Appearance copied. Select compatible objects, then use Paste Appearance.');
      return;
    }
    if (id === 'paste-style') {
      if (!this.style) throw Error('Copy Appearance from a text or vector first.');
      const next = clone(doc),
        source = this.style;
      for (const layer of next.layers.filter(
        (l) => selected.includes(l.id) && !l.locked && l.visible,
      )) {
        layer.opacity = source.opacity;
        if (layer.kind === 'text' && source.kind === 'text') {
          for (const key of ['size', 'color', 'bold', 'align', 'typography'] as const)
            Object.assign(layer, {
              [key]: source[key] === undefined ? undefined : clone(source[key]),
            });
        } else if (layer.kind === 'vector' && source.kind === 'vector') {
          const colors = layerColors(source),
            svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
          for (const shape of svg.querySelectorAll(
            'path,rect,circle,ellipse,line,polyline,polygon',
          ))
            if (colors[0]) shape.setAttribute('fill', colors[0]);
          layer.markup = svg.innerHTML;
        }
      }
      this.host.commit(next, 'Compatible appearance applied.');
      return;
    }
    if (id === 'save-checkpoint') {
      const name = value.trim().slice(0, 80);
      if (!name) throw Error('Enter a checkpoint name.');
      const records = this.checkpoints();
      if (records.length >= 10)
        throw Error('Ten checkpoints are already saved. Delete an old checkpoint to save another.');
      const item = { id: crypto.randomUUID(), name, at: new Date().toISOString() };
      await saveLocal(`${this.checkpointKey}:${item.id}`, serializeProject(doc));
      try {
        localStorage.setItem(this.checkpointKey, JSON.stringify([...records, item]));
      } catch (error) {
        await deleteLocal(`${this.checkpointKey}:${item.id}`);
        throw error;
      }
      this.host.status('Named checkpoint saved on this device.');
      return;
    }
    if (id === 'restore-checkpoint' || id === 'delete-checkpoint') {
      const savedId = this.q<HTMLSelectElement>('[data-wb-checkpoint]').value,
        records = this.checkpoints(),
        record = records.find((r) => r.id === savedId);
      if (!record) throw Error('Choose an available checkpoint.');
      if (id === 'delete-checkpoint') {
        await deleteLocal(`${this.checkpointKey}:${savedId}`);
        localStorage.setItem(
          this.checkpointKey,
          JSON.stringify(records.filter((r) => r.id !== savedId)),
        );
        this.host.status('Checkpoint removed; your canvas is unchanged.');
      } else {
        const saved = await loadLocal(`${this.checkpointKey}:${savedId}`);
        if (!validateDocument(saved, doc.artId))
          throw Error('This checkpoint could not be validated. Your canvas was preserved.');
        await prepareProjectSources(saved);
        if (this.host.committed() !== doc)
          throw Error(
            'The canvas changed while this checkpoint loaded. Restore again when you are ready.',
          );
        this.host.commit(
          withoutEmbeddedSources(saved),
          'Checkpoint restored. Undo returns to your previous work.',
        );
      }
      return;
    }
    if (id === 'export-inventory') {
      const rows = [['Name', 'Type', 'X', 'Y', 'Width', 'Height', 'Visible', 'Locked']];
      for (const l of doc.layers) {
        const b = this.host.bounds([l.id]);
        rows.push([
          l.label,
          l.kind,
          String(l.x),
          String(l.y),
          String(b?.width || 0),
          String(b?.height || 0),
          String(l.visible),
          String(l.locked),
        ]);
      }
      const quote = (v: string) =>
        `"${(/^[\s]*[=+@-]/.test(v) ? "'" : '') + v.replaceAll('"', '""')}"`;
      download(
        new Blob(['\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n')], {
          type: 'text/csv;charset=utf-8',
        }),
        `${filename(doc)}-objects.csv`,
      );
      return;
    }
    if (id === 'export-palette') {
      const colors = [...new Set(doc.layers.filter((l) => l.visible).flatMap(layerColors))];
      download(
        new Blob([JSON.stringify({ title: doc.title || doc.artId, colors }, null, 2)], {
          type: 'application/json',
        }),
        `${filename(doc)}-palette.json`,
      );
      return;
    }
    if (id === 'export-text') {
      const text = doc.layers
        .filter((l): l is TextLayer => l.kind === 'text' && l.visible)
        .map((l) => l.text)
        .join('\n\n');
      download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filename(doc)}-text.txt`);
      return;
    }
    if (
      [
        'export-svg',
        'export-selected-svg',
        'copy-svg',
        'export-png',
        'export-jpeg',
        'copy-png',
        'export-selected-png',
      ].includes(id)
    ) {
      this.busy = true;
      this.host.root.dataset.wbBusy = 'true';
      try {
        const d = this.file(doc, id.includes('selected'));
        if (id.endsWith('svg')) {
          const svg = await this.portableSvg(d);
          if (id === 'copy-svg') await this.copyText(svg, 'SVG markup');
          else
            download(
              new Blob([svg], { type: 'image/svg+xml' }),
              `${filename(doc)}${id.includes('selected') ? '-selection' : ''}.svg`,
            );
        } else {
          const format = id === 'export-jpeg' ? 'image/jpeg' : 'image/png',
            width = Math.min(4096, Math.round((d.crop || d).width));
          const blob = await renderBitmap(d, width, 0.94, format);
          if (id === 'copy-png') {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              this.host.status('PNG copied to the clipboard.');
            } catch {
              download(blob, `${filename(doc)}.png`);
              this.host.status('Image clipboard is unavailable; the PNG was downloaded instead.');
            }
          } else
            download(
              blob,
              `${filename(doc)}${id.includes('selected') ? '-selection' : ''}.${format === 'image/jpeg' ? 'jpg' : 'png'}`,
            );
        }
      } finally {
        this.busy = false;
        this.host.root.dataset.wbBusy = 'false';
      }
      return;
    }
    const result = documentCommand(id, doc, {
      selected,
      bounds: this.host.bounds,
      value,
      second,
      margin: this.p.safeSize,
    });
    if (result.document)
      this.host.commit(result.document, `${definition[1]} applied. Undo is available.`);
    if (result.selection) this.host.setSelection(result.selection);
  }
  render() {
    const doc = this.host.committed(),
      selected = this.host.selected();
    this.q('[data-wb-document-size]').textContent =
      `${Math.round(doc.width)} × ${Math.round(doc.height)} px`;
    this.q('[data-wb-layer-count]').textContent =
      `${doc.layers.length} ${doc.layers.length === 1 ? 'layer' : 'layers'}`;
    this.q('[data-wb-selection]').textContent = selected.length
      ? `${selected.length} selected`
      : 'Select an object to edit it';
    this.q('[data-wb-context]').hidden = !this.p.context;
    this.q('[data-wb-cursor]').hidden = !this.p.cursor;
    const box = this.host.bounds(selected);
    this.q('[data-wb-measurement]').hidden = !this.p.measure || !box;
    if (box)
      this.q('[data-wb-measurement]').textContent =
        `Selection ${Math.round(box.width)} × ${Math.round(box.height)} px`;
    const title = this.host.root.querySelector<HTMLElement>('.uc-command h2');
    if (title) title.textContent = doc.title || this.initialTitle;
    const back = this.host.root.querySelector<HTMLElement>('[data-wb-back-page]');
    if (back)
      back.textContent =
        this.host.root.dataset.wbFocus === 'true' ? 'Back to Page' : 'Open Workspace';
    for (const b of this.host.root.querySelectorAll<HTMLButtonElement>('[data-wb-run]')) {
      const id = b.dataset.wbRun;
      b.disabled =
        !!(
          id &&
          ['selection-tool', 'copy-selection', 'lock-selection'].includes(id) &&
          !selected.length
        ) ||
        (id === 'paste-selection' && !this.clipboard.length);
      if (id === 'show-grid') b.setAttribute('aria-pressed', String(this.p.grid));
      if (id === 'show-rulers') b.setAttribute('aria-pressed', String(this.p.rulers));
      if (id === 'focus-mode')
        b.setAttribute('aria-pressed', String(this.host.root.dataset.wbFocus === 'true'));
    }
    this.drawGuides();
    this.scheduleResize();
  }
  drawGuides() {
    this.host.canvas.querySelector('.wb-guides')?.remove();
    const doc = this.host.doc(),
      area = doc.crop || { x: 0, y: 0, width: doc.width, height: doc.height };
    if (!this.p.grid && !this.p.rulers && !this.p.center && !this.p.safe) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('wb-guides');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `${area.x} ${area.y} ${area.width} ${area.height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    const line = (x1: number, y1: number, x2: number, y2: number, color: string, dash = '') => {
      const l = document.createElementNS(NS, 'line');
      for (const [k, v] of Object.entries({
        x1,
        y1,
        x2,
        y2,
        stroke: color,
        'stroke-width': 1,
        'stroke-dasharray': dash,
      }))
        l.setAttribute(k, String(v));
      svg.append(l);
    };
    if (this.p.grid) {
      const step =
        this.p.gridSize *
        Math.max(1, Math.ceil(Math.max(area.width, area.height) / this.p.gridSize / 150));
      for (let x = Math.ceil(area.x / step) * step; x < area.x + area.width; x += step)
        line(x, area.y, x, area.y + area.height, '#4685cb35');
      for (let y = Math.ceil(area.y / step) * step; y < area.y + area.height; y += step)
        line(area.x, y, area.x + area.width, y, '#4685cb35');
    }
    if (this.p.center) {
      line(
        area.x + area.width / 2,
        area.y,
        area.x + area.width / 2,
        area.y + area.height,
        '#d071ba',
        '5 4',
      );
      line(
        area.x,
        area.y + area.height / 2,
        area.x + area.width,
        area.y + area.height / 2,
        '#d071ba',
        '5 4',
      );
    }
    if (this.p.safe) {
      const margin = Math.min(this.p.safeSize, area.width / 2 - 1, area.height / 2 - 1),
        rect = document.createElementNS(NS, 'rect');
      for (const [k, v] of Object.entries({
        x: area.x + margin,
        y: area.y + margin,
        width: area.width - margin * 2,
        height: area.height - margin * 2,
        fill: 'none',
        stroke: '#2687a9',
        'stroke-width': 1,
        'stroke-dasharray': '6 4',
      }))
        rect.setAttribute(k, String(v));
      svg.append(rect);
    }
    if (this.p.rulers) {
      const scale = area.width / Math.max(1, this.host.canvas.clientWidth),
        step = Math.max(50, Math.ceil(area.width / 8 / 50) * 50);
      for (let x = Math.ceil(area.x / step) * step; x < area.x + area.width; x += step) {
        line(x, area.y, x, area.y + 9 * scale, '#31577f');
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', String(x + 3 * scale));
        t.setAttribute('y', String(area.y + 14 * scale));
        t.setAttribute('font-size', String(10 * scale));
        t.setAttribute('fill', '#31577f');
        t.textContent = String(x);
        svg.append(t);
      }
      for (let y = Math.ceil(area.y / step) * step; y < area.y + area.height; y += step) {
        line(area.x, y, area.x + 9 * scale, y, '#31577f');
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', String(area.x + 3 * scale));
        t.setAttribute('y', String(y + 12 * scale));
        t.setAttribute('font-size', String(10 * scale));
        t.setAttribute('fill', '#31577f');
        t.textContent = String(y);
        svg.append(t);
      }
    }
    this.host.canvas.append(svg);
  }
  snapMove(dx: number, dy: number, box: Box) {
    if (this.p.snap) {
      dx = Math.round((box.x + dx) / this.p.gridSize) * this.p.gridSize - box.x;
      dy = Math.round((box.y + dy) / this.p.gridSize) * this.p.gridSize - box.y;
    }
    if (this.p.snapCenter) {
      const doc = this.host.doc(),
        area = doc.crop || { x: 0, y: 0, width: doc.width, height: doc.height },
        tolerance = (8 * area.width) / Math.max(1, this.host.canvas.clientWidth);
      const cx = area.x + area.width / 2,
        cy = area.y + area.height / 2;
      if (Math.abs(box.x + box.width / 2 + dx - cx) < tolerance) dx = cx - box.x - box.width / 2;
      if (Math.abs(box.y + box.height / 2 + dy - cy) < tolerance) dy = cy - box.y - box.height / 2;
    }
    return { dx, dy, custom: this.p.snap || this.p.snapCenter };
  }
}
