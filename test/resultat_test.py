# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för det sparade resultatet (0.13.6, BJ) mot testservern (test/server.py).

    python3 test/resultat_test.py <utkatalog> [tema]

Skapar underlag med alla tillval, går till Om-sidan (och öppnar Stöd utvecklingen) och tillbaka:
lagren på kartan, sammanfattningen och 3D-knappen ska komma tillbaka utan nytt Skapa, och zip-filen
ska gå att ladda ner med samma filer. Ett ändrat område tar bort det sparade.
"""
import zipfile, io, re, sys, os
from playwright.sync_api import sync_playwright

UT = sys.argv[1] if len(sys.argv) > 1 else '.'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
BAS = 'http://localhost:8765/'
APP = BAS + 'index.html'
ROT = 'http://127.0.0.1:8765'
os.makedirs(UT, exist_ok=True)
INIT = f"""
window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}';
window.TERRANG_OVERPASS='{ROT}/api/interpreter';
window.TERRANG_GEODATA = {{ naturWfs: '{ROT}/nv/wfs', natura2000Wfs: '{ROT}/n2k/wfs', lamningarWms: '{ROT}/raa/wms', oversvamningWms: '{ROT}/mcf/wms', overpass: '{ROT}/api/interpreter' }};
window.TERRANG_PAUSER = [80, 80];
window.TERRANG_TEST = {{}};
delete window.showSaveFilePicker;
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
"""


def lager(pg):
    return pg.locator('#lp-lager').inner_text().replace('\n', ' | ')


def senaste_nycklar(pg):
    return pg.evaluate("(() => { const s = TERRANG_TEST.senaste(); return s ? Object.keys(s).filter(k => s[k] != null).sort() : null; })()")


def ladda_ner(pg):
    with pg.expect_download() as d:
        pg.click('#ladda-ner')
    z = zipfile.ZipFile(io.BytesIO(open(d.value.path(), 'rb').read()))
    return d.value.suggested_filename, sorted(i.filename for i in z.infolist())


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
    pg = ctx.new_page()
    logg = []
    pg.on('pageerror', lambda e: logg.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: logg.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.goto(APP); pg.wait_for_timeout(700)

    # --- ett område i 15 00 och alla tillval utom sektion och horisontpunkt
    pg.select_option('#zon', '3009')
    c = pg.evaluate("Terrang.omvandlare(3006, 3009).forward([539750, 6427700])")
    pg.click('#rita')
    box = pg.locator('#karta').bounding_box()
    cx, cy = box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.6
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 30, steps=5); pg.mouse.up()
    pg.wait_for_timeout(300)
    pg.select_option('#zon', '3009')
    r0 = dict(xmin=round(c[0] - 150, -1), xmax=round(c[0] + 150, -1), ymin=round(c[1] - 100, -1), ymax=round(c[1] + 100, -1))
    for k, v in r0.items():
        pg.fill('#' + k, str(int(v))); pg.dispatch_event('#' + k, 'change')
    pg.fill('#projekt', 'Staren 2'); pg.dispatch_event('#projekt', 'input')
    pg.evaluate("""() => document.querySelectorAll('input[name=tillval]').forEach(i => {
      if (['sektion', 'horisont'].includes(i.value) || i.checked) return;
      i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true }));
    })""")
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.click('#skapa')
    pg.wait_for_selector('#resultat:not([hidden])', timeout=600000)
    pg.wait_for_function("Resultat.alla().then(a => a.length === 1)", timeout=60000, polling=500)
    pg.wait_for_timeout(500)
    fore = {
        'lager': lager(pg),
        'sammanfattning': pg.locator('#sammanfattning').text_content(),
        'nycklar': senaste_nycklar(pg),
        'kurvor': pg.evaluate("TERRANG_TEST.senaste().kurvor.length"),
        'zip': ladda_ner(pg),
    }
    meta = pg.evaluate("Resultat.alla()")
    print('sparat:', [(m['storlek'], m['zip'], m['zipStorlek']) for m in meta])
    print('sammanfattning:', fore['sammanfattning'].replace('\n', ' | '))
    print('lager:', fore['lager'])
    print('zip:', fore['zip'][0], len(fore['zip'][1]), 'filer')
    assert 'Sparat' in fore['sammanfattning'] and 'finns kvar om du byter sida' in fore['sammanfattning']
    assert meta[0]['zip'], 'zip-filen sparas'
    pg.screenshot(path=f'{UT}/resultat_1_skapat_{TEMA}.png')

    # --- till Om-sidan, Stöd utvecklingen, och tillbaka med menyn
    pg.click('.huvudmeny a[href="om.html"]'); pg.wait_for_load_state('load'); pg.wait_for_timeout(400)
    pg.click('[data-stod]'); pg.wait_for_timeout(300)
    assert pg.locator('dialog.stod img[src="bilder/swish-kort.png"]').is_visible()
    pg.locator('dialog.stod').screenshot(path=f'{UT}/stod_dialog_{TEMA}.png')
    pg.keyboard.press('Escape')
    pg.locator('#stod').screenshot(path=f'{UT}/stod_om_{TEMA}.png')
    pg.click('.huvudmeny a[href="index.html"]'); pg.wait_for_load_state('load')
    pg.wait_for_selector('#resultat:not([hidden])', timeout=30000)
    pg.wait_for_timeout(800)
    status = pg.locator('#status-text').inner_text()
    efter_lager = lager(pg)
    print('tillbaka:', status)
    print('lager:', efter_lager)
    assert 'inläst från webbläsaren' in status
    assert efter_lager == fore['lager'], 'samma lager på kartan'
    assert pg.locator('#sammanfattning').text_content() == fore['sammanfattning'], 'samma sammanfattning'
    assert senaste_nycklar(pg) == fore['nycklar'] or set(fore['nycklar']) - set(senaste_nycklar(pg)) == {'yta'}, (fore['nycklar'], senaste_nycklar(pg))
    assert pg.evaluate("TERRANG_TEST.senaste().kurvor.length") == fore['kurvor']
    assert pg.evaluate("TERRANG_TEST.senaste().ortofoto.canvas instanceof HTMLCanvasElement"), 'ortofotot har sin canvas igen'
    tak = pg.evaluate("(TERRANG_TEST.senaste().byggnaderAlla || []).filter(b => b.tak).length")
    print('hus med tak:', tak)
    assert pg.is_visible('#visa-3d')
    pg.screenshot(path=f'{UT}/resultat_2_inlast_{TEMA}.png')
    zip2 = ladda_ner(pg)
    assert zip2 == fore['zip'], 'samma zip-fil'
    # 3D-vyn öppnas med det inlästa
    pg.click('#visa-3d'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{UT}/resultat_3_3d_{TEMA}.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    # --- omladdning läser också in
    pg.reload(); pg.wait_for_selector('#resultat:not([hidden])', timeout=30000)
    # --- ändrat område: det sparade tas bort och läses inte in
    pg.fill('#xmax', str(int(r0['xmax'] + 20))); pg.dispatch_event('#xmax', 'change')
    pg.wait_for_function("Resultat.alla().then(a => a.length === 0)", timeout=10000, polling=200)
    assert pg.is_hidden('#resultat')
    pg.reload(); pg.wait_for_timeout(1500)
    assert pg.is_hidden('#resultat'), 'inget gammalt resultat efter ändrat område'

    fel = [x for x in logg if 'PAGEERROR' in x or 'Det sparade underlaget' in x or 'kunde inte ritas' in x]
    print('fel:', fel)
    assert not fel
    print('resultat_test: ok')
    b.close()
