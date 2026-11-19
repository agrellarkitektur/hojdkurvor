# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur
"""
Gränssnittstest för projektet (0.13.0) mot testservern (test/server.py) med Playwright och Chromium.

    python3 test/projekt_test.py <utkatalog> [tema]

Prövar: autospar i webbläsaren (utsnitt, namn, sektion, volymer, nollpunkt, vridning och val),
att allt finns kvar efter omladdning, Spara projektfil (zip med projekt.json), Nytt projekt,
Senaste projekt, Öppna projektfil och dra-och-släpp, frågan när filen och webbläsaren är oense
(öppna som kopia), inmatning utanför utsnittet, Ta bort under Sparat i webbläsaren, en annan flik
som ändrar samma projekt och flytten av det som sparades i sessionStorage före 0.13.0.
"""
import zipfile, io, re, sys, json, os, base64
from playwright.sync_api import sync_playwright

UT = sys.argv[1] if len(sys.argv) > 1 else '.'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
APP = 'http://localhost:8765/index.html'
ROT = 'http://127.0.0.1:8765'
os.makedirs(UT, exist_ok=True)
INIT = f"""
window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}';
window.TERRANG_TEST = {{}};
delete window.showSaveFilePicker;
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
"""
DXF = '\n'.join(['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', 'GARAGE', '90', '4', '70', '1',
                 '10', '30', '20', '120', '10', '37', '20', '120', '10', '37', '20', '126', '10', '30', '20', '126', '0', 'ENDSEC', '0', 'EOF'])


def utsnitt(pg):
    return {k: int(pg.input_value('#' + k)) for k in ('xmin', 'xmax', 'ymin', 'ymax')}


def satt_utsnitt(pg, r):
    """Ritar ett område om inget finns (fälten syns först då) och skriver in hörnen."""
    if pg.is_hidden('#utsnitt'):
        pg.click('#rita')
        box = pg.locator('#karta').bounding_box()
        cx, cy = box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.6
        pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 40, cy + 30, steps=5); pg.mouse.up()
        pg.wait_for_timeout(300)
        pg.select_option('#zon', '3009')
    for k, v in r.items():
        pg.fill('#' + k, str(int(v))); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(300)


def vanta_sparat(pg, ms=1200):
    pg.wait_for_timeout(ms)


def alla(pg):
    return pg.evaluate("Projekt.dbAlla().then(a => a.map(p => ({ id: p.id, namn: p.namn, antal: p.antal, fil: !!p.filInnehall })))")


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
    pg = ctx.new_page()
    logg = []
    pg.on('pageerror', lambda e: logg.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: logg.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(APP); pg.wait_for_timeout(700)
    print('start:', pg.locator('#projekt-status').inner_text(), '| senaste syns:', pg.locator('#projekt-senaste').is_visible())
    assert alla(pg) == [], 'inget sparas innan något är gjort'

    # --- ett projekt: utsnitt i 15 00, namn, egen nollpunkt, vridning, ett tillval, en sektion och en volym
    pg.select_option('#zon', '3009')
    c = pg.evaluate("Terrang.omvandlare(3006, 3009).forward([539750, 6427700])")
    r0 = dict(xmin=round(c[0] - 150, -1), xmax=round(c[0] + 150, -1), ymin=round(c[1] - 100, -1), ymax=round(c[1] + 100, -1))
    satt_utsnitt(pg, r0)
    pg.fill('#projekt', 'Staren 2'); pg.dispatch_event('#projekt', 'input')
    pg.evaluate("document.getElementById('g-lokalt').open = true")
    pg.check('input[name=nollpunkt][value=egen]')
    pg.fill('#np-z', '112,5'); pg.dispatch_event('#np-z', 'change')
    pg.select_option('#vrid', 'egen'); pg.fill('#vrid-grader', '12,5'); pg.dispatch_event('#vrid-grader', 'change')
    pg.click('#flik-underlag')
    pg.evaluate("document.getElementById('g-kartdata').open = true")
    pg.check('input[name=tillval][value=byggnader]')

    def pkt(x, y):
        return pg.evaluate(f"(() => {{ const ll = Terrang.omvandlare(3009, 4326).forward([{x}, {y}]); return window.__punkt([ll[1], ll[0]]); }})()")
    pg.evaluate("document.getElementById('g-sektioner').open = true")
    pg.click('#rita-sektion')
    for (x, y) in ((c[0] - 100, c[1]), (c[0] + 100, c[1] + 20)):
        q = pkt(x, y); pg.mouse.move(q[0], q[1]); pg.mouse.click(q[0], q[1]); pg.wait_for_timeout(150)
    open(f'{UT}/garage.dxf', 'w').write(DXF)
    pg.click('#flik-skiss')
    pg.set_input_files('#skiss-fil', f'{UT}/garage.dxf'); pg.wait_for_timeout(300)
    pg.check('input[name=dxf-koord][value=lokal]')
    pg.click('#skiss-dxf-ok'); pg.wait_for_timeout(300)
    assert pg.locator('#volymlista li').count() == 1
    vanta_sparat(pg)
    a = alla(pg)
    print('sparat:', a)
    assert len(a) == 1 and a[0]['namn'] == 'Staren 2' and a[0]['antal']['volymer'] == 1 and a[0]['antal']['sektioner'] == 1
    pg.click('#flik-plats'); pg.wait_for_timeout(200)
    print('  status:', pg.locator('#projekt-status').inner_text(), '| osparad:', pg.get_attribute('#projekt-spara', 'class'))
    assert 'osparad' in pg.get_attribute('#projekt-spara', 'class')
    pg.screenshot(path=f'{UT}/p01_projekt.png')

    # --- omladdning: allt finns kvar
    pg.reload(); pg.wait_for_timeout(1200)
    efter = utsnitt(pg)
    print('efter omladdning:', efter, pg.input_value('#zon'), pg.input_value('#projekt'), '| volymer', pg.locator('#volymlista li').count(),
          '| sektioner', pg.locator('#sektionslista li').count(), '| np-z', pg.input_value('#np-z'), '| vrid', pg.input_value('#vrid'), pg.input_value('#vrid-grader'),
          '| byggnader', pg.is_checked('input[name=tillval][value=byggnader]'))
    assert efter == {k: int(v) for k, v in r0.items()} and pg.input_value('#zon') == '3009' and pg.input_value('#projekt') == 'Staren 2'
    assert pg.locator('#volymlista li').count() == 1 and pg.locator('#sektionslista li').count() == 1
    assert pg.input_value('#np-z') == '112.5' and pg.input_value('#vrid') == 'egen' and pg.input_value('#vrid-grader') == '12,5'
    assert pg.is_checked('input[name=tillval][value=byggnader]')
    assert len(alla(pg)) == 1, 'omladdningen gör inget nytt projekt'

    # --- spara projektfil
    with pg.expect_download() as d:
        pg.click('#projekt-spara')
    d.value.save_as(f'{UT}/Staren_2.hojdkurvor')
    pg.wait_for_timeout(800)
    z = zipfile.ZipFile(f'{UT}/Staren_2.hojdkurvor')
    pj = json.loads(z.read('projekt.json'))
    print('projektfil:', d.value.suggested_filename, z.namelist(), pj['plats']['zon'], pj['plats']['utsnitt'], len(pj['inmatning']['volymer']), [h['handelse'] for h in pj['historik']])
    assert d.value.suggested_filename == 'Staren_2.hojdkurvor' and pj['format'] == 'hojdkurvor-projekt' and pj['sparad']
    v0 = pj['inmatning']['volymer'][0]
    assert v0['fotavtryck'][0][0] > 500000, 'volymerna i SWEREF 99 TM'
    assert pj['plats']['nollpunkt']['typ'] == 'egen' and pj['plats']['nollpunkt']['z'] == 112.5
    assert pj['plats']['vridning'] == {'typ': 'egen', 'grader': 12.5}
    assert 'byggnader' in pj['val']['tillval']
    assert 'osparad' not in (pg.get_attribute('#projekt-spara', 'class') or ''), 'ingen markering direkt efter sparandet'
    print('  status:', pg.locator('#projekt-status').inner_text())

    # --- nytt projekt
    pg.click('#projekt-nytt'); pg.wait_for_timeout(500)
    print('nytt:', pg.locator('#projekt-status').inner_text(), '| utsnitt dolt:', pg.is_hidden('#utsnitt'), '| volymer', pg.locator('#volymlista li').count(), '| namn', repr(pg.input_value('#projekt')))
    assert pg.is_hidden('#utsnitt') and pg.locator('#volymlista li').count() == 0 and pg.locator('#sektionslista li').count() == 0 and pg.input_value('#projekt') == ''
    pg.evaluate("document.getElementById('projekt-senaste').open = true"); pg.wait_for_timeout(200)
    print('  senaste:', pg.locator('#projekt-lista li').all_inner_texts())
    assert pg.locator('#projekt-lista li').count() == 1
    pg.screenshot(path=f'{UT}/p02_nytt.png')
    # ett andra projekt med ett annat utsnitt
    satt_utsnitt(pg, dict(xmin=r0['xmin'] + 1000, xmax=r0['xmax'] + 1000, ymin=r0['ymin'], ymax=r0['ymax']))
    pg.fill('#projekt', 'Ladan'); pg.dispatch_event('#projekt', 'input')
    vanta_sparat(pg)
    assert len(alla(pg)) == 2
    # tillbaka till det första via listan
    pg.locator('#projekt-lista button', has_text='Staren 2').click(); pg.wait_for_timeout(800)
    print('öppnat ur listan:', pg.input_value('#projekt'), utsnitt(pg), '| volymer', pg.locator('#volymlista li').count())
    assert pg.input_value('#projekt') == 'Staren 2' and utsnitt(pg) == {k: int(v) for k, v in r0.items()} and pg.locator('#volymlista li').count() == 1
    assert 'osparad' not in (pg.get_attribute('#projekt-spara', 'class') or ''), 'samma som projektfilen'

    # --- ändra, öppna filen: frågan, öppna som kopia
    pg.fill('#projekt', 'Staren 2 ändrad'); pg.dispatch_event('#projekt', 'input'); vanta_sparat(pg)
    pg.set_input_files('#projekt-fil', f'{UT}/Staren_2.hojdkurvor'); pg.wait_for_timeout(600)
    print('frågan:', pg.locator('#pd-text').inner_text(), '|', pg.locator('#pd-fil').inner_text(), '|', pg.locator('#pd-webb').inner_text())
    assert pg.locator('#projektdialog').is_visible()
    pg.screenshot(path=f'{UT}/p03_fragan.png')
    pg.click('#pd-kopia'); pg.wait_for_timeout(800)
    a = alla(pg)
    print('  som kopia:', pg.input_value('#projekt'), [x['namn'] for x in a])
    assert pg.input_value('#projekt') == 'Staren 2 (kopia)' and len(a) == 3
    assert 'osparad' in pg.get_attribute('#projekt-spara', 'class'), 'en kopia är inte sparad i någon fil'

    # --- öppna filens version (dra-och-släpp på kartan)
    pg.locator('#projekt-lista button', has_text='Staren 2 ändrad').click(); pg.wait_for_timeout(600)
    data = base64.b64encode(open(f'{UT}/Staren_2.hojdkurvor', 'rb').read()).decode()
    pg.evaluate(f"""(() => {{
      const b = Uint8Array.from(atob('{data}'), c => c.charCodeAt(0));
      const dt = new DataTransfer(); dt.items.add(new File([b], 'Staren_2.hojdkurvor'));
      const k = document.getElementById('karta');
      k.dispatchEvent(new DragEvent('dragover', {{ dataTransfer: dt, bubbles: true, cancelable: true }}));
      k.dispatchEvent(new DragEvent('drop', {{ dataTransfer: dt, bubbles: true, cancelable: true }}));
    }})()""")
    pg.wait_for_timeout(600)
    assert pg.locator('#projektdialog').is_visible()
    pg.click('#pd-fil'); pg.wait_for_timeout(800)
    print('filens version:', pg.input_value('#projekt'), '|', pg.locator('#status-text').inner_text())
    assert pg.input_value('#projekt') == 'Staren 2' and len(alla(pg)) == 3

    # --- utanför utsnittet: krymp utsnittet så att volymen hamnar utanför
    vol = pg.evaluate("Projekt.dbAlla().then(a => a.find(p => p.namn === 'Staren 2').data.inmatning.volymer[0].fotavtryck)")
    for k, v in dict(xmin=r0['xmax'] - 20, xmax=r0['xmax'], ymin=r0['ymax'] - 20, ymax=r0['ymax']).items():
        pg.fill('#' + k, str(int(v))); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(300)
    print('utanför:', pg.locator('#projekt-utanfor').inner_text())
    assert 'ligger utanför utsnittet' in pg.locator('#projekt-utanfor').inner_text()
    pg.screenshot(path=f'{UT}/p04_utanfor.png')
    for k, v in r0.items():
        pg.fill('#' + k, str(int(v))); pg.dispatch_event('#' + k, 'change')
    pg.wait_for_timeout(300)
    assert pg.is_hidden('#projekt-utanfor')

    # --- en annan flik ändrar samma projekt
    pg2 = ctx.new_page(); pg2.on('pageerror', lambda e: logg.append(f'PAGEERROR 2: {e}'))
    pg2.goto(APP); pg2.wait_for_timeout(800)
    pg2.evaluate("document.getElementById('projekt-senaste').open = true"); pg2.wait_for_timeout(300)
    pg2.locator('#projekt-lista button', has_text='Staren 2').filter(has_not_text='kopia').first.click(); pg2.wait_for_timeout(800)
    pg2.fill('#projekt', 'Staren 2 från flik 2'); pg2.dispatch_event('#projekt', 'input'); pg2.wait_for_timeout(1200)
    pg.wait_for_timeout(300)
    print('annan flik:', pg.locator('#projekt-status').inner_text(), '| knapp syns:', pg.is_visible('#projekt-las-igen'))
    assert pg.is_visible('#projekt-las-igen')
    pg.click('#projekt-las-igen'); pg.wait_for_timeout(800)
    assert pg.input_value('#projekt') == 'Staren 2 från flik 2'
    pg2.close()

    # --- Sparat i webbläsaren: projekten med storlek, ta bort ett
    pg.click('#flik-underlag')
    pg.evaluate("document.getElementById('g-sparat').open = true"); pg.wait_for_timeout(500)
    rader = pg.locator('#lagring-projekt li').all_inner_texts()
    print('sparat i webbläsaren:', [r.replace('\n', ' | ') for r in rader])
    assert len(rader) == 3
    pg.screenshot(path=f'{UT}/p05_sparat.png')
    pg.once('dialog', lambda dlg: dlg.accept())
    pg.locator('#lagring-projekt li', has_text='Ladan').locator('button').click(); pg.wait_for_timeout(500)
    assert len(alla(pg)) == 2

    # --- ren JSON går också att öppna (samma id: frågan, behåll webbläsarens)
    open(f'{UT}/projekt.json', 'w').write(json.dumps(pj))
    pg.click('#flik-plats')
    pg.set_input_files('#projekt-fil', f'{UT}/projekt.json'); pg.wait_for_timeout(600)
    assert pg.locator('#projektdialog').is_visible()
    pg.click('#pd-webb'); pg.wait_for_timeout(600)
    assert pg.input_value('#projekt') == 'Staren 2 från flik 2'
    # en fil från en nyare version
    nyare = dict(pj, version=99)
    open(f'{UT}/nyare.json', 'w').write(json.dumps(nyare))
    pg.set_input_files('#projekt-fil', f'{UT}/nyare.json'); pg.wait_for_timeout(400)
    print('nyare version:', pg.locator('#status-text').inner_text())
    assert 'nyare version' in pg.locator('#status-text').inner_text()

    # --- flytten från sessionStorage (före 0.13.0) i en ny flik utan projekt
    ctx2 = b.new_context(viewport={'width': 1400, 'height': 900})
    gammal_vol = {'epsg': 3009, 'volymer': [{'id': 'dxf1', 'namn': 'Garage', 'fotavtryck': [[c[0], c[1]], [c[0] + 7, c[1]], [c[0] + 7, c[1] + 6], [c[0], c[1] + 6]], 'golv': None, 'takfot': 3, 'takform': 'sadel', 'taklutning': 27, 'nockriktning': None}]}
    gammal_sek = [{'namn': 'A', 'a': [58.0, 15.6], 'b': [58.001, 15.602], 'vand': False}]
    ctx2.add_init_script(INIT + f"""
      if (!sessionStorage.getItem('flyttest')) {{
        sessionStorage.setItem('flyttest', '1');
        sessionStorage.setItem('terrang-volymer', {json.dumps(json.dumps(gammal_vol))});
        sessionStorage.setItem('terrang-sektioner', {json.dumps(json.dumps(gammal_sek))});
        sessionStorage.setItem('terrang-projektid', '"gammalt-id"');
        localStorage.setItem('terrang-utsnitt', {json.dumps(json.dumps({'epsg': 3009, 'r': {k: int(v) for k, v in r0.items()}, 'projekt': 'Gamla'}))});
      }}""")
    pg3 = ctx2.new_page(); pg3.on('pageerror', lambda e: logg.append(f'PAGEERROR 3: {e}'))
    pg3.goto(APP); pg3.wait_for_timeout(1500)
    a3 = pg3.evaluate("Projekt.dbAlla().then(a => a.map(p => ({ id: p.id, namn: p.namn, antal: p.antal, golv: p.data.inmatning.volymer[0] && p.data.inmatning.volymer[0].golv })))")
    print('flytten:', a3, '|', pg3.locator('#status-text').inner_text())
    assert len(a3) == 1 and a3[0]['id'] == 'gammalt-id' and a3[0]['namn'] == 'Gamla' and a3[0]['antal']['volymer'] == 1 and a3[0]['antal']['sektioner'] == 1 and a3[0]['golv'] is None
    assert pg3.evaluate("sessionStorage.getItem('terrang-volymer')") is None
    pg3.reload(); pg3.wait_for_timeout(1200)
    assert len(pg3.evaluate("Projekt.dbAlla()")) == 1 and pg3.locator('#volymlista li').count() == 1, 'flyttas bara en gång'
    ctx2.close()

    fel = [x for x in logg if 'PAGEERROR' in x or ('error' in x and '404' not in x and 'Failed to load' not in x and 'ERR_FAILED' not in x)]
    print('fel:', fel)
    assert not [x for x in logg if 'PAGEERROR' in x], 'inga sidfel'
    print('projekt_test: ok')
    b.close()
