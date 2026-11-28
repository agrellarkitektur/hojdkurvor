# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för låset och hämtminnet (0.14.3, AY och AT) mot testservern (test/server.py).

    python3 test/las_test.py <utkatalog> [tema]

Skapar underlag två gånger för samma område: andra gången ska inget hämtas från testservern och
knappen säga *Uppdatera* (0.16.5, förut *igen*). Ramen ska gå att dra efter flera Skapa (AT). Låset: handtagen och krysset
försvinner, ramen går inte att dra, Rita är avstängd, och låset finns kvar efter omladdning.
Lassot i 3D-vyn släcks när vyn rörs (AU).
"""
import re, sys, os
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


def utsnitt(pg):
    return {k: pg.input_value('#' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax')}


def norrkant(pg):
    """Skärmpunkten en fjärdedel in på ramens norra kant (mitt på sitter handtaget)."""
    return pg.evaluate("""(() => {
      const r = { xmin: +xmin.value, xmax: +xmax.value, ymax: +ymax.value };
      const ll = Terrang.omvandlare(+zon.value, 4326).forward([r.xmin + (r.xmax - r.xmin) / 4, r.ymax]);
      const k = TERRANG_TEST.karta, p = k.latLngToContainerPoint([ll[1], ll[0]]), b = k.getContainer().getBoundingClientRect();
      return [b.left + p.x, b.top + p.y];
    })()""")


def dra_ramen(pg, dy=40):
    x, y = norrkant(pg)
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y + dy, steps=8); pg.mouse.up()
    pg.wait_for_timeout(300)


def skapa(pg):
    pg.click('#skapa')
    pg.wait_for_function("!document.querySelector('#skapa').disabled && !document.querySelector('#resultat').hidden", timeout=600000, polling=300)
    pg.wait_for_timeout(400)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
    pg = ctx.new_page()
    logg, anrop = [], []
    pg.on('pageerror', lambda e: logg.append(f'PAGEERROR: {e}'))
    pg.on('request', lambda r: anrop.append(r.url) if r.url.startswith(ROT) else None)
    pg.goto(APP); pg.wait_for_timeout(700)

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
    pg.fill('#projekt', 'Las 1'); pg.dispatch_event('#projekt', 'input')
    for v in ('laser', 'trad', 'ortofoto', 'byggnader', 'vagar', 'vagytor', 'hojdpunkter', 'platsanalys'):
        pg.evaluate(f"""() => {{ const i = document.querySelector('input[name=tillval][value={v}]'); if (i && !i.checked) {{ i.checked = true; i.dispatchEvent(new Event('change', {{ bubbles: true }})); }} }}""")
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.wait_for_function("TERRANG_TEST.karta", timeout=5000)

    knapp1 = pg.inner_text('#skapa').lower()
    skapa(pg)
    forsta = len(anrop)
    knapp2 = pg.inner_text('#skapa').lower()
    print('  knappen före och efter:', knapp1, '|', knapp2)
    # sedan 0.16.5 (DV) säger knappen Uppdatera i stället för igen
    assert 'uppdatera' not in knapp1 and 'uppdatera' in knapp2, 'knappen säger Uppdatera när underlaget finns'

    # --- andra Skapa: inget hämtas från testservern
    anrop.clear()
    skapa(pg)
    print('  anrop andra gången:', len(anrop), 'första gången:', forsta, anrop[:5])
    # kvar: HEAD-frågan om kommunfilen är ny (kommunfil.js) och rutor som saknas i testservern
    # (felsvar sparas inte); allt underlag kommer ur minnet
    assert forsta > 50 and len(anrop) <= 5, 'underlaget ska inte hämtas igen för samma område'
    samman = pg.evaluate("[...document.querySelectorAll('#sammanfattning dt')].map(dt => dt.textContent + ': ' + dt.nextElementSibling.textContent)")
    rad = next((l for l in samman if 'fanns redan' in l), None)
    print('  sammanfattningen:', rad)
    assert rad, 'raden Hämtat i sammanfattningen'
    skapa(pg)

    # --- AT: ramen går att dra efter tre Skapa
    fore = utsnitt(pg)
    dra_ramen(pg)
    efter = utsnitt(pg)
    print('  dra i ramen efter tre Skapa:', fore['ymax'], '→', efter['ymax'])
    assert efter['ymax'] != fore['ymax'] and int(efter['ymax']) - int(efter['ymin']) == int(fore['ymax']) - int(fore['ymin']), 'ramen flyttas'
    assert 'uppdatera' not in pg.inner_text('#skapa').lower(), 'nytt område: inte Uppdatera'

    # --- låset
    pg.click('#las-omrade')
    pg.wait_for_timeout(200)
    assert pg.get_attribute('#las-omrade', 'aria-pressed') == 'true'
    assert pg.is_disabled('#rita') and pg.is_disabled('#xmin') and pg.is_disabled('#zon'), 'låst: rita, hörnen och zonen avstängda'
    assert pg.locator('.handtag').count() == 0 and pg.locator('.stang-utsnitt').count() == 0, 'låst: inga handtag eller kryss'
    fore = utsnitt(pg)
    dra_ramen(pg)
    assert utsnitt(pg) == fore, 'låst: ramen flyttas inte'
    print('  låst:', pg.inner_text('#las-hjalp'))
    pg.screenshot(path=os.path.join(UT, f'las_{TEMA}.png'))
    pg.wait_for_timeout(1200)   # autosparet
    pg.reload(); pg.wait_for_timeout(1500)
    assert pg.get_attribute('#las-omrade', 'aria-pressed') == 'true' and pg.is_disabled('#rita'), 'låset finns kvar efter omladdning'
    assert utsnitt(pg) == fore
    pg.click('#las-omrade'); pg.wait_for_timeout(200)
    assert not pg.is_disabled('#rita') and pg.locator('.handtag').count() == 4, 'upplåst: handtagen tillbaka'
    print('  upplåst:', pg.inner_text('#las-omrade'))

    # --- AU: lassot släcks när vyn rörs
    skapa(pg)
    pg.click('#visa-3d'); pg.wait_for_timeout(2500)
    if pg.is_visible('#vy3d-val'):
        pg.click('#vy3d-val'); pg.wait_for_timeout(200)
    pg.click('#vy3d-lasso'); pg.wait_for_timeout(200)
    yb = pg.locator('#vy3d-yta').bounding_box()
    mx, my = yb['x'] + yb['width'] / 2, yb['y'] + yb['height'] / 2
    pg.mouse.move(mx - 150, my - 100); pg.mouse.down()
    for x, y in ((mx + 150, my - 100), (mx + 150, my + 100), (mx - 150, my + 100), (mx - 150, my - 95)):
        pg.mouse.move(x, y, steps=10)
    d0 = pg.get_attribute('svg.vy3d-lasso path', 'd') or ''
    pg.mouse.up(); pg.wait_for_timeout(200)
    d1 = pg.get_attribute('svg.vy3d-lasso path', 'd') or ''
    print('  lasso medan musknappen är nere/efter släpp:', len(d0), len(d1), '|', pg.inner_text('#lasso-info'))
    assert d0 and not d1, 'slingan syns medan man ritar och släcks när musknappen släpps (0.14.4)'

    print('fel:', [l for l in logg if 'PAGEERROR' in l])
    assert not [l for l in logg if 'PAGEERROR' in l]
    b.close()
print('las_test: ok')
