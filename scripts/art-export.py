#!/usr/bin/env python3
"""Convert sanitized original SVG to vector CMYK PDF through LittleCMS.

Requirements: Pillow, reportlab, pypdf. Node + sharp used for WebP rasterization.
The source profile is sRGB; target is the registered GRACoL2006_Coated1v2 print condition.
This is a process-CMYK PDF with a named output intent, NOT a claimed PDF/X certification. The full 2.75 MB
profile is referenced by registered condition rather than embedded (1 MB cap).
"""
from pathlib import Path
from io import BytesIO
import json, re, math, os, subprocess, shutil, hashlib, sys
import xml.etree.ElementTree as ET
from PIL import Image, ImageCms
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject, TextStringObject, DictionaryObject, DecodedStreamObject, ArrayObject
ROOT=Path(__file__).resolve().parents[1]
PROFILE=ROOT/'public/color/print.icc'
if not PROFILE.exists():
 raise RuntimeError('Missing licensed print.icc; restore the checked-in GRACoL2006_Coated1v2 profile.')
srgb=ImageCms.createProfile('sRGB'); target=ImageCms.getOpenProfile(str(PROFILE))
transform=ImageCms.buildTransform(srgb,target,'RGB','CMYK',renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)
CACHE={}
def cmyk(color):
 if color=='white':color='#ffffff'
 if color=='black':color='#000000'
 if color not in CACHE:
  if not re.fullmatch('#[0-9a-fA-F]{6}',color):raise ValueError(f'Unsupported color: {color}')
  rgb=tuple(int(color[i:i+2],16) for i in (1,3,5))
  if len(set(rgb)) == 1:
   CACHE[color]=(0,0,0,1-rgb[0]/255)
   return CACHE[color]
  CACHE[color]=tuple(c/255 for c in ImageCms.applyTransform(Image.new('RGB',(1,1),rgb),transform).getpixel((0,0)))
 return CACHE[color]

def create_lut():
 n=17; pixels=[tuple(round(v*255/(n-1)) for v in (r,g,b)) for r in range(n) for g in range(n) for b in range(n)]
 img=Image.new('RGB',(len(pixels),1));img.putdata(pixels)
 vals=list(ImageCms.applyTransform(img,transform).get_flattened_data())
 data={'version':1,'gridSize':n,'indexing':'((r * gridSize + g) * gridSize + b) * 4; r,g,b grid indices 0..16','input':'sRGB IEC61966-2.1','output':'GRACoL2006_Coated1v2','intent':'relative colorimetric with black point compensation','profileName':'GRACoL2006_Coated1v2','channelRange':[0,1],'channels':['C','M','Y','K'],'interpolation':'trilinear','profile':'/color/print.icc','values':[round(v/255,6) for p in vals for v in p]}
 (ROOT/'public/color/cmyk-lut.json').write_text(json.dumps(data,separators=(',',':')))

def validate_svg(text):
 if len(text)>2_000_000:raise ValueError('SVG source too large')
 if re.search(r'<!|<\?|url\s*\(|javascript\s*:|data\s*:|https?\s*:',text,re.I):
  # Only the inert SVG namespace URL is permitted.
  stripped=text.replace('xmlns="http://www.w3.org/2000/svg"','')
  if re.search(r'<!|<\?|url\s*\(|javascript\s*:|data\s*:|https?\s*:',stripped,re.I):raise ValueError('External or executable SVG content')
 root=ET.fromstring(text); ids=set(); allowed={'svg','g','title','desc','path','ellipse','circle','rect','line','polygon','polyline'}
 attrs={'xmlns','viewBox','width','height','role','aria-labelledby','stroke-linecap','stroke-linejoin','id','data-label','fill','stroke','stroke-width','transform','d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','points','opacity','fill-opacity','stroke-opacity'}
 for e in root.iter():
  tag=e.tag.split('}')[-1]
  if tag not in allowed:raise ValueError(f'Forbidden SVG node {tag}')
  for k,v in e.attrib.items():
   if k not in attrs:raise ValueError(f'Forbidden SVG attribute {k}')
   if k=='id':
    if v in ids:raise ValueError('Duplicate SVG id')
    ids.add(v)
  if tag=='g' and not e.get('data-label'):raise ValueError('Unlabeled editable group')
 return root

def apply_transform(c,s):
 for name,body in re.findall(r'([a-zA-Z]+)\(([^)]*)\)',s):
  v=[float(x) for x in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',body)]
  if name=='translate':c.translate(v[0],v[1] if len(v)>1 else 0)
  elif name=='scale':c.scale(v[0],v[1] if len(v)>1 else v[0])
  elif name=='rotate':
   if len(v)==3:c.translate(v[1],v[2]);c.rotate(v[0]);c.translate(-v[1],-v[2])
   else:c.rotate(v[0])
  elif name=='matrix' and len(v)==6:c.transform(*v)
  else:raise ValueError(f'Unsupported transform {name}')

def svg_path(c,d):
 t=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d)
 p=c.beginPath();i=0;cmd=None;cx=cy=sx=sy=0
 while i<len(t):
  if t[i].isalpha():cmd=t[i];i+=1
  if cmd not in ['M','L','C','Q','Z']:raise ValueError(f'Unsupported SVG command {cmd}')
  if cmd=='Z':p.close();cx,cy=sx,sy;cmd=None;continue
  count={'M':2,'L':2,'C':6,'Q':4}[cmd]
  v=list(map(float,t[i:i+count]));i+=count
  if len(v)!=count:raise ValueError('Malformed SVG path')
  if cmd=='M':p.moveTo(*v);cx,cy=v;sx,sy=v;cmd='L'
  elif cmd=='L':p.lineTo(*v);cx,cy=v
  elif cmd=='C':p.curveTo(*v);cx,cy=v[-2:]
  elif cmd=='Q':
   qx,qy,x,y=v;p.curveTo(cx+2/3*(qx-cx),cy+2/3*(qy-cy),x+2/3*(qx-x),y+2/3*(qy-y),x,y);cx,cy=x,y
 return p

def draw(c,e,inherited=None):
 a={**(inherited or {}),**e.attrib};tag=e.tag.split('}')[-1]
 if tag in ('title','desc'):return
 c.saveState()
 apply_transform(c,e.get('transform',''))
 fill=a.get('fill','#000000'); stroke=a.get('stroke','none');f=fill!='none';s=stroke!='none'
 if f:c.setFillColorCMYK(*cmyk(fill))
 if s:c.setStrokeColorCMYK(*cmyk(stroke))
 c.setLineWidth(float(a.get('stroke-width',1)));c.setLineCap(1);c.setLineJoin(1)
 if tag in ('svg','g'):
  for child in e:draw(c,child,{k:v for k,v in a.items() if k in ('fill','stroke','stroke-width')})
 elif tag=='path':c.drawPath(svg_path(c,e.get('d','')),stroke=int(s),fill=int(f))
 elif tag in ('ellipse','circle'):
  x=float(a.get('cx',0));y=float(a.get('cy',0));rx=float(a.get('rx',a.get('r',0)));ry=float(a.get('ry',a.get('r',0)))
  c.ellipse(x-rx,y-ry,x+rx,y+ry,stroke=int(s),fill=int(f))
 elif tag=='rect':c.rect(float(a.get('x',0)),float(a.get('y',0)),float(a['width']),float(a['height']),stroke=int(s),fill=int(f))
 else:raise ValueError(f'Exporter does not implement {tag}')
 c.restoreState()

def pdf_export(source,dest,title):
 root=validate_svg(source.read_text()); out=BytesIO(); c=canvas.Canvas(out,pagesize=(612,792),pageCompression=1,invariant=1)
 c.setTitle(title);c.setAuthor('UltraClipart');c.setCreator('UltraClipart');c.setSubject(title+' clipart')
 c.translate(50,652);c.scale(1,-1);draw(c,root);c.showPage();c.save()
 w=PdfWriter();w.clone_document_from_reader(PdfReader(out))
 intent=DictionaryObject({NameObject('/Type'):NameObject('/OutputIntent'),NameObject('/S'):NameObject('/GTS_PDFX'),NameObject('/OutputConditionIdentifier'):TextStringObject('CGATS TR 006'),NameObject('/RegistryName'):TextStringObject('http://www.color.org'),NameObject('/OutputCondition'):TextStringObject('GRACoL2006_Coated1v2'),NameObject('/Info'):TextStringObject('LittleCMS sRGB to GRACoL2006_Coated1v2; relative colorimetric; black point compensation. Registered profile referenced, not embedded.')})
 w._root_object[NameObject('/OutputIntents')]=ArrayObject([w._add_object(intent)])
 w.pages[0][NameObject('/TrimBox')]=w.pages[0].mediabox
 with dest.open('wb') as f:w.write(f)
 if dest.stat().st_size>1_000_000:raise RuntimeError('CMYK PDF exceeds 1,000,000-byte hard limit')

def main():
 create_lut();arts=json.loads((ROOT/'data/art.json').read_text())
 for a in arts:
  pdf_export(ROOT/'assets/masters'/f'{a["id"]}.svg',ROOT/'public'/a['pdf'].lstrip('/'),a['title'])
 node=os.environ.get('NODE_BIN') or shutil.which('node') 
 if not node: raise RuntimeError('Node.js is required on PATH (or set NODE_BIN).')
 subprocess.run([node,str(ROOT/'scripts/art-raster.mjs')],check=True)
 for a in arts:
  a['files']={}
  for key in ('svg','webp','pdf','thumb'):
   p=ROOT/'public'/a[key].lstrip('/');a['files'][key]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
  a['formats']=['WEBP','PDF'];a['printProfile']='GRACoL2006_Coated1v2';a['pdfColorSpace']='DeviceCMYK';a['pdfPage']='US Letter';a['alpha']=True
 (ROOT/'data/art.json').write_text(json.dumps(arts,indent=2)+'\n')
 print(f'Exported {len(arts)} true CMYK vector PDFs with registered GRACoL print condition; profile referenced, not embedded.')
if __name__=='__main__':main()
