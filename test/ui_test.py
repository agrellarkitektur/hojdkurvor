"""
Gränssnittstest för hela flödet mot testservern (test/server.py) med Playwright och Chromium.

    python3 test/server.py <datakatalog> <appkatalog> &
    python3 test/ui_test.py <utkatalog> [tema]

Testar: rita och ändra utsnitt, sektioner med 90° och Shift, val i alla fyra steg,
DXF-skiss, inloggning, Skapa med alla tillval och platsanalys, zip, utskrift,
3D-vyn, projektlänk och utbytet med en låtsas-cad-apa (test/cad-apa-mock.html).
"""
import zipfile, io, re, sys, json, os
from playwright.sync_api import sync_playwright

UT = sys.argv[1] if len(sys.argv) > 1 else '.'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
APP = 'http://localhost:8765/index.html'
ROT = 'http://127.0.0.1:8765'
os.makedirs(UT, exist_ok=True)

INIT = f"""
window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}';
window.TERRANG_OVERPASS='{ROT}/api/interpreter';
window.TERRANG_GEODATA = {{ naturWfs: '{ROT}/nv/wfs', natura2000Wfs: '{ROT}/n2k/wfs', lamningarWms: '{ROT}/raa/wms', oversvamningWms: '{ROT}/mcf/wms', overpass: '{ROT}/api/interpreter' }};
window.TERRANG_CADAPA = '/test/cad-apa-mock.html';
delete window.showSaveFilePicker;
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
"""
DXF = '\n'.join(['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', 'GARAGE', '90', '4', '70', '1',
                 '10', '30', '20', '120', '10', '37', '20', '120', '10', '37', '20', '126', '10', '30', '20', '126', '0', 'ENDSEC', '0', 'EOF'])

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True, permissions=['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page()
    logg = []
    pg.on('console', lambda m: logg.append(f'{m.type}: {m.text}'))
    pg.on('response', lambda r: logg.append(f'404: {r.url}') if r.status == 404 else None)
    pg.on('pageerror', lambda e: logg.append(f'PAGEERROR: {e}'))
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis).*'), lambda r: r.abort())
    pg.goto(APP); pg.wait_for_timeout(700)
    pg.screenshot(path=f'{UT}/01_start.png')

    # 01 Plats
    pg.click('#rita')
    box = pg.locator('#karta').bounding_box()
    cx, cy = box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.6
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 30, steps=5); pg.mouse.up()
    pg.select_option('#zon', '3009')
    c = pg.evaluate("Terrang.omvandlare(3006, 3009).forward([539750, 6427700])")
    for k, v in dict(xmin=c[0] - 150, xmax=c[0] + 150, ymin=c[1] - 100, ymax=c[1] + 100).items():
        pg.fill('#' + k, str(round(v))); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(1500)
    h = pg.locator('.handtag-wrap').nth(3).bounding_box()
    hx, hy = h['x'] + h['width'] / 2, h['y'] + h['height'] / 2
    pg.mouse.move(hx, hy); pg.mouse.down(); pg.mouse.move(hx + 25, hy, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    print('utsnitt:', [pg.input_value('#' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax')], pg.locator('#storlek-text').inner_text(), '| mitt:', pg.locator('#latlon-text').inner_text())
    pg.fill('#projekt', 'Staren 2')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')

    # 02 Underlag
    pg.click('#flik-underlag')
    pg.click('#ritprogram button[data-prog=archicad]')
    for g in ['g-laser', 'g-kartdata', 'g-sektioner']:
        pg.evaluate(f"document.getElementById('{g}').open = true")
    for v in ['laser', 'trad', 'hom', 'byggnader', 'marktacke', 'stompunkter', 'vagar', 'sektion']:
        pg.check(f'input[name=tillval][value={v}]')
    pg.screenshot(path=f'{UT}/02_underlag.png')

    def pkt(x, y):
        return pg.evaluate(f"(() => {{ const ll = Terrang.omvandlare(3009, 4326).forward([{x}, {y}]); return window.__punkt([ll[1], ll[0]]); }})()")
    hus = pg.evaluate("Terrang.omvandlare(3006, 3009).forward([539800, 6427700])")
    pg.click('#ortho'); pg.click('#rita-sektion')
    for (x, y) in ((hus[0], hus[1] - 70), (hus[0] + 9, hus[1] + 70)):
        q = pkt(x, y); pg.mouse.move(q[0], q[1]); pg.mouse.click(q[0], q[1]); pg.wait_for_timeout(150)
    pg.click('#ortho'); pg.click('#rita-sektion')
    q = pkt(c[0] - 140, c[1] + 40); pg.mouse.click(q[0], q[1]); pg.wait_for_timeout(150)
    q = pkt(c[0] + 140, c[1] + 52)
    pg.keyboard.down('Shift'); pg.mouse.move(q[0], q[1]); pg.mouse.click(q[0], q[1]); pg.keyboard.up('Shift'); pg.wait_for_timeout(150)
    print('sektioner:', pg.locator('#sf-sektioner').inner_text(), '| terräng:', pg.locator('#sf-terrang').inner_text())

    # 03 Analys
    pg.click('#flik-analys')
    pg.check('#platsanalys')
    pg.evaluate("document.getElementById('g-sol').open = true")
    pg.check('input[name=tillval][value=horisont]')
    pg.click('#hor-valj')
    q = pkt(c[0] - 60, c[1] - 30); pg.mouse.click(q[0], q[1]); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{UT}/03_analys.png')

    # 04 Skiss: DXF med ett garage i lokala koordinater
    pg.click('#flik-skiss')
    open(f'{UT}/garage.dxf', 'w').write(DXF)
    pg.set_input_files('#skiss-fil', f'{UT}/garage.dxf'); pg.wait_for_timeout(300)
    pg.click('#skiss-dxf-ok'); pg.wait_for_timeout(300)
    print('skiss:', pg.locator('#skiss-status').inner_text(), '| volymer:', pg.locator('#volymlista li').count())
    print('sammanfattning före:', pg.locator('#val-sammanf').inner_text().replace('\n', ' | '), '|', pg.locator('#skapa').inner_text())
    pg.screenshot(path=f'{UT}/04_skiss.png')

    # Skapa
    pg.click('#skapa')
    pg.wait_for_selector('#resultat:not([hidden])', timeout=600000)
    print('status:', pg.locator('#status-text').inner_text().replace('\n', ' / '))
    print('sammanfattning:', pg.locator('#sammanfattning').inner_text().replace('\n', ' | '))
    print('lager:', pg.locator('#lp-lager').inner_text().replace('\n', ' | '))
    pg.screenshot(path=f'{UT}/05_klar.png')
    with pg.expect_download() as d:
        pg.click('#ladda-ner')
    z = zipfile.ZipFile(io.BytesIO(open(d.value.path(), 'rb').read()))
    print('zip:', d.value.suggested_filename, len(z.infolist()), 'filer')
    for i in z.infolist():
        if not i.filename.endswith('/'): print('   ', i.filename, i.file_size)
    z.extractall(f'{UT}/zip')

    # utskrift i skala med Lantmäteriets karta
    pg.click('#lp-bakgrund button:has-text("LANTMÄTERIET")'); pg.wait_for_timeout(2000)
    pg.click('#lp-skriv'); pg.wait_for_timeout(200)
    with pg.expect_download(timeout=120000) as d:
        pg.click('#pr-skapa')
    open(f'{UT}/utskrift.pdf', 'wb').write(open(d.value.path(), 'rb').read())
    print('utskrift:', d.value.suggested_filename)

    # 3D
    pg.click('#visa-3d'); pg.wait_for_timeout(4000)
    pg.screenshot(path=f'{UT}/06_3d.png')
    print('3d:', pg.locator('#vy3d-yta canvas').count(), 'canvas', pg.locator('#vy3d-yta').inner_text()[:100])
    pg.click('#vy3d-stang')

    # projektlänk
    pg.click('#flik-plats'); pg.click('#kopiera-projektlank'); pg.wait_for_timeout(200)
    lank = pg.evaluate('navigator.clipboard.readText()')
    print('projektlänk:', len(lank), 'tecken')
    pg2 = ctx.new_page(); pg2.goto(lank); pg2.wait_for_timeout(1500)
    print('  öppnad:', [pg2.input_value('#' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax')], pg2.input_value('#projekt'),
          pg2.evaluate("[...document.querySelectorAll('input[name=tillval]:checked')].map(c => c.value).join(',')"))
    pg2.close()

    # cad-apa: skicka platsen, ta emot en skiss
    with ctx.expect_page() as ny:
        pg.click('#flik-skiss'); pg.click('#skiss-cadapa')
    cad = ny.value; cad.wait_for_timeout(1500)
    print('cad-apa:', cad.locator('#logg').inner_text().strip(), '| höjdkurvor:', pg.locator('#skiss-status').inner_text())
    cad.click('#skicka'); cad.wait_for_timeout(800)
    print('  tillbaka:', cad.locator('#logg').inner_text().strip().split('\n')[-1], '|', pg.locator('#skiss-status').inner_text(), '| volymer', pg.locator('#volymlista li').count())

    fel = [l for l in logg if l.startswith('404:') or (('error' in l.lower() or 'PAGEERROR' in l) and 'ERR_FAILED' not in l)]
    print('konsolfel:', fel or 'inga')
    b.close()
