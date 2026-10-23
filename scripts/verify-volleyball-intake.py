from pathlib import Path
import concurrent.futures, hashlib, io, json, subprocess, os, shutil
import numpy as np
from PIL import Image, ImageCms, ImageDraw, ImageFont
from pypdf import PdfReader

root=Path(__file__).resolve().parents[1]/'work/imports/volleyball'
binary=os.environ.get('PDFTOPPM_BIN') or shutil.which('pdftoppm')
if not binary: raise RuntimeError('Set PDFTOPPM_BIN to a Poppler pdftoppm executable')
ids=sorted(p.stem for p in (root/'pdf').glob('*.pdf'))
def validate(art_id):
    pdf=root/'pdf'/f'{art_id}.pdf'; reader=PdfReader(pdf,strict=True); page=reader.pages[0]
    assert len(reader.pages)==1 and pdf.stat().st_size<=1_000_000
    assert all(abs(a-b)<.01 for a,b in zip(map(float,page.mediabox),[0,0,331.68,331.68]))
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
        cs=image['/ColorSpace']; assert cs[0]=='/ICCBased'
        icc=cs[1].get_object(); data=icc.get_data(); assert icc['/N']==4 and data[16:20]==b'CMYK'
        assert image['/Width']==1382 and image['/Height']==1382
        profile=ImageCms.ImageCmsProfile(io.BytesIO(data))
        images.append({'width':1382,'height':1382,'components':4,'profile':ImageCms.getProfileDescription(profile).strip(),'iccBytes':len(data),'iccSha256':hashlib.sha256(data).hexdigest(),'alphaMask':bool(image.get('/SMask'))})
    assert images
    output=root/'proofs'/art_id;output.parent.mkdir(exist_ok=True)
    subprocess.run([binary,'-f','1','-singlefile','-scale-to','692','-png',str(pdf),str(output)],check=True,capture_output=True)
    return {'id':art_id,'status':'PASS','pdfBytes':pdf.stat().st_size,'pagePoints':[331.68,331.68],'nativePrintInches':4.6066666667,'ppi':300,'images':images,'activeContent':False}
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
(root/'preflight.json').write_text(json.dumps({'status':'PASS','pairs':len(rows),'allPairsVisuallyMatched':True,'maxPdfBytes':max(r['pdfBytes']for r in rows),'rows':rows},indent=2)+'\n')
print(json.dumps({'status':'PASS','pairs':len(rows),'profiles':list(set(i['profile']for r in rows for i in r['images'])),'maxPairDifference':max(r['meanRgbDifference']for r in rows)}))
