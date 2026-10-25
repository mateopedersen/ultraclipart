"""Build the reviewed, local Tabler Icons subset. Reads an already downloaded package."""
import sys, json, tarfile, hashlib, re, html, base64
from pathlib import Path
from collections import defaultdict
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1])
expected_version = '3.49.0'
target_count = 1724  # With the 276 original elements: 2,000 distinct vectors.
expected_integrity = 'sha512-l+GnSkFETx0U26icxv1VUFnxxiTqXfCcVRiRAnyMwibupM2S2L/hSaZ9gmSgz01rkrsH/93NvLsxykqdanc6lw=='
actual_integrity = 'sha512-' + base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
if actual_integrity != expected_integrity: raise ValueError('Package integrity mismatch')
allowed_tags = {'g','path','circle','ellipse','rect','line','polyline','polygon'}
allowed_attrs = {'d','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-opacity','opacity','transform','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','points'}
groups = {
 'Animals': 'Nature & Animals', 'Nature': 'Nature & Animals', 'Weather':'Weather & Seasons',
 'Food':'Food & Kitchen', 'Buildings':'Buildings & Places', 'Vehicles':'Travel & Transport',
 'Map':'Travel & Transport', 'Health':'Health & Wellbeing', 'Sport':'Sports & Activities',
 'Games':'Games & Hobbies', 'Media':'Music & Media', 'Photography':'Music & Media',
 'Math':'School & Science', 'Devices':'Technology', 'Computers':'Technology',
 'Electrical':'Technology', 'Communication':'Communication', 'E-commerce':'Shopping & Everyday',
 'Mood':'Faces & Gestures', 'Gestures':'Faces & Gestures', 'Design':'Design Tools',
 'Document':'School & Science', 'Shapes':'Shapes & Symbols', 'Symbols':'Shapes & Symbols',
 'Badges':'Badges & Awards', 'Zodiac':'Shapes & Symbols', 'Charts':'Business & Charts',
 'Laundry':'Home & Care'
}
# Prefer objects and filled artwork. Avoid brand marks and disabled/numbered copies.
def useful(name):
 return not re.search(r'(?:^|[-])(?:off|disabled|dashed|dotted|minus|plus|check|x|filled|small|large|thin|thick|outline|error|warning)(?:$|[-])|[0-9]',name)
with tarfile.open(archive) as t:
 package=json.load(t.extractfile('package/package.json'))
 if package['version'] != expected_version: raise ValueError('Unexpected icon package version')
 meta=json.load(t.extractfile('package/icons.json'))
 license=t.extractfile('package/LICENSE').read().decode()
 buckets=defaultdict(list)
 for name, info in sorted(meta.items()):
  category=info['category']
  if category not in groups or not useful(name): continue
  style='filled' if 'filled' in info['styles'] else 'outline'
  buckets[category].append((name,info,style))
 for category in buckets:
  buckets[category].sort(key=lambda row:(row[2]!='filled',len(row[0].split('-')),row[0]))
 chosen=[]; geometry=set(); sources=[]
 while len(chosen)<target_count:
  progress=False
  for category in groups:
   if not buckets[category] or len(chosen)>=target_count: continue
   name,info,style=buckets[category].pop(0)
   original=t.extractfile(f'package/icons/{style}/{name}.svg').read()
   svg=ET.fromstring(original)
   pieces=[]
   def clean(node):
    tag=node.tag.rsplit('}',1)[-1]
    if tag not in allowed_tags: raise ValueError(f'Unsupported SVG tag {name}: {tag}')
    attrs={k:v.replace('currentColor','#326acb') for k,v in node.attrib.items() if k in allowed_attrs}
    if any(re.search(r'url\(|https?:|javascript:|NaN|Infinity',v,re.I) for v in attrs.values()):raise ValueError(name)
    text=' '.join(f'{k}="{html.escape(v,quote=True)}"' for k,v in sorted(attrs.items()))
    inside=''.join(clean(child) for child in node)
    return f'<{tag} {text}>{inside}</{tag}>' if inside else f'<{tag} {text}/>'
   for node in svg:
    if node.attrib.get('fill') == 'none' and node.attrib.get('stroke') == 'none': continue
    pieces.append(clean(node))
   inner=''.join(pieces)
   shape=hashlib.sha256(inner.encode()).hexdigest()
   if shape in geometry: continue
   geometry.add(shape)
   inherited='fill="#326acb" stroke="none"' if style=='filled' else 'fill="none" stroke="#326acb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
   markup=f'<g transform="scale(10.666667)" {inherited}><desc>{html.escape(license)}</desc>{inner}</g>'
   chosen.append({'id':f'tabler-{name}','name':name.replace('-',' ').title()+' Icon','category':groups[category], 'tags':' '.join(map(str, info['tags']))+' icon '+style,'markup':markup})
   sources.append({'id':f'tabler-{name}','source':f'icons/{style}/{name}.svg','sha256':hashlib.sha256(original).hexdigest()})
   progress=True
  if not progress:raise ValueError('Not enough distinct eligible vectors')
 (root/'data/studio-tabler-elements.json').write_text(json.dumps(chosen,ensure_ascii=False,separators=(',',':'))+'\n')
 (root/'public/licenses/tabler-icons-MIT.txt').write_text(license)
 (root/'data/studio-vector-provenance.json').write_text(json.dumps({'source':'https://github.com/tabler/tabler-icons','package':'@tabler/icons','version':expected_version,'license':'MIT','integrity':actual_integrity,'tarball':'https://registry.npmjs.org/@tabler/icons/-/icons-3.49.0.tgz','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'count':len(chosen),'selection':'Distinct non-brand objects; category-balanced, preferring filled SVGs; no color or size duplicates. Original geometry normalized to a 256px editing space.','files':sources},indent=2)+'\n')
 print(json.dumps({'imported':len(chosen),'categories':len(set(e['category'] for e in chosen)),'bytes':(root/'data/studio-tabler-elements.json').stat().st_size}))
