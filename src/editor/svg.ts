import { clamp, identity, isColor, transformString, type EditorDocument, type Layer, type StylePreset } from './model';
export const NS = 'http://www.w3.org/2000/svg';
const tags = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','title','desc','defs','linearGradient','radialGradient','stop','clipPath']);
const attrs = new Set(['xmlns','viewBox','width','height','id','data-label','data-role','role','aria-label','aria-labelledby','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','opacity','transform','d','x','y','x1','x2','y1','y2','rx','ry','cx','cy','r','points','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path','clipPathUnits','preserveAspectRatio']);
export function sanitizeSvg(source: string): SVGSVGElement {
 if(source.length > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('This SVG is too large or contains unsupported document declarations.');
 const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
 const root = parsed.documentElement;
 if(parsed.querySelector('parsererror') || root.localName !== 'svg') throw new Error('The SVG source could not be read.');
 const all = [root, ...root.querySelectorAll('*')];
 if(all.length > 10000) throw new Error('This illustration has too many shapes for the editor.');
 for(const el of all) {
  if(!tags.has(el.localName)) throw new Error(`Unsupported or unsafe SVG element: ${el.localName}.`);
  for(const attr of [...el.attributes]) {
   if(!attrs.has(attr.name) || /javascript:|data:|https?:|@import|expression\s*\(/i.test(attr.value) && attr.name !== 'xmlns' || /url\s*\(/i.test(attr.value) && !/^url\(#[A-Za-z0-9_-]+\)$/.test(attr.value)) throw new Error(`Unsafe SVG attribute: ${attr.name}.`);
  }
 }
 return document.importNode(root, true) as unknown as SVGSVGElement;
}
export function fromSvg(source: string, artId: string): EditorDocument {
 const svg = sanitizeSvg(source); const box = (svg.getAttribute('viewBox') || '0 0 800 800').trim().split(/[ ,]+/).map(Number);
 if(box.length !== 4 || !box.every(Number.isFinite) || box[2]<=0 || box[3]<=0) throw new Error('The SVG has invalid canvas dimensions.');
 const inherited = ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule'].map(a => svg.hasAttribute(a) ? `${a}="${(svg.getAttribute(a)||'').replaceAll('&','&amp;').replaceAll('\"','&quot;').replaceAll('<','&lt;')}"` : '').join(' ');
 const children = [...svg.children].filter(el => !['title','desc','defs'].includes(el.localName));
 if(svg.querySelector('defs')) throw new Error('This source uses definitions that need a dedicated editing adapter.');
 const layers: Layer[] = children.map((el,i) => ({ id: `layer-${i}`, label: el.getAttribute('data-label') || el.getAttribute('aria-label') || el.id || `Shape ${i+1}`, kind: 'vector', markup: `<g ${inherited} transform="translate(${-box[0]} ${-box[1]})">${new XMLSerializer().serializeToString(el)}</g>`, visible: true, locked: false, opacity: 1, ...identity() }));
 return { version: 1, artId, width: box[2], height: box[3], background: 'transparent', layers, crop: null, print: {paper:'letter',orientation:'portrait',margin:.5,scale:'fit'} };
}
export function nodeForLayer(layer: Layer): SVGGElement {
 const g = document.createElementNS(NS, 'g'); g.setAttribute('data-layer',layer.id); g.setAttribute('transform',transformString(layer));
 if(layer.kind === 'vector') g.innerHTML = layer.markup;
 else { const text = document.createElementNS(NS,'text'); text.setAttribute('data-caption',layer.text);for(const [index,line] of layer.text.split('\n').entries()){const span=document.createElementNS(NS,'tspan');span.textContent=line;span.setAttribute('x','0');span.setAttribute('dy',index===0?'0':'1.2em');text.append(span);} text.setAttribute('font-family','UltraEditorText, Arial, sans-serif'); text.setAttribute('font-size',String(layer.size)); text.setAttribute('font-weight',layer.bold?'700':'400'); text.setAttribute('text-anchor',layer.align); text.setAttribute('fill',layer.color); g.append(text); }
 for(const shape of g.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text'))shape.setAttribute('opacity',String(Number(shape.getAttribute('opacity')||1)*layer.opacity));
 return g;
}
export function documentSvg(doc: EditorDocument): SVGSVGElement {
 const svg = document.createElementNS(NS,'svg'); svg.setAttribute('xmlns',NS); const b = doc.crop || {x:0,y:0,width:doc.width,height:doc.height}; svg.setAttribute('viewBox',`${b.x} ${b.y} ${b.width} ${b.height}`); svg.setAttribute('width',String(b.width)); svg.setAttribute('height',String(b.height));
 if(doc.background !== 'transparent') { const rect = document.createElementNS(NS,'rect'); for(const key of ['x','y','width','height'] as const) rect.setAttribute(key,String(b[key])); rect.setAttribute('fill',doc.background); svg.append(rect); }
 doc.layers.filter(l => l.visible).forEach(l => svg.append(nodeForLayer(l))); return svg;
}
export function colorHex(color: string): string | null {
 if(/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase();
 if(/^#[\da-f]{3}$/i.test(color)) return '#'+[...color.slice(1)].map(c=>c+c).join('');
 const v = color.match(/^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/); if(v) return '#'+v.slice(1).map(n=>clamp(Number(n),0,255).toString(16).padStart(2,'0')).join('');
 return ({black:'#000000',white:'#ffffff',red:'#ff0000',transparent:null,none:null} as Record<string,string|null>)[color] || null;
}
export function layerColors(layer: Layer): string[] {
 if(layer.kind === 'text') return [layer.color]; const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`); return [...new Set([...svg.querySelectorAll('[fill],[stroke]')].flatMap(el=>[el.getAttribute('fill'),el.getAttribute('stroke')]).map(v=>v?colorHex(v):null).filter((v):v is string=>!!v))];
}
export function recolor(layer: Layer, color: string, matching?: string, strokeOnly = false): void {
 if(!isColor(color)) throw new Error('Enter a six-digit hex color, such as #2865D2.');
 if(layer.kind === 'text') { layer.color = color; return; }
 const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`); const selectors = strokeOnly ? ['stroke'] : ['fill','stroke'];
 for(const el of svg.querySelectorAll('*')) for(const attr of selectors) { const old = el.getAttribute(attr); if(old && old !== 'none' && (!matching || colorHex(old)===matching)) el.setAttribute(attr,color); }
 layer.markup = svg.innerHTML;
}
export function strokeWidth(layer: Layer, width: number): void {
 if(layer.kind !== 'vector') return; const svg = sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`); for(const el of svg.querySelectorAll('[stroke]')) if(el.getAttribute('stroke')!=='none') el.setAttribute('stroke-width',String(width)); layer.markup=svg.innerHTML;
}
export function preset(layer: Layer, mode: StylePreset, contrast=1): void {
 if(mode==='original') return;
 const map = (hex:string) => { const rgb = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); const gray = rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; const next = mode==='grayscale' ? rgb.map(()=>128+(gray-128)*contrast) : mode==='pastel' ? rgb.map(v=>v*.65+255*.35) : mode==='vintage' ? [rgb[0]*.75+45,rgb[1]*.7+40,rgb[2]*.58+35] : rgb.map(v=>128+(v-128)*1.25); return '#'+next.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join(''); };
 if(layer.kind==='text') {layer.color=mode==='outline'?'#000000':map(layer.color);return;}
 const svg=sanitizeSvg(`<svg xmlns="${NS}">${layer.markup}</svg>`);
 for(const el of svg.querySelectorAll('*')) {
  if(mode==='outline') {
   if(el.hasAttribute('fill') && el.getAttribute('fill')!=='none') el.setAttribute('fill','#ffffff');
   if(el.hasAttribute('stroke') && el.getAttribute('stroke')!=='none') el.setAttribute('stroke','#000000');
   if(['path','rect','circle','ellipse','polygon'].includes(el.localName) && !el.closest('[stroke]')) {el.setAttribute('stroke','#000000');el.setAttribute('stroke-width','2');}
  } else for(const attr of ['fill','stroke']) {const old=el.getAttribute(attr);const hex=old?colorHex(old):null;if(hex)el.setAttribute(attr,map(hex));}
 }
 layer.markup=svg.innerHTML;
}
export async function renderWebp(doc: EditorDocument, size:number, quality:number): Promise<Blob> {
 const svg=documentSvg(doc); const box=doc.crop||doc; const width=Math.round(size),height=Math.round(size*box.height/box.width); if(width*height>16777216)throw new Error('This canvas is too large. Choose a smaller export size.');
 svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
 await document.fonts.ready; const serialized=new XMLSerializer().serializeToString(svg); const url=URL.createObjectURL(new Blob([serialized],{type:'image/svg+xml'}));
 try {const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not create an image canvas.');context.drawImage(img,0,0,width,height); const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob?.type==='image/webp')return blob;try{const {encodeWebp}=await import('./webp-fallback');return await encodeWebp(context.getImageData(0,0,width,height),quality);}catch{throw new Error('The local WebP encoder could not be loaded. Reconnect and try again. Your edits are saved, and PDF export is also available.');}}finally{URL.revokeObjectURL(url);}
}
export function download(blob:Blob,name:string) {const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
