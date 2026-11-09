import pathlib,json,hashlib,os,stat,datetime,sys
root=pathlib.Path('/work')
manifest=json.loads((root/'data/publication.json').read_text())
rows=manifest['files'];total=0
for row in rows:
    path=pathlib.PurePosixPath(row['path'].lstrip('/'))
    assert path.parts[0]=='catalog' and '..' not in path.parts
    source=root/'public'/path;output=root/'dist'/path
    assert not source.is_symlink() and not output.is_symlink()
    a=source.stat();b=output.stat()
    assert a.st_size==b.st_size==row['bytes'] and a.st_ino==b.st_ino and a.st_dev==b.st_dev
    assert not (a.st_mode & 0o222)
    h=hashlib.sha256()
    with source.open('rb') as inp:
        while True:
            chunk=inp.read(1048576)
            if not chunk: break
            h.update(chunk)
    assert h.hexdigest()==row['sha256'],row['path']
    total+=a.st_size
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stage':sys.argv[1],'files':len(rows),'logicalBytesAtEachLocation':total,'allSourceAndOutputBytesSHAExact':True,'sharedImmutableInodes':True,'independentBackup':False,'privateFixtureOnly':True}
out=root/'reports/private-tail'/('media-integrity-'+sys.argv[1]+'.json');out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
