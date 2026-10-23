#!/usr/bin/env python3
"""Resumable, unpublished vector production with independently checked downloads.

Nothing in this command writes the live catalog or uploads to R2. A valid
journal row requires source, SVG, PDF, WebP and thumbnail hashes to agree.
Run again after interruption: completed matching rows are reused. Changes to
any generator, exporter or ICC profile invalidate that row automatically.
"""
import argparse, fcntl, hashlib, importlib.util, itertools, json, os, re, shutil, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/waves'))
spec = importlib.util.spec_from_file_location('exporter', ROOT / 'scripts/art-export.py')
exporter = importlib.util.module_from_spec(spec); spec.loader.exec_module(exporter)
sha = lambda body: hashlib.sha256(body).hexdigest()
def file_hash(path): return sha(path.read_bytes())
def atomic_json(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n'); temp.replace(path)

def check_files(paths):
    layers = [node for node in exporter.validate_svg(paths['svg'].read_text()) if node.tag.endswith('g')]
    assert len(layers) >= 6, 'At least six meaningful named editable layers required'
    measurements = {'layers': len(layers), 'layerLabels': [node.get('data-label') for node in layers]}
    for kind, size in [('webp', 2048), ('thumb', 440)]:
        with Image.open(paths[kind]) as image:
            image.load()
            assert image.format == 'WEBP' and image.size == (size, size) and 'A' in image.getbands()
            alpha = image.getchannel('A'); bounds = alpha.getbbox()
            assert alpha.getextrema() == (0, 255), 'Transparency was lost'
            assert bounds and min(bounds) > 0 and max(bounds) < size, 'Artwork clips the canvas edge'
            measurements[kind] = {'width': size, 'height': size, 'alphaBounds': bounds}
    pdf = PdfReader(paths['pdf'], strict=True)
    assert len(pdf.pages) == 1
    page = pdf.pages[0]; stream = page.get_contents().get_data()
    assert list(map(float, page.mediabox)) == [0, 0, 612, 792]
    assert re.search(rb'\d(?:\.\d+)?\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[kK](?:\s|$)', stream), 'Missing actual CMYK paint'
    assert not re.search(rb'\s(?:rg|RG)(?:\s|$)', stream), 'Unexpected RGB paint'
    assert not list(page.images), 'PDF must remain vector artwork'
    assert paths['pdf'].stat().st_size <= 1_000_000
    intent = pdf.trailer['/Root'].get('/OutputIntents')
    assert intent and str(intent[0].get_object()['/OutputConditionIdentifier']) == 'CGATS TR 006'
    measurements['pdf'] = {'bytes': paths['pdf'].stat().st_size, 'processCMYK': True,
                           'rasterImages': 0, 'profileEmbedded': False, 'pdfXCertified': False}
    return measurements

def optimize_pdf(path):
    original = path.read_bytes()
    before_stream = PdfReader(path).pages[0].get_contents().get_data()
    writer = PdfWriter(); writer.clone_document_from_reader(PdfReader(path))
    for page in writer.pages: page.compress_content_streams(level=9)
    candidate = path.with_suffix('.optimized.pdf')
    with candidate.open('wb') as out: writer.write(out)
    after_stream = PdfReader(candidate).pages[0].get_contents().get_data()
    assert before_stream == after_stream, 'Compression changed vector drawing instructions'
    size = candidate.stat().st_size
    if size < len(original): candidate.replace(path)
    else: candidate.unlink()
    return {'originalBytes': len(original), 'candidateBytes': size, 'selectedBytes': path.stat().st_size,
            'decodedVectorCommandsEqual': True}

def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--wave', default='wave_001', choices=[p.stem for p in (ROOT/'scripts/waves').glob('wave_[0-9][0-9][0-9].py')])
    cli.add_argument('--limit', type=int, default=50)
    args = cli.parse_args()
    if not 1 <= args.limit <= 50: raise ValueError('Each production wave is limited to 50 drawings')
    mod = importlib.import_module(args.wave); art = mod.ART
    topics = {t['slug'] for t in json.loads((ROOT / 'data/topics.json').read_text())['topics']}
    assert len({item['id'] for item in art}) == len(art)
    assert all(item['topic'] in topics for item in art)
    assert len(art) <= 50
    stage = ROOT / 'work/production' / args.wave; stage.mkdir(parents=True, exist_ok=True)
    lock = (stage / '.production.lock').open('a')
    try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError: raise RuntimeError(f'This wave already has an active production process: {args.wave}')
    journal_path = stage / 'journal.json'
    journal = json.loads(journal_path.read_text()) if journal_path.exists() else {'schema': 1, 'wave': args.wave, 'artworks': {}}
    inputs = [Path(__file__), ROOT / f'scripts/waves/{args.wave}.py', ROOT / 'scripts/waves/vector.py',
              ROOT / 'scripts/waves/raster.mjs', ROOT / 'scripts/art-export.py', ROOT / 'public/color/print.icc']
    signature = sha(b''.join(path.read_bytes() for path in inputs))
    node = os.environ.get('NODE_BIN') or shutil.which('node')
    if not node: raise RuntimeError('Node.js required')
    completed = []; resumed = 0
    for item in art[:args.limit]:
        art_id = item['id']; paths = {kind: stage / f'{art_id}{suffix}' for kind, suffix in [('svg','.svg'),('pdf','.pdf'),('webp','.webp'),('thumb','-thumb.webp')]}
        previous = journal['artworks'].get(art_id, {})
        reusable = previous.get('generatorSha256') == signature and all(path.exists() and previous.get('files', {}).get(kind, {}).get('sha256') == file_hash(path) for kind, path in paths.items())
        if reusable:
            check_files(paths); resumed += 1
            print(f'RESUMED {art_id}', flush=True)
        else:
            paths['svg'].write_text(item['source'])
            exporter.validate_svg(item['source'])
            exporter.pdf_export(paths['svg'], paths['pdf'], item['title'])
            pdf_optimization = optimize_pdf(paths['pdf'])
            run = subprocess.run([node, str(ROOT / 'scripts/waves/raster.mjs'), str(paths['svg']), str(paths['webp']), str(paths['thumb'])], capture_output=True, text=True, check=True)
            raster = json.loads(run.stdout)
            measurements = check_files(paths)
            journal['artworks'][art_id] = {key: value for key, value in item.items() if key != 'source'} | {
                'state': 'FORMAT_PREFLIGHT_PASSED', 'generatorSha256': signature,
                'files': {kind: {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': file_hash(path)} for kind, path in paths.items()},
                'checks': measurements, 'optimization': {'pdf': pdf_optimization, 'webp': raster},
                'provenance': 'Original vector drawing, AI-assisted; no stock artwork or tracing.',
                'ownerReview': 'PENDING', 'visualReview': 'PENDING', 'published': False, 'indexable': False}
            atomic_json(journal_path, journal)
            print(f'CREATED {art_id} / {len(measurements["layerLabels"])} layers / PDF {paths["pdf"].stat().st_size} bytes', flush=True)
        completed.append(journal['artworks'][art_id])
    # Exact geometry duplicates and near-identical silhouettes are separate checks.
    flags = []; shapes = []
    for item in completed:
        with Image.open(ROOT / item['files']['webp']['path']) as image:
            shapes.append((item['id'], [value > 96 for value in image.getchannel('A').resize((64,64)).get_flattened_data()]))
    for (id1, a), (id2, b) in itertools.combinations(shapes,2):
        union = sum(x or y for x,y in zip(a,b)); score = sum(x and y for x,y in zip(a,b)) / union if union else 1
        if score > .88: flags.append({'a':id1,'b':id2,'silhouetteIoU':round(score,4),'status':'REVIEW_REQUIRED'})
    assert len({row['files']['svg']['sha256'] for row in completed}) == len(completed), 'Exact duplicate SVG'
    geometry_keys = {'d','cx','cy','rx','ry','r','x','y','width','height','points','transform'}
    def geometry_hash(source):
        root = exporter.validate_svg(source)
        rows = [(node.tag.split('}')[-1], sorted((key,value) for key,value in node.attrib.items() if key in geometry_keys))
                for node in root.iter() if node.tag.split('}')[-1] not in ('title','desc','svg')]
        return sha(json.dumps(rows, sort_keys=True).encode())
    known = {geometry_hash(path.read_text()): path.stem for path in (ROOT / 'assets/masters').glob('*.svg')}
    for row in completed:
        geometry = geometry_hash((ROOT / row['files']['svg']['path']).read_text())
        assert geometry not in known, f'Geometry-only duplicate: {row["id"]} and {known.get(geometry)}'
        known[geometry] = row['id']; row['geometrySha256'] = geometry
    report = {'schema': 1, 'wave': args.wave, 'actualExportedDrawings': len(completed), 'resumed': resumed,
              'topics': sorted({row['topic'] for row in completed}), 'totalBytes': sum(f['bytes'] for row in completed for f in row['files'].values()),
              'maxPdfBytes': max(row['files']['pdf']['bytes'] for row in completed), 'silhouetteReviewFlags': flags,
              'publishedDrawings': 0, 'ownerApprovedDrawings': 0, 'artworks': completed,
              'limitations': ['Automated checks do not prove artistic originality.', 'Human review and physical print proofs pending.', 'ICC registered output condition referenced; not PDF/X certified.']}
    atomic_json(stage / 'report.json', report)
    # SVG screen contact sheet. PDF proofs are independently rendered by Poppler.
    font = ImageFont.load_default(size=13)
    sheet = Image.new('RGB', (1000, math_ceil(len(completed) / 4) * 260), '#F5F2E9'); draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(completed):
        x, y = i%4*250, i//4*260
        with Image.open(ROOT / row['files']['thumb']['path']) as image:
            image.thumbnail((224,224)); sheet.paste(image,(x+(250-image.width)//2,y+4),image)
        draw.text((x+10,y+232), f'{i+1:02d} {row["title"][:31]}',font=font,fill='#394337')
    sheet.save(stage / 'contact-sheet.png')
    print(json.dumps({key:value for key,value in report.items() if key != 'artworks'},indent=2))

def math_ceil(number):
    return int(-(-number // 1))

if __name__ == '__main__': main()
