"""Local-only, allowlisted admin LAB. Production files and endpoints are excluded."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import re

ROOT = Path(__file__).resolve().parents[1]
FILES = {'admin.html', 'admin-lab-config.js', 'admin-lab-fixtures.js',
         'admin-safety-backend.js', 'admin-safety.js'}
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8081)
parser.add_argument('--test-project-ref', default='')
args = parser.parse_args()
if args.test_project_ref and not re.fullmatch(r'[a-z0-9]{20}', args.test_project_ref):
    parser.error('Expected the separate test project reference')
production_host = re.search(r'supabaseUrl:\s*"https://([^/\"]+)', (ROOT / 'config.js').read_text()).group(1)
if args.test_project_ref and args.test_project_ref + '.supabase.co' == production_host:
    parser.error('Production connection is forbidden')
connect = "'none'" if not args.test_project_ref else f'https://{args.test_project_ref}.supabase.co wss://{args.test_project_ref}.supabase.co'
scripts = "'self' 'unsafe-inline'" + (' https://cdn.jsdelivr.net' if args.test_project_ref else '')
csp = f"default-src 'none'; script-src {scripts}; style-src 'self' 'unsafe-inline'; connect-src {connect}; img-src 'self' data:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"

class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def do_GET(self):
        name = urlsplit(self.path).path.lstrip('/') or 'admin.html'
        if name not in FILES:
            self.send_error(404)
            return
        blob = (ROOT / name).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8' if name.endswith('.html') else 'application/javascript; charset=utf-8')
        self.send_header('Content-Length', str(len(blob)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', csp)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(blob)
    def log_message(self, *_):
        pass  # Do not log login input or query values.

class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

with Server(('127.0.0.1', args.port), Handler) as server:
    print(f'Admin safety LAB: http://127.0.0.1:{args.port}/admin.html', flush=True)
    server.serve_forever()
