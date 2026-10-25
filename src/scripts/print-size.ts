import {
  calculatePrintSize,
  PAPER_SIZES,
  PRINT_UNITS,
  type PrintInput,
  type PrintUnit,
} from '../lib/print-size';

const form = document.querySelector<HTMLFormElement>('#print-calculator-form');
if (form) {
  const element = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const field = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const check = field('landscape') as HTMLInputElement;
  const result = element('print-result');
  const preview = element('print-preview-content');
  const error = element('print-error');
  const fit = element<HTMLButtonElement>('print-fit');
  const rotate = element<HTMLButtonElement>('print-rotate');
  const references = element('print-reference-cards');
  const referenceEmpty = element('print-reference-empty');
  const number = (value: number, digits = 2) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: value > 0 && value < 0.01 ? 6 : digits,
      ...(value > 0 && value < 0.000001 ? { notation: 'scientific' as const } : {}),
    }).format(value);
  const inputNumber = (value: number) => String(Number(value.toFixed(9)));
  const validPixels = () =>
    ['pixelsWide', 'pixelsHigh'].every((name) => {
      const value = Number(field(name).value);
      return field(name).value !== '' && Number.isInteger(value) && value >= 1 && value <= 100000;
    });
  let unit: PrintUnit = 'in';
  let sizeBy = 'width';
  let last: ReturnType<typeof calculatePrintSize> | undefined;
  const scale = () => PRINT_UNITS[unit].scale;
  const dimensions = (width: number, height: number, longUnit = false) =>
    `${number(width * scale())} × ${number(height * scale())} ${longUnit ? PRINT_UNITS[unit].label : PRINT_UNITS[unit].short}`;

  function updateLabels() {
    const height = sizeBy === 'height';
    element('print-size-label').textContent = height ? 'Height on paper' : 'Width on paper';
    element('print-linked-label').textContent = height
      ? 'Width (calculated)'
      : 'Height (calculated)';
    element('print-margin-label').textContent = `Margin per side (${PRINT_UNITS[unit].short})`;
    field('printWidth').setAttribute('max', inputNumber(500 * scale()));
    field('margin').setAttribute('max', inputNumber(2 * scale()));
  }

  function updateReferences() {
    const valid = validPixels();
    references.hidden = !valid;
    referenceEmpty.hidden = valid;
    if (!valid) return;
    const width = Number(field('pixelsWide').value);
    const height = Number(field('pixelsHigh').value);
    for (const density of [150, 300, 600])
      element(`print-reference-${density}`).textContent = dimensions(
        width / density,
        height / density,
      );
  }

  function draw(computed: ReturnType<typeof calculatePrintSize>, paperName: string) {
    const zoom = Math.min(260 / computed.pageWidth, 264 / computed.pageHeight);
    const width = computed.pageWidth * zoom;
    const height = computed.pageHeight * zoom;
    const x = (400 - width) / 2;
    const y = (325 - height) / 2;
    const margin = (Number(field('margin').value) / scale()) * zoom;
    const attrs = (id: string, values: Record<string, number | string>) => {
      const node = document.getElementById(id)!;
      for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value));
    };
    attrs('print-paper-rect', { x, y, width, height });
    attrs('print-clip-rect', { x, y, width, height });
    attrs('print-paper-shadow', { x: x + 5, y: y + 8, width, height });
    attrs('print-paper-edge', { x: x + 2, y: y + 4, width, height });
    attrs('print-paper-layer', { x: x + 1, y: y + 2, width, height });
    attrs('print-top-ruler', { x, y: y - 22, width, height: 14 });
    attrs('print-left-ruler', { x: x - 22, y, width: 14, height });
    const ticks = document.getElementById('print-ruler-ticks')!;
    ticks.replaceChildren();
    const svgNode = (tag: string, attributes: Record<string, string | number>, text = '') => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      if (text) node.textContent = text;
      ticks.append(node);
    };
    const ruler = (length: number, vertical: boolean) => {
      const total = length * scale();
      const target = total / 6;
      const base = 10 ** Math.floor(Math.log10(target));
      const step = ([1, 2, 5, 10].find((value) => value * base >= target) ?? 10) * base;
      const minor = step / 5;
      for (let index = 0; index * minor <= total + 1e-9; index++) {
        const value = index * minor;
        const offset = (value / scale()) * zoom;
        const major = index % 5 === 0;
        if (vertical) {
          svgNode('line', { x1: x - 8, x2: x - (major ? 14 : 11), y1: y + offset, y2: y + offset });
          if (major && index > 0)
            svgNode(
              'text',
              {
                x: x - 17,
                y: y + offset + 2,
                'text-anchor': 'middle',
                'font-size': 5,
                stroke: 'none',
              },
              number(value),
            );
        } else {
          svgNode('line', { x1: x + offset, x2: x + offset, y1: y - 8, y2: y - (major ? 15 : 11) });
          if (major && index > 0)
            svgNode(
              'text',
              { x: x + offset, y: y - 17, 'text-anchor': 'middle', 'font-size': 5, stroke: 'none' },
              number(value),
            );
        }
      }
    };
    ruler(computed.pageWidth, false);
    ruler(computed.pageHeight, true);
    attrs('print-margin-rect', {
      x: x + margin,
      y: y + margin,
      width: computed.usableWidth * zoom,
      height: computed.usableHeight * zoom,
    });
    const imageWidth = computed.widthInches * zoom;
    const imageHeight = computed.heightInches * zoom;
    attrs('print-image-rect', {
      x: 200 - imageWidth / 2,
      y: y + height / 2 - imageHeight / 2,
      width: imageWidth,
      height: imageHeight,
      stroke: computed.fits ? '#2865ad' : '#ae3c43',
    });
    attrs('print-image-icon', {
      transform: `translate(200 ${y + height / 2}) scale(${Math.min(1, imageWidth / 46, imageHeight / 40)})`,
    });
    document.getElementById('print-page-caption')!.textContent =
      `${paperName} · ${dimensions(computed.pageWidth, computed.pageHeight)}`;
    document.getElementById('print-diagram-title')!.textContent =
      `Image centered on ${paperName} paper`;
    document.getElementById('print-diagram-desc')!.textContent =
      `${dimensions(computed.widthInches, computed.heightInches, true)} image. ${computed.fits ? 'Fits within' : 'Exceeds'} the selected margins. ${computed.fits ? '' : 'Parts outside the paper are clipped in this diagram. '}Diagram is not actual size.`;
  }

  function fail(message: string) {
    last = undefined;
    result.hidden = true;
    preview.hidden = true;
    fit.hidden = true;
    rotate.hidden = true;
    error.textContent = message;
    error.hidden = false;
    element('print-linked-value').textContent = '—';
  }

  function render() {
    updateReferences();
    if (!form!.checkValidity()) {
      fail(
        'Enter valid dimensions in every field. Pixel dimensions must be whole numbers; print size must be greater than zero.',
      );
      return;
    }
    try {
      const pixelsWide = Number(field('pixelsWide').value);
      const pixelsHigh = Number(field('pixelsHigh').value);
      const desired = Number(field('printWidth').value) / scale();
      const input: PrintInput = {
        pixelsWide,
        pixelsHigh,
        widthInches: sizeBy === 'height' ? (desired * pixelsWide) / pixelsHigh : desired,
        paper: field('paper').value as PrintInput['paper'],
        landscape: check.checked,
        marginInches: Number(field('margin').value) / scale(),
      };
      const computed = calculatePrintSize(input);
      last = computed;
      const eyebrow = document.createElement('p');
      eyebrow.className = 'print-eyebrow';
      eyebrow.textContent = 'Your print size';
      const heading = document.createElement('h3');
      heading.textContent = dimensions(computed.widthInches, computed.heightInches, true);
      const density = document.createElement('p');
      density.className = 'print-density';
      const strong = document.createElement('strong');
      strong.textContent = `${number(computed.ppi)} pixels per inch`;
      density.append(strong);
      const fitText = document.createElement('p');
      fitText.className = 'print-fit-status';
      fitText.dataset.fits = String(computed.fits);
      fitText.textContent = `${computed.fits ? 'Fits' : 'Does not fit'} inside the ${dimensions(computed.usableWidth, computed.usableHeight, true)} print area.`;
      const note = document.createElement('p');
      note.className = 'print-quality-note';
      note.textContent =
        computed.ppi < 300 - 1e-6
          ? 'Below the 300 PPI reference. A smaller print size will increase PPI.'
          : '300 PPI or higher. Print a sample to check small details.';
      const required = document.createElement('p');
      required.className = 'print-pixel-reference';
      const requiredLabel = document.createElement('span');
      requiredLabel.textContent = 'Pixels needed at 300 PPI';
      const requiredValue = document.createElement('strong');
      requiredValue.textContent = `${number(Math.max(1, Math.ceil(computed.widthInches * 300 * (1 - Number.EPSILON * 4))), 0)} × ${number(Math.max(1, Math.ceil(computed.heightInches * 300 * (1 - Number.EPSILON * 4))), 0)} px`;
      required.append(requiredLabel, requiredValue);
      result.replaceChildren(eyebrow, heading, density, fitText, note, required);
      element('print-linked-value').textContent =
        `${number((sizeBy === 'height' ? computed.widthInches : computed.heightInches) * scale())} ${PRINT_UNITS[unit].short}`;
      draw(computed, PAPER_SIZES[input.paper].name);
      result.hidden = false;
      preview.hidden = false;
      error.hidden = true;
      fit.hidden = false;
      rotate.hidden =
        computed.fits || !calculatePrintSize({ ...input, landscape: !input.landscape }).fits;
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : 'Check your dimensions and try again.');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
    if (last && window.matchMedia('(max-width: 760px)').matches)
      preview.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  });
  form.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement) render();
  });
  form.addEventListener('change', (event) => {
    if (event.target === field('units')) {
      const next = field('units').value as PrintUnit;
      const conversion = PRINT_UNITS[next].scale / scale();
      for (const name of ['printWidth', 'margin']) {
        const value = Number(field(name).value);
        if (field(name).value !== '' && Number.isFinite(value))
          field(name).value = inputNumber(value * conversion);
      }
      unit = next;
    }
    if (event.target === field('sizeBy')) {
      if (last)
        field('printWidth').value = inputNumber(
          (field('sizeBy').value === 'height' ? last.heightInches : last.widthInches) * scale(),
        );
      sizeBy = field('sizeBy').value;
    }
    updateLabels();
    render();
  });
  fit.addEventListener('click', () => {
    if (!last) return;
    // Round down only when writing to the field, so the suggested size never exceeds the fit.
    field('printWidth').value = String(
      Math.floor((sizeBy === 'height' ? last.fitHeight : last.fitWidth) * scale() * 1e9) / 1e9,
    );
    render();
  });
  rotate.addEventListener('click', () => {
    check.checked = !check.checked;
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-print-ppi]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!validPixels()) return;
      const pixels = Number(field(sizeBy === 'height' ? 'pixelsHigh' : 'pixelsWide').value);
      field('printWidth').value = String(
        Math.floor((pixels / Number(button.dataset.printPpi)) * scale() * 1e9) / 1e9,
      );
      render();
    });
  });
  const query = new URLSearchParams(window.location.search);
  const width = Number(query.get('width'));
  const height = Number(query.get('height'));
  if ([width, height].every((value) => Number.isInteger(value) && value >= 1 && value <= 100000)) {
    field('pixelsWide').value = String(width);
    field('pixelsHigh').value = String(height);
    element('print-import-note').hidden = false;
  }
  updateLabels();
  render();
}
