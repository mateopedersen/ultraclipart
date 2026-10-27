"""Compare supplied source pixels with concurrently accepted catalog additions."""
import concurrent.futures, hashlib, json, pathlib, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'work/imports/tesla-commerce-550'
previous_path = STAGE / 'concurrent-delta-review.json'
previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
accepted = {}
for decision in previous.get('decisions', []):
    if decision.get('status') != 'DISTINCT_COMPOSITION' or not decision.get('reviewedFromActualPairSheet') or not decision.get('observedDifference'):
        continue
    candidate = previous['candidates'][decision['index']]
    if decision.get('sourceSha256s') == candidate.get('sourceSha256s'):
        accepted[(candidate['a'], candidate['b'], *candidate['sourceSha256s'])] = decision
baseline = json.loads(subprocess.check_output(['git', 'show', '8e5ecc2:data/art.json'], cwd=ROOT))
prior = {x['id']: x for x in baseline}
current = json.loads((ROOT / 'data/art.json').read_text())
for item in current:
    if item['id'] in prior:
        assert item['files']['webp']['sha256'] == prior[item['id']]['files']['webp']['sha256'], 'Replaced baseline image requires fresh comparison'
new = [x for x in current if x['id'] not in prior]
x = np.arange(32)
dct = np.cos(np.pi * (x[None, :] + .5) * x[:, None] / 32)
def feature(p):
    with Image.open(p) as original:
        image = original.convert('RGBA')
    image = image.crop(image.getchannel('A').getbbox())
    background = Image.new('RGBA', image.size, 'white'); background.alpha_composite(image)
    coefficients = (dct @ np.asarray(background.convert('L').resize((32, 32)), dtype=float) @ dct.T)[:8, :8]
    return coefficients > np.median(coefficients.flatten()[1:])
features = [(item, feature(ROOT / 'public' / item['webp'].lstrip('/'))) for item in new]
pairs = []
for row in json.loads((STAGE / 'incoming-only.json').read_text()):
    source = pathlib.Path(row['path']); incoming = feature(source)
    for item, existing in features:
        distance = int(np.count_nonzero(incoming != existing))
        if distance <= 10:
            target = ROOT / 'public' / item['webp'].lstrip('/')
            pairs.append(dict(a=source.stem, b=item['id'], distance=distance, paths=[str(source), str(target)], sourceSha256s=[hashlib.sha256(source.read_bytes()).hexdigest(), item['files']['webp']['sha256']]))
decisions = []
for index, candidate in enumerate(pairs):
    decision = accepted.get((candidate['a'], candidate['b'], *candidate['sourceSha256s']))
    if decision:
        decisions.append({**decision, 'index': index})
report = dict(baselineAdded=len(new), unchangedAcceptedSources=len(prior), baselineCatalogSha256=hashlib.sha256((ROOT/'data/art.json').read_bytes()).hexdigest(), candidates=pairs, decisions=decisions, pendingCandidates=len(pairs)-len(decisions), status='PASS' if len(decisions)==len(pairs) else 'PENDING')
(STAGE / 'concurrent-delta-review.json').write_text(json.dumps(report, indent=2) + '\n')
for start in range(0, len(pairs), 8):
    sheet = Image.new('RGB', (1200, 190 * 8), 'white'); draw = ImageDraw.Draw(sheet)
    for index, pair in enumerate(pairs[start:start+8]):
        for column, name in enumerate(pair['paths']):
            image = Image.open(name).convert('RGBA'); image.thumbnail((250, 165))
            sheet.paste(image, (column*600, index*190), image)
            draw.text((column*600+255, index*190), str(start+index)+': '+pair['a' if column == 0 else 'b'][:45], font=ImageFont.load_default(size=11), fill='black')
    sheet.save(STAGE / 'contact' / f'concurrent-delta-{start//8+1}.jpg')
print(json.dumps({key:value for key,value in report.items() if key not in ('candidates', 'decisions')}), flush=True)
