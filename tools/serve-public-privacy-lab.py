"""127.0.0.1 only. Allowlisted pages + optional pinned TEST public RPC.
All reaction operations are in-memory browser fixtures. No production connections.
"""
import argparse,json,mimetypes
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs
from public_privacy_files import ROOT,FILES,check
from public_privacy_config import read_config
from privacy_videos import public_rows,report
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8084);p.add_argument('--config-file');a=p.parse_args()
check()
try: config=read_config(a.config_file) if a.config_file else {'publicApiUrl':f'http://127.0.0.1:{a.port}/lab-api','publicApiKey':'sb_publishable_local_fixtures_only','publicMatchesRpc':'public_privacy_matches'}
except (ValueError,OSError): p.error('TEST configuration rejected; values not logged')
original_fixtures=json.loads((ROOT/'tools/privacy-fixtures.json').read_text())
fixtures=public_rows(original_fixtures)
test_origin=config['publicApiUrl'] if a.config_file else ''
class Handler(BaseHTTPRequestHandler):
 def send(self,code,blob=b'',kind='text/plain; charset=utf-8'):
  self.send_response(code);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(blob)));self.send_header('Cache-Control','no-store');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Content-Security-Policy',f"default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.youtube.com https://i.ytimg.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' {test_origin} https://www.youtube.com https://*.googlevideo.com https://jnn-pa.googleapis.com; media-src https://*.googlevideo.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
  self.end_headers();self.wfile.write(blob)
 def do_GET(self):
  path=urlsplit(self.path).path
  if path=='/lab-api/rest/v1/rpc/public_privacy_matches' and not a.config_file:
   requested=parse_qs(urlsplit(self.path).query).get('requested_id',[None])[0]
   rows=[r for r in fixtures if requested is None or r['id']==requested]
   return self.send(200,json.dumps(rows,ensure_ascii=False).encode(),'application/json')
  if path=='/privacy-reactions.js':return self.send(200,(ROOT/'tools/privacy-reactions.js').read_bytes(),'application/javascript')
  name=path.lstrip('/') or 'index.html'
  if name not in FILES:return self.send(404)
  if name=='config.js':blob=('window.PULSE_CONFIG=Object.freeze('+json.dumps(config)+');').encode()
  elif name.endswith('.html'):
   html=(ROOT/name).read_text().replace('<script src="config.js">','<script src="privacy-reactions.js"></script><script src="config.js">')
   html=html.replace('</body>','<div id="publicLabBanner">公開情報保護 LAB／架空データ・反応は端末内のみ</div></body>')
   if name=='index.html':html=html.replace('</head>','<link rel="stylesheet" href="public-load.css"></head>')
   blob=html.encode()
  else:blob=(ROOT/name).read_bytes()
  return self.send(200,blob,mimetypes.guess_type(name)[0] or 'application/octet-stream')
 def do_POST(self):self.send(405)
 def do_DELETE(self):self.send(405)
 def do_PATCH(self):self.send(405)
 def log_message(self,*args):pass
class Server(ThreadingHTTPServer):daemon_threads=True
server=Server(('127.0.0.1',a.port),Handler)
print('Administrator local fixture video counts: '+json.dumps(report(original_fixtures)),flush=True)
print(f'Public privacy LAB ({"pinned TEST RPC" if a.config_file else "local fixtures"}): http://127.0.0.1:{a.port}/',flush=True)
server.serve_forever()
