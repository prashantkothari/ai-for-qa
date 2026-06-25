import http.server, socketserver, functools
ROOT = '/Users/prashant.kothari/Documents/claude'
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
with socketserver.TCPServer(('127.0.0.1', 8765), Handler) as httpd:
    httpd.serve_forever()
