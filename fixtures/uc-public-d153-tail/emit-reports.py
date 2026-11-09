import pathlib, json, hashlib, io, zipfile, base64, re
root=pathlib.Path('public-source/reports/private-tail')
source=pathlib.Path('public-source')
for directory in [source,source/'reports',root]:
    if directory.exists():
        assert directory.is_dir() and not directory.is_symlink()
        assert directory.resolve().is_relative_to(source.resolve())
items=[]
if root.exists():
    for p in sorted(root.rglob('*')):
        if not p.is_file(): continue
        assert not p.is_symlink()
        name=str(p.relative_to(root))
        assert re.fullmatch(r'[A-Za-z0-9_./-]+',name) and '..' not in pathlib.PurePosixPath(name).parts
        if p.suffix not in ['.json','.log','.tsv']:continue
        b=p.read_bytes();assert len(b)<=10000000
        items.append((name,b))
manifest=pathlib.Path('fixtures/uc-public-d153-tail/manifest.json').read_bytes()
items.append(('overlay-manifest.json',manifest))
assert len(items)<=5000 and sum(len(b) for _,b in items)<=50000000
out=io.BytesIO()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name,b in items:z.writestr(name,b)
raw=out.getvalue();assert len(raw)<=5000000
meta={'schema':1,'publicSource':'d153c5b5e811f5cc367e193adfa843fbf1af9c18','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'files':[{'path':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in items],'scope':'Byte-verifiable diagnostic reports in workflow logs; no artifact quota dependency. Test failure statuses remain failures.'}
print('UC_PUBLIC_TAIL_REPORT_BUNDLE_BEGIN '+json.dumps(meta,separators=(',',':')))
encoded=base64.b64encode(raw).decode()
for i in range(0,len(encoded),120):print(encoded[i:i+120])
print('UC_PUBLIC_TAIL_REPORT_BUNDLE_END')
