import pathlib,json,hashlib,sys,subprocess,shutil
target=pathlib.Path(sys.argv[1]).resolve();packet=pathlib.Path(sys.argv[2]).resolve()
manifest=json.loads((packet/'manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert subprocess.check_output(['git','-C',str(target),'rev-parse','HEAD'],text=True).strip()==manifest['publicSource']
assert subprocess.check_output(['git','-C',str(target),'rev-parse','HEAD^{tree}'],text=True).strip()==manifest['publicTree']
verify_only='--verify-only' in sys.argv
for row in manifest['files']:
    name=pathlib.PurePosixPath(row['path']);assert not name.is_absolute() and '..' not in name.parts
    src=packet/'overlay'/name;dst=target/name
    assert src.is_file() and not src.is_symlink() and src.stat().st_size==row['bytes'] and sha(src)==row['sha256']
    if not verify_only:
        if row['beforeSHA256'] is None:assert not dst.exists()
        else:assert dst.is_file() and sha(dst)==row['beforeSHA256']
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
    assert dst.is_file() and dst.stat().st_size==row['bytes'] and sha(dst)==row['sha256']
config=target/'astro.config.mjs'
adapter=manifest['buildAdapter']
if not verify_only:
    assert sha(config)==adapter['beforeSHA256']
    content=config.read_text()
    anchor="import { defineConfig } from 'astro/config';"
    marker="  integrations: ["
    assert content.count(anchor)==content.count(marker)==1
    content=content.replace(anchor,anchor+"\nimport { fixturePublicAssets } from '/harness/fixture-public-assets.mjs';").replace(marker,marker+"\n    fixturePublicAssets(),")
    config.write_text(content)
assert config.stat().st_size==adapter['bytes'] and sha(config)==adapter['afterSHA256']
check=subprocess.run(['git','-C',str(target),'diff','--exit-code','HEAD','--','.',':!public',':!tests/e2e/cute-surprise.mjs',':!tests/e2e/categories.mjs',':!astro.config.mjs'],capture_output=True,text=True)
assert check.returncode==0,check.stdout[:1000]+check.stderr[:1000]
print('PUBLIC_D153_APPLICATION_SOURCE_TEST_OVERLAYS_AND_BOUND_PRIVATE_COPY_ADAPTER_VERIFIED')
