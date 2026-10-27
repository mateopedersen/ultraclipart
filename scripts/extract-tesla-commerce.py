"""Preserve, safely extract and inventory the owner's eleven 50-pair archives."""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import hashlib, json, re, shutil, stat, zipfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/tesla-commerce-550'
TOPICS = ['tesla-cybercab', 'cybercab', 'robotaxi', 'autonomous-taxi',
          'tesla-optimus', 'optimus-robot', 'robot-hand', 'black-friday',
          'cyber-monday', 'online-sale', 'online-shopping']
for name in ['archives', 'extracted', 'contact', 'references', 'review']:
    (STAGE / name).mkdir(parents=True, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
archives, files, mapping, incoming = [], [], [], []
for topic in TOPICS:
    source = Path('/Users/melihozcan/Downloads') / (topic + '-clipart-50-pdf-50-webp.zip')
    backup = STAGE / 'archives' / source.name
    body = source.read_bytes()
    if backup.exists(): assert sha(backup.read_bytes()) == sha(body), 'Changed archive'
    else: shutil.copy2(source, backup)
    pairs = {}
    with zipfile.ZipFile(backup) as archive:
        members = [m for m in archive.infolist() if not m.is_dir()]
        assert len(members) == 100 and len(set(m.filename for m in members)) == 100
        assert archive.testzip() is None
        for member in members:
            path = PurePosixPath(member.filename)
            assert not path.is_absolute() and '..' not in path.parts
            assert not stat.S_ISLNK(member.external_attr >> 16)
            hit = re.fullmatch(r'(pdf|webp)/([a-z0-9][a-z0-9-]+)\.(pdf|webp)', member.filename)
            assert hit and hit[1] == hit[3] and not member.flag_bits & 1
            assert 0 < member.file_size < 16_000_000
            kind, ident = hit[3], hit[2]
            pairs.setdefault(ident, set()).add(kind)
            content = archive.read(member)
            relative = Path(topic + '-clipart') / kind / (ident + '.' + kind)
            target = STAGE / 'extracted' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists(): assert sha(target.read_bytes()) == sha(content)
            else: target.write_bytes(content)
            files.append({'path': str(relative), 'bytes': len(content), 'sha256': sha(content)})
    assert len(pairs) == 50 and all(kinds == {'pdf', 'webp'} for kinds in pairs.values())
    ids = sorted(pairs)
    archives.append({'topic': topic, 'source': source.name, 'bytes': len(body), 'sha256': sha(body), 'pairs': 50})
    mapping.append({'topic': topic, 'folder': topic + '-clipart', 'pairs': 50, 'ids': ids})
    for ident in ids:
        incoming.append({'path': str(STAGE / 'extracted' / (topic + '-clipart') / 'webp' / (ident + '.webp'))})
    for start in range(0, 50, 25):
        sheet = Image.new('RGB', (2000, 2200), '#eef3fa')
        draw = ImageDraw.Draw(sheet)
        for index, ident in enumerate(ids[start:start+25]):
            with Image.open(STAGE / 'extracted' / (topic + '-clipart') / 'webp' / (ident + '.webp')) as image:
                image.load()
                rgba = image.convert('RGBA'); rgba.thumbnail((388, 388))
                x = index % 5 * 400; y = index // 5 * 440
                sheet.paste(rgba, (x + (400-rgba.width)//2, y + (392-rgba.height)//2), rgba)
                draw.text((x+180,y+399), str(start+index+1), font=ImageFont.load_default(size=25), fill='#11294a')
        sheet.save(STAGE / 'contact' / (topic + '-' + str(start//25+1) + '.jpg'), quality=96)
    print(json.dumps({'topic': topic, 'pairs': 50, 'status': 'EXTRACTED_SHA_AND_CRC_VERIFIED'}), flush=True)
previous = STAGE / 'extraction.json'
at = json.loads(previous.read_text())['extractedAt'] if previous.exists() else datetime.now(timezone.utc).isoformat()
for name, data in [('extraction.json', {'extractedAt': at, 'archives': archives, 'files': files, 'repairs': [], 'generated': []}),
                   ('topic-map.json', mapping), ('incoming-only.json', incoming), ('repair-hold.json', {'items': []})]:
    temporary = STAGE / (name + '.tmp'); temporary.write_text(json.dumps(data, indent=2) + '\n'); temporary.replace(STAGE/name)
assert len(incoming) == 550
