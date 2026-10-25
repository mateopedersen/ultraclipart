#!/usr/bin/env python3
"""Check supplied WebPs against the catalog by file bytes and visible RGBA pixels."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--stage', required=True)
args = parser.parse_args()
stage = (ROOT / args.stage).resolve()
if not stage.is_relative_to(ROOT / 'work' / 'imports'):
    raise ValueError('The reviewed package must remain in work/imports')
baseline_bytes = (ROOT / 'data/art.json').read_bytes()
baseline = json.loads(baseline_bytes)
source_files = sorted((stage / 'extracted').glob('*/webp/*.webp'))
expected = sum(topic['pairs'] for topic in json.loads((stage / 'topic-map.json').read_text()))
if len(source_files) != expected:
    raise ValueError('The extracted WebP count differs from the reviewed topic map')
rows = [(item['id'], ROOT / 'public' / item['webp'].lstrip('/'), False) for item in baseline]
rows += [(file.stem, file, True) for file in source_files]


def digest(row):
    identity, path, supplied = row
    data = path.read_bytes()
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
        # Invisible RGB paint must not hide an otherwise identical cutout.
        invisible = rgba.getchannel('A').point(lambda alpha: 255 if alpha == 0 else 0)
        rgba.paste((0, 0, 0, 0), mask=invisible)
        pixels = str(rgba.size).encode() + rgba.tobytes()
    return {
        'id': identity,
        'new': supplied,
        'sha256': hashlib.sha256(data).hexdigest(),
        'pixels': hashlib.sha256(pixels).hexdigest(),
    }


seen, collisions, checked = {}, [], []
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for row in pool.map(digest, rows):
        for kind in ['sha256', 'pixels']:
            key = (kind, row[kind])
            prior = seen.get(key)
            if prior and (row['new'] or prior['new']):
                collisions.append({'kind': kind, 'first': prior['id'], 'second': row['id']})
            else:
                seen[key] = row
        checked.append(row)
report = {
    'status': 'PASS' if not collisions else 'REVIEW_REQUIRED',
    'algorithm': 'SHA-256 of file bytes and decoded RGBA with invisible RGB zeroed',
    'baselineCatalogSha256': hashlib.sha256(baseline_bytes).hexdigest(),
    'baseline': len(baseline),
    'new': expected,
    'collisions': collisions,
    'rows': checked,
}
output = stage / 'duplicate-review.json'
output.with_suffix('.tmp').write_text(json.dumps(report, indent=2) + '\n')
output.with_suffix('.tmp').replace(output)
print(json.dumps({key: value for key, value in report.items() if key != 'rows'}))
if collisions:
    raise SystemExit(1)
