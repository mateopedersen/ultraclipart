#!/usr/bin/env python3
"""Extract and hash the five nested owner ZIPs, then apply the reviewed pair checks."""
import hashlib, importlib.util, pathlib, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'work/imports/fruit-five-packs'
TOPICS='starfruit mulberry kumquat quince gooseberry'.split()
BUNDLE=STAGE/'owner-bundle.zip'
spec=importlib.util.spec_from_file_location('fruit_extraction',ROOT/'scripts/extract-fruit-expansion.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with zipfile.ZipFile(BUNDLE) as source:
    members=source.infolist()
    assert {m.filename for m in members}=={f'{t}-clipart-50-designs-100-files.zip' for t in TOPICS}
    assert len(members)==5 and not any(m.flag_bits&1 for m in members)
    STAGE.joinpath('archives').mkdir(parents=True,exist_ok=True)
    for m in members:
        data=source.read(m)
        assert 0<len(data)<150_000_000
        target=STAGE/'archives'/m.filename
        if target.exists():assert hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256(data).digest()
        else:target.write_bytes(data)
module.STAGE=STAGE;module.TOPICS=TOPICS
module.SOURCE_DIR=STAGE/'archives'
module.main()
