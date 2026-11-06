#!/usr/bin/env python3
"""Serve a TV UI preview with synthetic public-match data and no Supabase access."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import argparse
import json
import mimetypes

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_PAGES = {"index.html", "match.html"}
ALLOWED_EXTENSIONS = {".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2"}
BLOCKED_ASSETS = {"data.js", "robots.txt"}
SAMPLE_ID = "tv-layout-demo"
SAMPLE_MATCH = {
    "id": SAMPLE_ID,
    "date": "2026-11-05",
    "competition": "TV LAB SAMPLE",
    "round": "",
    "home": "SAMPLE A",
    "away": "SAMPLE B",
    "homeScore": 2,
    "awayScore": 1,
    "firstHalfVideo": "dSIO3AdVRIs",
    "secondHalfVideo": "Mx5IiSYW7T8",
    "highlightVideo": "",
    "published": True,
}
GOAL_SAMPLE_MATCHES = {
    sample_id: {**SAMPLE_MATCH, "id": sample_id, "competition": "TV GOAL SAMPLE"}
    for sample_id in ("tv-goal-a", "tv-goal-b")
}
GOAL_FIXTURES = {
    "fixtures/tv-goals/tv-goal-a.json",
    "fixtures/tv-goals/tv-goal-b.json",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "TVLabFixture/1"

    def log_message(self, *_args):
        pass

    def send_bytes(self, status, body, content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_POST(self):
        self.send_bytes(405, b"METHOD_NOT_ALLOWED")

    def do_PUT(self):
        self.send_bytes(405, b"METHOD_NOT_ALLOWED")

    def do_DELETE(self):
        self.send_bytes(405, b"METHOD_NOT_ALLOWED")

    def do_PATCH(self):
        self.send_bytes(405, b"METHOD_NOT_ALLOWED")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        request = urlsplit(self.path)
        path = request.path.lstrip("/") or "index.html"
        if path == "config.js":
            origin = f"http://{self.headers.get('Host', '127.0.0.1')}"
            body = f"window.PULSE_CONFIG={{supabaseUrl:{json.dumps(origin)},supabaseAnonKey:'FIXTURE_ONLY'}};".encode()
            return self.send_bytes(200, body, "application/javascript; charset=utf-8")
        if path == "rest/v1/rpc/pulse_public_matches_v1":
            query = parse_qs(request.query)
            requested = query.get("requested_id", [None])[0]
            rows = ([GOAL_SAMPLE_MATCHES[requested]] if requested in GOAL_SAMPLE_MATCHES
                    else [SAMPLE_MATCH] if requested in (None, SAMPLE_ID) else [])
            return self.send_bytes(200, json.dumps(rows).encode(), "application/json; charset=utf-8")
        if path.startswith("rest/"):
            return self.send_bytes(404, b"FIXTURE_ROUTE_NOT_FOUND")
        target = (ROOT / path).resolve()
        try:
            relative = target.relative_to(ROOT)
        except ValueError:
            return self.send_bytes(404, b"NOT_FOUND")
        allowed = (
            relative.as_posix() in ALLOWED_PAGES
            or relative.as_posix() in GOAL_FIXTURES
            or relative.name not in BLOCKED_ASSETS and relative.suffix.lower() in ALLOWED_EXTENSIONS
        )
        if not allowed or not target.is_file():
            return self.send_bytes(404, b"NOT_FOUND")
        data = target.read_bytes()
        if relative.as_posix() == "match.html":
            data = data.replace(
                b'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
                b"<script>window.supabase=undefined;</script>",
            )
        return self.send_bytes(200, data, mimetypes.guess_type(target.name)[0] or "application/octet-stream")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="bind address; use the Mac's LAN address for Fire TV testing")
    parser.add_argument("--port", type=int, default=8076)
    args = parser.parse_args()
    print(f"TV LAB fixture server: http://{args.host}:{args.port}/")
    print("Synthetic match only; Supabase client removed; writes are rejected.")
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
