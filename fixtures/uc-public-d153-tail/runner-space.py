import pathlib,json,shutil,subprocess,os,sys,datetime
assert os.environ.get('GITHUB_ACTIONS')=='true' and sys.platform=='linux'
assert pathlib.Path('/home/runner/work').is_dir()
allowed=['/usr/share/dotnet','/usr/local/lib/android','/usr/local/.ghcup','/usr/share/swift','/usr/lib/jvm']
before=shutil.disk_usage('/').free
removed=[]
for name in allowed:
    p=pathlib.Path(name)
    assert str(p)==name and not p.is_symlink()
    if p.exists():
        subprocess.run(['sudo','rm','-rf','--',name],check=True)
        assert not p.exists()
        removed.append(name)
after=shutil.disk_usage('/').free
required=23852770082+12000000000
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ephemeralGitHubRunnerOnly':True,'ownerMacModified':False,'allowlistedUnusedSDKsRemoved':removed,'freeBytesBefore':before,'freeBytesAfter':after,'requiredFreeBytes':required,'completeMediaLogicalBytes':23852770082,'secondPhysicalCatalogCopyRequired':False}
pathlib.Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
assert after>=required,'Insufficient runner space for complete media and bounded build reserve'
