"""Testserver för höjdkurvor.se. Efterliknar Lantmäteriet (Basic auth test:hemligt-åäö, Range, CORS, HEAD,
STAC-sök, Stompunkt Direkt) och Overpass, Naturvårdsverket, Riksantikvarieämbetet och MCF på port 8765.
Användning: python3 test/server.py DATAKATALOG APPKATALOG"""
import base64, os, sys, json, hashlib
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pyproj import Transformer

DATA, APP = sys.argv[1], sys.argv[2]
AUTH = 'Basic ' + base64.b64encode('test:hemligt-åäö'.encode()).decode()
TYPER = {'html': 'text/html; charset=utf-8', 'js': 'text/javascript', 'css': 'text/css', 'json': 'application/json',
         'png': 'image/png', 'svg': 'image/svg+xml', 'woff2': 'font/woff2', 'wasm': 'application/wasm',
         'ttf': 'font/ttf', 'md': 'text/plain', 'php': 'text/plain'}
STAC_ITEMS = {'type': 'FeatureCollection', 'links': [], 'features': [
    {'id': '21c007-test', 'properties': {'datetime': '2021-04-14T12:00:00Z', 'skanningsomrade': '21C007',
     'proj:bbox': [539000.0, 6427000.0, 541000.0, 6429000.0], 'punkttathet': 1.2},
     'assets': {'data': {'href': 'https://dl1.lantmateriet.se/hojd/data/pointcloud/sls/21c007/y21c007-64275_5375_25.copc.laz'}}},
    {'id': '15a001-gammal', 'properties': {'datetime': '2015-05-01T12:00:00Z', 'skanningsomrade': '15A001',
     'proj:bbox': [539000.0, 6427000.0, 541000.0, 6429000.0], 'punkttathet': 0.5},
     'assets': {'data': {'href': 'https://dl1.lantmateriet.se/hojd/data/pointcloud/sls/15a001/gammal.copc.laz'}}},
]}
# Stompunkter i SWEREF 99 TM med RH 2000-höjd
STOMPUNKTER = [
    dict(id='202100-4888_900001', namn='Staren', x=539705.123, y=6427722.456, z=114.218, typ='plan-höjdpunkt', kategori='brukspunkt',
         markering='dubb', underlag='berg', aterfunnen=2019, kvP='1', kvH='1', osP=0.010, osH=0.004,
         besk='Punkten är belägen 12 m S om gårdens ladugård, i en berghäll.'),
    dict(id='202100-4888_900002', namn='Kinda 12', x=539880.5, y=6427640.25, z=None, typ='planpunkt', kategori='brukspunkt',
         markering='rör', underlag='mark', aterfunnen=2011, kvP='2', kvH=None, osP=0.020, osH=None,
         besk='Vid vägkanten, 3,2 m V om stolpe.'),
    dict(id='202100-4888_900003', namn='H 4711', x=539620.0, y=6427790.0, z=116.902, typ='höjdpunkt', kategori='riksavvägningspunkt',
         markering='bult', underlag='berg', aterfunnen=2022, kvP=None, kvH='1', osP=None, osH=0.002,
         besk='Bult i berg vid gamla skolan.'),
    dict(id='202100-4888_900004', namn='Långt bort', x=545000.0, y=6440000.0, z=150.0, typ='planpunkt', kategori='brukspunkt',
         markering='dubb', underlag='berg', aterfunnen=2000, kvP='3', kvH=None, osP=0.05, osH=None, besk=''),
]
# Låtsad Overpass: några vägar i testområdet (SWEREF 99 TM → WGS 84)
_tm = Transformer.from_crs(3006, 4326, always_xy=True)
def _vag(i, typ, namn, pts):
    return {'type': 'way', 'id': 1000 + i, 'tags': {'highway': typ, **({'name': namn} if namn else {})},
            'geometry': [{'lat': round(_tm.transform(x, y)[1], 7), 'lon': round(_tm.transform(x, y)[0], 7)} for x, y in pts]}
OVERPASS = {'version': 0.6, 'elements': [
    _vag(1, 'secondary', 'Bygatan', [(539400, 6427640), (539600, 6427660), (539800, 6427650), (540100, 6427700)]),
    _vag(2, 'residential', 'Skolvägen', [(539700, 6427500), (539705, 6427650), (539720, 6427900)]),
    _vag(3, 'footway', None, [(539620, 6427760), (539700, 6427790), (539820, 6427760)]),
    _vag(4, 'track', None, [(539850, 6427550), (539880, 6427700), (539900, 6427850)]),
    _vag(5, 'construction', None, [(539600, 6427600), (539650, 6427610)]),
]}
# Låtsade geodatatjänster för platsanalysen (SWEREF 99 TM)
NATUR = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'id': 'SkyddadeOmraden.1',
    'properties': {'NAMN': 'Starens naturreservat', 'SKYDDSTYP': 'Naturreservat', 'NVRID': '2001234'},
    'geometry': {'type': 'Polygon', 'coordinates': [[[539560, 6427560], [539660, 6427560], [539660, 6427640], [539560, 6427640], [539560, 6427560]]]}}]}
LAMNINGAR = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'id': 'fornlamning.123', 'properties': {'lamningsnummer': 'L1972:4512', 'lamningstyp': 'Gravfält'}, 'geometry': {'type': 'Point', 'coordinates': [539780, 6427720]}},
    {'type': 'Feature', 'id': 'ovrkulthistlamning.9', 'properties': {'lamningsnummer': 'L2001:77', 'lamningstyp': 'Fossil åker'}, 'geometry': {'type': 'Point', 'coordinates': [539640, 6427660]}}]}
VATTEN = {'version': 0.6, 'elements': [{'type': 'way', 'id': 77, 'tags': {'natural': 'water', 'name': 'Lillsjön'},
    'geometry': [{'lat': round(_tm.transform(x, y)[1], 7), 'lon': round(_tm.transform(x, y)[0], 7)} for x, y in [(539960, 6427650), (540060, 6427650), (540060, 6427760), (539960, 6427760), (539960, 6427650)]]}]}
def png_halv(w, h, fylld):
    from PIL import Image
    import io
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    if fylld:
        for x in range(w // 3):
            for y in range(h):
                im.putpixel((x, y), (60, 120, 220, 160))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()

SRID_2D = {5845: 3006, 5846: 3007, 5847: 3008, 5851: 3012, 5848: 3009, 5852: 3013, 5849: 3010,
           5853: 3014, 5850: 3011, 5854: 3015, 5855: 3016, 5856: 3017, 5857: 3018}


def inne(pt, ring):
    x, y = pt; c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c


def feature(p, srid, full):
    plan = SRID_2D.get(srid, srid)
    x, y = Transformer.from_crs(3006, plan, always_xy=True).transform(p['x'], p['y']) if plan != 3006 else (p['x'], p['y'])
    koord = [round(x, 3), round(y, 3)] + ([p['z']] if (srid in SRID_2D and p['z'] is not None) else [])
    pr = {'stompunktId': p['id'], 'namn': p['namn'], 'mbPlan': {'kvalitetKlass': p['kvP']} if p['kvP'] else None,
          'historik': {'aterfunnen': p['aterfunnen']}, 'stomnat': {'natNamn': 'Nationellt passivt referensnät i plan'}}
    if full:
        pr.update({'typ': p['typ'], 'kategori': p['kategori'],
                   'mbHojd': {'ursprung': 'utjämnad (RH 2000)', 'kvalitetKlass': p['kvH'], 'lagesosakerhet': p['osH']} if p['kvH'] else None,
                   'mbPlan': {'ursprung': 'utjämnad (SWEREF 99)', 'kvalitetKlass': p['kvP'], 'lagesosakerhet': p['osP']} if p['kvP'] else None,
                   'markering': {'markeringTyp': p['markering'], 'underlag': p['underlag']},
                   'anmarkning': [{'anmarkningTyp': 'lägesbeskrivning', 'anmarkningText': p['besk']}] if p['besk'] else [],
                   'kommun': '0513', 'bild': [f"http://download.lantmateriet.se/stompunkt/skisser/Plan/900/{p['id'][-6:]}.png"]})
    pr = {k: v for k, v in pr.items() if v is not None}
    return {'type': 'Feature', 'id': p['id'], 'geometry': {'type': 'Point', 'coordinates': koord}, 'properties': pr}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cors(self, alla=False):
        o = self.headers.get('Origin')
        if alla:
            self.send_header('Access-Control-Allow-Origin', '*')
        elif o:
            self.send_header('Access-Control-Allow-Origin', o); self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, ETag, Last-Modified')

    def do_OPTIONS(self):
        self.send_response(204); self.cors()
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Range, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST'); self.end_headers()

    def do_HEAD(self):
        self.do_GET(head=True)

    def svara_json(self, obj, status=200, alla=False):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status); self.cors(alla)
        self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', len(b)); self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        path, _, q = self.path.partition('?')
        params = dict(kv.split('=', 1) for kv in q.split('&') if '=' in kv)
        n = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(n)
        if path == '/api/interpreter':
            assert raw.startswith(b'data='), raw[:20]
            return self.svara_json(VATTEN if b'natural' in raw else OVERPASS, alla=True)
        body = json.loads(raw or b'null')
        if not path.startswith('/distribution/produkter/stompunkt-direkt/v1.1/'):
            return self.svara_json({'code': 404, 'reason': 'Not Found'}, 404)
        if self.headers.get('Authorization') != AUTH:
            return self.svara_json({'code': 401, 'reason': 'Unauthorized'}, 401)
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.svara_json({'code': 415, 'reason': 'Unsupported Media Type'}, 415)
        srid = int(params.get('srid', 3006))
        if path.endswith('/filter'):
            g = body['geometri']
            assert g['crs']['properties']['name'] == 'urn:ogc:def:crs:EPSG::3006', g['crs']
            ring = g['coordinates'][0]
            traff = [p for p in STOMPUNKTER if inne((p['x'], p['y']), ring)]
            fc = {'type': 'FeatureCollection', 'crs': {'type': 'name', 'properties': {'name': f'urn:ogc:def:crs:EPSG::{srid}'}},
                  'features': [feature(p, srid, False) for p in traff]}
            return self.svara_json(fc)
        if path.endswith('/id'):
            ids = body if isinstance(body, list) else body.get('id', [])
            traff = [p for p in STOMPUNKTER if p['id'] in ids]
            return self.svara_json({'type': 'FeatureCollection', 'features': [feature(p, srid, True) for p in traff]})
        return self.svara_json({'code': 404, 'reason': 'Not Found'}, 404)

    def statisk(self, sokvag, head):
        p = os.path.join(APP, sokvag.lstrip('/').split('?')[0] or 'index.html')
        if not os.path.isfile(p):
            self.send_response(404); self.end_headers(); return
        b = open(p, 'rb').read()
        self.send_response(200)
        self.send_header('Content-Type', TYPER.get(p.rsplit('.', 1)[-1], 'application/octet-stream'))
        self.send_header('Content-Length', len(b)); self.end_headers()
        if not head:
            self.wfile.write(b)

    def do_GET(self, head=False):
        path = self.path.split('?')[0]
        q = dict(kv.split('=', 1) for kv in self.path.partition('?')[2].split('&') if '=' in kv)
        if path in ('/nv/wfs', '/n2k/wfs'):
            return self.svara_json(NATUR if path == '/nv/wfs' else {'type': 'FeatureCollection', 'features': []}, alla=True)
        if path == '/raa/wms':
            return self.svara_json(LAMNINGAR, alla=True)
        if path == '/mcf/wms':
            b = png_halv(int(q.get('width', 256)), int(q.get('height', 256)), q.get('layers') == '13')
            self.send_response(200); self.cors(alla=True)
            self.send_header('Content-Type', 'image/png'); self.send_header('Content-Length', len(b)); self.end_headers()
            if not head: self.wfile.write(b)
            return
        if path.startswith('/stac-hojd/'):
            b = json.dumps(STAC_ITEMS).encode()
            self.send_response(200); self.cors(alla=True)
            self.send_header('Content-Type', 'application/geo+json'); self.send_header('Content-Length', len(b)); self.end_headers()
            if not head:
                self.wfile.write(b)
            return
        ext = path.rsplit('.', 1)[-1] if '.' in path.rsplit('/', 1)[-1] else ''
        if path == '/' or (ext in TYPER and not path.startswith(('/hojd/', '/mark/'))):
            return self.statisk(path, head)
        if self.headers.get('Authorization') != AUTH:
            self.send_response(401); self.cors(); self.send_header('WWW-Authenticate', 'Basic realm="x"'); self.end_headers(); return
        p = os.path.join(DATA, os.path.basename(path))
        if not os.path.exists(p):
            self.send_response(404); self.cors(); self.end_headers(); return
        size = os.path.getsize(p)
        etag = '"' + hashlib.md5(f'{p}{os.path.getmtime(p)}'.encode()).hexdigest() + '"'
        rng = self.headers.get('Range')
        if rng:
            a, b = rng.split('=')[1].split(',')[0].split('-'); a = int(a); b = min(int(b) if b else size - 1, size - 1)
            self.send_response(206); self.send_header('Content-Range', f'bytes {a}-{b}/{size}')
        else:
            a, b = 0, size - 1; self.send_response(200)
        self.cors(); self.send_header('Accept-Ranges', 'bytes'); self.send_header('ETag', etag)
        self.send_header('Last-Modified', 'Thu, 15 Oct 2026 10:00:00 GMT')
        self.send_header('Content-Length', b - a + 1); self.end_headers()
        if not head:
            with open(p, 'rb') as f:
                f.seek(a); self.wfile.write(f.read(b - a + 1))


ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()
