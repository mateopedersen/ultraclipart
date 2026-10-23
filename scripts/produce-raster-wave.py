#!/usr/bin/env python3
"""Native-resolution raster export with bounded quality, resumable evidence and no remote writes.

WebP is exact lossless RGBA. Color CMYK uses LittleCMS; explicitly reviewed neutral
line art may use process black with empty C/M/Y plates. Independently decoded JPEG2000
streams choose lossless first, then only explicitly permitted high-quality candidates.
The alpha mask remains byte-exact. No resampling or invented embedded print profile.
"""
import argparse, fcntl, hashlib, io, json, math, os, re, shutil, struct, subprocess, zlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageCms, ImageChops, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, EncodedStreamObject, DecodedStreamObject, FloatObject, NameObject, NumberObject, TextStringObject
from raster_source import inspect_cmyk_image, decoded_alpha

ROOT=Path(__file__).resolve().parents[1]
PROFILE=ROOT/'public/color/print.icc'
sha=lambda b:hashlib.sha256(b).hexdigest()
def atomic_json(path, data):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,indent=2)+'\n');temp.replace(path)
def export_signature(plan, item, dependencies):
    # A deferred neighbor must not invalidate verified artwork. Every export-affecting
    # policy, this item's metadata, and encoder/profile/research bytes still bind reuse.
    policy={key:plan[key] for key in ('wave','topic','method','research','maxPdfBytes','minimumJpxQualityDb','maximumWeightedCmykRmse')}
    contract=json.dumps({'schema':2,'policy':policy,'item':item},sort_keys=True,separators=(',',':')).encode()
    return sha(contract+dependencies)
def validate_native_alpha(alpha):
    low,high=alpha.getextrema()
    assert low==0 and high>=250, 'Source needs transparent surroundings and near-opaque artwork'
def separate_cmyk(image,alpha,transform,meta):
    weights=np.asarray(alpha,dtype=np.float64)
    separation=meta.get('printSeparation','profile-cmyk')
    assert separation in ('profile-cmyk','black-only'), 'Unknown print separation'
    if separation=='black-only':
        # Explicit process-black separation for neutral line art. Four-channel CMYK
        # is retained; colored artwork must never take this path to meet a byte cap.
        assert meta.get('style') in ('Outline','Black & White'), 'Black-only requires monochrome artwork'
        rgb=np.asarray(image.convert('RGB'),dtype=np.float64)
        chroma=rgb.max(axis=2)-rgb.min(axis=2)
        assert weights.sum()>0 and np.sum(chroma*weights)/weights.sum()<=1, 'Colored source cannot use black-only separation'
        assert np.max(chroma[weights>32],initial=0)<=16, 'Visible colored accents cannot use black-only separation'
        raw=np.zeros((*weights.shape,4),dtype=np.uint8)
        raw[:,:,3]=255-np.asarray(image.convert('L'))
    else:
        raw=np.array(ImageCms.applyTransform(image.convert('RGB'),transform))
    # Color under fully transparent pixels cannot affect any composite.
    raw[weights==0]=0
    return raw
def png_payload(gray):
    out=io.BytesIO();gray.save(out,'PNG',compress_level=9)
    body=out.getvalue();pos=8;payload=[]
    while pos<len(body):
        size=struct.unpack('>I',body[pos:pos+4])[0];kind=body[pos+4:pos+8]
        if kind==b'IDAT':payload.append(body[pos+8:pos+8+size])
        pos+=size+12
    return b''.join(payload)
def pdf_bytes(encoded,alpha,title):
    width,height=alpha.size;pw,ph=width*72/300,height*72/300
    writer=PdfWriter();writer.pdf_header='%PDF-1.7';page=writer.add_blank_page(pw,ph)
    mask=EncodedStreamObject();mask._data=png_payload(alpha)
    mask.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Image'),NameObject('/Width'):NumberObject(width),NameObject('/Height'):NumberObject(height),NameObject('/BitsPerComponent'):NumberObject(8),NameObject('/ColorSpace'):NameObject('/DeviceGray'),NameObject('/Filter'):NameObject('/FlateDecode'),NameObject('/DecodeParms'):DictionaryObject({NameObject('/Predictor'):NumberObject(15),NameObject('/Colors'):NumberObject(1),NameObject('/Columns'):NumberObject(width),NameObject('/BitsPerComponent'):NumberObject(8)})})
    image=EncodedStreamObject();image._data=encoded
    image.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Image'),NameObject('/Width'):NumberObject(width),NameObject('/Height'):NumberObject(height),NameObject('/BitsPerComponent'):NumberObject(8),NameObject('/ColorSpace'):NameObject('/DeviceCMYK'),NameObject('/Filter'):NameObject('/JPXDecode'),NameObject('/SMask'):writer._add_object(mask)})
    page[NameObject('/Resources')]=DictionaryObject({NameObject('/XObject'):DictionaryObject({NameObject('/Artwork'):writer._add_object(image)})})
    content=DecodedStreamObject();content.set_data(f'q {pw:.6f} 0 0 {ph:.6f} 0 0 cm /Artwork Do Q'.encode('ascii'))
    page[NameObject('/Contents')]=writer._add_object(content.flate_encode())
    intent=DictionaryObject({NameObject('/Type'):NameObject('/OutputIntent'),NameObject('/S'):NameObject('/GTS_PDFX'),NameObject('/OutputConditionIdentifier'):TextStringObject('CGATS TR 006'),NameObject('/RegistryName'):TextStringObject('http://www.color.org'),NameObject('/OutputCondition'):TextStringObject('GRACoL2006_Coated1v2'),NameObject('/Info'):TextStringObject('GRACoL2006_Coated1v2; registered output condition; profile referenced, not embedded.')})
    writer._root_object[NameObject('/OutputIntents')]=ArrayObject([writer._add_object(intent)])
    writer.add_metadata({'/Title':title,'/Author':'UltraClipart','/Creator':'UltraClipart','/Producer':'UltraClipart','/Subject':title+' clipart'})
    out=io.BytesIO();writer.write(out);return out.getvalue()

def main():
    cli=argparse.ArgumentParser();cli.add_argument('--wave',required=True);args=cli.parse_args()
    if not re.fullmatch(r'wave_\d{3}',args.wave):raise ValueError('Unsafe wave ID')
    plan_path=ROOT/f'data/waves/{args.wave}-plan.json';plan=json.loads(plan_path.read_text())
    assert plan['wave']==args.wave and 0<len(plan['items'])<=50
    assert 48<=plan['minimumJpxQualityDb']<=60 and 0<plan['maximumWeightedCmykRmse']<=1.8
    assert 0<plan['maxPdfBytes']<=980_000
    stage=ROOT/'work/production'/args.wave;stage.mkdir(parents=True,exist_ok=True)
    lock=(stage/'.export.lock').open('w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    ids=[a['id']for a in plan['items']];assert len(set(ids))==len(ids)
    replacement_bytes=b''
    if plan.get('replacementReview'):
        replacement_path=(ROOT/plan['replacementReview']).resolve()
        assert replacement_path.is_relative_to(ROOT/'data'), 'Replacement review must be a project ledger'
        replacement_bytes=replacement_path.read_bytes()
        decisions=json.loads(replacement_bytes)['decisions']
        catalog={row['id']:row for row in json.loads((ROOT/'data/art.json').read_text())}
        for meta in plan['items']:
            matches=[row for row in decisions if row['replaceId']==meta['id']]
            assert len(matches)==1 and meta['id'] in catalog, 'Replacement must have one reviewed existing target'
            prior=catalog[meta['id']];decision=matches[0]
            assert decision['decision']=='REPLACE_NEAR_COMPOSITION'
            assert decision['topic']==prior['topic']==plan['topic']
            assert decision['priorWebpSha256']==prior['files']['webp']['sha256']
            assert decision['priorPdfSha256']==prior['files']['pdf']['sha256']
            assert meta['replacesRevision']==prior['revision'], 'Stale replacement revision'
    else:
        briefs=json.loads((ROOT/f'data/briefs/{plan["topic"]}.json').read_text())
        assert len(briefs['rows'])==50 and all(row['briefReview']=='REVIEWED_FOR_DISTINCT_COMPOSITION' for row in briefs['rows'])
        assert set(ids)<=set(row['artId']for row in briefs['rows'])
    research=json.loads((ROOT/plan['research']).read_text());assert research['topic']==plan['topic'] and research['sourceImageReuse'] is False
    binary=os.environ.get('PDFTOPPM_BIN') or shutil.which('pdftoppm');assert binary,'Poppler required'
    transform=ImageCms.buildTransformFromOpenProfiles(ImageCms.createProfile('sRGB'),ImageCms.getOpenProfile(str(PROFILE)),'RGB','CMYK',renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)
    dependencies=Path(__file__).read_bytes()+PROFILE.read_bytes()+(ROOT/'scripts/raster_source.py').read_bytes()+(ROOT/plan['research']).read_bytes()+replacement_bytes
    journal_path=stage/'raster-journal.json';journal=json.loads(journal_path.read_text()) if journal_path.exists() else {}
    files_dir=stage/'exports';files_dir.mkdir(exist_ok=True);proof_dir=stage/'proofs';proof_dir.mkdir(exist_ok=True)
    rows=[];resumed=0
    for meta in plan['items']:
        signature=export_signature(plan,meta,dependencies)
        art_id=meta['id'];assert re.fullmatch(r'[a-z0-9-]+',art_id)
        source=(ROOT/meta['source']).resolve();assert source.is_relative_to(stage/'source')
        source_sha=sha(source.read_bytes());prior=journal.get(art_id)
        if prior and prior.get('inputSignature')==signature and prior.get('sourceSha256')==source_sha and all((ROOT/f['path']).exists() and sha((ROOT/f['path']).read_bytes())==f['sha256']for f in prior['files'].values()) and (proof_dir/f'{art_id}.png').exists() and sha((proof_dir/f'{art_id}.png').read_bytes())==prior.get('proofSha256'):
            rows.append(prior);resumed+=1;continue
        with Image.open(source) as opened:
            opened.load();assert opened.mode=='RGBA' and max(opened.size)<=4096
            image=opened.copy()
        alpha=image.getchannel('A');validate_native_alpha(alpha)
        # Tiny isolated alpha noise is recorded; visible contours must stay inside the canvas.
        visible=alpha.point(lambda v:255 if v>=32 else 0).getbbox();assert visible
        width,height=image.size
        assert visible[0]>0 and visible[1]>0 and visible[2]<width and visible[3]<height,'Visible subject touches canvas edge'
        webp=files_dir/f'{art_id}.webp';image.save(webp,'WEBP',lossless=True,quality=100,method=6,exact=True)
        with Image.open(webp) as decoded:assert decoded.convert('RGBA').tobytes()==image.tobytes(),'WebP must preserve every RGBA byte'
        thumb=image.copy();thumb.thumbnail((440,440),Image.Resampling.LANCZOS);thumb.save(files_dir/f'{art_id}-thumb.webp','WEBP',quality=94,method=6,alpha_quality=100)
        raw=separate_cmyk(image,alpha,transform,meta);weights=np.array(alpha,dtype=np.float64)
        cmyk=Image.fromarray(raw,'CMYK');trials=[];selected=None
        # Wavelet decomposition changes packing, never native pixel dimensions or the quality floor.
        resolutions=meta.get('jpeg2000Resolutions',6)
        assert type(resolutions) is int and 4<=resolutions<=6, 'Unsupported JPEG2000 decomposition count'
        for quality in [None,54,52,50,48]:
            if quality and quality<plan['minimumJpxQualityDb']:continue
            out=io.BytesIO();cmyk.save(out,'JPEG2000',num_resolutions=resolutions,irreversible=quality is not None,**({'quality_mode':'dB','quality_layers':[quality]}if quality else {}))
            with Image.open(io.BytesIO(out.getvalue())) as decoded:
                decoded.load();assert decoded.mode=='CMYK' and decoded.size==image.size
                delta=raw.astype(np.float64)-np.array(decoded,dtype=np.float64)
            rmse=float(np.sqrt(np.sum(delta*delta*weights[:,:,None])/(4*np.sum(weights))))
            if quality is None:assert rmse==0
            pdf=pdf_bytes(out.getvalue(),alpha,meta['title'])
            trials.append({'numResolutions':resolutions,'qualityDb':quality,'losslessCmyk':quality is None,'bytes':len(pdf),'weightedCmykRmse':round(rmse,6)})
            if len(pdf)<=plan['maxPdfBytes'] and rmse<=plan['maximumWeightedCmykRmse']:
                selected=trials[-1];break
        if selected is None:
            atomic_json(stage/f'{art_id}.blocked.json',{'reason':'No candidate meets both quality floor and byte budget','trials':trials})
            raise ValueError(f'Quality/size gate blocked: {art_id}')
        pdf_path=files_dir/f'{art_id}.pdf';pdf_path.write_bytes(pdf)
        reader=PdfReader(pdf_path,strict=True);assert len(reader.pages)==1
        obj=reader.pages[0]['/Resources']['/XObject']['/Artwork'].get_object()
        info=inspect_cmyk_image(obj,width,height,reader.trailer['/Root']['/OutputIntents'])
        assert decoded_alpha(obj['/SMask'].get_object())==alpha.tobytes()
        subprocess.run([binary,'-f','1','-singlefile','-r','144','-defaultcmykprofile',str(PROFILE),'-png',str(pdf_path),str(proof_dir/art_id)],check=True,capture_output=True)
        row={**meta,'topic':plan['topic'],'width':width,'height':height,'sourceType':'raster','sourceSha256':source_sha,'inputSignature':signature,'state':'FORMAT_PREFLIGHT_PASSED','selectedEncoding':selected,'trials':trials,'webpExactRgba':True,'pdfAlphaExact':True,'nativeResolutionPreserved':True,'visibleBounds':visible,'image':info,'files':{}}
        for kind,path in [('pdf',pdf_path),('webp',webp),('thumb',files_dir/f'{art_id}-thumb.webp')]:
            body=path.read_bytes();row['files'][kind]={'path':str(path.relative_to(ROOT)),'bytes':len(body),'sha256':sha(body)}
        row['proofSha256']=sha((proof_dir/f'{art_id}.png').read_bytes())
        journal[art_id]=row;atomic_json(journal_path,journal);rows.append(row);print(art_id,selected,flush=True)
    # Independent render must match its own WebP more closely than every other wave artwork.
    previews=[]
    for row in rows:
        im=Image.open(ROOT/row['files']['webp']['path']).convert('RGBA');bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im)
        previews.append(np.array(bg.convert('RGB').resize((192,192)),dtype=float))
    for index,row in enumerate(rows):
        proof=np.array(Image.open(proof_dir/f'{row["id"]}.png').convert('RGB').resize((192,192)),dtype=float)
        errors=[float(np.abs(proof-p).mean())for p in previews]
        assert int(np.argmin(errors))==index and errors[index]<18,'PDF/WebP match or color render failed'
        row['pairMeanRgbDifference']=round(errors[index],5)
    sheet=Image.new('RGB',(1000,math.ceil(len(rows)/4)*300),'#f0f1ed');draw=ImageDraw.Draw(sheet)
    for index,row in enumerate(rows):
        im=Image.open(proof_dir/f'{row["id"]}.png').convert('RGB');im.thumbnail((240,260));x=index%4*250;y=index//4*300
        sheet.paste(im,(x+(250-im.width)//2,y));draw.text((x+8,y+272),row['title'],fill='#23332d',font=ImageFont.load_default(size=12))
    sheet.save(stage/'pdf-contact.png')
    previous_path=stage/'raster-report.json'
    previous=json.loads(previous_path.read_text()) if previous_path.exists() else {}
    retained_review=previous.get('screenReview','PENDING') if resumed==len(rows) else 'PENDING'
    report={'wave':args.wave,'status':'FORMAT_PREFLIGHT_PASSED','actualExportedDrawings':len(rows),'resumed':resumed,'screenReview':retained_review,'physicalPrintProof':False,'profileSha256':sha(PROFILE.read_bytes()),'profileEmbedded':False,'artworks':rows,'deferred':plan.get('deferred',[])}
    atomic_json(stage/'raster-report.json',report)
    print(json.dumps({k:v for k,v in report.items()if k not in ('artworks','deferred')}))
if __name__=='__main__':main()
