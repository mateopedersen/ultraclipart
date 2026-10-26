"""Preserve and validate the owner-supplied 100-pair Donald Trump archive."""
from pathlib import Path
import hashlib,json,zipfile,shutil,re
from datetime import datetime,timezone
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];S=R/'work/imports/donald-trump-100';P=Path('/Users/melihozcan/Downloads/Donald-Trump-100-Clipart-WEBP-PDF.zip');(S/'archives').mkdir(parents=True,exist_ok=True)
backup=S/'archives'/P.name
if backup.exists():assert backup.read_bytes()==P.read_bytes()
else:shutil.copy2(P,backup)
rows=[];pairs={}
with zipfile.ZipFile(backup) as z:
 assert len(z.infolist())==200 and len(set(z.namelist()))==200 and z.testzip() is None
 for m in z.infolist():
  hit=re.fullmatch(r'(pdf|webp)/(donald-trump-[a-z0-9-]+-clipart)\.(pdf|webp)',m.filename);assert hit and hit[1]==hit[3];assert not m.flag_bits&1 and 0<m.file_size<16000000
  kind,id=hit[3],hit[2];pairs.setdefault(id,set()).add(kind);b=z.read(m);rel='donald-trump-clipart/'+kind+'/'+id+'.'+kind;p=S/'extracted'/rel;p.parent.mkdir(parents=True,exist_ok=True)
  if p.exists():assert p.read_bytes()==b
  else:p.write_bytes(b)
  rows.append({'path':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
assert len(pairs)==100 and all(x=={'pdf','webp'}for x in pairs.values())
prior=S/'extraction.json';at=json.loads(prior.read_text())['extractedAt'] if prior.exists() else datetime.now(timezone.utc).isoformat()
for n,x in [('extraction.json',{'extractedAt':at,'archives':[{'topic':'donald-trump','source':P.name,'bytes':P.stat().st_size,'sha256':hashlib.sha256(P.read_bytes()).hexdigest(),'pairs':100}],'files':rows}),('topic-map.json',[{'topic':'donald-trump','folder':'donald-trump-clipart','pairs':100}]),('repair-hold.json',{'items':[]}),('incoming-only.json',[{'path':str(S/'extracted/donald-trump-clipart/webp'/(id+'.webp'))}for id in sorted(pairs)])]:
 (S/n).write_text(json.dumps(x,indent=2)+'\n')
(S/'contact').mkdir(exist_ok=True)
ids=sorted(pairs)
for start in range(0,100,10):
 sh=Image.new('RGB',(1600,1150),'#eef3fa');d=ImageDraw.Draw(sh)
 for i,id in enumerate(ids[start:start+10]):
  im=Image.open(S/'extracted/donald-trump-clipart/webp'/(id+'.webp')).convert('RGBA');im.thumbnail((308,490));x=i%5*320;y=i//5*575;sh.paste(im,(x+(320-im.width)//2,y+(490-im.height)//2),im)
  label=id.replace('donald-trump-','').replace('-clipart','');d.multiline_text((x+6,y+493),str(start+i+1)+': '+label.replace('-',' '),font=ImageFont.load_default(size=14),fill='#11294a')
 sh.save(S/'contact'/f'source-{start//10+1:02}.jpg',quality=95)
print(json.dumps({'status':'EXTRACTED_CRC_AND_SHA_VERIFIED','pairs':100,'sheets':10,'catalog':len(json.loads((R/'data/art.json').read_text()))}))
