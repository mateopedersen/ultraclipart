#!/usr/bin/env python3
"""Extract the school package and reconstruct only its five empty WebPs from their PDFs."""
import hashlib, json, os, pathlib, re, subprocess, zipfile
from datetime import datetime, timezone

import numpy as np
from PIL import Image
from pypdf import PdfReader
from raster_source import decoded_alpha

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/school'
SOURCE = STAGE / 'source.zip'

def sha(data): return hashlib.sha256(data).hexdigest()

with zipfile.ZipFile(SOURCE) as archive:
    files = [member for member in archive.infolist() if not member.is_dir()]
    assert len(files) == 100 and len({member.filename for member in files}) == 100
    assert sum(member.file_size for member in files) < 150_000_000
    pairs, zero = {}, []
    for member in files:
        match = re.fullmatch(r'school-clipart/(PDF|WEBP)/(school-[a-z0-9-]+-clipart)\.(pdf|webp)', member.filename)
        assert match and match[1].lower() == match[3]
        assert not member.flag_bits & 1 and 0 <= member.file_size < 16_000_000
        kind, art_id = match[3], match[2]
        pairs.setdefault(art_id, set()).add(kind)
        body = archive.read(member)
        if not body:
            assert kind == 'webp'
            zero.append(art_id)
            continue
        path = pathlib.Path('school-clipart') / kind / f'{art_id}.{kind}'
        target = STAGE / 'extracted' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
assert len(pairs) == 50 and all(kinds == {'pdf', 'webp'} for kinds in pairs.values())
assert len(zero) == 5 and len(set(zero)) == 5

repairs = []
repair_reasons = {art_id: 'Owner ZIP contains a zero-byte WebP' for art_id in zero}
for art_id in sorted(pairs):
    if art_id in repair_reasons: continue
    pdf = STAGE / 'extracted/school-clipart/pdf' / f'{art_id}.pdf'
    webp = STAGE / 'extracted/school-clipart/webp' / f'{art_id}.webp'
    page = PdfReader(pdf, strict=True).pages[0]
    images = [ref.get_object() for ref in page['/Resources']['/XObject'].values()
              if ref.get_object().get('/Subtype') == '/Image']
    assert len(images) == 1 and '/SMask' in images[0]
    with Image.open(webp) as image:
        image.load()
        if image.getchannel('A').tobytes() != decoded_alpha(images[0]['/SMask'].get_object()):
            repair_reasons[art_id] = 'Owner WebP transparency differs from matching PDF mask'
assert len(repair_reasons) == 6

for art_id in sorted(repair_reasons):
    pdf = STAGE / 'extracted/school-clipart/pdf' / f'{art_id}.pdf'
    target = STAGE / 'extracted/school-clipart/webp' / f'{art_id}.webp'
    reader = PdfReader(pdf, strict=True)
    assert len(reader.pages) == 1
    images = [ref.get_object() for ref in reader.pages[0]['/Resources']['/XObject'].values()
              if ref.get_object().get('/Subtype') == '/Image']
    assert len(images) == 1 and '/SMask' in images[0]
    image = images[0]
    width, height = int(image['/Width']), int(image['/Height'])
    assert (width, height) == (1500, 1500)
    alpha = np.frombuffer(decoded_alpha(image['/SMask'].get_object()), dtype=np.uint8).reshape(height, width)
    render_path = STAGE / f'{art_id}-pdf-render.png'
    subprocess.run([os.environ['PDFTOPPM_BIN'], '-f', '1', '-singlefile', '-scale-to', str(width),
                    '-png', str(pdf), str(render_path.with_suffix(''))], check=True, capture_output=True, timeout=90)
    with Image.open(render_path) as rendered:
        rendered.load()
        assert rendered.size == (width, height)
        rgb = np.asarray(rendered.convert('RGB'), dtype=np.float32)
    opacity = alpha.astype(np.float32) / 255
    recovered = np.zeros((height, width, 4), dtype=np.uint8)
    visible = opacity > .02
    recovered[visible, :3] = np.clip(np.rint((rgb[visible] - (1 - opacity[visible, None]) * 255) /
                                                  opacity[visible, None]), 0, 255).astype(np.uint8)
    recovered[:, :, 3] = alpha
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(recovered, 'RGBA').save(target, 'WEBP', lossless=True, method=6)
    with Image.open(target) as check:
        check.load()
        assert check.format == 'WEBP' and check.mode == 'RGBA' and check.size == (width, height)
        assert check.getchannel('A').tobytes() == alpha.tobytes()
        composed = Image.new('RGBA', check.size, 'white')
        composed.alpha_composite(check)
        visual_error = np.abs(np.asarray(composed.convert('RGB'), dtype=np.float32) - rgb).mean()
        assert visual_error < 3, (art_id, visual_error)
    repairs.append({'id': art_id, 'reason': repair_reasons[art_id],
                    'sourcePdfSha256': sha(pdf.read_bytes()), 'repairedWebpSha256': sha(target.read_bytes()),
                    'renderCompositeMeanDifference': round(float(visual_error), 3),
                    'method': 'Native-size Poppler PDF render; original PDF alpha mask; lossless WebP'})
    render_path.unlink()

records = []
for art_id in sorted(pairs):
    for kind in ('pdf', 'webp'):
        path = pathlib.Path('school-clipart') / kind / f'{art_id}.{kind}'
        body = (STAGE / 'extracted' / path).read_bytes()
        assert body
        records.append({'path': str(path), 'bytes': len(body), 'sha256': sha(body)})
prior = STAGE / 'extraction.json'
timestamp = json.loads(prior.read_text())['extractedAt'] if prior.exists() else datetime.now(timezone.utc).isoformat()
for name, value in [
    ('topic-map.json', [{'topic': 'school', 'folder': 'school-clipart', 'pairs': 50}]),
    ('extraction.json', {'extractedAt': timestamp,
                         'archives': [{'topic': 'school', 'source': SOURCE.name, 'bytes': SOURCE.stat().st_size,
                                       'sha256': sha(SOURCE.read_bytes()), 'pairs': 50}],
                         'files': records, 'repairs': repairs}),
    ('repair-hold.json', {'items': []}),
]:
    (STAGE / name).write_text(json.dumps(value, indent=2) + '\n')
print(json.dumps({'topic': 'school', 'pairs': len(pairs), 'files': len(records),
                  'reconstructedWebp': len(repairs), 'bytes': sum(x['bytes'] for x in records),
                  'status': 'EXTRACTED_CRC_HASH_AND_PDF_REPAIR_VERIFIED'}))
