#!/usr/bin/env python3
"""Safely stage the owner's two nested ZIP packs and retain their original bytes."""
import hashlib
import importlib.util
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/active-eight'
PARTS = [
    ('clipart-8-active-topics-part-01-money-to-girl-250-pdf-250-webp.zip', 'money music beach boy girl'.split()),
    ('clipart-8-active-topics-part-02-pizza-to-movie-150-pdf-150-webp.zip', 'pizza cookie movie'.split()),
]
STAGE.joinpath('archives').mkdir(parents=True, exist_ok=True)
for index, (name, topics) in enumerate(PARTS, 1):
    source = pathlib.Path('/Users/melihozcan/Downloads') / name
    backup = STAGE / f'owner-part-{index:02}.zip'
    if backup.exists():
        if source.exists():
            assert hashlib.sha256(source.read_bytes()).digest() == hashlib.sha256(backup.read_bytes()).digest()
    else:
        shutil.copyfile(source, backup)
    with zipfile.ZipFile(backup) as archive:
        members = archive.infolist()
        assert len(members) == len(topics)
        assert {m.filename for m in members} == {f'{t}-clipart-50-designs-100-files.zip' for t in topics}
        assert not any(m.flag_bits & 1 for m in members)
        for member in members:
            assert 0 < member.file_size < 200_000_000
            body = archive.read(member)
            destination = STAGE / 'archives' / member.filename
            if destination.exists():
                assert hashlib.sha256(destination.read_bytes()).digest() == hashlib.sha256(body).digest()
            else:
                destination.write_bytes(body)

spec = importlib.util.spec_from_file_location('supplied_extraction', ROOT / 'scripts/extract-fruit-expansion.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.STAGE = STAGE
module.TOPICS = [topic for _, topics in PARTS for topic in topics]
module.SOURCE_DIR = STAGE / 'archives'
module.main()
