#!/usr/bin/env python3
"""Stage and checksum all 19 owner archives; accept only paired PDF/WebP collections."""
import hashlib, importlib.util, json, pathlib, re, shutil, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/remaining-thirty-one'
SOURCE = pathlib.Path.home() / 'Downloads'
DIRECT = 'american-flag france-flag spain-flag spain france paris chicago tesla shoe exercise cheese train new-york candy happy-birthday'.split()
PARTS = {1: 'clock airplane mars mexico-flag'.split(), 2: 'math glove mom wave'.split(), 3: 'thank-you miami thermometer iphone'.split(), 4: 'samsung los-angeles moon grass'.split()}
NAMES = [f'{t}-clipart-50-pdf-50-webp.zip' for t in DIRECT] + [f'ultraclipart-remaining-31-sets-part-{n:02}.zip' for n in PARTS]
STAGE.joinpath('archives').mkdir(parents=True, exist_ok=True)
STAGE.joinpath('owner-archives').mkdir(exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
owners, sources = [], {}
for name in NAMES:
    source = SOURCE / name
    backup = STAGE / 'owner-archives' / name
    if backup.exists():
        if source.exists(): assert sha(source) == sha(backup), 'Source replaced: '+name
    else: shutil.copyfile(source, backup)
    owners.append(dict(source=name, bytes=backup.stat().st_size, sha256=sha(backup)))
    part = re.fullmatch(r'ultraclipart-remaining-31-sets-part-(\d\d)\.zip', name)
    with zipfile.ZipFile(backup) as z:
        if part:
            expected = {f'{t}-clipart-50-pdf-50-webp.zip' for t in PARTS[int(part[1])]}
            assert {m.filename for m in z.infolist()} == expected
            for member in z.infolist():
                assert not member.flag_bits & 1 and 0 < member.file_size < 200_000_000
                body = z.read(member)
                topic = member.filename.removesuffix('-clipart-50-pdf-50-webp.zip')
                target = STAGE / 'archives' / f'{topic}-clipart-50-designs-100-files.zip'
                if target.exists(): assert hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(body).digest()
                else: target.write_bytes(body)
                assert topic not in sources
                sources[topic] = dict(owner=name, member=member.filename)
        else:
            topic = name.removesuffix('-clipart-50-pdf-50-webp.zip')
            target = STAGE / 'archives' / f'{topic}-clipart-50-designs-100-files.zip'
            if target.exists(): assert sha(target) == sha(backup)
            else: shutil.copyfile(backup, target)
            assert topic not in sources
            sources[topic] = dict(owner=name)
# Keep related sets adjacent; each collection is a complete, separately reviewed 50-design wave.
order = 'american-flag france-flag spain-flag mexico-flag france spain paris new-york chicago miami los-angeles clock airplane mars math glove mom wave thank-you thermometer iphone samsung moon grass tesla shoe exercise cheese train candy happy-birthday'.split()
assert set(order) == set(sources) and len(order) == 31
spec = importlib.util.spec_from_file_location('supplied_extraction', ROOT/'scripts/extract-fruit-expansion.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
module.STAGE = STAGE; module.SOURCE_DIR = STAGE/'archives'; module.TOPICS = order; module.main()
p = STAGE/'extraction.json'; manifest = json.loads(p.read_text()); manifest['ownerArchives'] = owners
for archive in manifest['archives']: archive['source'] = sources[archive['topic']]
p.write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(dict(ownerArchives=len(owners), collections=len(order), designs=len(order)*50)))
