#!/usr/bin/env python3
"""Local immutable build preview with actual Cloudflare _headers rules applied."""
import functools,http.server,pathlib,sys,fnmatch
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'work/csp-preview').resolve()
port=int(sys.argv[2] if len(sys.argv)>2 else '4324')
rules=[]
for line in (root/'_headers').read_text().splitlines():
 if not line.strip() or line.lstrip().startswith('#'):continue
 if not line[0].isspace():rules.append((line.strip(),[]))
 elif rules:
  key,value=line.strip().split(':',1);rules[-1][1].append((key,value.strip()))
class Handler(http.server.SimpleHTTPRequestHandler):
 def end_headers(self):
  for pattern,headers in rules:
   if fnmatch.fnmatch(self.path.split('?')[0],pattern):
    for key,value in headers:self.send_header(key,value)
  super().end_headers()
 def log_message(self,*args):pass
http.server.ThreadingHTTPServer(('127.0.0.1',port),functools.partial(Handler,directory=str(root))).serve_forever()
