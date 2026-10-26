"""Rebuild invalid CMYK streams from reviewed WebPs; retains native alpha and a strict size/quality gate."""
from pathlib import Path
import importlib.util,sys,io,json,hashlib,shutil
import numpy as np
from PIL import Image,ImageCms
R=Path(__file__).resolve().parents[1];S=R/'work/imports/parade-scifi-14';sys.path.insert(0,str(R/'scripts'))
spec=importlib.util.spec_from_file_location('exporter',R/'scripts/produce-raster-wave.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
profile=R/'public/color/print.icc';transform=ImageCms.buildTransformFromOpenProfiles(ImageCms.createProfile('sRGB'),ImageCms.getOpenProfile(str(profile)),'RGB','CMYK',renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)
def encode(webp,target,title,neutral=False):
    with Image.open(webp)as src:im=src.convert('RGBA')
    alpha=im.getchannel('A');a=np.asarray(alpha,dtype=float);rgb=np.asarray(im.convert('RGB'));chroma=rgb.max(2)-rgb.min(2)
    monochrome=neutral and float(np.sum(chroma*a)/a.sum())<=1 and int(chroma[a>32].max(initial=0))<=16
    raw=mod.separate_cmyk(im,alpha,transform,{'style':'Black & White' if monochrome else 'Color','printSeparation':'black-only' if monochrome else 'profile-cmyk'})
    cmyk=Image.fromarray(raw,'CMYK');trials=[]
    for quality in [None,54,52,50,48]:
        out=io.BytesIO();cmyk.save(out,'JPEG2000',irreversible=quality is not None,**({'quality_mode':'dB','quality_layers':[quality]}if quality else {}))
        with Image.open(io.BytesIO(out.getvalue()))as decoded:
            decoded.load();assert decoded.mode=='CMYK' and decoded.size==im.size
            delta=raw.astype(float)-np.asarray(decoded,dtype=float)
        rmse=float(np.sqrt(np.sum(delta**2*a[:,:,None])/(4*a.sum())))
        pdf=mod.pdf_bytes(out.getvalue(),alpha,title);trials.append({'qualityDb':quality,'bytes':len(pdf),'weightedCmykRmse':rmse})
        if len(pdf)<=997000 and rmse<=1.8:
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(pdf);return {'sha256':hashlib.sha256(pdf).hexdigest(),'selected':trials[-1],'trials':trials,'sourceWebpSha256':hashlib.sha256(webp.read_bytes()).hexdigest()}
    raise ValueError('Print quality/size gate failed '+title+' '+json.dumps(trials))
if __name__=='__main__':
    manifest=json.loads((S/'extraction.json').read_text());repairs=manifest.get('repairs',[])
    if '--repair' in sys.argv:
        for p in sorted((S/'review').glob('*/preflight.json')):
            report=json.loads(p.read_text())
            for err in report['errors']:
                if 'four actual color components' not in err['error']:continue
                art=err['id'];topic=report['topic'];pdf=S/'extracted'/f'{topic}-clipart/pdf/{art}.pdf';webp=S/'extracted'/f'{topic}-clipart/webp/{art}.webp';backup=S/'original-pdfs'/f'{art}.pdf';backup.parent.mkdir(exist_ok=True)
                if not backup.exists():shutil.copy2(pdf,backup)
                evidence=encode(webp,pdf,art.replace('-',' '),neutral=True)
                record={'id':art,'topic':topic,'reason':'Original PDF image stream declared four CMYK components but actually contained incompatible image data. Rebuilt from the unchanged paired WebP.','originalPdfSha256':hashlib.sha256(backup.read_bytes()).hexdigest(),**evidence}
                repairs=[x for x in repairs if x['id']!=art]+[record]
                row=next(x for x in manifest['files']if x['path']==str(pdf.relative_to(S/'extracted')));row.update(bytes=pdf.stat().st_size,sha256=evidence['sha256'])
                manifest['repairs']=repairs;(S/'extraction.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(record),flush=True)
