"""
Gränssnittstest för hela flödet mot testservern (test/server.py) med Playwright och Chromium.

    python3 test/server.py <datakatalog> <appkatalog> &
    python3 test/ui_test.py <utkatalog> [tema]

Testar: rita och ändra utsnitt, sektioner med 90° och Shift, val i alla fyra steg,
DXF-skiss, inloggning, Skapa med alla tillval och platsanalys, zip, utskrift,
3D-vyn med ortofoto och lager, projektlänk, utbytet med en låtsas-cad-apa (test/cad-apa-mock.html),
BETA-knappen med formuläret Skicka synpunkter (synpunkter.php fångas upp) och dialogen Klistra in koordinater.
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
window.TERRANG_TEST = {{}};
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
    synpunkt = []
    def fanga(route):
        synpunkt.append(json.loads(route.request.post_data))
        route.fulfill(status=200, content_type='application/json', body='{"ok":true}')
    ctx.route(re.compile(r'.*/synpunkter\.php$'), fanga)
    pg.goto(APP); pg.wait_for_timeout(700)
    pg.screenshot(path=f'{UT}/01_start.png')

    # BETA-knappen och Skicka synpunkter
    print('beta:', pg.locator('.beta-knapp').inner_text().replace('\n', ' | '))
    pg.click('.beta-knapp'); pg.wait_for_timeout(300)
    pg.fill('#sp-text', 'Testsynpunkt från gränssnittstestet.')
    pg.screenshot(path=f'{UT}/00_synpunkter.png')
    pg.wait_for_timeout(3000)
    pg.click('.sp-skicka'); pg.wait_for_timeout(500)
    print('synpunkt:', pg.locator('.sp-status').inner_text(), '|', {k: v for k, v in (synpunkt[0] if synpunkt else {}).items() if k != 'elapsed'})
    pg.wait_for_timeout(1500)
    print('  dialogen stängd:', not pg.locator('dialog.synpunkter').is_visible())

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
    # Klistra in koordinater: samma hörn i 15 00 utan system i texten; dialogen ska föreslå 15 00 (Kinda)
    pg.select_option('#zon', '3006')
    pg.evaluate(f"navigator.clipboard.writeText('Väst {round(c[0] - 150)}\\nÖst {round(c[0] + 150)}\\nSyd {round(c[1] - 100)}\\nNord {round(c[1] + 100)}')")
    pg.click('#koord-klistra'); pg.wait_for_timeout(400)
    print('koordinatdialog:', pg.input_value('#kd-zon'), pg.locator('#kd-kommun option:checked').inner_text(), '|', pg.locator('#kd-tolkat').inner_text(), '|', pg.locator('#kd-kontroll').inner_text())
    pg.screenshot(path=f'{UT}/01b_koordinater.png')
    pg.select_option('#kd-zon', '3011'); pg.wait_for_timeout(100)
    print('  i 18 00:', pg.locator('#kd-kontroll').inner_text())
    pg.select_option('#kd-kommun', label='Kinda'); pg.wait_for_timeout(100)
    pg.click('#kd-ok'); pg.wait_for_timeout(1500)
    print('  använt:', pg.input_value('#zon'), [pg.input_value('#' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax')], '|', pg.locator('#koord-status').inner_text())
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
    for v in ['laser', 'trad', 'hom', 'ortofoto', 'byggnader', 'fastigheter', 'marktacke', 'stompunkter', 'vagar', 'sektion']:
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
    namn_i_zip = [i.filename for i in z.infolist()]
    if any('_byggnader_lokal.dxf' in n for n in namn_i_zip):
        ifc = [n for n in namn_i_zip if n.endswith('.ifc')]
        print('  ifc:', ifc)
        assert len(ifc) == 2, 'IFC lokal och sweref följer med byggnaderna'
        assert z.read(ifc[0]).startswith(b'ISO-10303-21;'), 'IFC-filen börjar med STEP-huvudet'
    info = next((z.read(n).decode('utf-8', 'replace') for n in namn_i_zip if n.endswith('info.txt')), '')
    for rad in info.splitlines():
        if 'IFC' in rad or 'från en byggnad är borttagna' in rad or 'precis vid en byggnad' in rad: print('  info:', rad.strip()[:160])

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
    print('3d:', pg.locator('#vy3d-yta canvas').count(), 'canvas', pg.locator('#vy3d-yta').inner_text()[:100],
          '| ortofoto', 'av' if pg.locator('#vy3d-orto').is_hidden() else pg.get_attribute('#vy3d-orto', 'aria-pressed'))
    print('  lager i 3D:', [(e.inner_text(), e.get_attribute('aria-pressed')) for e in pg.locator('#vy3d-lager button:visible').all()])
    for namn in ('trad', 'byggnader'):
        if pg.locator(f'[data-lager3d={namn}]').count(): pg.click(f'[data-lager3d={namn}]')
    pg.wait_for_timeout(800); pg.screenshot(path=f'{UT}/06c_3d_utan_trad_och_hus.png')
    for namn in ('trad', 'byggnader'):
        if pg.locator(f'[data-lager3d={namn}]').count(): pg.click(f'[data-lager3d={namn}]')
    if pg.locator('#vy3d-orto').is_visible():
        pg.click('#vy3d-orto'); pg.wait_for_timeout(800); pg.screenshot(path=f'{UT}/06b_3d_utan_orto.png')
        print('  ortofoto efter klick:', pg.get_attribute('#vy3d-orto', 'aria-pressed'))
    # panorera med högerdrag, dubbelklick återställer (0.8.0)
    yta = pg.locator('#vy3d-yta canvas').bounding_box()
    if yta:
        mx, my = yta['x'] + yta['width'] / 2, yta['y'] + yta['height'] / 2
        fore = pg.locator('#vy3d-yta canvas').screenshot()
        pg.mouse.move(mx, my); pg.mouse.down(button='right'); pg.mouse.move(mx + 160, my + 60, steps=8); pg.mouse.up(button='right')
        pg.wait_for_timeout(500)
        efter = pg.locator('#vy3d-yta canvas').screenshot()
        pg.screenshot(path=f'{UT}/06d_3d_panorerad.png')
        assert efter != fore, 'vyn flyttades vid högerdrag'
        pg.mouse.dblclick(mx, my); pg.wait_for_timeout(500)
        print('  panorering: flyttad, återställd lika start:', pg.locator('#vy3d-yta canvas').screenshot() == fore)
        # vad dragningen gör, mätt på kameran (0.8.1): snurra ändrar riktningen, flytta målpunkten
        kam = lambda: pg.evaluate('TERRANG_TEST.vy3d.kameralage()')
        def drag(knapp='left', skift=False):
            pg.mouse.dblclick(mx, my); pg.wait_for_timeout(200)
            fore = kam()
            if skift: pg.keyboard.down('Shift')
            pg.mouse.move(mx, my); pg.mouse.down(button=knapp); pg.mouse.move(mx + 120, my + 40, steps=6); pg.mouse.up(button=knapp)
            if skift: pg.keyboard.up('Shift')
            efter = kam()
            snurrad = abs(efter['azimut'] - fore['azimut']) > 1e-6
            flyttad = any(abs(a - b) > 1e-6 for a, b in zip(efter['mal'], fore['mal']))
            return snurrad, flyttad
        assert drag() == (True, False), 'vanlig dragning snurrar'
        assert drag(skift=True) == (False, True), 'skift-dra flyttar'
        assert drag(knapp='right') == (False, True), 'högerdra flyttar'
        pg.click('#vy3d-flytta')
        assert pg.get_attribute('#vy3d-flytta', 'aria-pressed') == 'true'
        assert drag() == (False, True), 'vanlig dragning flyttar i läget Flytta'
        assert drag(skift=True) == (True, False), 'skift-dra snurrar i läget Flytta'
        pg.screenshot(path=f'{UT}/06f_3d_flytta.png')
        pg.click('#vy3d-flytta')
        assert drag() == (True, False), 'tillbaka till Snurra'
        print('  dragning: snurra, skift-dra, högerdra och Flytta gör rätt')
    assert pg.locator('#gamla-filer').count() == 0, 'ingen varning om gamla filer när versionerna stämmer'
    if pg.locator('#vy3d-kurvfarg-rad').is_visible():
        print('  kurvfärg:', pg.input_value('#vy3d-kurvfarg'))
        pg.eval_on_selector('#vy3d-kurvfarg', "e => { e.value = '#e02020'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
        pg.wait_for_timeout(500); pg.screenshot(path=f'{UT}/06e_3d_roda_kurvor.png')
        pg.eval_on_selector('#vy3d-kurvfarg', "e => { e.value = '#000000'; e.dispatchEvent(new Event('input', { bubbles: true })); }")

    # 0.9.0: konturer, färger, träd, skuggor, ögonhöjd och bilder
    v3 = 'TERRANG_TEST.vy3d'
    print('  0.9.0 knappar:', {i: pg.locator('#' + i).is_visible() for i in ('vy3d-konturer', 'vy3d-tradniva-rad', 'vy3d-skuggor', 'vy3d-husfarg-rad', 'vy3d-skissfarg-rad', 'vy3d-ogon', 'vy3d-bild', 'vy3d-ai')})
    print('  0.9.1 knappar:', {i: pg.locator('#' + i).is_visible() for i in ('vy3d-takformer', 'vy3d-konturfarg-rad', 'vy3d-gransfarg-rad')},
          'takformer', pg.evaluate(f'{v3}.takformantal()'))
    if pg.locator('#vy3d-konturer').is_visible():
        pg.click('#vy3d-konturer'); assert pg.evaluate(f'{v3}.konturer()') is True
    if pg.locator('#vy3d-husfarg-rad').is_visible():
        pg.eval_on_selector('#vy3d-husfarg', "e => { e.value = '#d8c3a0'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
        assert pg.evaluate(f'{v3}.byggnadsfarg()') == '#d8c3a0'
    if pg.locator('#vy3d-konturfarg-rad').is_visible():
        pg.eval_on_selector('#vy3d-konturfarg', "e => { e.value = '#2050c0'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
        assert pg.evaluate(f'{v3}.konturfarg()') == '#2050c0'
    if pg.locator('#vy3d-gransfarg-rad').is_visible():
        pg.eval_on_selector('#vy3d-gransfarg', "e => { e.value = '#10a010'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
        assert pg.evaluate(f'{v3}.gransfarg()') == '#10a010'
    if pg.locator('#vy3d-takformer').is_visible():
        pg.click('#vy3d-takformer'); pg.wait_for_timeout(300)
        assert pg.evaluate(f'{v3}.takformer()') is True and pg.get_attribute('#vy3d-takformer', 'aria-pressed') == 'true'
    if pg.locator('#vy3d-tradniva-rad').is_visible():
        print('  träd enkla:', pg.evaluate(f'{v3}.tradantal()'))
        pg.select_option('#vy3d-tradniva', 'detaljerad'); pg.wait_for_timeout(300)
        antal = pg.evaluate(f'{v3}.tradantal()')
        print('  träd detaljerade (0.10.0, typer):', antal)
        assert sum(antal['detaljerad'].values()) > 0, 'detaljerade träd visas'
        assert pg.locator('#vy3d-tradniva option[value=realistisk]').count() == 0, 'Realistiska är borttaget'
    pg.wait_for_timeout(500); pg.screenshot(path=f'{UT}/06g_3d_konturer_trad.png')
    # närbild på huset med takform och de detaljerade träden: zooma in mot mitten, sedan ögonhöjd framför huset
    yta = pg.locator('#vy3d-yta canvas').bounding_box()
    cx3, cy3 = yta['x'] + yta['width'] / 2, yta['y'] + yta['height'] / 2
    for _ in range(6): pg.mouse.move(cx3, cy3); pg.mouse.wheel(0, -500); pg.wait_for_timeout(80)
    pg.wait_for_timeout(800); pg.screenshot(path=f'{UT}/06l_3d_takform_nara.png')
    pg.click('#vy3d-ogon'); pg.mouse.click(cx3, cy3 + yta['height'] * 0.3); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{UT}/06m_3d_tak_och_trad_ogonhojd.png')
    pg.evaluate(f'{v3}.oversikt()'); pg.evaluate(f'{v3}.aterstall()'); pg.wait_for_timeout(300)
    if pg.locator('#vy3d-skuggor').is_visible():
        pg.click('#vy3d-skuggor'); pg.wait_for_timeout(300)
        assert pg.locator('#vy3d-sol').is_visible(), 'solraden syns med skuggor'
        pg.click('[data-solhandelse=mars]')
        pg.fill('#vy3d-tid', '600'); pg.dispatch_event('#vy3d-tid', 'input'); pg.wait_for_timeout(800)
        print('  sol vårdagjämning 10:00:', pg.input_value('#vy3d-datum'), pg.inner_text('#vy3d-solinfo'))
        pg.screenshot(path=f'{UT}/06h_3d_skuggor_mars_10.png')
        pg.click('[data-solhandelse=juni]'); pg.fill('#vy3d-tid', '1080'); pg.dispatch_event('#vy3d-tid', 'input'); pg.wait_for_timeout(800)
        print('  sol midsommar 18:00:', pg.input_value('#vy3d-datum'), pg.inner_text('#vy3d-solinfo'))
        pg.screenshot(path=f'{UT}/06i_3d_skuggor_juni_18.png')
        pg.click('#vy3d-spela'); pg.wait_for_timeout(1500)
        t1 = pg.input_value('#vy3d-tid'); pg.wait_for_timeout(1000); t2 = pg.input_value('#vy3d-tid')
        pg.click('#vy3d-spela')
        print('  uppspelning:', t1, '→', t2); assert t1 != t2, 'tiden går vid uppspelning'
        pg.click('[data-solhandelse=dec]'); pg.fill('#vy3d-tid', '1320'); pg.dispatch_event('#vy3d-tid', 'input'); pg.wait_for_timeout(300)
        assert 'under horisonten' in pg.inner_text('#vy3d-solinfo'), 'solen nere en decemberkväll'
        pg.fill('#vy3d-tid', '720'); pg.dispatch_event('#vy3d-tid', 'input'); pg.wait_for_timeout(300)
    # bilder: en PNG, och för AI en zip med fyra bilder
    pg.select_option('#vy3d-skala', '2')
    with pg.expect_download(timeout=60000) as d:
        pg.click('#vy3d-bild')
    open(f'{UT}/3d_bild.png', 'wb').write(open(d.value.path(), 'rb').read())
    from PIL import Image
    bild = Image.open(f'{UT}/3d_bild.png'); yb = pg.locator('#vy3d-yta').bounding_box()
    print('  spara bild:', d.value.suggested_filename, bild.size, 'skärmen', round(yb['width']), '×', round(yb['height']))
    assert abs(bild.size[0] - 2 * round(yb['width'])) <= 2, 'bilden är 2 × skärmen'
    with pg.expect_download(timeout=120000) as d:
        pg.click('#vy3d-ai')
    open(f'{UT}/3d_ai.zip', 'wb').write(open(d.value.path(), 'rb').read())
    import zipfile
    z = zipfile.ZipFile(f'{UT}/3d_ai.zip'); print('  bild för AI:', d.value.suggested_filename, sorted(z.namelist()))
    for n in z.namelist():
        z.extract(n, f'{UT}/3d_ai')
    assert len([n for n in z.namelist() if n.endswith('.png')]) == 4
    # ögonhöjd: knappen väntar på ett klick på marken, WASD går, Esc tillbaka
    yta = pg.locator('#vy3d-yta canvas').bounding_box()
    mx, my = yta['x'] + yta['width'] / 2, yta['y'] + yta['height'] / 2
    pg.mouse.dblclick(mx, my); pg.wait_for_timeout(200)
    pg.click('#vy3d-ogon'); assert pg.evaluate(f'{v3}.lage()') == 'valj'
    print('  välj punkt, hjälp:', pg.inner_text('#vy3d-hjalp'))
    pg.mouse.click(mx, my + 40); pg.wait_for_timeout(400)
    kam0 = pg.evaluate(f'{v3}.kameralage()')
    print('  ögonhöjd:', kam0['lage'], [round(v, 1) for v in kam0['position']])
    assert kam0['lage'] == 'ogon'
    pg.screenshot(path=f'{UT}/06j_3d_ogonhojd.png')
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(1000); pg.keyboard.up('KeyW')
    kam1 = pg.evaluate(f'{v3}.kameralage()')
    gatt = ((kam1['position'][0] - kam0['position'][0]) ** 2 + (kam1['position'][2] - kam0['position'][2]) ** 2) ** 0.5
    print('  gick med W i 1 s:', round(gatt, 1), 'm')
    assert gatt > 1, 'W går framåt'
    pg.mouse.move(mx, my); pg.mouse.down(); pg.mouse.move(mx + 200, my, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{UT}/06k_3d_ogonhojd_vriden.png')
    # ett klick låser inte musen och tar inte en ur läget (0.9.1)
    pg.mouse.click(mx, my); pg.wait_for_timeout(300)
    assert pg.evaluate('document.pointerLockElement') is None, 'klick i ögonhöjd låser inte musen'
    assert pg.evaluate(f'{v3}.lage()') == 'ogon', 'klick i ögonhöjd stannar i läget'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    assert pg.evaluate(f'{v3}.lage()') == 'oversikt' and pg.locator('#vy3d').is_visible(), 'Esc tillbaka utan att stänga'
    pg.click('#vy3d-ogon'); pg.keyboard.press('Escape'); assert pg.evaluate(f'{v3}.lage()') == 'oversikt', 'Esc avbryter valet'

    # 0.10.0: egen takform på ett befintligt hus, klicka på huset
    hus3 = pg.evaluate("(() => { const b = TERRANG_TEST.byggnader.find(b => b.tak); return b ? Byggnad.tyngdpunkt(b.fotavtryck) : null; })()")
    if hus3:
        pg.evaluate(f'{v3}.aterstall()'); pg.wait_for_timeout(200)
        hid = pg.evaluate(f'{v3}.klickaHus({hus3[0]}, {hus3[1]})')
        pg.wait_for_timeout(300)
        print('  takpanel:', hid, pg.inner_text('#tak-namn'), '|', pg.inner_text('#tak-info'))
        assert hid and pg.locator('#vy3d-tak').is_visible(), 'klick på huset öppnar takpanelen'
        pg.select_option('#tak-form', 'valmat'); pg.fill('#tak-lutning', '40'); pg.dispatch_event('#tak-lutning', 'change'); pg.wait_for_timeout(300)
        info = pg.inner_text('#tak-info'); print('  valmat 40°:', info)
        assert 'Valmat 40°' in info
        sparat = pg.evaluate("JSON.parse(localStorage.getItem('terrang-takval') || '{}')")
        assert any(v.get('form') == 'valmat' for v in sparat.values()), 'valet sparas'
        assert pg.evaluate(f'{v3}.takformer()') is True
        for _ in range(4): pg.mouse.move(cx3, cy3); pg.mouse.wheel(0, -500); pg.wait_for_timeout(60)
        pg.wait_for_timeout(500); pg.screenshot(path=f'{UT}/06n_3d_egen_takform.png')
        pg.select_option('#tak-riktning', 'tvars'); pg.select_option('#tak-form', 'pulpettak'); pg.wait_for_timeout(300)
        print('  pulpet tvärs:', pg.inner_text('#tak-info')); assert 'Pulpettak' in pg.inner_text('#tak-info') and pg.locator('#tak-vand-rad').is_visible()
        pg.click('#tak-aterstall'); pg.wait_for_timeout(200)
        assert pg.evaluate("Object.keys(JSON.parse(localStorage.getItem('terrang-takval') || '{}')).length") == 0, 'Ur laserdatan tar bort valet'
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        assert not pg.locator('#vy3d-tak').is_visible() and pg.locator('#vy3d').is_visible(), 'Esc stänger takpanelen, inte vyn'
        pg.evaluate(f'{v3}.aterstall()')

    # 0.10.0: modellera volymer i 3D-vyn
    pg.click('#vy3d-modellera'); pg.wait_for_timeout(300)
    assert pg.evaluate(f'{v3}.modellera()') is True and pg.locator('#vy3d-modell').is_visible()
    fore = pg.evaluate(f'{v3}.volymer().length')
    mitt3 = pg.evaluate("(() => { const r = TERRANG_TEST.vy3d.kameralage(); return r; })()")
    # ny volym ur panelen, placerad med ett klick mitt i vyn
    pg.click('#vy3d-ny'); pg.wait_for_timeout(100)
    pg.select_option('#ny-typ', 'block'); pg.fill('#ny-b', '12'); pg.fill('#ny-d', '8'); pg.fill('#ny-h', '6')
    pg.click('#vy3d-nyform button[type=submit]'); pg.wait_for_timeout(200)
    yta = pg.locator('#vy3d-yta canvas').bounding_box(); mx, my = yta['x'] + yta['width'] / 2, yta['y'] + yta['height'] * 0.55
    pg.mouse.move(mx - 10, my); pg.mouse.move(mx, my, steps=3); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{UT}/07a_modell_placera.png')
    pg.mouse.click(mx, my); pg.wait_for_timeout(400)
    vol = pg.evaluate(f'{v3}.volymer()'); a = pg.evaluate(f'{v3}.vald()')
    print('  ny volym:', len(vol) - fore, a and a['namn'], a and [round(q, 1) for q in a['fotavtryck'][0]], 'golv', a and a['golv'])
    assert len(vol) == fore + 1 and a and a['primitiv']['typ'] == 'block' and pg.locator('#vy3d-valdform').is_visible()
    ax, ay = a['primitiv']['x'], a['primitiv']['y']
    # ett prisma 0,3 m bredvid snäpper an mot blockets sida
    pv = pg.evaluate(f"{v3}.nyVolym({{ typ: 'prisma', b: 10, d: 8, hojd: 4, takform: 'sadel', taklutning: 30 }}, {{ x: {ax + 11.3}, y: {ay + 0.4} }})")
    sn = pg.evaluate(f"{v3}.dra('{pv['id']}', 0, 0, {{ tol: 0.5 }})"); pv = pg.evaluate(f'{v3}.vald()')
    print('  snäpp:', sn, round(pv['primitiv']['x'] - ax, 3), round(pv['primitiv']['y'] - ay, 3))
    assert sn and sn['typ'] == 'yta' and abs(pv['primitiv']['x'] - ax - 11) < 0.01 and abs(pv['primitiv']['y'] - ay) < 0.01, 'an mot sidan, hörnen i linje'
    pg.wait_for_timeout(300)
    kedjor = pg.evaluate(f'{v3}.kedjor()'); print('  kedjor:', kedjor)
    assert any({k['a'], k['b']} == {a['id'], pv['id']} for k in kedjor), 'kedjeikon i fogen'
    # avstånd efter snäppet: 2 m
    assert pg.locator('#vald-snapp').is_visible(), 'avståndsfältet syns efter snäpp'
    pg.fill('#vald-avstand', '2'); pg.dispatch_event('#vald-avstand', 'change'); pg.wait_for_timeout(200)
    pv = pg.evaluate(f'{v3}.vald()'); print('  avstånd 2 m:', round(pv['primitiv']['x'] - ax, 3))
    assert abs(pv['primitiv']['x'] - ax - 13) < 0.01
    pg.evaluate(f"{v3}.angra()"); pv = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{pv['id']}')")
    assert abs(pv['primitiv']['x'] - ax - 11) < 0.01, 'ångra'
    # kedjan: klick sätter ihop, då följer prismat med när blocket flyttas
    pg.evaluate(f"{v3}.vald('{a['id']}')"); pg.wait_for_timeout(300)
    knapp = pg.locator(f".vy3d-kedja[data-a='{a['id']}'][data-pv='{pv['id']}'], .vy3d-kedja[data-a='{pv['id']}'][data-pv='{a['id']}']")
    knapp.first.click(); pg.wait_for_timeout(300)
    assert pg.evaluate(f'{v3}.kedjor()')[0]['lankad'] or any(k['lankad'] for k in pg.evaluate(f'{v3}.kedjor()')), 'länkad'
    print('  grupp:', pg.inner_text('#vald-grupp'))
    # dra blocket med musen i toppvyn: prismat följer med
    pg.click('#vy3d-toppvy'); pg.wait_for_timeout(500)
    assert pg.evaluate(f'{v3}.toppvy()') is True
    a = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{a['id']}')")
    s0 = pg.evaluate(f"{v3}.skarmpunkt({a['primitiv']['x']}, {a['primitiv']['y']}, {a['golv'] + a['takfot']})")
    pg.mouse.move(s0['x'], s0['y']); pg.mouse.down(); pg.mouse.move(s0['x'] + 60, s0['y'] + 30, steps=8); pg.mouse.up(); pg.wait_for_timeout(400)
    a2 = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{a['id']}')"); b2 = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{pv['id']}')")
    da = (a2['primitiv']['x'] - a['primitiv']['x'], a2['primitiv']['y'] - a['primitiv']['y']); db = (b2['primitiv']['x'] - pv['primitiv']['x'], b2['primitiv']['y'] - pv['primitiv']['y'])
    print('  dragen med musen:', [round(q, 2) for q in da], 'prismat:', [round(q, 2) for q in db])
    assert da[0] > 1 and da[1] < -0.5 and abs(da[0] - db[0]) < 1e-3 and abs(da[1] - db[1]) < 1e-3, 'gruppen flyttas ihop, öster och söder'
    pg.screenshot(path=f'{UT}/07b_modell_toppvy.png')
    # vrid med handtaget och skift: steg om 15°
    h = pg.locator('.vy3d-vrid').bounding_box()
    c0 = pg.evaluate(f"{v3}.skarmpunkt({a2['primitiv']['x']}, {a2['primitiv']['y']}, {a2['golv']})")
    import math
    r = math.hypot(h['x'] + 14 - c0['x'], h['y'] + 14 - c0['y']); a0 = math.atan2(h['y'] + 14 - c0['y'], h['x'] + 14 - c0['x'])
    pg.keyboard.down('Shift'); pg.mouse.move(h['x'] + 14, h['y'] + 14); pg.mouse.down()
    for k in range(1, 9):
        v = a0 - k * 0.05; pg.mouse.move(c0['x'] + r * math.cos(v), c0['y'] + r * math.sin(v))
    pg.mouse.up(); pg.keyboard.up('Shift'); pg.wait_for_timeout(300)
    a3 = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{a['id']}')"); b3 = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{pv['id']}')")
    print('  vriden:', a3['primitiv']['vrid'], b3['primitiv']['vrid'])
    assert a3['primitiv']['vrid'] % 15 == 0 and a3['primitiv']['vrid'] != 0 and abs(a3['primitiv']['vrid'] - b3['primitiv']['vrid']) < 1e-6, 'vriden i steg om 15°, gruppen med'
    pg.evaluate(f"{v3}.vrida('{a['id']}', {-a3['primitiv']['vrid']})")
    # ovanpå: ett mindre block mitt på blocket står på dess tak
    a = pg.evaluate(f"{v3}.volymer().find(v => v.id === '{a['id']}')")
    c = pg.evaluate(f"{v3}.nyVolym({{ typ: 'block', b: 6, d: 6, hojd: 3 }}, {{ x: {a['primitiv']['x'] + 1}, y: {a['primitiv']['y']} }})")
    print('  ovanpå: golv', c['golv'], 'blockets tak', round(a['golv'] + a['takfot'], 3), '|', pg.inner_text('#vald-golvtext'))
    assert abs(c['golv'] - (a['golv'] + a['takfot'])) < 1e-3 and 'står på' in pg.inner_text('#vald-golvtext').lower()
    # mått i panelen: bredden 6 → 9 m
    pg.fill('#vald-b', '9'); pg.dispatch_event('#vald-b', 'change'); pg.wait_for_timeout(200)
    c = pg.evaluate(f'{v3}.vald()'); xs = [q[0] for q in c['fotavtryck']]
    assert abs(max(xs) - min(xs) - 9) < 0.01, 'bredden ändrad'
    # en cylinder in i blocket (union): kanterna inuti tas bort
    pg.evaluate(f"{v3}.nyVolym({{ typ: 'cylinder', diam: 8, hojd: 9 }}, {{ x: {a['primitiv']['x'] - 6}, y: {a['primitiv']['y'] - 4} }})")
    pg.click('#vy3d-toppvy'); pg.wait_for_timeout(300)
    pg.evaluate(f"{v3}.tittaPa({a['primitiv']['x']}, {a['primitiv']['y']}, 70)")
    pg.evaluate(f"{v3}.vald(null)"); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{UT}/07c_modell_perspektiv.png')
    if pg.locator('#vy3d-skuggor').is_visible():
        if pg.get_attribute('#vy3d-skuggor', 'aria-pressed') != 'true': pg.click('#vy3d-skuggor')
        pg.click('[data-solhandelse=mars]'); pg.fill('#vy3d-tid', '780'); pg.dispatch_event('#vy3d-tid', 'input'); pg.wait_for_timeout(800)
        pg.screenshot(path=f'{UT}/07d_modell_skuggor.png'); pg.click('#vy3d-skuggor')
    # ta bort med Delete, ångra
    n0 = len(pg.evaluate(f'{v3}.volymer()'))
    pg.evaluate(f"{v3}.vald('{c['id']}')"); pg.mouse.move(mx, my); pg.keyboard.press('Delete'); pg.wait_for_timeout(200)
    assert len(pg.evaluate(f'{v3}.volymer()')) == n0 - 1, 'Delete tar bort'
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
    assert len(pg.evaluate(f'{v3}.volymer()')) == n0, 'Ctrl+Z tar tillbaka'
    # skissen följer med tillbaka till 04 Skiss
    print('  volymlistan:', pg.locator('#volymlista li').count(), 'volymer i 3D:', n0)
    assert pg.locator('#volymlista li').count() == n0
    pg.evaluate(f"{v3}.vald('{c['id']}')"); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    assert pg.evaluate(f'{v3}.vald()') is None and pg.evaluate(f'{v3}.modellera()') is True, 'Esc tar bort valet'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    assert pg.evaluate(f'{v3}.modellera()') is False and not pg.locator('#vy3d-modell').is_visible() and pg.locator('#vy3d').is_visible(), 'Esc igen går ur modelleringen'
    if pg.locator('#vy3d-skuggor').is_visible() and pg.get_attribute('#vy3d-skuggor', 'aria-pressed') == 'true': pg.click('#vy3d-skuggor')
    if pg.locator('#vy3d-konturer').is_visible() and pg.get_attribute('#vy3d-konturer', 'aria-pressed') == 'true': pg.click('#vy3d-konturer')
    if pg.locator('#vy3d-tradniva-rad').is_visible(): pg.select_option('#vy3d-tradniva', 'enkel')
    if pg.locator('#vy3d-takformer').is_visible() and pg.get_attribute('#vy3d-takformer', 'aria-pressed') == 'true': pg.click('#vy3d-takformer')
    pg.click('#vy3d-stang')
    print('  efter stängning:', pg.inner_text('#status-text'))
    assert 'Skissen är ändrad' in pg.inner_text('#status-text')

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
