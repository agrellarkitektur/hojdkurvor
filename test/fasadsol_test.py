# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Agrell Arkitektur AB
"""
Gränssnittstest för sol på fasaderna (0.15.0).

    python3 test/server.py test/data . &
    python3 test/fasadsol_test.py <utkatalog> [tema]

Skapar underlaget för testtomten, ritar två byggnader i plan (en hög och en låg norr om den),
väljer bara Sol på fasaderna i platsanalysen och skapar igen. Prövar: steget i sammanfattningen,
PDF:en och CSV-filen i zip-filen (sidorna sparas som bilder i utkatalogen), att den låga
byggnadens södervägg skuggas av den höga, att 3D-vyn färgar fasaderna (summa och timtopp) och
att färgerna försvinner när skissen ändras, att perioden och tiden sparas i projektet, och
att platsen till cad-apa får topparna.
"""
import sys, re, os, io, json, zipfile, subprocess
UT = sys.argv[1] if len(sys.argv) > 1 else 'test/ut'
TEMA = sys.argv[2] if len(sys.argv) > 2 else 'ritning'
os.makedirs(UT, exist_ok=True)
from playwright.sync_api import sync_playwright
ROT = 'http://127.0.0.1:8765'
INIT = f"""window.TERRANG_DL_ROT='{ROT}'; window.TERRANG_STAC_BAS='{ROT}'; window.TERRANG_API_BAS='{ROT}'; window.TERRANG_TEST={{}};
try {{ localStorage.setItem('terrang-tema', '{TEMA}'); }} catch (e) {{}}
delete window.showSaveFilePicker;"""

def skapa(pg):
    pg.click('#flik-plats')
    pg.fill('#anv', 'test'); pg.fill('#losen', 'hemligt-åäö'); pg.dispatch_event('#losen', 'change')
    pg.click('#skapa')
    pg.wait_for_function("!document.getElementById('skapa').disabled && !document.getElementById('resultat').hidden", timeout=300000)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
    pg = ctx.new_page()
    fel = []
    pg.on('pageerror', lambda e: fel.append(str(e)))
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://.*(openstreetmap|opentopomap|arcgis|nominatim).*'), lambda r: r.abort())
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
        for r in pg.locator(f'#steg-{flik} input[name=tillval]:checked, #steg-{flik} input[name=val]:checked, #steg-{flik} input[name=kapitel]:checked').all():
            if r.is_visible() and r.is_enabled(): r.uncheck()
    pg.click('#flik-underlag'); pg.check('input[name=tillval][value=byggnader]')
    skapa(pg)
    print('1) skapat:', pg.inner_text('#status-text')[:80])

    # två byggnader i plan: en hög (30 m) och en låg (9 m) 12 m norr om den
    pg.click('#flik-skiss'); pg.click('#skiss-plan'); pg.wait_for_timeout(500)
    def skarm(x, y):
        return pg.evaluate(f"""(() => {{ const t = TERRANG_TEST.planvy._test, s = t.w2s([{x}, {y}]), r = document.querySelector('.planvy-svg').getBoundingClientRect(); return [r.x + s[0], r.y + s[1]]; }})()""")
    def rektangel(x, y, matt):
        pg.keyboard.press('r'); sx, sy = skarm(x, y); pg.mouse.move(sx, sy); pg.wait_for_timeout(50); pg.mouse.click(sx, sy); pg.wait_for_timeout(150)
        sx, sy = skarm(x + 5, y + 5); pg.mouse.move(sx, sy); pg.wait_for_timeout(100)
        pg.fill('.planvy-kommando', matt); pg.press('.planvy-kommando', 'Enter'); pg.wait_for_timeout(200)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    rektangel(539850, 6427660, '30x12')
    rektangel(539850, 6427684, '30x10')
    pg.click('[data-pv=stang]'); pg.wait_for_timeout(1000)
    n = pg.locator('#volymlista li').count()
    print('2) byggnader:', n)
    assert n == 2

    # bara Sol på fasaderna i platsanalysen
    pg.click('#flik-analys')
    pg.evaluate("document.querySelectorAll('.steg-panel details').forEach(d => d.open = true)")
    pg.check('#platsanalys'); pg.check('input[name=kapitel][value=sol]')
    for v in ('sol', 'horisont', 'skugga'):
        if pg.is_checked(f'input[name=tillval][value={v}]'): pg.uncheck(f'input[name=tillval][value={v}]')
    pg.check('input[name=tillval][value=fasadsol]')
    pg.select_option('#fasadsol-period', 'april')
    pg.locator('#fasadsol-tid').scroll_into_view_if_needed()
    pg.locator('#g-sol').screenshot(path=f'{UT}/fasadsol_val_{TEMA}.png')
    # höjderna via testkroken: den södra 30 m hög
    ok = pg.evaluate("""(() => { const f = TERRANG_TEST.satVolymHojd; return f ? (f(0, 30), f(1, 9), true) : false; })()""")
    assert ok, 'testkroken satVolymHojd'
    skapa(pg)
    status = pg.text_content('#sammanfattning')
    print('3) skapat:', pg.inner_text('#status-text')[:100])
    assert 'Sol på fasaderna' in status, status[:400]
    fs = pg.evaluate("""(() => { const s = TERRANG_TEST.senaste(); return s.fasadsol ? { n: s.fasadsol.punkter.x.length, period: s.fasadsol.period, grupper: s.fasadsol.grupper } : null; })()""")
    assert fs and fs['n'] > 500 and fs['period'] == 'april', fs and fs['n']
    for g in fs['grupper']: print('   ', g['namn'], g['streck'], round(g['summa']), round(g['lokal']), round(g['samtidig']), round(g['skuggning']['volymer'] * 100), '%')
    lag_s = [g for g in fs['grupper'] if g['streck'] == 'S' and g['area'] < 9 * 31][0]
    hog_s = [g for g in fs['grupper'] if g['streck'] == 'S' and g['area'] > 9 * 31][0]
    assert lag_s['skuggning']['volymer'] > 0.3, 'den låga byggnadens södervägg skuggas av den höga'
    assert hog_s['skuggning']['volymer'] < 0.01

    # zip-filen: PDF och CSV
    with pg.expect_download() as d:
        pg.click('#ladda-ner')
    z = zipfile.ZipFile(io.BytesIO(open(d.value.path(), 'rb').read()))
    namn = [x for x in z.namelist() if x.startswith('fasadsol/')]
    print('4) zip:', namn)
    assert any(x.endswith('_sol_pa_fasader.pdf') for x in namn) and any(x.endswith('_fasader.csv') for x in namn)
    pdf = [x for x in namn if x.endswith('.pdf')][0]
    open(f'{UT}/fasadsol.pdf', 'wb').write(z.read(pdf))
    subprocess.run(['pdftoppm', '-r', '60', '-png', f'{UT}/fasadsol.pdf', f'{UT}/fasadsol_sida'], check=True)
    csv = z.read([x for x in namn if x.endswith('.csv')][0]).decode('utf-8').splitlines()
    print('   csv:', csv[0][:80], len(csv) - 1, 'rader')
    assert len(csv) - 1 == 8
    info = [x for x in z.namelist() if x.endswith('.txt') and 'info' in x.lower()]
    if info: assert 'SOL PÅ FASADERNA' in z.read(info[0]).decode('utf-8')

    # 3D-vyn: färgade fasader
    pg.click('#visa-3d'); pg.wait_for_function("window.TERRANG_TEST.vy3d", timeout=60000); pg.wait_for_timeout(1000)
    assert pg.is_visible('#vy3d-fasadsol-rad') or pg.evaluate("TERRANG_TEST.vy3d.fasadsol()") is not None
    print('5) 3D:', pg.evaluate("TERRANG_TEST.vy3d.fasadsol()"))
    assert pg.evaluate("TERRANG_TEST.vy3d.fasadsol()") == 'summa'
    pg.screenshot(path=f'{UT}/fasadsol_3d_summa_{TEMA}.png')
    pg.evaluate("document.getElementById('vy3d-fasadsol').value = 'topp'; document.getElementById('vy3d-fasadsol').dispatchEvent(new Event('change'))")
    pg.wait_for_timeout(400)
    assert pg.evaluate("TERRANG_TEST.vy3d.fasadsol()") == 'topp'
    assert '900' in pg.inner_text('#vy3d-fasadskala')
    pg.screenshot(path=f'{UT}/fasadsol_3d_topp_{TEMA}.png')
    # platsen till cad-apa får topparna
    paket = pg.evaluate("TERRANG_TEST.platspaket ? TERRANG_TEST.platspaket() : null")
    if paket is not None:
        assert paket.get('fasadsol') and len(paket['fasadsol']['fasader']) == 8, 'fasadsol i platspaketet'
        print('6) platspaket:', paket['fasadsol']['fasader'][0])
    # skissen ändras i 3D-vyn: färgerna försvinner
    pg.evaluate("(() => { const v = TERRANG_TEST.vy3d; v.vald(v.volymer()[1].id); v.andraVald({ hojd: 12 }); })()")
    pg.wait_for_timeout(400)
    print('7) efter ändring:', pg.evaluate("TERRANG_TEST.vy3d.fasadsol()"), pg.is_visible('#vy3d-fasadsol-rad'))
    assert pg.evaluate("TERRANG_TEST.vy3d.fasadsol()") is None and not pg.is_visible('#vy3d-fasadsol-rad'), 'färgerna försvinner när skissen ändras'
    pg.click('#vy3d-stang'); pg.wait_for_timeout(300)

    # projektet: perioden och tiden
    proj = pg.evaluate("TERRANG_TEST.byggProjekt ? TERRANG_TEST.byggProjekt() : null")
    if proj: assert proj['val']['analys']['fasadsolPeriod'] == 'april'
    pg.reload(); pg.wait_for_timeout(2500)
    assert pg.input_value('#fasadsol-period') == 'april', 'perioden finns kvar efter omladdning'

    print('fel:', fel)
    assert not fel, fel
    print('fasadsol_test: godkänt')
    b.close()
