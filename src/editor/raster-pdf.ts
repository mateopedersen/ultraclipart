import {
  PDFDocument,
  PDFName,
  PDFString,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  concatTransformationMatrix,
  type PDFEmbeddedPage,
} from 'pdf-lib';
import type { EditorDocument, Layer, RasterLayer } from './model';
import { paperLayout } from './pdf-math';
import { rasterPlacement } from './raster-placement';
import { rasterPdf } from './raster';

/** Compose existing CMYK image streams with independently rendered vector runs.
 * No bitmap resampling, JPEG recompression, tracing, or RGB-to-CMYK relabeling.
 * Repeated image layers reuse one embedded source rather than duplicate its bytes.
 */
export async function exportRasterPdf(
  doc: EditorDocument,
  vectorPdf: (doc: EditorDocument) => Promise<Blob>,
  sourcePdf: (layer: RasterLayer) => Promise<Uint8Array> = rasterPdf,
): Promise<Blob> {
  const output = await PDFDocument.create(),
    p = paperLayout(doc),
    page = output.addPage([p.pageWidth, p.pageHeight]);
  output.setTitle('UltraClipart edited artwork');
  output.setAuthor('UltraClipart');
  output.setCreator('UltraClipart editor');
  output.setProducer('UltraClipart');
  const intent = output.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of('CGATS TR 006'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('GRACoL2006_Coated1v2'),
  });
  output.catalog.set(
    PDFName.of('OutputIntents'),
    output.context.obj([output.context.register(intent)]),
  );
  page.pushOperators(
    pushGraphicsState(),
    rectangle(p.margin, p.margin, p.pageWidth - 2 * p.margin, p.pageHeight - 2 * p.margin),
    clip(),
    endPath(),
    rectangle(p.x, p.pageHeight - p.y - p.height, p.width, p.height),
    clip(),
    endPath(),
  );
  const embedded = new Map<string, PDFEmbeddedPage>();
  let vectors: Layer[] = [],
    background = doc.background;
  async function flushVectors() {
    if (!vectors.length && background === 'transparent') return;
    const blob = await vectorPdf({ ...doc, layers: vectors, background });
    const [drawing] = await output.embedPdf(await blob.arrayBuffer(), [0]);
    page.drawPage(drawing, { x: 0, y: 0, width: p.pageWidth, height: p.pageHeight });
    vectors = [];
    background = 'transparent';
  }
  for (const layer of doc.layers.filter((l) => l.visible && l.opacity > 0)) {
    if (layer.kind !== 'raster') {
      vectors.push(layer);
      continue;
    }
    await flushVectors();
    let image = embedded.get(layer.assetId);
    if (!image) {
      [image] = await output.embedPdf(await sourcePdf(layer), [0]);
      embedded.set(layer.assetId, image);
    }
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(...rasterPlacement(doc, layer, image.width, image.height)),
    );
    page.drawPage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
      opacity: layer.opacity,
    });
    page.pushOperators(popGraphicsState());
  }
  await flushVectors();
  page.pushOperators(popGraphicsState());
  const bytes = await output.save({ useObjectStreams: true });
  if (bytes.length > 1_000_000)
    throw new Error(
      `This edited PDF is ${bytes.length.toLocaleString()} bytes, above the 1,000,000-byte limit. Simplify added layers and try again. The original image has not been reduced in quality.`,
    );
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
