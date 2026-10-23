"""Independent edited raster preflight: actual CMYK channels, alpha and 600 PPI placement."""
import json, sys, subprocess, hashlib, zipfile, io
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
def images(reader):
    found=[];seen=set()
    def visit(resources):
        for ref in resources.get('/XObject',{}).values():
            obj=ref.get_object()
            if id(obj) in seen: continue
            seen.add(id(obj))
            if obj.get('/Subtype')=='/Form': visit(obj.get('/Resources',{}))
            elif obj.get('/Subtype')=='/Image': found.append(obj)
    for page in reader.pages:visit(page['/Resources'])
    return found
folder=Path(sys.argv[1]); pdf=folder/'baby-edited.pdf'; web=Image.open(folder/'baby-edited.webp').convert('RGBA'); r=PdfReader(pdf)
a=images(r);assert len(a)==1
obj=a[0];assert obj['/ColorSpace']=='/DeviceCMYK' and obj['/BitsPerComponent']==8
assert (obj['/Width'],obj['/Height'])==web.size==(1226,1283)
assert len(obj.get_data())==1226*1283*4
alpha=obj['/SMask'].get_object().get_data();assert len(alpha)==1226*1283
assert alpha==web.getchannel('A').tobytes(), 'CMYK PDF and WebP alpha mismatch'
art=next(a for a in json.loads((ROOT/'data/art.json').read_text()) if a['id']=='baby-girl-with-pink-bow-clipart')
original=Image.open(ROOT/'public'/art['webp'].lstrip('/')).convert('RGBA')
assert alpha==original.getchannel('A').tobytes(), 'Region recolor changed source alpha'
project=json.loads((folder/'baby-print-project.json').read_text());assert project['print']['scale']=='native'
subprocess.run(['pdftoppm','-singlefile','-r','300','-png',str(pdf),str(folder/'baby-pdf-proof')],check=True,capture_output=True)
proof=Image.open(folder/'baby-pdf-proof.png').convert('RGB');w,h=float(r.pages[0].mediabox.width),float(r.pages[0].mediabox.height)
cw,ch=1226*.12,1283*.12;x,y=(w-cw)/2,(h-ch)/2
crop=proof.crop(tuple(round(v*300/72) for v in (x,y,x+cw,y+ch))).resize(web.size)
white=Image.new('RGBA',web.size,'white');white.alpha_composite(web);difference=sum(ImageStat.Stat(ImageChops.difference(crop,white.convert('RGB'))).mean)/3
assert difference<22,f'CMYK proof placement/color differs: {difference}'
crop.thumbnail((600,650));crop.save(folder/'baby-print-detail.png')
report={'status':'PASS','nativePixels':list(web.size),'actualColorSpace':'DeviceCMYK (four channels)','alphaExactlyMatchesWebpAndOriginal':True,'effectivePpi':600,'pdfBytes':pdf.stat().st_size,'largePdfExplicitlyRequired':pdf.stat().st_size>1000000,'pdfWebpMeanDifference':round(difference,3),'profile':'GRACoL LUT conversion; referenced output intent, not embedded ICC / not certified PDF-X'}
(folder/'export-preflight.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if len(sys.argv)>2:
    z=Path(sys.argv[2]);rows=[]
    with zipfile.ZipFile(z) as archive:
        assert len(archive.namelist())==6;assert archive.testzip() is None
        for name in archive.namelist():
            if not name.endswith('.pdf'):continue
            data=archive.read(name);assert len(data)<=1000000
            imgs=images(PdfReader(io.BytesIO(data)));assert imgs and all(i['/ColorSpace']=='/DeviceCMYK' for i in imgs)
            webp=Image.open(io.BytesIO(archive.read(name.removesuffix('.pdf')+'.webp'))).convert('RGBA')
            assert (imgs[0]['/Width'],imgs[0]['/Height'])==webp.size
            assert imgs[0]['/SMask'].get_object().get_data()==webp.getchannel('A').tobytes()
            rows.append({'pdf':name,'bytes':len(data),'dimensions':list(webp.size),'cmyk':True,'exactAlpha':True})
    z.with_suffix('.preflight.json').write_text(json.dumps({'status':'PASS','pairs':rows},indent=2));print(json.dumps({'zip':'PASS','pairs':len(rows)}))
