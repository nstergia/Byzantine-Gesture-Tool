#!/usr/bin/env python3
"""Tiny local server for Byzantine Gesture.

Same as `python -m http.server`, plus:
  * Cache-Control: no-store, so the browser never shows an old copy of the app;
  * a quiet 204 answer for /favicon.ico and Chrome's DevTools probe (no 404 noise).
Usage: python serve.py [port]
"""
import http.server, socket, sys

QUIET = ('/favicon.ico', '/.well-known/appspecific/com.chrome.devtools.json')

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] in QUIET:
            self.send_response(204)
            self.end_headers()
            return
        super().do_GET()

class DualStack(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except Exception:
            pass
        super().server_bind()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    try:
        httpd = DualStack(('::', port), Handler)
    except OSError:
        httpd = http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print('Serving on http://localhost:%d/  (Ctrl+C to stop)' % port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    main()
