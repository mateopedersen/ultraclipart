import pathlib, json, sys, hashlib, shutil
root=pathlib.Path('/work/reports')
out=root/'private-tail'
round=sys.argv[1]
snap=out/('round-'+round+'-reports')
for path in list(root.rglob('report.json'))+list(root.rglob('*-report.json')):
    if out in path.parents: continue
    dest=snap/path.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,dest)
rows=[]
for line in (out/'status.tsv').read_text().splitlines():
    r,name,code=line.split('\t');rows.append({'round':int(r),'case':name,'exit':int(code)})
(out/'summary.json').write_text(json.dumps({'publicSource':'d153c5b5e811f5cc367e193adfa843fbf1af9c18','scope':'Exact public source plus four test-only overlays and the bound immutable media copy-storage fixture adapter. Bounded two-round remaining Studio diagnostics in OS network-none; actual unchanged assertions except explicit preview/deployment header-layer evidence. Not a native catalog or live publication.','cases':rows,'passed':all(x['exit']==0 for x in rows)},indent=2)+'\n')
print(json.dumps({'round':round,'completedCases':len(rows),'failed':[x for x in rows if x['exit']]}))
