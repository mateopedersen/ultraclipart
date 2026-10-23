"""Checks for supplied raster artwork, separate from the layered vector contract."""
import hashlib, io
from PIL import Image, ImageCms
from pypdf import PdfReader

def inspect_raster(art, files):
    checks={'sourceType':'raster','namedLayers':0}
    assert art.get('svg') is None and 'svg' not in art['files']
    checks['hashes']=all(hashlib.sha256(p.read_bytes()).hexdigest()==art['files'][k]['sha256'] and p.stat().st_size==art['files'][k]['bytes'] for k,p in files.items())
    assert checks['hashes']
    for kind,size in [('webp',(art['width'],art['height'])),('thumb',(440,440))]:
        with Image.open(files[kind]) as image:
            image.load();assert image.format=='WEBP' and image.size==size and image.mode=='RGBA'
            alpha=image.getchannel('A');low,high=alpha.getextrema()
            # Downsampling the supplied near-opaque pixels can produce 253/254.
            assert low==0 and (high==255 if kind=='webp' else high>=250)
            checks[kind]={'width':size[0],'height':size[1],'alpha':True,'alphaRange':[low,high],'bounds':alpha.getbbox()}
    reader=PdfReader(files['pdf'],strict=True);assert len(reader.pages)==1
    page=reader.pages[0];assert abs(float(page.mediabox.width)-331.68)<.01 and abs(float(page.mediabox.height)-331.68)<.01
    images=[]
    for ref in page['/Resources'].get('/XObject',{}).values():
        image=ref.get_object()
        if image.get('/Subtype')!='/Image':continue
        cs=image['/ColorSpace'];assert cs[0]=='/ICCBased'
        icc=cs[1].get_object();profile=icc.get_data();assert icc['/N']==4 and profile[16:20]==b'CMYK'
        assert image['/Width']==art['width'] and image['/Height']==art['height']
        description=ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(profile))).strip()
        assert description==art['printProfile']
        images.append({'profile':description,'components':4,'embeddedICC':True})
    assert images and files['pdf'].stat().st_size<=1_000_000
    checks['pdf']={'bytes':files['pdf'].stat().st_size,'underCap':True,'colorSpace':'ICCBased CMYK','rasterImages':len(images),'page':art['pdfPage'],'profileEmbedded':True,'images':images}
    checks['pass']=True
    return checks
