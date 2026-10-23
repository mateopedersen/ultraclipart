import {
  PDFDocument,
  PDFName,
  PDFString,
  drawObject,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from 'pdf-lib';
import type { RasterLayer } from '../model';
import type { ColorLut } from '../pdf-math';
import { processedPixels, withProcessor } from './render';
/** Lossless full-resolution CMYK image plus its exact 8-bit transparency mask. */
export async function editedRasterPdf(layer: RasterLayer, lut: ColorLut): Promise<Uint8Array> {
  const image = await processedPixels(layer);
  const streams = await withProcessor(layer, (processor) =>
    processor.run<{ colors: Uint8Array; alpha: Uint8Array }>('cmyk', {
      image,
      lut,
    }),
  );
  const pdf = await PDFDocument.create(),
    context = pdf.context;
  const mask = context.register(
    context.stream(streams.alpha, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: image.width,
      Height: image.height,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 15, Colors: 1, BitsPerComponent: 8, Columns: image.width },
    }),
  );
  const rgb = context.register(
    context.stream(streams.colors, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: image.width,
      Height: image.height,
      ColorSpace: 'DeviceCMYK',
      BitsPerComponent: 8,
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 15, Colors: 4, BitsPerComponent: 8, Columns: image.width },
      SMask: mask,
    }),
  );
  const width = (image.width * 72) / 600,
    height = (image.height * 72) / 600,
    page = pdf.addPage([width, height]);
  page.node.set(PDFName.of('Resources'), context.obj({ XObject: { EditedPixels: rgb } }));
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(width, 0, 0, height, 0, 0),
    drawObject('EditedPixels'),
    popGraphicsState(),
  );
  const intent = context.register(
    context.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFX',
      OutputConditionIdentifier: PDFString.of('CGATS TR 006'),
      RegistryName: PDFString.of('http://www.color.org'),
      Info: PDFString.of(
        'GRACoL2006_Coated1v2; ICC LUT conversion; profile referenced, not embedded',
      ),
    }),
  );
  pdf.catalog.set(PDFName.of('OutputIntents'), context.obj([intent]));
  return pdf.save({ useObjectStreams: true });
}
