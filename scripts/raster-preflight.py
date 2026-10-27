"""Checks for supplied raster artwork, separate from the layered vector contract."""
import hashlib, io
from PIL import Image, ImageCms
from pypdf import PdfReader
from raster_source import inspect_cmyk_image, decoded_alpha

def inspect_raster(art, files):
    checks={'sourceType':'raster','namedLayers':0}
    assert art.get('svg') is None and 'svg' not in art['files']
    checks['hashes']=all(hashlib.sha256(p.read_bytes()).hexdigest()==art['files'][k]['sha256'] and p.stat().st_size==art['files'][k]['bytes'] for k,p in files.items())
    assert checks['hashes']
    width,height=art['width'],art['height']
    assert all(isinstance(n,int) and 0<n<=4096 for n in (width,height))
    factor=min(1,440/max(width,height))
    thumb_size=(max(1,round(width*factor)),max(1,round(height*factor)))
    for kind,size in [('webp',(width,height)),('thumb',thumb_size)]:
        with Image.open(files[kind]) as image:
            image.load();assert image.format=='WEBP' and image.size==size and image.mode=='RGBA'
            alpha=image.getchannel('A');low,high=alpha.getextrema()
            # Downsampling the supplied near-opaque pixels can produce 253/254.
            assert low==0 and high>=250
            checks[kind]={'width':size[0],'height':size[1],'alpha':True,'alphaRange':[low,high],'bounds':alpha.getbbox()}
    reader=PdfReader(files['pdf'],strict=True);assert len(reader.pages)==1
    if art.get('productionMethod')=='generated-raster':
        assert tuple(map(int,reader.pdf_header.removeprefix('%PDF-').split('.')))>=(1,5), 'JPX image data requires PDF 1.5 or later'
    root=reader.trailer['/Root']
    assert not any(key in root for key in ('/OpenAction','/AA','/AcroForm'))
    assert '/JavaScript' not in root.get('/Names',{})
    page=reader.pages[0]
    pw,ph=map(float,(page.mediabox.width,page.mediabox.height))
    assert pw>0 and ph>0 and abs(pw/ph-width/height)<.0001, 'PDF must match the image canvas aspect ratio'
    assert list(page.mediabox.lower_left)==[0,0] and list(page.cropbox)==list(page.mediabox)
    assert page.get('/Rotate',0)==0 and not page.get('/Annots') and not page.get('/AA')
    print_info=art.get('pdfPrint')
    print_width,print_height=width,height
    if print_info:
        print_width,print_height=print_info['width'],print_info['height']
        assert all(isinstance(n,int) and n>0 for n in (print_width,print_height))
        assert print_width<=width and print_height<=height
        assert abs(pw/ph-print_width/print_height)<.0001
        px,py=print_width/(pw/72),print_height/(ph/72)
        assert 150<=px<=600 and abs(px-py)<.01
        assert abs(px-print_info['ppi'])<.001
        assert all(abs(a-b)<.001 for a,b in zip(print_info['pagePoints'],[pw,ph]))
        with Image.open(files['webp']) as source:
            source=source.convert('RGBA')
            if source.size!=(print_width,print_height):source=source.resize((print_width,print_height),Image.Resampling.LANCZOS)
            expected_alpha=source.getchannel('A').tobytes()
    images=[]
    for ref in page['/Resources'].get('/XObject',{}).values():
        image=ref.get_object()
        if image.get('/Subtype')!='/Image':continue
        info=inspect_cmyk_image(image,print_width,print_height,root.get('/OutputIntents'))
        if print_info:
            assert '/SMask' in image
            assert decoded_alpha(image['/SMask'].get_object())==expected_alpha, 'PDF alpha differs from the actual supplied print edition'
        assert info['profile']==art['printProfile'] and info['colorSpace']==art['pdfColorSpace']
        images.append(info)
    assert images and files['pdf'].stat().st_size<=1_000_000
    checks['pdf']={'bytes':files['pdf'].stat().st_size,'underCap':True,'colorSpace':art['pdfColorSpace'],'rasterImages':len(images),'page':art['pdfPage'],'profileEmbedded':all(i['iccBytes']>0 for i in images),'images':images}
    checks['pass']=True
    return checks
