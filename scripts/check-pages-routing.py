"""Check real local Pages responses, not Python http.server's routing model.
Start cached Wrangler pages dev on loopback, then pass its --base URL.
No install, deployment or remote request is performed by this check.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener
import xml.etree.ElementTree as ET

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:9315')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    base = args.base.rstrip('/')
    assert urlsplit(base).hostname in {'127.0.0.1', 'localhost', '::1'}, 'loopback only'
    opener = build_opener(NoRedirect())
    rows, failures = [], []
    def get(path, status, file=None, content_type=None, location=None):
        try:
            response = opener.open(base+path, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            body = response.read()
            row = {'path': path, 'status': response.status, 'type': response.headers.get_content_type(), 'location': response.headers.get('Location')}
            headers = response.headers
        errors = []
        if row['status'] != status: errors.append(f'expected status {status}')
        if file is not None and body != (args.root/'demo'/file).read_bytes(): errors.append('body differs from '+file)
        if content_type and row['type'] != content_type: errors.append('expected type '+content_type)
        if location and row['location'] != location: errors.append('expected redirect '+location)
        if row['status'] in {200, 404}:
            for name, expected in [('X-Frame-Options', 'DENY'), ('X-Content-Type-Options', 'nosniff'), ('Referrer-Policy', 'no-referrer')]:
                if headers.get(name) != expected: errors.append('missing or incorrect '+name)
            csp = headers.get('Content-Security-Policy', '')
            for directive in ["script-src 'self'", "worker-src 'self'", "connect-src 'self'", "frame-ancestors 'none'"]:
                if directive not in csp.split('; '): errors.append('missing CSP '+directive)
            if headers.get('Access-Control-Allow-Origin') is not None: errors.append('unexpected CORS header')
        row.update(sha256=hashlib.sha256(body).hexdigest(), errors=errors)
        rows.append(row)
        failures.extend(path+': '+error for error in errors)
        return body
    robots = get('/robots.txt', 200, content_type='text/plain')
    if robots != b'User-agent: *\nAllow: /\nSitemap: https://parallax.sangeev.me/sitemap.xml\n': failures.append('invalid robots body')
    sitemap = get('/sitemap.xml', 200, content_type='application/xml')
    try:
        xml = ET.fromstring(sitemap)
        ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
        assert xml.tag == ns+'urlset'
        assert [x.text for x in xml.findall(ns+'url/'+ns+'loc')] == ['https://parallax.sangeev.me/']
        assert len(xml) == 1
    except (ET.ParseError, AssertionError): failures.append('invalid landing-only sitemap XML')
    for path in ['/__routing_missing__', '/lab/not-a-real-page', '/mesh-spike/missing.obj', '/assets/missing.js', '/missing.html', '/missing/?q=1']:
        get(path, 404, file='404.html' if (args.root/'demo/404.html').exists() else None, content_type='text/html')
    get('/', 200, file='index.html', content_type='text/html')
    for alias in ['/index.html', '/index']:
        get(alias+'?probe=1', 308, location='/?probe=1')
    for name in ['lab', 'explore', 'lessons', 'guided', 'beam3d', 'mesh-spike', 'femur-lesson', 'licences']:
        get('/'+name, 200, file=name+'.html', content_type='text/html')
        get('/'+name+'.html?probe=1', 308, location='/'+name+'?probe=1')
    manifest = json.loads((args.root/'MANIFEST.json').read_text())['files']
    for name in sorted(manifest):
        if name.startswith('demo/') and not name.endswith('.html') and not Path(name).name.startswith('_'):
            get('/'+name[5:], 200, file=name[5:])
    print(json.dumps({'requests': len(rows), 'failures': failures, 'responses': rows}, indent=2))
    return bool(failures)

if __name__ == '__main__':
    raise SystemExit(main())
