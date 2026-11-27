# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för klockan och loggen under Skapa (0.16.5, DU, DW och DV) mot testservern
(test/server.py) med Playwright och Chromium.

    python3 test/skapalogg_test.py <utkatalog> [tema]

Prövar:
- DU: klockan tickar under Skapa och säger vilket steg som pågår. Vägarna från en Overpass som aldrig
  svarar ger en varning efter tidsgränsen, och resten av underlaget blir klart.
- DW: Kopiera status och logg kopierar status, sammanfattning och logg som text.
- DV: andra gången säger knappen Uppdatera, med en rad om att det går fortare.
"""
import re, sys, os
from playwright.sync_api import sync_playwright

UT = sys.argv[1] if len(sys.argv) > 1 else '.'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
ROT = 'http://127.0.0.1:8765'
os.makedirs(UT, exist_ok=True)
INIT = f"""
window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}';
window.TERRANG_OVERPASS='{ROT}/hanger/interpreter'; window.TERRANG_OVERPASS_TID = 1500;
window.TERRANG_TEST = {{}};
delete window.showSaveFilePicker;
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
"""


def klart(pg):
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=180000)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1500, 'height': 950})
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://localhost:8765')
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
    # en Overpass som aldrig svarar (vägarna, DU)
    ctx.route(re.compile(r'.*/hanger/interpreter.*'), lambda r: None)
    pg = ctx.new_page()
    fel = []
    pg.on('pageerror', lambda e: fel.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(800)
    pg.click('#rita'); box = pg.locator('#karta').bounding_box()
    cx, cy = box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.6
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 30, steps=5); pg.mouse.up()
    pg.select_option('#zon', '3006')
    for k, v in dict(xmin=539740, xmax=539940, ymin=6427640, ymax=6427760).items():
        pg.fill('#' + k, str(v)); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(500)
    for flik in ('underlag', 'analys'):
        pg.click('#flik-' + flik)
        pg.evaluate("document.querySelectorAll('.steg-panel details').forEach(d => d.open = true)")
        for r in pg.locator(f'#steg-{flik} input[name=tillval]:checked, #steg-{flik} input[name=val]:checked').all():
            if r.is_visible() and r.is_enabled(): r.uncheck()
    pg.click('#flik-underlag')
    pg.check('input[name=tillval][value=vagar]')
    pg.click('#flik-plats')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    assert pg.locator('#skapa-hjalp').is_hidden(), 'ingen rad om uppdatering första gången'
    forsta = pg.text_content('#skapa')
    assert forsta.startswith('Skapa'), forsta

    # --- DU: klockan under Skapa (höjddatan fördröjd så att klockan hinner synas)
    ctx.route(re.compile(r'.*\.tif.*'), lambda r: (pg.wait_for_timeout(1200), r.continue_()))
    pg.click('#skapa'); pg.wait_for_timeout(1300)
    pg.locator('.panel-fot').screenshot(path=os.path.join(UT, f'skapalogg-klocka-{TEMA}.png'))
    klocka = pg.text_content('#status-klocka')
    print('klockan under Skapa:', klocka)
    assert pg.locator('#status-klocka').is_visible(), 'klockan syns under Skapa'
    assert re.match(r'^0:0\d · \S', klocka), klocka
    assert pg.locator('#status-kopiera').is_hidden(), 'kopieringen syns först när Skapa är klar'
    klart(pg)
    status = pg.text_content('#status-text')
    print('status:', status)
    assert 'Vägar: OpenStreetMap (Overpass) svarade inte inom 2 s' in status, status
    assert pg.locator('#status-klocka').is_hidden(), 'klockan döljs efteråt'
    pg.locator('.panel-fot').screenshot(path=os.path.join(UT, f'skapalogg-{TEMA}.png'))

    # --- DW: kopiera status och logg
    assert pg.locator('#kopiera-logg').is_visible()
    pg.click('#kopiera-logg'); pg.wait_for_timeout(300)
    text = pg.evaluate('navigator.clipboard.readText()')
    print(text)
    for del_ in ('Höjdkurvor 0.', 'STATUS', 'SAMMANFATTNING', 'LOGG', 'Skapa startar', 'Terrängen', 'Vägar: OpenStreetMap (Overpass) svarade inte', 'Klart med 1 varning'):
        assert del_ in text, 'saknas i texten: ' + del_
    assert 'hemligt' not in text, 'lösenordet följer inte med'
    assert 'Kopierat' in pg.text_content('#kopiera-logg')

    # --- DV: andra gången
    andra = pg.text_content('#skapa')
    print('knappen andra gången:', andra, '|', pg.text_content('#skapa-hjalp'))
    assert andra.startswith('Uppdatera underlag'), andra
    assert pg.locator('#skapa-hjalp').is_visible()
    assert 'samma utsnitt' in pg.text_content('#skapa-hjalp').lower()

    print('sidfel:', fel)
    assert not fel, fel
    b.close()
print('skapalogg: alla prov godkända')
