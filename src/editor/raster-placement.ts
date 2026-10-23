import type { EditorDocument, RasterLayer } from './model';
import { paperLayout } from './pdf-math.ts';

/** Map the PDF source's upward Y axis through an SVG layer's downward Y axis. */
export function rasterPlacement(
  doc: EditorDocument,
  layer: RasterLayer,
  sourceWidth: number,
  sourceHeight: number,
): [number, number, number, number, number, number] {
  const p = paperLayout(doc),
    crop = doc.crop ?? { x: 0, y: 0 };
  const angle = (layer.angle * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const sx = (layer.width * layer.scaleX) / sourceWidth,
    sy = (layer.height * layer.scaleY) / sourceHeight;
  return [
    p.scale * cos * sx,
    -p.scale * sin * sx,
    p.scale * sin * sy,
    p.scale * cos * sy,
    p.x + p.scale * (layer.x - crop.x - sin * layer.height * layer.scaleY),
    p.pageHeight - p.y - p.scale * (layer.y - crop.y + cos * layer.height * layer.scaleY),
  ];
}
