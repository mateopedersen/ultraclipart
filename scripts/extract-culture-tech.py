"""Validate and preserve the 25 supplied culture/technology ZIPs before review."""
from pathlib import Path
import hashlib,json,re,shutil,zipfile
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'work/imports/culture-tech-25'
TOPICS='red-and-blue-states democrat-donkey republican-elephant political-debate godzilla giant-monster kaiju godzilla-minus-zero sunrise-on-the-reaping hunger-games game-awards magic-spell disney-hexed hexed mockingjay gaming-trophy smart-home smart-glasses sonic-4 sonic-birthday sonic sonic-the-hedgehog angry-birds-3 angry-birds-movie angry-birds'.split()
COUNTS={'disney-hexed':36,'hexed':48,'mockingjay':48}
def main():
    STAGE.mkdir(parents=True,exist_ok=True);(STAGE/'archives').mkdir(exist_ok=True)
    rows=[];archives=[];mapping=[];seen=set()
    for topic in TOPICS:
        count=COUNTS.get(topic,50);partial='-partial' if topic in COUNTS else ''
        original=Path.home()/'Downloads'/f'{topic}-clipart-{count}-designs{partial}.zip'
        backup=STAGE/'archives'/original.name
        digest=hashlib.sha256(original.read_bytes()).hexdigest()
        if backup.exists():assert hashlib.sha256(backup.read_bytes()).hexdigest()==digest,'Archive backup changed'
        else:shutil.copy2(original,backup)
        with zipfile.ZipFile(backup) as z:
            members=z.infolist();assert len(members)==count*2
            assert len(set(x.filename for x in members))==len(members)
            assert sum(x.file_size for x in members)<250_000_000
            pairs={}
            for member in members:
                m=re.fullmatch(r'(pdf|webp)/([a-z0-9-]+)\.(pdf|webp)',member.filename)
                assert m and m[1]==m[3] and m[2].startswith(topic+'-')
                assert not member.flag_bits&1 and 0<member.file_size<16_000_000
                pairs.setdefault(m[2],set()).add(m[1])
            assert len(pairs)==count and all(x=={'pdf','webp'} for x in pairs.values())
            assert not seen.intersection(pairs);seen.update(pairs)
            for member in members:
                body=z.read(member);relative=f'{topic}-clipart/{member.filename}';target=STAGE/'extracted'/relative
                target.parent.mkdir(parents=True,exist_ok=True);h=hashlib.sha256(body).hexdigest()
                if target.exists():assert hashlib.sha256(target.read_bytes()).hexdigest()==h
                else:target.write_bytes(body)
                rows.append({'path':relative,'bytes':len(body),'sha256':h})
        archives.append({'topic':topic,'source':original.name,'bytes':original.stat().st_size,'sha256':digest,'pairs':count})
        mapping.append({'topic':topic,'folder':topic+'-clipart','pairs':count})
        print(json.dumps({'topic':topic,'pairs':count,'status':'CRC_AND_SHA_VERIFIED'}),flush=True)
    prior=STAGE/'extraction.json';at=json.loads(prior.read_text())['extractedAt'] if prior.exists() else datetime.now(timezone.utc).isoformat()
    for name,obj in [('extraction.json',{'extractedAt':at,'archives':archives,'files':rows}),('topic-map.json',mapping),('repair-hold.json',{'items':[]})]:
        (STAGE/name).write_text(json.dumps(obj,indent=2)+'\n')
    assert len(seen)==1232
if __name__=='__main__':main()
