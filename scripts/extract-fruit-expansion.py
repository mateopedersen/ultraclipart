"""Read the 29 owner-supplied archives without modifying their original media."""
import hashlib, json, pathlib, re, zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/fruit-expansion-29'
TOPICS = 'green-apple blackberry persimmon guava red-apple pineapple lychee nectarine dragon-fruit date pomegranate melon papaya blackcurrant plum passion-fruit cranberry apricot fig lemon cantaloupe cherry lime grapefruit mango grapes peach pear watermelon'.split()

def main():
    STAGE.mkdir(parents=True, exist_ok=True)
    records, archives, mapping, ids = [], [], [], set()
    for topic in TOPICS:
        source = pathlib.Path('/Users/melihozcan/Downloads') / f'{topic}-clipart-50-designs-100-files.zip'
        with zipfile.ZipFile(source) as package:
            members = package.infolist()
            assert len(members) == 100 and len(set(m.filename for m in members)) == 100
            assert sum(m.file_size for m in members) < 200_000_000
            expected = {}
            for m in members:
                match = re.fullmatch(r'(pdf|webp)/([a-z0-9-]+)\.(pdf|webp)', m.filename)
                assert match and match[1] == match[3] and match[2].startswith(topic+'-')
                assert not m.flag_bits & 1 and m.file_size > 0 and m.file_size < 16_000_000
                expected.setdefault(match[2], set()).add(match[1])
            assert len(expected) == 50 and all(k == {'webp','pdf'} for k in expected.values())
            assert not ids.intersection(expected), 'Repeated artwork identity across packages'
            ids.update(expected)
            for m in members:
                body = package.read(m)  # zipfile verifies CRC before accepting a member.
                relative = f'{topic}-clipart/{m.filename}'
                target = STAGE/'extracted'/relative
                target.parent.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256(body).hexdigest()
                if target.exists(): assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
                else: target.write_bytes(body)
                records.append({'path':relative,'bytes':len(body),'sha256':digest})
            archives.append({'topic':topic,'source':source.name,'bytes':source.stat().st_size,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'pairs':50})
            mapping.append({'topic':topic,'folder':topic+'-clipart','pairs':50})
            print(json.dumps({'topic':topic,'pairs':50,'status':'EXTRACTED_CRC_AND_HASH_VERIFIED'}),flush=True)
    prior = STAGE/'extraction.json'
    timestamp = json.loads(prior.read_text())['extractedAt'] if prior.exists() else datetime.now(timezone.utc).isoformat()
    for name,value in [('topic-map.json',mapping),('extraction.json',{'extractedAt':timestamp,'archives':archives,'files':records}),('repair-hold.json',{'items':[]})]:
        (STAGE/name).write_text(json.dumps(value,indent=2)+'\n')
    print(json.dumps({'archives':len(archives),'artworks':len(ids),'files':len(records),'bytes':sum(x['bytes'] for x in records)}))

if __name__ == '__main__': main()
