#!/usr/bin/env python3
"""Independent preflight of actual studio browser downloads, using pypdf and Pillow."""
import json, pathlib, re, sys
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream
root=pathlib.Path(sys.argv[1])
rows=[]
for engine in ['chromium','webkit']:
 folder=root/engine
 for path in sorted(folder.glob('*.pdf')):
  reader=PdfReader(path,strict=True);assert len(reader.pages)==1
  page=reader.pages[0];raw=page['/Contents'].get_data()
  assert not re.search(rb'(?<![A-Za-z])[+-]?\d+(?:\.\d+)?[eE][+-]\d+',raw), 'Invalid PDF exponent notation'
  ops=ContentStream(page['/Contents'],reader).operations
  inks=[values for values,op in ops if op in [b'k',b'K']]
  assert inks and all(len(v)==4 and all(0<=float(c)<=1 for c in v) for v in inks)
  assert not any(op in [b'rg',b'RG'] for _,op in ops)
  assert not page['/Resources'].get('/XObject')
  assert path.stat().st_size<=1000000
  assert [float(page.mediabox.width),float(page.mediabox.height)]==[612,792]
  intent=reader.trailer['/Root']['/OutputIntents'][0].get_object()
  assert intent['/OutputConditionIdentifier']=='CGATS TR 006'
  assert '/DestOutputProfile' not in intent
  if path.name=='created-art.pdf': assert 'Made by me' in page.extract_text()
  if path.name=='imported.pdf':
   alphas=[float(v.get_object().get('/ca',1)) for v in page['/Resources']['/ExtGState'].values()]
   assert any(abs(a-.7)<1e-6 for a in alphas)
  rows.append({'engine':engine,'file':path.name,'bytes':path.stat().st_size,'type':'process CMYK vector PDF','cmykOperators':len(inks),'rgbOperators':0,'embeddedRaster':False,'scientificNumericTokens':0,'outputCondition':'CGATS TR 006','embeddedICC':False,'status':'PASS'})
 for path in sorted(folder.glob('*.webp')):
  image=Image.open(path);image.load();assert image.format=='WEBP';assert image.mode=='RGBA'
  expected=(2048,1593) if path.name=='created-art.webp' else (2048,1536)
  assert image.size==expected,(path,image.size,expected)
  alpha=image.getchannel('A');low,high=alpha.getextrema();assert low==0;assert abs(high-178.5)<=.5 if path.name=='imported.webp' else high==255;assert alpha.getbbox()
  assert len(alpha.getcolors(256))>2  # Native engines may quantize edge coverage differently.
  rows.append({'engine':engine,'file':path.name,'bytes':path.stat().st_size,'type':'WebP','dimensions':image.size,'mode':image.mode,'alphaRange':alpha.getextrema(),'alphaLevels':len(alpha.getcolors(256)),'status':'PASS'})
assert len(rows)==32, len(rows)
report={'files':len(rows),'passed':len(rows),'maxPDFBytes':max(r['bytes'] for r in rows if r['type']=='process CMYK vector PDF'),'results':rows}
(root/'export-preflight.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='results'}))
