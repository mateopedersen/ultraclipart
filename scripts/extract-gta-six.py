#!/usr/bin/env python3
"""Checksum and stage six owner-supplied GTA archives without changing originals."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/gta-six'
TOPICS = 'gta-6-jason gta-6-map gta-6-lucia grand-theft-auto gta-vi gta-6'.split()
STAGE.joinpath('archives').mkdir(parents=True, exist_ok=True)
for topic in TOPICS:
    source = Path.home() / 'Downloads' / f'{topic}-clipart-50-pdf-50-webp.zip'
    target = STAGE / 'archives' / f'{topic}-clipart-50-designs-100-files.zip'
    if target.exists():
        if source.exists():
            assert hashlib.sha256(source.read_bytes()).digest() == hashlib.sha256(target.read_bytes()).digest(), 'Owner archive changed'
    else:
        shutil.copyfile(source, target)
spec = importlib.util.spec_from_file_location('supplied_extraction', ROOT / 'scripts/extract-fruit-expansion.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.STAGE, module.SOURCE_DIR, module.TOPICS = STAGE, STAGE / 'archives', TOPICS
module.main()
path = STAGE / 'extraction.json'
manifest = json.loads(path.read_text())
for archive in manifest['archives']:
    archive['ownerSource'] = archive['topic'] + '-clipart-50-pdf-50-webp.zip'
path.write_text(json.dumps(manifest, indent=2) + '\n')
