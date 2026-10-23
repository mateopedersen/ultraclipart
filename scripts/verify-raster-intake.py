from pathlib import Path
import concurrent.futures, hashlib, io, json, subprocess, os, shutil, argparse
import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFont
from pypdf import PdfReader
from raster_source import inspect_cmyk_image

parser=argparse.ArgumentParser();parser.add_argument('--topic',required=True);args=parser.parse_args()
assert args.topic.replace('-','').isalnum() and args.topic.islower()
root=Path(__file__).resolve().parents[1]/'work/imports'/args.topic
binary=os.environ.get('PDFTOPPM_BIN') or shutil.which('pdftoppm')
if not binary: raise RuntimeError('Set PDFTOPPM_BIN to a Poppler pdftoppm executable')
ids=sorted(p.stem for p in (root/'pdf').glob('*.pdf'))
def validate(art_id):
    pdf=root/'pdf'/f'{art_id}.pdf'; reader=PdfReader(pdf,strict=True); page=reader.pages[0]
    assert len(reader.pages)==1 and pdf.stat().st_size<=1_000_000
    source=root/'webp'/f'{art_id}.webp'
    with Image.open(source) as im: width,height=im.size; assert im.mode=='RGBA' and im.getchannel('A').getextrema()[0]==0
    pw,ph=map(float,(page.mediabox.width,page.mediabox.height))
    assert list(page.mediabox.lower_left)==[0,0] and abs(pw/ph-width/height)<.0001
    assert page.get('/Rotate',0)==0 and not page.get('/Annots') and list(page.cropbox)==list(page.mediabox)
    forbidden={'/JavaScript','/JS','/OpenAction','/AA','/EmbeddedFiles','/Launch','/RichMedia','/XFA'}
    visited=set()
    def walk(obj):
        obj=obj.get_object() if hasattr(obj,'get_object') else obj
        identity=id(obj)
        if identity in visited:return
        visited.add(identity)
        if isinstance(obj,dict):
            assert not forbidden.intersection(map(str,obj)), f'Active PDF content: {art_id}'
            for v in obj.values():walk(v)
        elif isinstance(obj,list):
            for v in obj:walk(v)
    walk(reader.trailer)
    images=[]
    for ref in page['/Resources']['/XObject'].values():
        image=ref.get_object()
        if image.get('/Subtype')!='/Image':continue
        images.append(inspect_cmyk_image(image,width,height))
    assert images
    output=root/'proofs'/art_id;output.parent.mkdir(exist_ok=True)
    subprocess.run([binary,'-f','1','-singlefile','-scale-to','692','-png',str(pdf),str(output)],check=True,capture_output=True)
    return {'id':art_id,'status':'PASS','pdfBytes':pdf.stat().st_size,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'webpSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'pagePoints':[pw,ph],'nativePrintInches':[pw/72,ph/72],'ppi':round(width/(pw/72)),'images':images,'activeContent':False}
assert len(ids)==50 and set(ids)=={p.stem for p in (root/'webp').glob('*.webp')}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(validate,ids))
web=[];proof=[]
for art_id in ids:
    source=Image.open(root/'webp'/f'{art_id}.webp').convert('RGBA'); bg=Image.new('RGBA',source.size,'white');bg.alpha_composite(source)
    web.append(np.asarray(bg.convert('RGB').resize((160,160),Image.Resampling.LANCZOS),dtype=float))
    proof.append(np.asarray(Image.open(root/'proofs'/f'{art_id}.png').convert('RGB').resize((160,160),Image.Resampling.LANCZOS),dtype=float))
for i,row in enumerate(rows):
    errors=[float(np.abs(proof[i]-candidate).mean())for candidate in web]
    nearest=int(np.argmin(errors)); assert nearest==i, f'PDF/WebP cross-match mismatch: {ids[i]} -> {ids[nearest]}'
    assert errors[i]<18, f'PDF/WebP visual discrepancy: {ids[i]}'
    row['pairedWebp']=ids[nearest];row['meanRgbDifference']=round(errors[i],4)
font=ImageFont.load_default(size=12)
for offset in range(0,50,10):
    sheet=Image.new('RGB',(1250,550),'#f0f1ee'); draw=ImageDraw.Draw(sheet)
    for n,art_id in enumerate(ids[offset:offset+10]):
        im=Image.open(root/'proofs'/f'{art_id}.png').convert('RGB');im.thumbnail((238,238));x=n%5*250;y=n//5*275
        sheet.paste(im,(x+6,y+6));draw.text((x+8,y+250),f'{offset+n+1:02} CMYK PDF',fill='#24372c',font=font)
    sheet.save(root/f'pdf-contact-{offset//10+1}.png')
(root/'preflight.json').write_text(json.dumps({'status':'PASS','pairs':len(rows),'allPairsVisuallyMatched':True,'pairMethod':'Independent Poppler render, nearest-neighbor comparison against all 50 WebP originals, followed by visual contact-sheet review','maxPdfBytes':max(r['pdfBytes']for r in rows),'rows':rows},indent=2)+'\n')
print(json.dumps({'status':'PASS','pairs':len(rows),'profiles':list(set(i['profile']for r in rows for i in r['images'])),'maxPairDifference':max(r['meanRgbDifference']for r in rows)}))
