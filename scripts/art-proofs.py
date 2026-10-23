#!/usr/bin/env python3
"""Create 128px alpha-background sheets and 300-dpi PDF proof renders.

Requires Poppler pdftoppm on PATH, or PDFTOPPM_BIN. These are screen proofs;
no claim of physical press certification or human review is made.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops,ImageStat
import os, shutil, json, subprocess
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/art-proofs';OUT.mkdir(parents=True,exist_ok=True)
arts=json.loads((ROOT/'data/art.json').read_text());pdftoppm=os.environ.get('PDFTOPPM_BIN') or shutil.which('pdftoppm')
if not pdftoppm:raise RuntimeError('Install Poppler and make pdftoppm available, or set PDFTOPPM_BIN')
contact=Image.new('RGB',(1250,600),'#f5f6f5');dc=ImageDraw.Draw(contact)
proof=Image.new('RGB',(1250,800),'#e9eeed');dp=ImageDraw.Draw(proof)
small=Image.new('RGB',(1440,440),'#edf0ef');ds=ImageDraw.Draw(small)
rows=[]
for i,a in enumerate(arts):
 im=Image.open(ROOT/'public'/a['webp'].lstrip('/')).convert('RGBA');thumb=im.resize((220,220),Image.Resampling.LANCZOS);x=(i%5)*250;y=(i//5)*300
 contact.paste(thumb,(x+15,y+10),thumb);dc.text((x+10,y+258),a['title'],fill='#263448')
 for j,bg in enumerate(('#ffffff','#172438','checker')):
  cell=Image.new('RGB',(128,128),bg if bg!='checker' else '#edf0f2')
  if bg=='checker':
   draw=ImageDraw.Draw(cell)
   for xx in range(0,128,16):
    for yy in range(0,128,16):
     if (xx//16+yy//16)%2:draw.rectangle((xx,yy,xx+15,yy+15),fill='#dfe5e8')
  t=im.resize((128,128),Image.Resampling.LANCZOS);cell.paste(t,(0,0),t);small.paste(cell,(i*144+8,j*140+5))
 dest=OUT/(a['id']+'-pdf-300dpi')
 subprocess.run([pdftoppm,'-f','1','-singlefile','-r','300','-defaultcmykprofile',str(ROOT/'public/color/print.icc'),'-png',str(ROOT/'public'/a['pdf'].lstrip('/')),str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 page=Image.open(dest.with_suffix('.png')).convert('RGB');assert page.size==(2550,3300)
 printthumb=page.copy();printthumb.thumbnail((230,330));x=(i%5)*250;y=(i//5)*400;proof.paste(printthumb,(x+10,y+8));dp.text((x+10,y+350),a['title'],fill='#263448')
 # Measure source/print silhouette geometry after normalizing print canvas.
 crop=page.crop((round(50*300/72),round(140*300/72),round(562*300/72),round(652*300/72))).resize((512,512),Image.Resampling.LANCZOS)
 src=Image.new('RGB',(2048,2048),'white');src.paste(im,mask=im.getchannel('A'));src=src.resize((512,512),Image.Resampling.LANCZOS)
 srcmask=[min(p)<230 for p in src.get_flattened_data()];pdfmask=[min(p)<230 for p in crop.get_flattened_data()];union=sum(a or b for a,b in zip(srcmask,pdfmask));intersection=sum(a and b for a,b in zip(srcmask,pdfmask))
 rows.append({'id':a['id'],'pagePixels':[2550,3300],'rasterProofDpi':300,'sourceToPdfDarkSilhouetteIoU':round(intersection/union,4),'note':'Screen proof with GRACoL process-CMYK profile; optical color differences expected within print gamut.'})
contact.save(OUT/'contact-sheet.png');small.save(OUT/'legibility-128px.png');proof.save(OUT/'print-proof-contact-sheet.png')
(OUT/'proof-metrics.json').write_text(json.dumps({'rows':rows,'physicalPrintProof':'NOT_PERFORMED'},indent=2)+'\n')
print('Rendered 10 PDF proofs at 300 dpi plus contact and 128px alpha-background sheets.')
