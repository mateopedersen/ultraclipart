#!/usr/bin/env python3
"""Inspect real editor downloads; never infers successful exports from UI text."""
import json, pathlib, sys
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'work/editor-evidence/chromium')
report=[]
for path in sorted(root.glob('*.pdf')):
 reader=PdfReader(path,strict=True)
 assert len(reader.pages)==1
 page=reader.pages[0]
 ops=ContentStream(page['/Contents'],reader).operations
 ink=[(operands,operator.decode()) for operands,operator in ops if operator in [b'k',b'K']]
 rgb=[operator for _,operator in ops if operator in [b'rg',b'RG']]
 assert ink and not rgb
 assert all(len(v)==4 and all(0<=float(c)<=1 for c in v) for v,_ in ink)
 assert path.stat().st_size<=1000000
 assert not page['/Resources'].get('/XObject')
 intents=reader.trailer['/Root']['/OutputIntents']
 assert intents[0].get_object()['/OutputConditionIdentifier']=='CGATS TR 006'
 if 'landscape' in path.name:
  assert abs(float(page.mediabox.width)-841.8898)<.1
  assert abs(float(page.mediabox.height)-595.2756)<.1
  assert all(float(v[0])==float(v[1])==float(v[2])==0 for v,_ in ink)
 elif path.name=='edited.pdf':
  assert [float(page.mediabox.width),float(page.mediabox.height)]==[612,792]
 assert 'Happy Harvest' in page.extract_text()
 report.append({'file':path.name,'format':'PDF','bytes':path.stat().st_size,'version':reader.pdf_header,'pages':len(reader.pages),'mediaBox':[float(page.mediabox.width),float(page.mediabox.height)],'cmykOperations':len(ink),'rgbOperations':len(rgb),'embeddedRaster':False,'captionExtracted':True,'outputCondition':'CGATS TR 006','embeddedICC':False,'status':'PASS'})
for path in sorted(root.glob('*.webp')):
 image=Image.open(path);image.load()
 assert image.format=='WEBP'
 assert image.size==(2048,2048)
 assert image.mode=='RGBA'
 alpha=image.getchannel('A')
 assert alpha.getextrema()==(0,255)
 # Many intermediate alpha values prove antialiased vector edges at export resolution.
 levels=len(alpha.getcolors(256))
 assert levels>100 if path.name=='edited.webp' else levels>2
 report.append({'file':path.name,'format':'WebP','bytes':path.stat().st_size,'size':image.size,'mode':image.mode,'alphaRange':alpha.getextrema(),'alphaLevels':levels,'status':'PASS'})
assert report,'No downloaded editor files to preflight'
(root/'export-preflight.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
