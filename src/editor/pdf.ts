import type { EditorDocument } from './model';
import { colorHex, documentSvg } from './svg';
import type { jsPDF } from 'jspdf';
import {
  paperLayout,
  lookupCmyk,
  parsePath,
  rectangleRadii,
  type ColorLut,
  type PathOp,
} from './pdf-math';
export { paperLayout } from './pdf-math';
interface PdfInternal {
  events: { subscribe: (topic: string, callback: () => void) => void };
  newObject: () => number;
  putStream: (o: {
    data: string;
    additionalKeyValues: { key: string; value: string | number }[];
  }) => void;
  write: (...args: string[]) => void;
}
function registerOutputCondition(pdf: jsPDF, name: string) {
  const internal = pdf.internal as unknown as PdfInternal;
  let intent = 0;
  // The genuine GRACoL profile is 2.75 MB. A registered output condition avoids
  // exceeding the 1 MB document cap; this is not a PDF/X conformance assertion.
  internal.events.subscribe('putResources', () => {
    intent = internal.newObject();
    const label = name
      .replace(/[()\\\r\n]/g, '')
      .replace(/[^\x20-\x7e]/g, '')
      .slice(0, 150);
    internal.write(
      `<< /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier (CGATS TR 006) /RegistryName (http://www.color.org) /Info (${label}; LittleCMS relative colorimetric with black point compensation) >>`,
    );
    internal.write('endobj');
  });
  internal.events.subscribe('putCatalog', () => {
    internal.write(`/OutputIntents [${intent} 0 R]`);
  });
}
let colorPromise: Promise<{ lut: ColorLut; profile: Uint8Array }> | undefined;
async function colorResources() {
  if (!colorPromise)
    colorPromise = (async () => {
      const [a, b] = await Promise.all([fetch('/color/cmyk-lut.json'), fetch('/color/print.icc')]);
      if (!a.ok || !b.ok)
        throw new Error(
          'The validated CMYK print profile could not be loaded. Connect to the internet and try again, or export WebP.',
        );
      const lut = (await a.json()) as ColorLut,
        profile = new Uint8Array(await b.arrayBuffer());
      if (
        !Number.isInteger(lut.gridSize) ||
        lut.gridSize < 2 ||
        !Array.isArray(lut.values) ||
        lut.values.length !== lut.gridSize ** 3 * 4 ||
        lut.values.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
        profile.length < 128 ||
        String.fromCharCode(...profile.slice(36, 40)) !== 'acsp' ||
        String.fromCharCode(...profile.slice(16, 20)) !== 'CMYK'
      )
        throw new Error('CMYK profile validation failed. No PDF has been produced.');
      return { lut, profile };
    })().catch((error) => {
      colorPromise = undefined;
      throw error;
    });
  return colorPromise;
}
export async function exportPdf(doc: EditorDocument): Promise<Blob> {
  if (doc.layers.some((layer) => layer.kind === 'raster')) {
    const { exportRasterPdf } = await import('./raster-pdf');
    return exportRasterPdf(doc, exportVectorPdf);
  }
  return exportVectorPdf(doc);
}
async function exportVectorPdf(doc: EditorDocument): Promise<Blob> {
  const [{ jsPDF: PDF }, { lut }] = await Promise.all([import('jspdf'), colorResources()]);
  const p = paperLayout(doc),
    pdf = new PDF({
      unit: 'pt',
      format: [p.pageWidth, p.pageHeight],
      orientation: doc.print.orientation,
      compress: true,
      putOnlyUsedFonts: true,
      floatPrecision: 5,
    });
  (
    pdf as unknown as { __private__: { setPdfVersion: (version: string) => void } }
  ).__private__.setPdfVersion('1.7');
  pdf.setProperties({
    title: 'UltraClipart edited artwork',
    subject: 'ICC-converted process CMYK vector artwork',
    creator: 'UltraClipart editor',
  });
  registerOutputCondition(pdf, lut.profileName || 'CMYK print profile');
  const svg = documentSvg(doc);
  if (
    svg.querySelector('defs,clipPath,linearGradient,radialGradient,[clip-path]') ||
    [...svg.querySelectorAll('g[opacity]')].some((g) => Number(g.getAttribute('opacity')) !== 1)
  )
    throw new Error(
      'This project uses a vector effect that has not been validated for PDF. Export WebP or restore the original artwork.',
    );
  svg.style.position = 'fixed';
  svg.style.left = '-20000px';
  svg.style.top = '0';
  svg.style.pointerEvents = 'none';
  document.body.append(svg);
  try {
    pdf.advancedAPI(() => {
      pdf.saveGraphicsState();
      pdf.rect(p.margin, p.margin, p.pageWidth - 2 * p.margin, p.pageHeight - 2 * p.margin, null);
      pdf.clip();
      pdf.discardPath();
      // Clip to the edited canvas as well as paper margins. Hidden material never leaks into a PDF.
      pdf.rect(p.x, p.y, p.width, p.height, null);
      pdf.clip();
      pdf.discardPath();
      const elements = [
        ...svg.querySelectorAll<SVGGraphicsElement>(
          'path,rect,circle,ellipse,line,polyline,polygon,text',
        ),
      ];
      for (const el of elements) {
        if (el.closest('defs')) continue;
        const style = getComputedStyle(el),
          matrix = el.getCTM();
        if (!matrix) continue;
        if (
          [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].some(
            (v) => !Number.isFinite(v) || Math.abs(v) > 1000000,
          )
        )
          throw new Error(
            'This artwork contains oversized transforms. Simplify the layer before exporting.',
          );
        let opacity = 1;
        for (
          let parent: Element | null = el;
          parent && parent !== svg;
          parent = parent.parentElement
        )
          opacity *= Number(getComputedStyle(parent).opacity);
        if (opacity === 0) continue;
        const fill = style.fill === 'none' ? null : colorHex(style.fill),
          stroke = style.stroke === 'none' ? null : colorHex(style.stroke);
        if (!fill && !stroke) continue;
        if ((style.fill !== 'none' && !fill) || (style.stroke !== 'none' && !stroke))
          throw new Error(
            'This artwork uses a paint effect that has not been validated for CMYK PDF. Export WebP or remove the effect.',
          );
        pdf.saveGraphicsState();
        pdf.setCurrentTransformationMatrix(
          pdf.Matrix(
            matrix.a * p.scale,
            matrix.b * p.scale,
            matrix.c * p.scale,
            matrix.d * p.scale,
            p.x + matrix.e * p.scale,
            p.y + matrix.f * p.scale,
          ),
        );
        if (fill) pdf.setFillColor(...lookupCmyk(fill, lut));
        if (stroke) pdf.setDrawColor(...lookupCmyk(stroke, lut));
        const lineWidth = parseFloat(style.strokeWidth) || 0;
        if (!Number.isFinite(lineWidth) || lineWidth < 0 || lineWidth > 10000)
          throw new Error('This artwork contains an invalid stroke width.');
        pdf.setLineWidth(lineWidth);
        pdf.setLineCap(
          style.strokeLinecap === 'round' ? 1 : style.strokeLinecap === 'square' ? 2 : 0,
        );
        pdf.setLineJoin(
          style.strokeLinejoin === 'round' ? 1 : style.strokeLinejoin === 'bevel' ? 2 : 0,
        );
        pdf.setLineMiterLimit(parseFloat(style.strokeMiterlimit) || 4);
        pdf.setGState(
          pdf.GState({
            opacity: opacity * Number(style.fillOpacity),
            'stroke-opacity': opacity * Number(style.strokeOpacity),
          }),
        );
        const a = (name: string) => {
          const value = Number(el.getAttribute(name) || 0);
          if (!Number.isFinite(value) || Math.abs(value) > 100000)
            throw new Error('This artwork contains an invalid or oversized coordinate.');
          return value;
        };
        let ops: PathOp[] = [];
        if (el.localName === 'path') ops = parsePath(el.getAttribute('d') || '');
        else if (el.localName === 'rect') {
          const x = a('x'),
            y = a('y'),
            w = a('width'),
            h = a('height');
          const [rx, ry] = rectangleRadii(
            w,
            h,
            el.hasAttribute('rx') ? a('rx') : null,
            el.hasAttribute('ry') ? a('ry') : null,
          );
          if (rx || ry) pdf.roundedRect(x, y, w, h, rx, ry, null);
          else pdf.rect(x, y, w, h, null);
        } else if (el.localName === 'circle' || el.localName === 'ellipse') {
          pdf.ellipse(
            a('cx'),
            a('cy'),
            el.localName === 'circle' ? a('r') : a('rx'),
            el.localName === 'circle' ? a('r') : a('ry'),
            null,
          );
        } else if (el.localName === 'line') {
          ops = [
            { op: 'm', c: [a('x1'), a('y1')] },
            { op: 'l', c: [a('x2'), a('y2')] },
          ];
        } else if (el.localName === 'polyline' || el.localName === 'polygon') {
          const points = (el.getAttribute('points') || '').trim().split(/[ ,]+/).map(Number);
          if (points.length % 2 || !points.every(Number.isFinite))
            throw new Error('Invalid vector polygon.');
          for (let i = 0; i < points.length; i += 2)
            ops.push({ op: i === 0 ? 'm' : 'l', c: [points[i], points[i + 1]] });
          if (el.localName === 'polygon') ops.push({ op: 'h', c: [] });
        } else if (el.localName === 'text') {
          const text = el.getAttribute('data-caption') || el.textContent || '';
          if (/[^\x20-\x7e\u00a0-\u00ff\n]/.test(text))
            throw new Error(
              'PDF text currently supports Latin characters. Export WebP for this caption, or use a Latin caption.',
            );
          if (fill) pdf.setTextColor(...lookupCmyk(fill, lut));
          pdf.setFont('helvetica', Number(style.fontWeight) >= 600 ? 'bold' : 'normal');
          pdf.setFontSize(parseFloat(style.fontSize) || 48);
          pdf.text(text, a('x'), a('y'), {
            lineHeightFactor: 1.2,
            align:
              style.textAnchor === 'middle'
                ? 'center'
                : style.textAnchor === 'end'
                  ? 'right'
                  : 'left',
          });
          pdf.restoreGraphicsState();
          continue;
        }
        if (ops.some((op) => op.c.some((v) => !Number.isFinite(v) || Math.abs(v) > 100000)))
          throw new Error('This artwork contains an invalid or oversized path.');
        if (ops.length) pdf.path(ops);
        const evenOdd = style.fillRule === 'evenodd';
        if (fill && stroke) {
          if (evenOdd) pdf.fillStrokeEvenOdd();
          else pdf.fillStroke();
        } else if (fill) {
          if (evenOdd) pdf.fillEvenOdd();
          else pdf.fill();
        } else pdf.stroke();
        pdf.restoreGraphicsState();
      }
      pdf.restoreGraphicsState();
    });
    const blob = pdf.output('blob');
    if (blob.size > 1000000)
      throw new Error(
        `This edited PDF is ${blob.size.toLocaleString()} bytes, above the 1,000,000-byte limit. Remove duplicate layers or lengthy captions and try again. Your artwork has not been degraded.`,
      );
    return blob;
  } finally {
    svg.remove();
  }
}
