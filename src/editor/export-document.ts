import type { EditorDocument } from './model';
import { documentSvg, renderBitmap } from './svg';
import { prepareDocument } from './smart/render';
import { paperLayout } from './pdf-math';
import { zipFiles } from './smart/zip';

export const exportFormats = ['png', 'jpg', 'webp', 'pdf', 'svg', 'docx'] as const;
export type ExportFormat = (typeof exportFormats)[number];

/** Preserve readable Unicode names while removing filesystem control characters. */
export function exportFilename(title: string, fallback = 'My Clipart Project') {
  const clean = title
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.(?:png|jpe?g|webp|pdf|svg|docx|json)$/i, '')
    .replace(/[ .]+$/g, '')
    .slice(0, 100)
    .trim();
  if (!clean) return fallback;
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean) ? `_${clean}` : clean;
}

export async function portableSvg(doc: EditorDocument) {
  await prepareDocument(doc);
  await document.fonts.ready;
  const svg = documentSvg(doc);
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = doc.title || 'My Clipart Project';
  svg.prepend(title);
  for (const image of svg.querySelectorAll('image')) {
    const href = image.getAttribute('href') || '';
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(href)) continue;
    if (!href.startsWith('blob:')) throw new Error('An export source is not available.');
    const response = await fetch(href);
    if (!response.ok) throw new Error('An image could not be embedded.');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('An image could not be embedded.'));
      reader.readAsDataURL(blob);
    });
    image.setAttribute('href', data);
  }
  return new XMLSerializer().serializeToString(svg);
}

/** One page, with the same paper size, crop and placement as the PDF exporter. */
export async function renderPrintPage(doc: EditorDocument) {
  const p = paperLayout(doc),
    scale = 200 / 72;
  const art = await renderBitmap(doc, Math.min(4096, doc.crop?.width || doc.width), 1, 'image/png');
  const url = URL.createObjectURL(art);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(p.pageWidth * scale);
    canvas.height = Math.round(p.pageHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare a printed page.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, p.x * scale, p.y * scale, p.width * scale, p.height * scale);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Your browser could not prepare a printed page.');
    return { blob, ...p };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const xml = (text: string) =>
  text
    .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
    .replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
    );
const xmlFile = (text: string) =>
  new Blob(['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', text], {
    type: 'application/xml',
  });

export async function exportWord(doc: EditorDocument) {
  const page = await renderPrintPage(doc),
    title = xml(doc.title || 'My Clipart Project');
  const cx = Math.round(page.pageWidth * 12700),
    cy = Math.round(page.pageHeight * 12700);
  // A page-anchored image and a one-point paragraph avoid a trailing blank Word page.
  const drawing = `<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="${title}" descr="${title}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="artwork.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing>`;
  const documentXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r>${drawing}</w:r></w:p><w:sectPr><w:pgSz w:w="${Math.round(page.pageWidth * 20)}" w:h="${Math.round(page.pageHeight * 20)}" w:orient="${doc.print.orientation}"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = await zipFiles([
    {
      name: '[Content_Types].xml',
      blob: xmlFile(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      ),
    },
    {
      name: '_rels/.rels',
      blob: xmlFile(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      ),
    },
    {
      name: 'word/_rels/document.xml.rels',
      blob: xmlFile(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/artwork.png"/></Relationships>',
      ),
    },
    { name: 'word/document.xml', blob: xmlFile(documentXml) },
    {
      name: 'docProps/core.xml',
      blob: xmlFile(
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>UltraClipart</dc:creator></cp:coreProperties>`,
      ),
    },
    { name: 'word/media/artwork.png', blob: page.blob },
  ]);
  return new Blob([zip], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function printDocument(doc: EditorDocument, cancelled: () => boolean) {
  const page = await renderPrintPage(doc);
  if (cancelled()) return;
  const frame = document.createElement('iframe');
  frame.title = 'Print artwork';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0';
  document.body.append(frame);
  const url = URL.createObjectURL(page.blob);
  const cleanup = () => {
    frame.remove();
    URL.revokeObjectURL(url);
  };
  try {
    const target = frame.contentDocument!,
      win = frame.contentWindow!;
    target.title = doc.title || 'My Clipart Project';
    const style = target.createElement('style');
    style.textContent = `@page{size:${page.pageWidth}pt ${page.pageHeight}pt;margin:0}html,body{margin:0;padding:0;width:${page.pageWidth}pt;height:${page.pageHeight}pt;overflow:hidden}img{display:block;width:100%;height:100%;print-color-adjust:exact;-webkit-print-color-adjust:exact}`;
    target.head.append(style);
    const image = target.createElement('img');
    image.alt = doc.title || 'My Clipart Project';
    image.src = url;
    target.body.append(image);
    await image.decode();
    if (cancelled()) {
      cleanup();
      return;
    }
    if (typeof win.print !== 'function')
      throw new Error(
        'Printing is unavailable here. Download the PDF and print it from your PDF viewer.',
      );
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    setTimeout(cleanup, 300000);
  } catch (error) {
    cleanup();
    throw error;
  }
}
