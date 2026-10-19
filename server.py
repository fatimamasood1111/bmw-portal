"""Serves the portal and proxies /ollama/* to the local Ollama (no CORS setup needed).
Run:  python server.py        then open http://localhost:8080
"""
import http.server, socketserver, urllib.request, urllib.error, os, sys

PORT = int(os.environ.get("PORT", 8080))
OLLAMA = os.environ.get("OLLAMA_URL", "http://localhost:11434")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _proxy(self):
        path = self.path[len("/ollama"):]
        body = None
        if self.command == "POST":
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        req = urllib.request.Request(OLLAMA + path, data=body, method=self.command,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                self.send_response(r.status)
                self.send_header("Content-Type", r.headers.get("Content-Type", "application/json"))
                self.end_headers()
                while True:  # stream chunks straight through
                    chunk = r.read1(4096) if hasattr(r, "read1") else r.read(4096)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except urllib.error.URLError as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(('{"error":"Cannot reach Ollama at %s: %s"}' % (OLLAMA, e)).encode())
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        self._proxy() if self.path.startswith("/ollama/") else super().do_GET()

    def do_POST(self):
        if self.path.startswith("/ollama/"):
            self._proxy()
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        if "/ollama/" not in str(args[0] if args else ""):
            sys.stderr.write("%s\n" % (fmt % args))


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    print(f"Verde Motors portal -> http://localhost:{PORT}   (Ollama: {OLLAMA})")
    Server(("", PORT), Handler).serve_forever()
