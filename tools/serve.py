"""Local preview server for the site: like `python3 -m http.server`, but tells the browser never
to cache, so every reload picks up the latest HTML, CSS and JavaScript. Not part of the published
site. Usage (from the repo root): python3 tools/serve.py [port]"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
