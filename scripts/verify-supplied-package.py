#!/usr/bin/env python3
"""Resume a supplied collection's independent image/PDF inspection without publishing it."""
import argparse, concurrent.futures, hashlib, json, os, pathlib, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader
from raster_source import inspect_cmyk_image, decoded_alpha

ROOT = pathlib.Path(__file__).resolve().parents[1]
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')
    temp.replace(path)
def forbid_active_content(reader):
    forbidden = {'/JavaScript','/JS','/OpenAction','/AA','/EmbeddedFiles','/Launch','/RichMedia','/XFA','/AcroForm'}
    visited = set()
    def walk(obj):
        obj = obj.get_object() if hasattr(obj,'get_object') else obj
        if id(obj) in visited: return
        visited.add(id(obj))
        if isinstance(obj,dict):
            assert not forbidden.intersection(map(str,obj)), 'Active PDF content'
            for value in obj.values(): walk(value)
        elif isinstance(obj,list):
            for value in obj: walk(value)
    walk(reader.trailer)

def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('--root',required=True)
    cli.add_argument('--workers',type=int,default=6)
    cli.add_argument('--topic')
    args=cli.parse_args()
    root=(ROOT/args.root).resolve()
    assert root.is_relative_to(ROOT/'work')
    binary=os.environ['PDFTOPPM_BIN']
    held={r['id'] for r in json.loads((root/'repair-hold.json').read_text())['items']}
    expected_counts={r['folder']:r['pairs'] for r in json.loads((root/'topic-map.json').read_text())}
    manifest=json.loads((root/'extraction.json').read_text())
    expected={r['path']:r for r in manifest['files']}
    dependencies=hashlib.sha256(pathlib.Path(__file__).read_bytes()+(ROOT/'scripts/raster_source.py').read_bytes()).hexdigest()
    folders=sorted(p for p in (root/'extracted').iterdir() if p.is_dir())
    if args.topic: folders=[p for p in folders if p.name==args.topic+'-clipart']
    summaries=[]
    for folder in folders:
        topic=folder.name.removesuffix('-clipart')
        stage=root/'review'/topic
        stage.joinpath('proofs').mkdir(parents=True,exist_ok=True)
        ids=sorted(p.stem for p in (folder/'webp').glob('*.webp') if p.stem not in held)
        all_ids={p.stem for p in (folder/'webp').glob('*.webp')}
        assert len(all_ids)==expected_counts[folder.name]
        assert len(ids)==expected_counts[folder.name]-len(all_ids.intersection(held))
        def inspect(art_id):
            cache=stage/'items'/f'{art_id}.json'
            pdf=folder/'pdf'/f'{art_id}.pdf';webp=folder/'webp'/f'{art_id}.webp'
            hashes={k:digest(p) for k,p in [('pdf',pdf),('webp',webp)]}
            for kind,path in [('pdf',pdf),('webp',webp)]:
                entry=expected[str(path.relative_to(root/'extracted'))]
                assert hashes[kind]==entry['sha256'] and path.stat().st_size==entry['bytes']
            proof=stage/'proofs'/f'{art_id}.png'
            if cache.exists() and proof.exists():
                prior=json.loads(cache.read_text())
                if prior.get('dependencies')==dependencies and prior.get('hashes')==hashes and prior.get('proofSha256')==digest(proof): return prior
            with Image.open(webp) as source:
                source.load();assert source.format=='WEBP' and source.mode=='RGBA'
                width,height=source.size;assert 0<width<=4096 and 0<height<=4096
                alpha=source.getchannel('A');extrema=alpha.getextrema();assert extrema[0]==0 and extrema[1]>=250
                rgbaSha=hashlib.sha256(source.tobytes()).hexdigest()
                visible=alpha.point(lambda v:255 if v>=32 else 0).getbbox();assert visible
                edge=visible[0]==0 or visible[1]==0 or visible[2]==width or visible[3]==height
            reader=PdfReader(pdf,strict=True);assert len(reader.pages)==1 and pdf.stat().st_size<=1_000_000
            forbid_active_content(reader)
            page=reader.pages[0];pw,ph=map(float,(page.mediabox.width,page.mediabox.height))
            assert pw>0 and ph>0 and abs(pw/ph-width/height)<.0001
            assert list(page.mediabox.lower_left)==[0,0] and list(page.cropbox)==list(page.mediabox)
            assert page.get('/Rotate',0)==0 and not page.get('/Annots')
            images=[];alphaEqual=[]
            for ref in page['/Resources'].get('/XObject',{}).values():
                obj=ref.get_object()
                if obj.get('/Subtype')!='/Image':continue
                images.append(inspect_cmyk_image(obj,width,height,reader.trailer['/Root'].get('/OutputIntents')))
                assert '/SMask' in obj, 'Transparent source needs PDF alpha mask'
                alphaEqual.append(decoded_alpha(obj['/SMask'].get_object())==alpha.tobytes())
            assert len(images)==1 and all(alphaEqual), 'PDF/WebP alpha mismatch'
            subprocess.run([binary,'-f','1','-singlefile','-scale-to','692','-png',str(pdf),str(proof.with_suffix(''))],check=True,capture_output=True,timeout=90)
            info={str(k):str(v) for k,v in (reader.metadata or {}).items()}
            record={'id':art_id,'topic':topic,'status':'FORMAT_PASSED','hashes':hashes,'dependencies':dependencies,'pdfBytes':pdf.stat().st_size,'webpBytes':webp.stat().st_size,'width':width,'height':height,'rgbaSha256':rgbaSha,'alphaRange':extrema,'visibleBounds':visible,'edgeReviewRequired':edge,'pagePoints':[pw,ph],'ppi':round(width/(pw/72)),'images':images,'pdfAlphaExact':True,'metadata':info,'proofSha256':digest(proof)}
            save(cache,record);return record
        rows=[];errors=[]
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,8))) as pool:
            futures={pool.submit(inspect,art_id):art_id for art_id in ids}
            for future in concurrent.futures.as_completed(futures):
                try: rows.append(future.result())
                except Exception as error: errors.append({'id':futures[future],'error':str(error) or type(error).__name__})
        rows.sort(key=lambda r:r['id'])
        source_small=[];source_pair=[]
        for row in rows:
            with Image.open(folder/'webp'/f"{row['id']}.webp") as image:
                image=image.convert('RGBA');bg=Image.new('RGBA',image.size,'white');bg.alpha_composite(image)
                source_pair.append(np.asarray(bg.convert('RGB').resize((160,160)),dtype=np.float32))
                source_small.append(np.asarray(bg.convert('RGB').resize((48,48)),dtype=np.float32).reshape(-1))
        candidates=np.asarray(source_small)
        for index,row in enumerate(rows):
            proof=Image.open(stage/'proofs'/f"{row['id']}.png").convert('RGB')
            sample=np.asarray(proof.resize((48,48)),dtype=np.float32).reshape(-1)
            differences=np.mean((candidates-sample)**2,axis=1)
            closest=int(np.argmin(differences))
            error=float(np.abs(np.asarray(proof.resize((160,160)),dtype=np.float32)-source_pair[index]).mean())
            row.update(pairedWebp=rows[closest]['id'],meanRgbDifference=round(error,4))
            if closest!=index or error>=18: errors.append({'id':row['id'],'error':'PDF/WebP visual mismatch','nearest':rows[closest]['id'],'meanRgbDifference':error})
        font=ImageFont.load_default(size=13)
        for start in range(0,len(rows),25):
            sheet=Image.new('RGB',(1400,1550),'#edf0ed');draw=ImageDraw.Draw(sheet)
            for n,row in enumerate(rows[start:start+25]):
                image=Image.open(stage/'proofs'/f"{row['id']}.png").convert('RGB');image.thumbnail((270,264))
                x=n%5*280;y=n//5*310;sheet.paste(image,(x+(280-image.width)//2,y+(264-image.height)//2))
                label=row['id'].removesuffix('-clipart');lines=[label[i:i+35] for i in range(0,len(label),35)]
                draw.text((x+5,y+266),f'{start+n+1:02} '+lines[0],font=font,fill='#18242a')
                if len(lines)>1:draw.text((x+5,y+283),lines[1],font=font,fill='#18242a')
            sheet.save(stage/f'pdf-contact-{start//25+1}.png')
        report={'topic':topic,'status':'FORMAT_PASSED' if not errors and len(rows)==len(ids) else 'FAIL','pairs':len(rows),'expectedPairs':len(ids),'allPairsVisuallyMatched':not errors,'screenReview':'PENDING','physicalPrintProof':False,'maxPdfBytes':max((r['pdfBytes']for r in rows),default=0),'rows':rows,'errors':errors,'heldIds':sorted(held)if topic=='octopus'else[]}
        save(stage/'preflight.json',report)
        summary={k:v for k,v in report.items()if k not in ('rows','heldIds')};summaries.append(summary)
        save(root/'verification-progress.json',summaries);print(json.dumps(summary),flush=True)
    assert all(r['status']=='FORMAT_PASSED'for r in summaries),'Some collections require investigation'
if __name__=='__main__':main()
