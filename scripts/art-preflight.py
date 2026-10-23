#!/usr/bin/env python3
"""Fail-closed structural, color-space, integrity and transparency checks."""
from pathlib import Path
import json, hashlib, re, importlib.util, itertools, statistics, math
from PIL import Image
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('export',ROOT/'scripts/art-export.py');ex=importlib.util.module_from_spec(spec);spec.loader.exec_module(ex)
ART=json.loads((ROOT/'data/art.json').read_text())
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def preflight():
 rows=[];errors=[];shapes=[]
 for a in ART:
  checks={};files={k:ROOT/'public'/a[k].lstrip('/') for k in ('svg','webp','thumb','pdf')}
  try:
   svg=ex.validate_svg(files['svg'].read_text());groups=[e.get('id') for e in svg if e.tag.endswith('g')]
   checks['namedLayers']=len(groups);assert len(groups)>=4
   checks['hashes']=all(digest(p)==a['files'][k]['sha256'] and p.stat().st_size==a['files'][k]['bytes'] for k,p in files.items());assert checks['hashes']
   for k,size in [('webp',2048),('thumb',440)]:
    with Image.open(files[k]) as im:
     im.load();assert im.format=='WEBP' and im.size==(size,size);assert 'A' in im.getbands();assert im.getchannel('A').getextrema()==(0,255)
     # No painting at the canvas edge; no clipping through an exterior contour.
     alpha=im.getchannel('A');bb=alpha.getbbox();assert bb and min(bb)>0 and bb[2]<size and bb[3]<size
     checks[k]={'width':size,'height':size,'alpha':True,'bounds':bb}
   with Image.open(files['webp']) as im:
    tiny=im.convert('RGBA').resize((32,32));alpha=tiny.getchannel('A');shapes.append((a['id'],[v>96 for v in alpha.get_flattened_data()]))
   reader=PdfReader(files['pdf'],strict=True);assert len(reader.pages)==1;p=reader.pages[0];assert [float(v) for v in p.mediabox]==[0,0,612,792]
   stream=p.get_contents().get_data();has_cmyk=bool(re.search(rb'\d(?:\.\d+)?\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[kK](?:\s|$)',stream));assert has_cmyk
   assert not re.search(rb'\s(?:rg|RG)(?:\s|$)',stream),'RGB paint operation in PDF'
   assert not p.images,'Unexpected raster image in vector PDF'
   intent=reader.trailer['/Root'].get('/OutputIntents');assert intent
   checks['pdf']={'bytes':files['pdf'].stat().st_size,'underCap':files['pdf'].stat().st_size<=1_000_000,'colorSpace':'DeviceCMYK','rasterImages':len(p.images),'page':'US Letter','registeredCondition':str(intent[0].get_object()['/OutputConditionIdentifier']),'profileEmbedded':False}
   assert checks['pdf']['underCap']
   checks['pass']=True
  except Exception as e:
   checks['pass']=False;checks['error']=str(e);errors.append(a['id']+': '+str(e))
  rows.append({'id':a['id'],'checks':checks})
 # Similar silhouettes are review flags, not fabricated semantic originality proof.
 duplicates=[]
 for (id1,b1),(id2,b2) in itertools.combinations(shapes,2):
  inter=sum(x and y for x,y in zip(b1,b2));union=sum(x or y for x,y in zip(b1,b2));score=inter/union if union else 1
  if score>.88:duplicates.append({'a':id1,'b':id2,'silhouetteIoU':round(score,4),'status':'REVIEW_REQUIRED'})
 bad=['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>','<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>','<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>','<svg xmlns="http://www.w3.org/2000/svg"><image href="https://bad.invalid/a.svg"/></svg>','<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>','<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(data:text/html,bad)"/></svg>']
 security=[]
 for i,payload in enumerate(bad):
  try:ex.validate_svg(payload);security.append(False);errors.append('Malicious SVG accepted: '+str(i))
  except Exception:security.append(True)
 sizes=sorted(a['files']['pdf']['bytes'] for a in ART);total=sum(v['bytes'] for a in ART for v in a['files'].values())
 report={'status':'PASS' if not errors else 'FAIL','generatedCount':len(ART),'topicCount':len(set(a['topic'] for a in ART)),'targetCount':5500,'completedTopicCount':0,'publishedApprovedCount':sum(a['published'] for a in ART),'totalLocalAssetBytes':total,'r2MeasuredBytes':None,'maxPdfBytes':max(sizes),'p95PdfBytes':sizes[math.ceil(.95*len(sizes))-1],'pdfOverCapCount':sum(n>1_000_000 for n in sizes),'maliciousSvgVectorsRejected':sum(security),'exactDuplicateSvgCount':len(ART)-len(set(a['files']['svg']['sha256'] for a in ART)),'silhouetteReviewFlags':duplicates,'rows':rows,'errors':errors,'limitations':['No PDF/X compliance claim. Registered GRACoL output condition is referenced; full ICC not embedded due 1 MB cap.','Physical print proof and owner visual signoff are pending. Automated checks do not prove artistic originality.','R2 counters are unknown until authenticated remote inventory is obtained.']}
 (ROOT/'data/art-preflight.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ('rows','silhouetteReviewFlags')},indent=2));return report
if __name__=='__main__':raise SystemExit(0 if preflight()['status']=='PASS' else 1)
